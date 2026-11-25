#!/usr/bin/env python3
"""Focused tests for the reproducible Yaak export."""

import copy
import json
import re
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import yaak_collection as generator


class YaakCollectionTest(unittest.TestCase):
    def setUp(self):
        self.spec = {
            "openapi": "3.0.0",
            "components": {"securitySchemes": {
                "bearer": {"type": "http", "scheme": "bearer"},
                "yandexEdaBearer": {"type": "http", "scheme": "bearer"},
            },
                           "schemas": {
                "Nested": {"type": "object", "required": ["id"],
                           "properties": {"id": {"type": "string", "example": "sample-id"}}},
                "Payload": {"type": "object", "required": ["nested"],
                            "properties": {"nested": {"$ref": "#/components/schemas/Nested"}}},
            }},
            "paths": {
                "/client/orders/{id}": {"get": {
                    "summary": "Show order", "security": [{"bearer": []}],
                    "parameters": [{"name": "id", "in": "path", "required": True,
                                    "schema": {"type": "string"}}],
                    "responses": {"200": {"description": "ok"}},
                }},
                "/client/cart": {"post": {
                    "summary": "Add", "requestBody": {"content": {"application/json": {
                        "schema": {"$ref": "#/components/schemas/Payload"}
                    }}}, "security": [{"bearer": []}, {}],
                    "responses": {"200": {"description": "ok"}},
                }},
                "/integrations/yandex-eda/restaurants": {"get": {
                    "security": [{"yandexEdaBearer": []}],
                    "responses": {"200": {"description": "ok"}},
                }},
            },
        }

    def test_required_nested_examples_and_auth(self):
        bundle = generator.make_bundle(self.spec)
        self.assertEqual(generator.verify(self.spec, bundle), 3)
        requests = {(r["method"], r["name"].split(" ", 1)[1]): r
                    for r in bundle["resources"]["httpRequests"]}
        body_request = requests[("POST", "/client/cart")]
        self.assertEqual(body_request["bodyType"], "application/json")
        self.assertIn("sample-id", body_request["body"]["text"])
        self.assertIn({"enabled": True, "name": "Content-Type", "value": "application/json"},
                      body_request["headers"])
        self.assertIsNone(body_request["authenticationType"])
        self.assertIn({"enabled": False, "name": "Authorization", "value": "Bearer ${[ access_token ]}"},
                      body_request["headers"])
        order_request = requests[("GET", "/client/orders/{id}")]
        self.assertEqual(order_request["authenticationType"], "bearer")
        self.assertIn("behavior='never'", order_request["urlParameters"][0]["value"])
        yandex = requests[("GET", "/integrations/yandex-eda/restaurants")]
        self.assertEqual(yandex["authentication"]["token"], "${[ yandex_access_token ]}")

    def test_deterministic_output_and_drift(self):
        original = copy.deepcopy(self.spec)
        first = generator.make_bundle(self.spec)
        self.assertEqual(first, generator.make_bundle(self.spec))
        self.assertEqual(self.spec, original)
        changed = copy.deepcopy(first)
        changed["resources"]["httpRequests"].pop()
        with self.assertRaisesRegex(ValueError, "request drift"):
            generator.verify(self.spec, changed)

    def test_environment_contains_no_credentials(self):
        local = generator.make_bundle(self.spec, "local")["resources"]["environments"]
        staging = generator.make_bundle(self.spec, "staging")["resources"]["environments"]
        self.assertEqual([e["name"] for e in local], ["Local"])
        self.assertEqual([e["name"] for e in staging], ["Staging"])
        self.assertEqual(staging[0]["variables"][0]["value"], "")
        self.assertFalse(local[0]["public"] or staging[0]["public"])
        variables = {item["name"]: item["value"] for item in local[0]["variables"]}
        self.assertIn("behavior='never'", variables["refresh_token"])
        self.assertIn("behavior='never'", variables["yandex_access_token"])

    def test_hyphenated_header_has_defined_variable(self):
        self.spec["paths"]["/client/orders/{id}"]["get"]["parameters"].append({
            "name": "If-None-Match", "in": "header", "schema": {"type": "string"}
        })
        bundle = generator.make_bundle(self.spec)
        self.assertEqual(generator.verify(self.spec, bundle), 3)
        variables = {item["name"] for item in bundle["resources"]["environments"][0]["variables"]}
        self.assertIn("if_none_match", variables)
        request = next(request for request in bundle["resources"]["httpRequests"]
                       if request["name"] == "GET /client/orders/{id}")
        self.assertIn({"enabled": False, "name": "If-None-Match", "value": "${[ if_none_match ]}"},
                      request["headers"])

    def test_refresh_uses_editable_token_variable(self):
        operation = {"requestBody": {"content": {"application/json": {
            "schema": {"type": "object", "required": ["refresh_token"],
                       "properties": {"refresh_token": {"type": "string"}}}
        }}}}
        _, body = generator.body_for(operation, self.spec, "/client/auth/refresh")
        self.assertEqual(json.loads(body["text"])["refresh_token"], "${[ refresh_token ]}")

    def test_profiles_have_disjoint_requests_and_local_chains(self):
        local = generator.make_bundle(self.spec, "local")
        staging = generator.make_bundle(self.spec, "staging")
        local_ids = {r["id"] for r in local["resources"]["httpRequests"]}
        staging_ids = {r["id"] for r in staging["resources"]["httpRequests"]}
        self.assertFalse(local_ids & staging_ids)
        self.assertNotEqual(local["resources"]["workspaces"][0]["id"],
                            staging["resources"]["workspaces"][0]["id"])
        for bundle, foreign_ids in ((local, staging_ids), (staging, local_ids)):
            text = json.dumps(bundle)
            references = set(re.findall(r"request='(rq_[^']+)'", text))
            self.assertNotIn("behavior='smart'", text)
            self.assertNotIn("behavior='always'", text)
            self.assertFalse(references & foreign_ids)

    def test_form_body_and_schema_minima(self):
        operation = {
            "requestBody": {"content": {"application/x-www-form-urlencoded": {
                "schema": {"type": "object", "required": ["client_id", "client_secret", "count"],
                           "properties": {
                               "client_id": {"type": "string", "minLength": 3},
                               "client_secret": {"type": "string"},
                               "count": {"type": "integer", "exclusiveMinimum": 2},
                           }}
            }}}
        }
        mime, body = generator.body_for(operation, self.spec, "/integrations/yandex-eda/security/oauth/token")
        self.assertEqual(mime, "application/x-www-form-urlencoded")
        self.assertEqual({entry["name"]: entry["value"] for entry in body["form"]}, {
            "client_id": "${[ client_id ]}",
            "client_secret": "${[ client_secret ]}",
            "count": "3",
        })

    def test_order_starter_omits_contextual_optional_fields(self):
        operation = {"requestBody": {"content": {"application/json": {"schema": {
            "type": "object", "required": ["cart_id", "branch_id"],
            "properties": {
                "cart_id": {"type": "string"}, "branch_id": {"type": "string"},
                "cook_by": {"type": "string", "example": "2026-01-01T00:00:00Z"},
                "spend_points": {"type": "integer", "example": 100},
            }
        }}}}}
        _, body = generator.body_for(operation, self.spec, "/client/orders")
        values = json.loads(body["text"])
        self.assertEqual(values["fulfillment_type"], "pickup")
        self.assertEqual(values["payment_method"], "cash")
        self.assertEqual(values["customer_phone"], "${[ customer_phone ]}")
        self.assertNotIn("cook_by", values)
        self.assertNotIn("spend_points", values)

    def test_sync_rejects_an_unmanaged_workspace_id(self):
        with tempfile.TemporaryDirectory() as directory:
            bundle = Path(directory) / "bundle.json"
            bundle.write_text(json.dumps(generator.make_bundle(self.spec)))
            with patch.object(generator, "yaak_run", return_value=json.dumps({"description": "My work"})):
                with self.assertRaisesRegex(SystemExit, "does not belong"):
                    generator.sync(bundle, "wk_custom")

    def test_inventory_gate_rejects_missing_contracts(self):
        count = len(generator.operations(self.spec))
        generator.verify_inventory(self.spec, {"x-delivest-contract-coverage": {
            "routeCount": count, "undocumentedCount": 0,
        }})
        with self.assertRaisesRegex(ValueError, "incomplete public contract"):
            generator.verify_inventory(self.spec, {"x-delivest-contract-coverage": {
                "routeCount": count + 1, "undocumentedCount": 1,
            }})

    def test_smoke_rejects_nonlocal_or_foreign_environment(self):
        def cli(args):
            if args == ["workspace", "list"]:
                return "wk_local - Delivest API · Local\n"
            if args == ["workspace", "show", "wk_local"]:
                return json.dumps({"id": "wk_local", "description": generator.MARKER + ":local"})
            if args[0:2] == ["environment", "show"]:
                return json.dumps({"workspaceId": "wk_local", "variables": [
                    {"name": "base_url", "value": "https://staging.example.test", "enabled": True}
                ]})
            self.fail(f"unexpected CLI command: {args}")
        with patch.object(generator, "yaak_run", side_effect=cli):
            with self.assertRaisesRegex(SystemExit, "localhost HTTP"):
                generator.smoke("ev_stage")
        with patch.object(generator, "yaak_run", side_effect=lambda args: (
            json.dumps({"workspaceId": "wk_foreign"}) if args[0:2] == ["environment", "show"]
            else cli(args))):
            with self.assertRaisesRegex(SystemExit, "another workspace"):
                generator.smoke("ev_foreign")

    def test_smoke_sends_only_two_managed_gets(self):
        requests = {path: {"id": f"rq_{index}", "workspaceId": "wk_local",
                           "name": f"GET {path}", "method": "GET",
                           "url": generator.BASE + path,
                           "settingFollowRedirects": {"enabled": True, "value": False}}
                    for index, path in enumerate(("/health", "/client/capabilities"))}
        sent = []
        def cli(args):
            if args == ["workspace", "list"]:
                return "wk_local - Delivest API · Local\n"
            if args == ["workspace", "show", "wk_local"]:
                return json.dumps({"id": "wk_local", "description": generator.MARKER + ":local"})
            if args == ["environment", "show", "ev_smoke"]:
                return json.dumps({"workspaceId": "wk_local", "variables": [
                    {"name": "base_url", "value": "http://127.0.0.1:4318", "enabled": True}
                ]})
            if args == ["request", "list", "wk_local"]:
                return "rq_0 - GET GET /health\nrq_1 - GET GET /client/capabilities\n"
            if args[0:2] == ["request", "show"]:
                return json.dumps(requests["/health" if args[2] == "rq_0" else "/client/capabilities"])
            if args[0] == "send":
                sent.append(args)
                path = "/health" if args[-1] == "rq_0" else "/client/capabilities"
                body = ({"status": "ok", "app": "delivest"} if path == "/health"
                        else {"api_version": 1, "money_unit": "kopeck"})
                return ("* Setting redirects=false\n> GET http://127.0.0.1:4318" + path +
                        "\n< HTTP/1.1 200 OK\n< content-type: application/json\n" + json.dumps(body))
            self.fail(f"unexpected CLI command: {args}")
        with patch.object(generator, "yaak_run", side_effect=cli):
            generator.smoke("ev_smoke")
        self.assertEqual([args[-1] for args in sent], ["rq_0", "rq_1"])


if __name__ == "__main__":
    unittest.main()

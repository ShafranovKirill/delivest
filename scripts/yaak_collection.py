#!/usr/bin/env python3
"""Generate, verify, and import the Delivest Yaak workspace from public OpenAPI."""

import argparse
import copy
import hashlib
import json
import os
import re
import shutil
import subprocess
from pathlib import Path
from urllib.parse import urlsplit


METHODS = {"get", "post", "put", "patch", "delete", "head", "options", "trace"}
MARKER = "delivest-openapi-generated-v1"
STAMP = "2026-01-01T00:00:00"
BASE = "${[ base_url ]}"
FOLDER_ORDER = ["Health", "Client / auth", "Client / branches", "Client / storefront",
                "Client / session", "Client / cart", "Client / orders"]


def identifier(prefix, value):
    digest = hashlib.sha256(value.encode()).hexdigest()[:16]
    return f"{prefix}_{digest}"


def workspace_id(profile):
    return identifier("wk", f"delivest-api:{profile}")


def request_id(method, path, profile="local"):
    return identifier("rq", f"{profile}:{method.upper()} {path}")


def response_value(method, path, json_path, profile="local"):
    source = request_id(method, path, profile)
    return "${[ response.body.path(request='" + source + "',path='" + json_path + "',behavior='never') ]}"


def variable_name(name):
    return re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")


def folder_name(path):
    segments = path.strip("/").split("/")
    if path in ("/health", "/ready"):
        return "Health"
    if segments[0] == "integrations":
        provider = segments[1] if len(segments) > 1 else "other"
        return f"Integrations / {provider}"
    if segments[0] == "client":
        domain = segments[1] if len(segments) > 1 else "general"
        if domain in {"branches", "auth", "cart", "orders", "storefront", "session"}:
            return f"Client / {domain}"
        return f"Client / {domain}"
    return "Other"


def resolve(schema, spec, seen=()):
    if not isinstance(schema, dict):
        return {}
    ref = schema.get("$ref")
    if not ref:
        return schema
    if ref in seen or not ref.startswith("#/components/schemas/"):
        return {}
    name = ref.rsplit("/", 1)[1]
    return resolve(spec.get("components", {}).get("schemas", {}).get(name, {}), spec, seen + (ref,))


def example(schema, spec, depth=0):
    """Use declared examples/defaults and include every required nested field."""
    schema = resolve(schema, spec)
    if depth > 12:
        return None
    if "example" in schema:
        return schema["example"]
    if "default" in schema:
        return schema["default"]
    if "enum" in schema and schema["enum"]:
        return schema["enum"][0]
    for key in ("oneOf", "anyOf", "allOf"):
        variants = schema.get(key, [])
        if variants:
            if key == "allOf":
                merged = {}
                for part in variants:
                    value = example(part, spec, depth + 1)
                    if isinstance(value, dict):
                        merged.update(value)
                return merged
            return example(variants[0], spec, depth + 1)
    kind = schema.get("type")
    if kind == "object" or "properties" in schema:
        required = set(schema.get("required", []))
        properties = schema.get("properties", {})
        return {
            name: example(prop, spec, depth + 1)
            for name, prop in sorted(properties.items())
            if name in required or "example" in prop or "default" in prop
        }
    if kind == "array":
        return [example(schema.get("items", {}), spec, depth + 1)] if schema.get("minItems", 0) else []
    if kind == "boolean":
        return False
    if kind in ("integer", "number"):
        minimum = schema.get("minimum", 0)
        exclusive = schema.get("exclusiveMinimum")
        if isinstance(exclusive, (int, float)) and not isinstance(exclusive, bool):
            return max(minimum, exclusive + 1)
        return minimum + 1 if exclusive is True else minimum
    if schema.get("format") == "uuid":
        return "00000000-0000-4000-8000-000000000000"
    if schema.get("format") in ("date-time", "date_time"):
        return "2026-01-01T00:00:00Z"
    if schema.get("format") == "date":
        return "2026-01-01"
    if schema.get("format") == "email":
        return "user@example.test"
    if schema.get("format") in ("uri", "url"):
        return "https://example.test"
    return "x" * max(1, schema.get("minLength", 0))


def parameter_value(parameter, path, profile="local"):
    name = parameter["name"]
    if name.lower() == "idempotency-key":
        return "${[ uuid.v4() ]}"
    if path == "/client/auth/call/{id}" or path.startswith("/client/auth/call/{id}/"):
        if name == "id":
            return response_value("post", "/client/auth/call", "$.data.confirmation_id", profile)
    if name == "cart_id":
        return response_value("get", "/client/cart", "$.data.id", profile)
    if name == "branch_id":
        return "${[ branch_id ]}"
    if name == "product_id":
        return "${[ product_id ]}"
    if name in {"token", "provider", "restaurant_id", "client_id", "client_secret"}:
        return "${[ " + name + " ]}"
    if name == "id" and path.startswith("/client/orders/"):
        return response_value("post", "/client/orders", "$.data.id", profile)
    if name == "order_id" and path.startswith("/client/orders/"):
        return response_value("post", "/client/orders", "$.data.id", profile)
    schema = parameter.get("schema", {})
    value = schema.get("example", parameter.get("example", ""))
    return str(value) if value != "" else "${[ " + variable_name(name) + " ]}"


def body_for(operation, spec, path, profile="local"):
    content = operation.get("requestBody", {}).get("content", {})
    if not content:
        return None, None
    mime_type = "application/json" if "application/json" in content else next(iter(content))
    media = content[mime_type]
    body = copy.deepcopy(media.get("example", example(media.get("schema", {}), spec)))
    if isinstance(body, dict):
        for key in ("client_id", "client_secret"):
            if key in body:
                body[key] = "${[ " + key + " ]}"
    if path == "/client/auth/call" and isinstance(body, dict):
        body["phone"] = "${[ customer_phone ]}"
    if path == "/client/auth/refresh" and isinstance(body, dict):
        body["refresh_token"] = "${[ refresh_token ]}"
    if path == "/client/orders" and isinstance(body, dict):
        body = {
            "cart_id": response_value("get", "/client/cart", "$.data.id", profile),
            "branch_id": "${[ branch_id ]}",
            "fulfillment_type": "pickup",
            "payment_method": "cash",
            "customer_phone": "${[ customer_phone ]}",
            "customer_name": "${[ customer_name ]}",
        }
    if mime_type == "application/json":
        return mime_type, {"text": json.dumps(body, ensure_ascii=False, indent=2)}
    if mime_type in ("application/x-www-form-urlencoded", "multipart/form-data") and isinstance(body, dict):
        return mime_type, {"form": [{"name": key, "value": str(value), "enabled": True}
                                    for key, value in sorted(body.items())]}
    return mime_type, {"text": str(body)}


def make_request(spec, method, path, operation, position, profile="local"):
    url = BASE + re.sub(r"\{([^}]+)\}", r":\1", path)
    params = []
    headers = []
    for param in operation.get("parameters", []):
        param = resolve(param, spec)
        location = param.get("in")
        if location in ("path", "query"):
            name = ":" + param["name"] if location == "path" else param["name"]
            params.append({"enabled": location == "path" or param.get("required", False),
                           "name": name, "value": parameter_value(param, path, profile)})
        elif location == "header":
            headers.append({"enabled": param.get("required", False), "name": param["name"],
                            "value": parameter_value(param, path, profile)})
    mime_type, body = body_for(operation, spec, path, profile)
    if body is not None:
        headers.append({"enabled": True, "name": "Content-Type", "value": mime_type})
    security = operation.get("security", spec.get("security", []))
    auth_scheme = None
    for alternative in security:
        for name in alternative:
            scheme = spec.get("components", {}).get("securitySchemes", {}).get(name, {})
            if scheme.get("type") == "http" and scheme.get("scheme") == "bearer":
                auth_scheme = name
            elif scheme.get("type") == "oauth2":
                auth_scheme = name
    optional_auth = any(not alternative for alternative in security)
    auth_type = "bearer" if auth_scheme and not optional_auth else None
    token_var = "yandex_access_token" if auth_scheme and "yandex" in auth_scheme.lower() else "access_token"
    if auth_scheme and optional_auth:
        headers.append({"enabled": False, "name": "Authorization",
                        "value": "Bearer ${[ " + token_var + " ]}"})
    request = {
        "model": "http_request", "id": request_id(method, path, profile),
        "workspaceId": workspace_id(profile),
        "folderId": identifier("fl", f"{profile}:{folder_name(path)}"),
        "createdAt": STAMP, "updatedAt": STAMP,
        "name": f"{method.upper()} {path}",
        "description": "\n\n".join(filter(None, [operation.get("summary", ""),
                                               operation.get("description", "")])),
        "method": method.upper(), "url": url, "urlParameters": params, "headers": headers,
        "bodyType": mime_type, "body": body or {}, "sortPriority": float(position),
        "authenticationType": auth_type,
        "authentication": {"token": "${[ " + token_var + " ]}", "prefix": "Bearer"} if auth_type else {},
    }
    if method == "get" and path in {"/health", "/client/capabilities"}:
        request["settingFollowRedirects"] = {"enabled": True, "value": False}
    return request


def operations(spec):
    return [(method, path, operation)
            for path, methods in sorted(spec.get("paths", {}).items())
            for method, operation in sorted(methods.items()) if method in METHODS]


def make_environment(profile, base_url, parameter_names):
    variables = [
        {"name": "base_url", "value": base_url, "enabled": True},
        {"name": "access_token", "value": response_value("post", "/client/auth/call/{id}/complete", "$.data.access_token", profile), "enabled": True},
        {"name": "refresh_token", "value": response_value("post", "/client/auth/call/{id}/complete", "$.data.refresh_token", profile), "enabled": True},
        {"name": "yandex_access_token", "value": response_value("post", "/integrations/yandex-eda/security/oauth/token", "$.access_token", profile), "enabled": True},
    ]
    variable_names = {entry["name"] for entry in variables}
    for key in sorted(parameter_names | {"branch_id", "product_id", "client_id", "client_secret",
                                       "customer_phone", "customer_name"}):
        if key not in variable_names:
            variables.append({"name": key, "value": "Тест" if key == "customer_name" else "",
                              "enabled": True})
    return {
        "model": "environment", "id": identifier("ev", profile),
        "workspaceId": workspace_id(profile),
        "createdAt": STAMP, "updatedAt": STAMP, "name": profile.title(), "public": False,
        "parentModel": "environment", "parentId": None, "variables": variables,
        "sortPriority": 0.0,
    }


def make_bundle(spec, profile="local"):
    if profile not in {"local", "staging"}:
        raise ValueError(f"unknown profile: {profile}")
    api_operations = operations(spec)
    folders = sorted({folder_name(path) for _, path, _ in api_operations},
                     key=lambda name: (FOLDER_ORDER.index(name), name) if name in FOLDER_ORDER
                     else (len(FOLDER_ORDER), name))
    parameter_names = {variable_name(name) for _, path, operation in api_operations
                       for name in (re.findall(r"\{([^}]+)\}", path) +
                                    [parameter.get("name", "")
                                     for parameter in operation.get("parameters", [])])
                       if variable_name(name)}
    resources = {
        "workspaces": [{"model": "workspace", "id": workspace_id(profile), "createdAt": STAMP,
                        "updatedAt": STAMP, "name": f"Delivest API · {profile.title()}",
                        "description": f"{MARKER}:{profile}",
                        "settingSendCookies": True, "settingStoreCookies": True}],
        "environments": [make_environment(profile,
                                          "http://127.0.0.1:4000" if profile == "local" else "",
                                          parameter_names)],
        "folders": [{"model": "folder", "id": identifier("fl", f"{profile}:{name}"),
                     "workspaceId": workspace_id(profile),
                     "createdAt": STAMP, "updatedAt": STAMP, "name": name,
                     "sortPriority": float(index)} for index, name in enumerate(folders)],
        "httpRequests": [make_request(spec, method, path, operation, index, profile)
                         for index, (method, path, operation) in enumerate(api_operations)],
        "grpcRequests": [], "websocketRequests": [],
    }
    return {"yaakVersion": "0.1.0", "yaakSchema": 4, "timestamp": STAMP, "resources": resources}


def verify(spec, bundle, profile="local"):
    expected = {(method.upper(), path) for method, path, _ in operations(spec)}
    actual = set()
    requests = bundle["resources"]["httpRequests"]
    variables = {item["name"] for environment in bundle["resources"]["environments"]
                 for item in environment["variables"]}
    for request in requests:
        path = request["name"].split(" ", 1)[1]
        key = (request["method"], path)
        if key in actual:
            raise ValueError(f"duplicate request: {key}")
        actual.add(key)
        if request["id"] != request_id(*key, profile):
            raise ValueError(f"unstable ID: {key}")
        if request["bodyType"] == "application/json" and not any(
            h["name"].lower() == "content-type" and h["enabled"] for h in request["headers"]
        ):
            raise ValueError(f"missing JSON Content-Type: {key}")
    if actual != expected:
        raise ValueError(f"request drift: missing={sorted(expected - actual)} extra={sorted(actual - expected)}")
    for variable in re.findall(r"\$\{\[\s*([A-Za-z_][A-Za-z_0-9]*)\s*\]\}",
                               json.dumps(bundle["resources"]["httpRequests"])):
        if variable not in variables:
            raise ValueError(f"undefined Yaak variable: {variable}")
    if bundle != make_bundle(spec, profile):
        raise ValueError("bundle differs from generated OpenAPI collection")
    return len(actual)


def verify_inventory(spec, inventory):
    coverage = inventory.get("x-delivest-contract-coverage", {})
    route_count = coverage.get("routeCount")
    undocumented = coverage.get("undocumentedCount")
    count = len(operations(spec))
    if route_count != count or undocumented != 0:
        raise ValueError(f"incomplete public contract: routes={route_count}, "
                         f"documented={count}, gaps={undocumented}")


def cli_command():
    found = shutil.which("yaak")
    if not found and (Path.home() / ".local/bin/yaak").is_file():
        found = str(Path.home() / ".local/bin/yaak")
    if found:
        command = [found]
    elif shutil.which("npm"):
        command = ["npm", "exec", "--yes", "--package=@yaakapp/cli@2026.9.1", "--", "yaak"]
    else:
        raise SystemExit("Yaak CLI missing; install yaak or npm")
    if data_dir := os.environ.get("YAAK_DATA_DIR"):
        command += ["--data-dir", data_dir]
    return command


def yaak_run(args):
    return subprocess.run(cli_command() + args, check=True, capture_output=True, text=True).stdout


def sync(bundle_path, workspace_id=None):
    workspace_id = workspace_id or None
    bundle = json.loads(Path(bundle_path).read_text())
    marker = bundle["resources"]["workspaces"][0]["description"]
    if workspace_id is None:
        ids = []
        for line in yaak_run(["workspace", "list"]).splitlines():
            match = re.match(r"^(wk_\S+) - ", line)
            if match:
                workspace = json.loads(yaak_run(["workspace", "show", match.group(1)]))
                if workspace.get("description") == marker:
                    ids.append(workspace["id"])
        if len(ids) > 1:
            raise SystemExit("multiple generated Delivest workspaces for this profile")
        workspace_id = ids[0] if ids else None
    else:
        workspace = json.loads(yaak_run(["workspace", "show", workspace_id]))
        if workspace.get("description") != marker:
            raise SystemExit("workspace ID does not belong to this generated Delivest profile")
    command = ["import", str(bundle_path)]
    if workspace_id:
        command += ["--workspace-id", workspace_id]
    print(yaak_run(command).strip())


def smoke(environment_id=None):
    environment_id = environment_id or None
    marker = f"{MARKER}:local"
    matches = []
    for line in yaak_run(["workspace", "list"]).splitlines():
        match = re.match(r"^(wk_\S+) - ", line)
        if match:
            workspace = json.loads(yaak_run(["workspace", "show", match.group(1)]))
            if workspace.get("description") == marker:
                matches.append(workspace["id"])
    if len(matches) != 1:
        raise SystemExit("yaak-smoke requires exactly one managed Local workspace")
    workspace_id = matches[0]
    if environment_id is None:
        environments = []
        for line in yaak_run(["environment", "list", workspace_id]).splitlines():
            match = re.match(r"^(ev_\S+) - Local \(environment\)$", line)
            if match:
                environments.append(match.group(1))
        if len(environments) != 1:
            raise SystemExit("yaak-smoke requires one Local environment or --environment-id")
        environment_id = environments[0]
    environment = json.loads(yaak_run(["environment", "show", environment_id]))
    if environment.get("workspaceId") != workspace_id:
        raise SystemExit("yaak-smoke environment belongs to another workspace")
    urls = [item["value"] for item in environment.get("variables", [])
            if item.get("name") == "base_url" and item.get("enabled")]
    if len(urls) != 1:
        raise SystemExit("yaak-smoke requires exactly one enabled base_url")
    url = urlsplit(urls[0])
    if url.scheme != "http" or url.hostname not in {"localhost", "127.0.0.1", "::1"} or url.username or url.password or url.path not in {"", "/"} or url.query or url.fragment:
        raise SystemExit("yaak-smoke allows only a localhost HTTP base_url")
    request_lines = yaak_run(["request", "list", workspace_id]).splitlines()
    for path in ("/health", "/client/capabilities"):
        matches = [re.match(r"^(rq_\S+) - GET GET " + re.escape(path) + r"$", line)
                   for line in request_lines]
        matches = [match.group(1) for match in matches if match]
        request = json.loads(yaak_run(["request", "show", matches[0]])) if len(matches) == 1 else None
        if not request or request.get("name") != "GET " + path or request.get("workspaceId") != workspace_id or request.get("method") != "GET" or request.get("url") != BASE + path or request.get("settingFollowRedirects") != {"enabled": True, "value": False}:
            raise SystemExit(f"missing safe managed smoke request: {path}")
        output = yaak_run(["send", "--verbose", "--environment", environment_id, request["id"]])
        lines = output.splitlines()
        status_lines = [line for line in lines if re.fullmatch(r"< HTTP/\S+ 200 .+", line)]
        expected_url = urls[0].rstrip("/") + path
        headers = [line.lower() for line in lines if line.startswith("< ")]
        body_start = max((index for index, line in enumerate(lines) if line.startswith("< ")), default=-1) + 1
        if "* Setting redirects=false" not in lines or f"> GET {expected_url}" not in lines or len(status_lines) != 1 or not any(line.startswith("< content-type: application/json") for line in headers):
            raise SystemExit(f"Yaak {path}: expected local JSON 200 without redirects")
        try:
            body = json.loads("\n".join(lines[body_start:]))
        except json.JSONDecodeError as error:
            raise SystemExit(f"Yaak {path}: invalid JSON: {error}") from error
        if not isinstance(body, dict):
            raise SystemExit(f"Yaak {path}: expected JSON object")
        if path == "/health" and (body.get("status") != "ok" or body.get("app") != "delivest"):
            raise SystemExit("Yaak /health: unexpected status/app")
        if path == "/client/capabilities" and (body.get("api_version") != 1 or body.get("money_unit") != "kopeck"):
            raise SystemExit("Yaak /client/capabilities: unexpected API fields")
        print(f"Yaak {path}: JSON 200")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=["generate", "verify", "sync", "smoke"])
    parser.add_argument("--spec", type=Path)
    parser.add_argument("--inventory", type=Path,
                        help="Scalar inventory used to require a complete public contract")
    parser.add_argument("--bundle", type=Path)
    parser.add_argument("--workspace-id")
    parser.add_argument("--environment-id")
    parser.add_argument("--profile", choices=["local", "staging"], default="local")
    args = parser.parse_args()
    if args.bundle is None:
        args.bundle = Path(f"tools/yaak/delivest-{args.profile}.yaak.json")
    if args.action == "sync":
        sync(args.bundle, args.workspace_id)
        return
    if args.action == "smoke":
        if args.profile != "local":
            parser.error("smoke supports only Local")
        smoke(args.environment_id)
        return
    if not args.spec:
        parser.error("--spec is required for generate/verify")
    spec = json.loads(args.spec.read_text())
    if args.inventory:
        verify_inventory(spec, json.loads(args.inventory.read_text()))
    if args.action == "generate":
        bundle = make_bundle(spec, args.profile)
        args.bundle.parent.mkdir(parents=True, exist_ok=True)
        args.bundle.write_text(json.dumps(bundle, ensure_ascii=False, indent=2) + "\n")
        print(f"Generated {len(bundle['resources']['httpRequests'])} Yaak requests in {args.bundle}")
    else:
        bundle = json.loads(args.bundle.read_text())
        print(f"Verified {verify(spec, bundle, args.profile)} Yaak requests for {args.profile}")


if __name__ == "__main__":
    main()

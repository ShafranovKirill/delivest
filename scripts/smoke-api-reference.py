#!/usr/bin/env python3
"""Read-only smoke check of a running local Delivest API."""

import argparse
import json
import urllib.parse
import urllib.request


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, msg, headers, newurl):
        raise SystemExit(f"unexpected redirect from {request.full_url}: {newurl}")


OPERATION_METHODS = {"get", "post", "put", "patch", "delete", "head", "options", "trace"}
OPENER = urllib.request.build_opener(NoRedirect)


def get(base_url: str, path: str):
    with OPENER.open(base_url + path, timeout=10) as response:
        return response.status, response.headers, response.read()


def verify(condition: bool, message: str):
    if not condition:
        raise SystemExit(message)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", default="http://127.0.0.1:4000")
    args = parser.parse_args()
    base_url = args.base_url.rstrip("/")
    parsed = urllib.parse.urlparse(base_url)
    if parsed.scheme != "http" or parsed.hostname not in {"127.0.0.1", "localhost", "::1"}:
        parser.error("smoke requests are limited to a local HTTP server")

    status, headers, body = get(base_url, "/health")
    health = json.loads(body)
    verify(status == 200 and "application/json" in headers["Content-Type"], "/health: expected JSON 200")
    verify(health["status"] == "ok" and health["app"] == "delivest", "/health: unexpected body")

    status, headers, body = get(base_url, "/client/capabilities")
    capabilities = json.loads(body)
    verify(status == 200 and "application/json" in headers["Content-Type"], "/client/capabilities: expected JSON 200")
    verify(capabilities["api_version"] == 1 and capabilities["money_unit"] == "kopeck", "/client/capabilities: unexpected body")

    status, headers, body = get(base_url, "/api/openapi")
    public = json.loads(body)
    verify(status == 200 and "application/json" in headers["Content-Type"], "/api/openapi: expected JSON 200")
    verify(public["openapi"].startswith("3."), "/api/openapi: invalid version")

    status, headers, body = get(base_url, "/api/scalar/openapi")
    scalar = json.loads(body)
    verify(status == 200 and "application/json" in headers["Content-Type"], "/api/scalar/openapi: expected JSON 200")
    verify(scalar["openapi"].startswith("3."), "/api/scalar/openapi: invalid version")
    operations = {
        (method, path): operation
        for path, methods in scalar["paths"].items()
        for method, operation in methods.items()
        if method in OPERATION_METHODS
    }
    public_operations = {
        (method, path): operation
        for path, methods in public["paths"].items()
        for method, operation in methods.items()
        if method in OPERATION_METHODS
    }
    coverage = scalar["x-delivest-contract-coverage"]
    verify(len(operations) == coverage["routeCount"], "/api/scalar/openapi: route count mismatch")
    verify(public_operations.keys() <= operations.keys(), "/api/scalar/openapi: public operation missing")
    verify(
        sum(operation.get("x-delivest-contract-status") == "undocumented" for operation in operations.values())
        == coverage["undocumentedCount"],
        "/api/scalar/openapi: gap count mismatch",
    )
    verify(scalar["servers"] == [{"url": "/"}], "/api/scalar/openapi: expected same-origin server")

    status, headers, body = get(base_url, "/api/reference")
    verify(status == 200 and "text/html" in headers["Content-Type"], "/api/reference: expected HTML 200")
    verify(b"@scalar/api-reference@1.84.0" in body, "/api/reference: pinned Scalar missing")
    verify(b"/api/scalar/openapi" in body, "/api/reference: Scalar spec URL missing")

    print("Local GET smoke passed: health, capabilities, public spec, Scalar spec, reference")


if __name__ == "__main__":
    main()

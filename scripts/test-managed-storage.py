#!/usr/bin/env python3
"""Opt-in isolated SeaweedFS/TLS integration check for managed media."""

import json
import os
from pathlib import Path
import socket
import subprocess
import tempfile
import time
import urllib.error
import urllib.request
import uuid


ROOT = Path(__file__).resolve().parents[1]
SEAWEED = "chrislusf/seaweedfs:4.50@sha256:c2658820e763294a9e9de7b36c81e59b879e3459148351aee4e31a126ca64860"
NGINX = "nginx:1.28-alpine@sha256:a8b39bd9cf0f83869a2162827a0caf6137ddf759d50a171451b335cecc87d236"


def run(*args, cwd=None, capture=False, quiet=False, env=None):
    return subprocess.run(args, cwd=cwd, check=True, text=True,
                          stdout=subprocess.PIPE if capture else subprocess.DEVNULL if quiet else None,
                          stderr=subprocess.DEVNULL if quiet else None, env=env).stdout


def docker_port(container, port):
    address = run("docker", "port", container, f"{port}/tcp", capture=True).strip()
    return int(address.rsplit(":", 1)[1])


def wait_for_port(port):
    for _ in range(60):
        try:
            with socket.create_connection(("127.0.0.1", port), timeout=1):
                return
        except OSError:
            time.sleep(1)
    raise RuntimeError(f"local test port {port} did not open")


def wait_for_s3(port):
    for _ in range(60):
        try:
            urllib.request.urlopen(f"http://127.0.0.1:{port}/", timeout=1).close()
            return
        except urllib.error.HTTPError:
            return  # A 403/404 is a response from the S3 gateway.
        except (OSError, urllib.error.URLError):
            time.sleep(1)
    raise RuntimeError("local S3 gateway did not become ready")


def certificates(directory):
    run("openssl", "req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "1",
        "-subj", "/CN=Delivest stage 3 test CA", "-keyout", str(directory / "ca-key.pem"),
        "-out", str(directory / "ca.pem"), cwd=directory, quiet=True)
    run("openssl", "req", "-newkey", "rsa:2048", "-nodes", "-subj", "/CN=localhost",
        "-keyout", str(directory / "key.pem"), "-out", str(directory / "server.csr"), cwd=directory, quiet=True)
    (directory / "server.ext").write_text(
        "basicConstraints=critical,CA:FALSE\n"
        "keyUsage=critical,digitalSignature,keyEncipherment\n"
        "extendedKeyUsage=serverAuth\n"
        "subjectAltName=DNS:localhost,IP:127.0.0.1\n"
    )
    run("openssl", "x509", "-req", "-in", str(directory / "server.csr"),
        "-CA", str(directory / "ca.pem"), "-CAkey", str(directory / "ca-key.pem"),
        "-CAcreateserial", "-days", "1", "-extfile", str(directory / "server.ext"),
        "-out", str(directory / "cert.pem"), cwd=directory, quiet=True)


def probe_script(directory, internal_port, public_port):
    # Paths and ports are generated locally; no customer keys or production services are read.
    text = r'''
for app <- [:ex_aws, :ex_aws_s3, :req] do
  {:ok, _} = Application.ensure_all_started(app)
end
Application.put_env(:ex_aws, :http_client, ExAws.Request.Hackney)
Application.put_env(:ex_aws, :access_key_id, "stage3-test-access")
Application.put_env(:ex_aws, :secret_access_key, "stage3-test-secret")
Application.put_env(:ex_aws, :s3, scheme: "http://", host: "127.0.0.1", port: INTERNAL_PORT, region: "us-east-1")
Application.put_env(:delivest, Delivest.Media, public_bucket: "stage3-public", private_bucket: "stage3-private", public_host: "localhost", public_scheme: "https://", public_port: PUBLIC_PORT)
Application.put_env(:delivest, :public_site_config_path, "TEST_DIR/public-site.json")
Application.put_env(:delivest, :client_origin, "https://old.example.test")
ca = File.read!("TEST_DIR/ca.pem") |> :public_key.pem_decode() |> Enum.map(&elem(&1, 1))
tls = [connect_options: [transport_opts: [cacerts: ca]], retry: false]
Application.put_env(:delivest, :managed_storage_req_options, tls)
{:ok, _} = ExAws.S3.put_bucket("stage3-public", "us-east-1") |> ExAws.request()
{:ok, _} = ExAws.S3.put_bucket("stage3-private", "us-east-1") |> ExAws.request()
{:ok, _} = Delivest.PublicSite.apply(%{"primary_url" => "https://new.example.test", "origins" => ["https://old.example.test", "https://new.example.test"]})
checks = Delivest.ManagedStorage.run!()
true = Enum.all?(~w(public_upload public_read private_signed internal_endpoint), &(checks[&1] == true))
preflight = [method: :options, url: "https://localhost:PUBLIC_PORT/stage3-public/test", headers: [{"origin", "https://new.example.test"}, {"access-control-request-method", "PUT"}, {"access-control-request-headers", "content-type"}]]
{:ok, allowed} = Req.request(Keyword.merge(preflight, tls))
true = allowed.status in 200..299
["https://new.example.test"] = Req.Response.get_header(allowed, "access-control-allow-origin")
{:ok, _} = Delivest.PublicSite.apply(%{"primary_url" => "https://old.example.test", "origins" => ["https://old.example.test"]})
"https://old.example.test" = Delivest.PublicSite.primary_url()
{:ok, denied} = Req.request(Keyword.merge(preflight, tls))
[] = Req.Response.get_header(denied, "access-control-allow-origin")
IO.puts(Jason.encode!(Map.merge(checks, %{"browser_cors" => true, "rollback" => true})))
'''
    text = text.replace("INTERNAL_PORT", str(internal_port))
    text = text.replace("PUBLIC_PORT", str(public_port))
    text = text.replace("TEST_DIR", str(directory))
    (directory / "probe.exs").write_text(text)


def main():
    suffix = uuid.uuid4().hex[:12]
    network = f"delivest-storage-test-{suffix}"
    s3 = f"{network}-s3"
    proxy = f"{network}-tls"
    created = []
    with tempfile.TemporaryDirectory(prefix="delivest-storage-test-") as temp:
        directory = Path(temp)
        os.chmod(directory, 0o755)  # container needs read access to test-only files
        certificates(directory)
        (directory / "s3.json").write_text(json.dumps({"identities": [
            {"name": "test", "credentials": [{"accessKey": "stage3-test-access", "secretKey": "stage3-test-secret"}],
             "actions": ["Admin", "Read", "List", "Tagging", "Write"]},
            {"name": "anonymous", "actions": ["Read:stage3-public"]}
        ]}))
        (directory / "nginx.conf").write_text(
            "events {}\nhttp { server { listen 443 ssl; "
            "ssl_certificate /config/cert.pem; ssl_certificate_key /config/key.pem; "
            "location / { proxy_pass http://s3:8333; proxy_set_header Host $http_host; "
            "proxy_request_buffering off; } } }\n"
        )
        try:
            run("docker", "network", "create", network, quiet=True)
            created.append(("network", network))
            run("docker", "run", "-d", "--name", s3, "--network", network, "--network-alias", "s3",
                "-p", "127.0.0.1::8333", "--tmpfs", "/data",
                "-v", f"{directory / 's3.json'}:/config/s3.json:ro",
                SEAWEED, "server", "-s3", "-s3.port=8333", "-s3.config=/config/s3.json", "-dir=/data", quiet=True)
            created.append(("container", s3))
            run("docker", "run", "-d", "--name", proxy, "--network", network,
                "-p", "127.0.0.1::443", "-v", f"{directory}:/config:ro",
                "-v", f"{directory / 'nginx.conf'}:/etc/nginx/nginx.conf:ro", NGINX, quiet=True)
            created.append(("container", proxy))
            internal_port = docker_port(s3, 8333)
            public_port = docker_port(proxy, 443)
            wait_for_port(internal_port)
            wait_for_port(public_port)
            wait_for_s3(internal_port)
            probe_script(directory, internal_port, public_port)
            run("mix", "run", "--no-start", str(directory / "probe.exs"), cwd=ROOT / "server",
                env={**os.environ, "MIX_ENV": "test"})
        finally:
            for kind, name in reversed(created):
                subprocess.run(["docker", "rm", "-f", name] if kind == "container"
                               else ["docker", "network", "rm", name],
                               stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=False)


if __name__ == "__main__":
    main()

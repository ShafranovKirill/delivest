#!/usr/bin/env python3
"""Prepare an exact published Delivest release for a manual Compose deployment."""
import argparse
import fcntl
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import urllib.request

REPOSITORY = "ShafranovKirill/delivest"
COMPONENTS = ("server", "client", "agent")
SHA = re.compile(r"[0-9a-f]{40}\Z")
DIGEST = re.compile(r"sha256:[0-9a-f]{64}\Z")
VERSION = re.compile(r"[0-9]+\.[0-9]+\.[0-9]+(?:[-+][0-9A-Za-z.-]+)?\Z")


def run(*argv):
    return subprocess.check_output(argv, text=True).strip()


def fetch_json(url):
    request = urllib.request.Request(url, headers={"Accept": "application/vnd.github+json", "User-Agent": "delivest-release-installer"})
    with urllib.request.urlopen(request, timeout=20) as response:
        if response.status != 200:
            raise RuntimeError(f"unexpected HTTP status {response.status}")
        return json.load(response)


def manifest_for(version):
    release = fetch_json(f"https://api.github.com/repos/{REPOSITORY}/releases/tags/v{version}")
    if not isinstance(release, dict):
        raise ValueError("invalid release response")
    if release.get("draft") is not False or not isinstance(release.get("published_at"), str) or release.get("tag_name") != f"v{version}":
        raise ValueError("release is not published under the selected tag")
    listed_assets = release.get("assets")
    if not isinstance(listed_assets, list):
        raise ValueError("release assets are unavailable")
    assets = [asset for asset in listed_assets if isinstance(asset, dict) and asset.get("name") == "release-manifest.json"]
    if len(assets) != 1:
        raise ValueError("release has no unique release-manifest.json asset")
    asset = assets[0]
    if not str(asset.get("url", "")).startswith(f"https://api.github.com/repos/{REPOSITORY}/releases/assets/"):
        raise ValueError("unexpected manifest asset source")
    request = urllib.request.Request(asset["url"], headers={"Accept": "application/octet-stream", "User-Agent": "delivest-release-installer"})
    with urllib.request.urlopen(request, timeout=20) as response:
        if response.status != 200:
            raise RuntimeError(f"manifest download returned HTTP {response.status}")
        data = response.read(64_001)
    if len(data) > 64_000:
        raise ValueError("manifest is too large")
    return json.loads(data)


def validate(manifest, version):
    if not isinstance(manifest, dict) or set(manifest) != {"version", "root_sha", "gitlinks", "images"} or manifest["version"] != version or not VERSION.fullmatch(version):
        raise ValueError("manifest version or shape does not match the selected release")
    if not isinstance(manifest["root_sha"], str) or not SHA.fullmatch(manifest["root_sha"]):
        raise ValueError("invalid root SHA")
    for field, regex in (("gitlinks", SHA), ("images", DIGEST)):
        entries = manifest[field]
        if not isinstance(entries, dict) or set(entries) != set(COMPONENTS):
            raise ValueError(f"invalid {field} entries")
        if not all(isinstance(entries[component], str) and regex.fullmatch(entries[component]) for component in COMPONENTS):
            raise ValueError(f"invalid {field} value")
    return {component: f"ghcr.io/shafranovkirill/delivest-{component}@{manifest['images'][component]}" for component in COMPONENTS}


def persist_refs(root, refs):
    path = root / ".env"
    content = path.read_text() if path.exists() else ""
    names = {f"DELIVEST_{component.upper()}_IMAGE" for component in COMPONENTS}
    lines = [line for line in content.splitlines() if line.partition("=")[0] not in names]
    lines.extend(f"DELIVEST_{component.upper()}_IMAGE={refs[component]}" for component in COMPONENTS)
    mode = path.stat().st_mode & 0o660 if path.exists() else 0o600
    fd, temp = tempfile.mkstemp(prefix=".env.release-", dir=root)
    try:
        os.fchmod(fd, mode)
        with os.fdopen(fd, "w") as file:
            file.write("\n".join(lines) + "\n")
            file.flush()
            os.fsync(file.fileno())
        os.replace(temp, path)
    finally:
        if os.path.exists(temp):
            os.unlink(temp)


def restore_env(root, content, mode):
    path = root / ".env"
    if content is None:
        path.unlink(missing_ok=True)
        return
    fd, temp = tempfile.mkstemp(prefix=".env.restore-", dir=root)
    try:
        os.fchmod(fd, mode)
        with os.fdopen(fd, "wb") as file:
            file.write(content)
            file.flush()
            os.fsync(file.fileno())
        os.replace(temp, path)
    finally:
        if os.path.exists(temp):
            os.unlink(temp)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("version", help="published release version, without v")
    parser.add_argument("--manifest", type=Path, help="previously downloaded manifest; must match published asset")
    parser.add_argument("--apply", action="store_true", help="recreate site services while holding the operation lock")
    args = parser.parse_args()
    if not VERSION.fullmatch(args.version):
        raise ValueError("invalid release version")
    root = Path(__file__).resolve().parent.parent
    with (root / ".delivest-operation.lock").open("a") as lock_file:
        try:
            fcntl.flock(lock_file, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError as error:
            raise RuntimeError("another site operation is running") from error
        published = manifest_for(args.version)
        manifest = json.loads(args.manifest.read_text()) if args.manifest else published
        if manifest != published:
            raise ValueError("provided manifest differs from published release asset")
        refs = validate(manifest, args.version)
        remote = run("git", "-C", str(root), "remote", "get-url", "origin")
        if remote not in ("https://github.com/ShafranovKirill/delivest.git", "git@github.com:ShafranovKirill/delivest.git"):
            raise ValueError("unexpected source repository")
        run("git", "-C", str(root), "fetch", "origin", manifest["root_sha"])
        tree = dict(line.split("\t", 1)[::-1] for line in run("git", "-C", str(root), "ls-tree", manifest["root_sha"]).splitlines())
        if any(tree.get(component) != f"160000 commit {manifest['gitlinks'][component]}" for component in COMPONENTS):
            raise ValueError("manifest gitlinks do not match root SHA")
        if run("git", "-C", str(root), "status", "--porcelain"):
            raise ValueError("checkout must be clean before manual installation")
        for ref in refs.values():
            subprocess.run(["docker", "pull", ref], check=True)
        old_head = run("git", "-C", str(root), "rev-parse", "HEAD")
        old_env = (root / ".env").read_bytes() if (root / ".env").exists() else None
        old_env_mode = (root / ".env").stat().st_mode & 0o660 if old_env is not None else 0o600
        try:
            run("git", "-C", str(root), "checkout", "--detach", manifest["root_sha"])
            run("git", "-C", str(root), "submodule", "update", "--init", "server", "client")
            persist_refs(root, refs)
            config = json.loads(subprocess.check_output(["docker", "compose", "config", "--format", "json"], cwd=root, text=True))
            if any(config.get("services", {}).get(component, {}).get("image") != refs[component] for component in COMPONENTS):
                raise ValueError("selected checkout does not resolve the release image references")
            (root / ".delivest-release-manifest.json").write_text(json.dumps(manifest, sort_keys=True) + "\n")
        except Exception:
            restore_env(root, old_env, old_env_mode)
            run("git", "-C", str(root), "checkout", "--detach", old_head)
            run("git", "-C", str(root), "submodule", "update", "--init", "server", "client")
            raise
        if args.apply:
            subprocess.run(["docker", "compose", "up", "-d", "--no-deps", "server", "client", "gateway"], cwd=root, check=True)
            subprocess.run(["docker", "compose", "restart", "gateway"], cwd=root, check=True)
        print(f"Prepared v{args.version} at {manifest['root_sha']}. Check gateway /ready and site before recording success.")


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, RuntimeError, subprocess.CalledProcessError, json.JSONDecodeError) as error:
        print(f"release preparation failed: {error}", file=sys.stderr)
        sys.exit(1)

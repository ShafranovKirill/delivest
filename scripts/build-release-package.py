#!/usr/bin/env python3
"""Package the exact Compose deployment files for a published manifest."""

import argparse
import importlib.util
import json
import gzip
from io import BytesIO
from pathlib import Path
import re
import subprocess
import tarfile

ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location("installer", ROOT / "scripts/install-release.py")
installer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(installer)


def build(manifest_path, output_dir):
    manifest = json.loads(manifest_path.read_text())
    if not isinstance(manifest, dict) or not isinstance(manifest.get("version"), str):
        raise ValueError("invalid deployment manifest")
    refs = installer.validate(manifest, manifest["version"])
    if manifest.get("schema_version") != 2:
        raise ValueError("deployment package requires manifest schema version 2")
    root_sha = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip()
    if manifest["root_sha"] != root_sha:
        raise ValueError("manifest root SHA differs from checkout")

    compose = committed_blob(root_sha, "docker-compose.yml").decode()
    for component in installer.COMPONENTS:
        variable = f"DELIVEST_{component.upper()}_IMAGE"
        pattern = rf"(?m)^([ \t]*image: )\$\{{{variable}:-[^}}\n]+\}}$"
        compose, count = re.subn(pattern, lambda match: match[1] + "${" + variable + ":-" + refs[component] + "}", compose)
        if count != 1:
            raise ValueError(f"committed Compose has no unique {variable} image default")
    files = (
        ("docker-compose.yml", compose.encode()),
        ("deploy/nginx/gateway.conf.template", committed_blob(root_sha, "deploy/nginx/gateway.conf.template")),
        ("release-manifest.json", manifest_path.read_bytes()),
    )
    output_dir.mkdir(parents=True, exist_ok=True)
    archive = output_dir / f"delivest-deploy-{manifest['version']}.tar.gz"
    with archive.open("wb") as output, gzip.GzipFile(fileobj=output, mode="wb", mtime=0) as zipped:
        with tarfile.open(fileobj=zipped, mode="w") as package:
            for target, payload in files:
                entry = tarfile.TarInfo(target)
                entry.mtime = 0
                entry.uid = entry.gid = 0
                entry.uname = entry.gname = ""
                entry.mode = 0o644
                entry.size = len(payload)
                package.addfile(entry, BytesIO(payload))
    return archive


def committed_blob(root_sha, path):
    return subprocess.check_output(["git", "show", f"{root_sha}:{path}"], cwd=ROOT)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", type=Path, default=Path("release-manifest.json"))
    parser.add_argument("--output-dir", type=Path, default=Path("dist"))
    args = parser.parse_args()
    print(build(args.manifest, args.output_dir))

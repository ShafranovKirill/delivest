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


def upgrade_metadata(report_path, manifest):
    report = json.loads(report_path.read_text())
    if report.get("candidate") != manifest:
        raise ValueError("upgrade report candidate differs from the deployment manifest")
    previous = report.get("previous")
    if report.get("status") == "baseline_only" and previous is None:
        return None
    if report.get("status") != "passed" or report.get("compatibility") not in (
        "compatible",
        "incompatible",
    ):
        raise ValueError("deployment package requires a passed upgrade report")
    if not isinstance(previous, dict) or not isinstance(previous.get("version"), str):
        raise ValueError("upgrade report is missing the previous release")
    installer.validate(previous, previous["version"])
    return {
        "base_version": previous["version"],
        "base_server_sha": previous["gitlinks"]["server"],
        "candidate_server_sha": manifest["gitlinks"]["server"],
        "compatibility": report["compatibility"],
    }


def build(manifest_path, output_dir, report_path=None):
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
    files = [
        ("docker-compose.yml", compose.encode()),
        ("deploy/nginx/gateway.conf.template", committed_blob(root_sha, "deploy/nginx/gateway.conf.template")),
        ("release-manifest.json", manifest_path.read_bytes()),
    ]
    if report_path is not None:
        metadata = upgrade_metadata(report_path, manifest)
        if metadata is not None:
            files.append(("managed-upgrade.json", json.dumps(metadata, sort_keys=True).encode() + b"\n"))
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
    parser.add_argument("--upgrade-report", type=Path)
    args = parser.parse_args()
    print(build(args.manifest, args.output_dir, args.upgrade_report))

#!/usr/bin/env python3
"""Select and validate the preceding release, then describe the upgrade gate."""
import argparse
import importlib.util
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import urllib.request

ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location('installer', ROOT / 'scripts/install-release.py')
installer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(installer)
MIGRATIONS = 'priv/repo/migrations/'


def api_releases():
    releases = []
    page = 1
    while True:
        req = urllib.request.Request(
            f'https://api.github.com/repos/{installer.REPOSITORY}/releases?per_page=100&page={page}',
            headers={'Accept': 'application/vnd.github+json', 'User-Agent': 'delivest-upgrade-gate',
                     **({'Authorization': f'Bearer {os.environ["GH_TOKEN"]}'} if os.getenv('GH_TOKEN') else {})})
        with urllib.request.urlopen(req, timeout=30) as response:
            batch = json.load(response)
        if not isinstance(batch, list):
            raise ValueError('release listing was not a list')
        releases.extend(batch)
        if len(batch) < 100:
            return releases
        page += 1


def previous_manifest(release):
    assets = release.get('assets')
    if not isinstance(assets, list):
        raise ValueError('previous release assets are unavailable')
    matches = [asset for asset in assets if isinstance(asset, dict) and asset.get('name') == 'release-manifest.json']
    if len(matches) != 1:
        raise ValueError('previous release has no unique manifest asset')
    url = matches[0].get('url', '')
    if not re.fullmatch(r'https://api\.github\.com/repos/ShafranovKirill/delivest/releases/assets/[0-9]+', url):
        raise ValueError('invalid manifest asset source')
    req = urllib.request.Request(url, headers={
        'Accept': 'application/octet-stream', 'User-Agent': 'delivest-upgrade-gate',
        **({'Authorization': f'Bearer {os.environ["GH_TOKEN"]}'} if os.getenv('GH_TOKEN') else {})})
    with urllib.request.urlopen(req, timeout=30) as response:
        content = response.read(64_001)
    if len(content) > 64_000:
        raise ValueError('previous manifest is too large')
    return json.loads(content)

def select_previous(releases, candidate):
    cv = tuple(map(int, candidate.split('.')))
    eligible = []
    for release in releases:
        if not isinstance(release, dict) or not isinstance(release.get('tag_name'), str) or not isinstance(release.get('draft'), bool) or not isinstance(release.get('prerelease'), bool):
            raise ValueError('malformed release listing entry')
        if release['draft'] or release['prerelease']:
            continue
        if not isinstance(release.get('published_at'), str):
            raise ValueError('published release has no timestamp')
        tag = release.get('tag_name', '')
        if re.fullmatch(r'v[0-9]+\.[0-9]+\.[0-9]+', tag):
            version = tag[1:]
            if tuple(map(int, version.split('.'))) < cv:
                eligible.append((tuple(map(int, version.split('.'))), version))
    return max(eligible)[1] if eligible else None


def git(*args):
    return subprocess.check_output(['git', *args], cwd=ROOT, text=True).strip()


def validate_gitlinks(manifest):
    for name, commit in manifest['gitlinks'].items():
        tree = git('ls-tree', manifest['root_sha'], name).split()
        if len(tree) != 4 or tree[:2] != ['160000', 'commit'] or tree[3] != name:
            raise ValueError(f'{name} is not a gitlink')
        actual = tree[2]
        if actual != commit:
            raise ValueError(f'{name} gitlink differs from release manifest')


def migration_diff(before, after):
    if before == after:
        return []
    if subprocess.run(['git', '-C', 'server', 'cat-file', '-e', before + '^{commit}'], cwd=ROOT).returncode:
        subprocess.run(['git', '-C', 'server', 'fetch', '--no-tags', 'origin', before], cwd=ROOT, check=True)
    subprocess.run(['git', '-C', 'server', 'cat-file', '-e', before + '^{commit}'], cwd=ROOT, check=True)
    subprocess.run(['git', '-C', 'server', 'cat-file', '-e', after + '^{commit}'], cwd=ROOT, check=True)
    output = git('-C', 'server', 'diff', '--name-status', '-M', before, after, '--', MIGRATIONS)
    result = []
    for line in output.splitlines():
        parts = line.split('\t')
        status = parts[0]
        if not re.fullmatch(r'[AMDR][0-9]*', status):
            raise ValueError(f'unexpected migration change: {line}')
        result.append({'status': status, 'paths': parts[1:]})
    return result


def policy_for(path, before, after, changes):
    policy = json.loads(path.read_text())
    if not changes:
        return 'compatible', None
    if not isinstance(policy, dict) or policy.get('base_server_sha') != before or policy.get('candidate_server_sha') != after:
        raise ValueError('migration policy must name both exact server commits')
    kind = policy.get('compatibility')
    if kind not in ('compatible', 'incompatible'):
        raise ValueError('compatibility must be compatible or incompatible')
    if kind == 'incompatible':
        for field in ('required_backup', 'restore_procedure', 'orders_after_backup'):
            if not isinstance(policy.get(field), str) or not policy[field].strip():
                raise ValueError(f'incompatible migration policy requires {field}')
    return kind, policy


def candidate_manifest(version, sha, directory):
    manifest = {'schema_version': 2, 'version': version, 'root_sha': sha, 'gitlinks': {}, 'images': {}}
    for name in installer.COMPONENTS:
        variant, digest = (directory / f'{name}.digest').read_text().strip().split()
        if variant != name:
            raise ValueError(f'{name} digest artifact has wrong variant')
        manifest['images'][name] = digest
        manifest['gitlinks'][name] = git('rev-parse', f'{sha}:{name}')
    installer.validate(manifest, version)
    validate_gitlinks(manifest)
    return manifest


def prepare(args):
    candidate = candidate_manifest(args.version, args.sha, args.digest_dir)
    releases = api_releases()
    previous_version = select_previous(releases, args.version)
    report = {'candidate': candidate, 'previous': None, 'status': 'baseline_only',
              'migration_changes': [], 'compatibility': None, 'policy': None}
    if previous_version:
        previous = previous_manifest(next(item for item in releases if item.get('tag_name') == f'v{previous_version}' and item.get('draft') is False and item.get('prerelease') is False))
        installer.validate(previous, previous_version)
        validate_gitlinks(previous)
        # Reject a mismatched tag even when its asset has valid-looking hashes.
        if git('rev-parse', f'v{previous_version}^{{commit}}') != previous['root_sha']:
            raise ValueError('previous tag does not match release manifest')
        changes = migration_diff(previous['gitlinks']['server'], candidate['gitlinks']['server'])
        kind, policy = policy_for(args.policy, previous['gitlinks']['server'], candidate['gitlinks']['server'], changes)
        report.update(previous=previous, status='upgrade_required', migration_changes=changes,
                      compatibility=kind, policy=policy)
    return report


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--version', required=True)
    parser.add_argument('--sha', required=True)
    parser.add_argument('--digest-dir', type=Path, default=Path('.'))
    parser.add_argument('--policy', type=Path, default=ROOT / 'deploy/release-upgrade-policy.json')
    parser.add_argument('--report', type=Path, required=True)
    args = parser.parse_args()
    report = {'status': 'failed', 'error': 'preparation did not complete'}
    try:
        report = prepare(args)
        print(json.dumps(report, sort_keys=True))
    except Exception as exc:
        report['error'] = str(exc)
        print(f'upgrade preparation failed: {exc}', file=sys.stderr)
        raise
    finally:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(report, indent=2, sort_keys=True) + '\n')

if __name__ == '__main__':
    main()

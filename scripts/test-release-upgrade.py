#!/usr/bin/env python3
import importlib.util
import json
from pathlib import Path
import tempfile
import subprocess
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location('upgrade', ROOT / 'scripts/release-upgrade.py')
upgrade = importlib.util.module_from_spec(spec)
spec.loader.exec_module(upgrade)
SHA1, SHA2 = 'a' * 40, 'b' * 40

class UpgradeTest(unittest.TestCase):
    def test_candidate_uses_site_only_manifest_after_legacy_release(self):
        legacy = {'version': '1.17.0', 'root_sha': SHA1,
                  'gitlinks': {name: SHA1 for name in upgrade.installer.LEGACY_COMPONENTS},
                  'images': {name: 'sha256:' + 'a' * 64 for name in upgrade.installer.LEGACY_COMPONENTS}}
        self.assertEqual(set(upgrade.installer.validate(legacy, '1.17.0')),
                         set(upgrade.installer.LEGACY_COMPONENTS))
        with tempfile.TemporaryDirectory() as directory:
            for name in upgrade.installer.COMPONENTS:
                (Path(directory) / f'{name}.digest').write_text(f'{name} sha256:{"b" * 64}\n')
            with patch.object(upgrade, 'git', return_value=SHA2), \
                 patch.object(upgrade, 'validate_gitlinks'):
                candidate = upgrade.candidate_manifest('1.18.0', SHA2, Path(directory))
        self.assertEqual(candidate['schema_version'], 2)
        self.assertEqual(set(candidate['images']), set(upgrade.installer.COMPONENTS))

    def test_previous_is_highest_published_lower_stable(self):
        releases = [{'tag_name': 'v1.16.0', 'draft': False, 'prerelease': False, 'published_at': 'now'},
                    {'tag_name': 'v1.17.0', 'draft': False, 'prerelease': False, 'published_at': 'now'},
                    {'tag_name': 'v1.18.0', 'draft': True, 'prerelease': False, 'published_at': 'now'},
                    {'tag_name': 'v1.15.0', 'draft': False, 'prerelease': False, 'published_at': 'now'}]
        self.assertEqual(upgrade.select_previous(releases, '1.18.0'), '1.17.0')
        self.assertIsNone(upgrade.select_previous([], '1.18.0'))

    def test_migration_changes_require_exact_pair_and_recovery_text(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'policy.json'
            path.write_text('{}')
            with self.assertRaisesRegex(ValueError, 'both exact'):
                upgrade.policy_for(path, SHA1, SHA2, [{'status': 'A', 'paths': ['x']}])
            path.write_text(json.dumps({'base_server_sha': SHA1, 'candidate_server_sha': SHA2,
                'compatibility': 'incompatible', 'required_backup': 'pg and files'}))
            with self.assertRaisesRegex(ValueError, 'restore_procedure'):
                upgrade.policy_for(path, SHA1, SHA2, [{'status': 'D', 'paths': ['x']}])
            self.assertEqual(upgrade.policy_for(path, SHA1, SHA2, []), ('compatible', None))

    def test_malformed_listing_fails_closed(self):
        with self.assertRaisesRegex(ValueError, 'malformed'):
            upgrade.select_previous([{'tag_name': 'v1.17.0'}], '1.18.0')

    def test_valid_policy_for_both_compatibility_modes(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'policy.json'
            base = {'base_server_sha': SHA1, 'candidate_server_sha': SHA2}
            path.write_text(json.dumps({**base, 'compatibility': 'compatible'}))
            self.assertEqual(upgrade.policy_for(path, SHA1, SHA2, [{'status': 'A', 'paths': ['x']}])[0], 'compatible')
            path.write_text(json.dumps({**base, 'compatibility': 'incompatible',
                'required_backup': 'pg and files', 'restore_procedure': 'restore both',
                'orders_after_backup': 'must be reentered'}))
            self.assertEqual(upgrade.policy_for(path, SHA1, SHA2, [{'status': 'D', 'paths': ['x']}])[0], 'incompatible')
            with self.assertRaisesRegex(ValueError, 'both exact'):
                upgrade.policy_for(path, SHA2, SHA1, [{'status': 'D', 'paths': ['x']}])

    def test_migration_diff_includes_add_modify_delete_rename(self):
        output = 'A\tpriv/repo/migrations/new.exs\nM\tpriv/repo/migrations/changed.exs\nD\tpriv/repo/migrations/old.exs\nR100\tpriv/repo/migrations/a.exs\tpriv/repo/migrations/b.exs'
        with patch.object(upgrade.subprocess, 'run') as run, patch.object(upgrade, 'git', return_value=output):
            run.return_value.returncode = 0
            changes = upgrade.migration_diff(SHA1, SHA2)
        self.assertEqual([change['status'] for change in changes], ['A', 'M', 'D', 'R100'])
        self.assertEqual(changes[-1]['paths'], ['priv/repo/migrations/a.exs', 'priv/repo/migrations/b.exs'])

    def test_candidate_rejects_invalid_digest(self):
        with tempfile.TemporaryDirectory() as directory:
            for variant in ('server', 'client'):
                (Path(directory) / f'{variant}.digest').write_text(f'{variant} bad\n')
            with patch.object(upgrade, 'git', return_value=SHA1):
                with self.assertRaisesRegex(ValueError, 'invalid images'):
                    upgrade.candidate_manifest('1.18.0', SHA1, Path(directory))

    def test_empty_published_list_is_explicit_baseline(self):
        candidate = {'version': '1.18.0', 'root_sha': SHA2,
                     'gitlinks': {}, 'images': {}}
        with patch.object(upgrade, 'candidate_manifest', return_value=candidate), \
             patch.object(upgrade, 'api_releases', return_value=[]):
            result = upgrade.prepare(type('Args', (), {'version': '1.18.0', 'sha': SHA2,
                'digest_dir': Path('.')}))
        self.assertEqual(result['status'], 'baseline_only')
        self.assertIsNone(result['previous'])

    def test_selected_release_without_manifest_fails(self):
        with self.assertRaisesRegex(ValueError, 'unique manifest'):
            upgrade.previous_manifest({'assets': []})

    def test_real_git_migration_diff_tracks_changes_only(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory)
            def git(*args):
                return subprocess.check_output(['git', '-C', str(path), *args], text=True).strip()
            subprocess.run(['git', '-C', str(path), 'init', '-q'], check=True)
            subprocess.run(['git', '-C', str(path), 'config', 'user.email', 'test@example.invalid'], check=True)
            subprocess.run(['git', '-C', str(path), 'config', 'user.name', 'Test'], check=True)
            migrations = path / 'priv/repo/migrations'
            migrations.mkdir(parents=True)
            for name in ('modify.exs', 'delete.exs', 'rename.exs'):
                (migrations / name).write_text(name)
            (path / 'outside.txt').write_text('before')
            subprocess.run(['git', '-C', str(path), 'add', '.'], check=True)
            subprocess.run(['git', '-C', str(path), 'commit', '-qm', 'before'], check=True)
            before = git('rev-parse', 'HEAD')
            (migrations / 'modify.exs').write_text('changed')
            (migrations / 'delete.exs').unlink()
            (migrations / 'rename.exs').rename(migrations / 'renamed.exs')
            (migrations / 'add.exs').write_text('added')
            (path / 'outside.txt').write_text('after')
            subprocess.run(['git', '-C', str(path), 'add', '-A'], check=True)
            subprocess.run(['git', '-C', str(path), 'commit', '-qm', 'after'], check=True)
            after = git('rev-parse', 'HEAD')
            with patch.object(upgrade, 'ROOT', path), patch.object(upgrade, 'git', side_effect=lambda *args: git(*args[2:] if args[:2] == ('-C', 'server') else args)):
                # Keep the same layout as the checkout: a nested server repository.
                server = path / 'server'
                server.symlink_to(path, target_is_directory=True)
                changes = upgrade.migration_diff(before, after)
            self.assertEqual({item['status'][0] for item in changes}, {'A', 'M', 'D', 'R'})
            self.assertTrue(all(all(name.startswith('priv/repo/migrations/') for name in item['paths']) for item in changes))

    def test_listing_failure_never_becomes_baseline(self):
        with patch.object(upgrade, 'candidate_manifest', return_value={'version': '1.18.0'}), \
             patch.object(upgrade, 'api_releases', side_effect=OSError('network unavailable')):
            with self.assertRaisesRegex(OSError, 'network unavailable'):
                upgrade.prepare(type('Args', (), {'version': '1.18.0', 'sha': SHA2, 'digest_dir': Path('.')}))

    def test_release_gate_blocks_publish(self):
        workflow = (ROOT / '.github/workflows/release.yml').read_text()
        self.assertIn('needs: [prepare, build, smoke, upgrade]', workflow)
        self.assertIn('bash scripts/release-upgrade.sh', workflow)
        self.assertIn('if: always()', workflow)

if __name__ == '__main__':
    unittest.main()

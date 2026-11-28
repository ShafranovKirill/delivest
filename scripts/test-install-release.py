#!/usr/bin/env python3
import importlib.util
import json
from pathlib import Path
import subprocess
import tarfile
import tempfile
import unittest
from unittest import mock

spec = importlib.util.spec_from_file_location("install_release", Path(__file__).with_name("install-release.py"))
installer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(installer)
package_spec = importlib.util.spec_from_file_location("build_release_package", Path(__file__).with_name("build-release-package.py"))
packager = importlib.util.module_from_spec(package_spec)
package_spec.loader.exec_module(packager)


class InstallReleaseTest(unittest.TestCase):
    def setUp(self):
        self.sha = "a" * 40
        self.digest = "sha256:" + "b" * 64
        self.manifest = {
            "version": "1.2.3", "root_sha": self.sha,
            "gitlinks": {component: self.sha for component in installer.LEGACY_COMPONENTS},
            "images": {component: self.digest for component in installer.LEGACY_COMPONENTS},
        }

    def test_strict_manifest_and_fixed_image_names(self):
        refs = installer.validate(self.manifest, "1.2.3")
        self.assertEqual(refs["server"], f"ghcr.io/shafranovkirill/delivest-server@{self.digest}")
        for bad in (None, "HEAD", 12):
            broken = json.loads(json.dumps(self.manifest))
            broken["root_sha"] = bad
            with self.assertRaises(ValueError):
                installer.validate(broken, "1.2.3")
        broken = json.loads(json.dumps(self.manifest))
        del broken["images"]["agent"]
        with self.assertRaises(ValueError):
            installer.validate(broken, "1.2.3")

    def test_version_two_manifest_contains_site_images_only(self):
        manifest = {"schema_version": 2, "version": "1.2.3", "root_sha": self.sha,
                    "gitlinks": {component: self.sha for component in installer.COMPONENTS},
                    "images": {component: self.digest for component in installer.COMPONENTS}}
        refs = installer.validate(manifest, "1.2.3")
        self.assertEqual(set(refs), {"server", "client"})
        broken = json.loads(json.dumps(manifest))
        broken["images"]["agent"] = self.digest
        with self.assertRaises(ValueError):
            installer.validate(broken, "1.2.3")

    def test_version_two_package_contains_manifest_and_agent_free_compose(self):
        manifest = {"schema_version": 2, "version": "1.2.3", "root_sha": self.sha,
                    "gitlinks": {component: self.sha for component in installer.COMPONENTS},
                    "images": {component: self.digest for component in installer.COMPONENTS}}
        with tempfile.TemporaryDirectory() as temporary:
            manifest_path = Path(temporary) / "release-manifest.json"
            manifest_path.write_text(json.dumps(manifest))
            with mock.patch.object(packager.subprocess, "check_output", return_value=self.sha):
                archive = packager.build(manifest_path, Path(temporary))
            with tarfile.open(archive) as package:
                self.assertEqual(set(package.getnames()), {"release-manifest.json", "docker-compose.yml",
                                                           "deploy/nginx/gateway.conf.template"})
                compose = package.extractfile("docker-compose.yml").read().decode()
                self.assertNotIn("  agent:", compose)
                self.assertNotIn("/var/run/docker.sock", compose)
                self.assertEqual(json.load(package.extractfile("release-manifest.json")), manifest)

    def test_persist_refs_preserves_secrets_and_is_atomic(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            path = root / ".env"
            path.write_text("SECRET=kept\nDELIVEST_SERVER_IMAGE=old\n")
            path.chmod(0o600)
            refs = installer.validate(self.manifest, "1.2.3")
            installer.persist_refs(root, refs)
            content = path.read_text()
            self.assertIn("SECRET=kept", content)
            self.assertEqual(content.count("DELIVEST_SERVER_IMAGE="), 1)
            self.assertIn(refs["agent"], content)
            self.assertEqual(path.stat().st_mode & 0o777, 0o600)

    def test_bad_compose_config_restores_checkout_and_env(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            (root / "scripts").mkdir()
            (root / ".env").write_text("SECRET=kept\n")
            calls = []

            def fake_run(*argv):
                calls.append(argv)
                if "get-url" in argv:
                    return "https://github.com/ShafranovKirill/delivest.git"
                if "ls-tree" in argv:
                    return "\n".join(f"160000 commit {self.sha}\t{component}" for component in installer.LEGACY_COMPONENTS)
                if "rev-parse" in argv:
                    return "c" * 40
                return ""

            with mock.patch.object(installer, "__file__", str(root / "scripts" / "install-release.py")), \
                 mock.patch.object(installer, "manifest_for", return_value=self.manifest), \
                 mock.patch.object(installer, "run", side_effect=fake_run), \
                 mock.patch.object(installer.subprocess, "run"), \
                 mock.patch.object(installer.subprocess, "check_output", return_value=json.dumps({"services": {}})), \
                 mock.patch("sys.argv", ["install-release.py", "1.2.3"]):
                with self.assertRaisesRegex(ValueError, "does not resolve"):
                    installer.main()

            self.assertEqual((root / ".env").read_text(), "SECRET=kept\n")
            self.assertIn(("git", "-C", str(root), "fetch", "--no-recurse-submodules", "origin", self.sha), calls)
            self.assertIn(("git", "-C", str(root), "checkout", "--detach", "c" * 40), calls)
            self.assertEqual(sum(argv[-4:] == ("--init", "server", "client", "agent") for argv in calls), 2)

    def test_registry_failure_never_changes_checkout_or_env(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            (root / "scripts").mkdir()
            (root / ".env").write_text("SECRET=kept\n")
            calls = []

            def fake_run(*argv):
                calls.append(argv)
                if "get-url" in argv:
                    return "https://github.com/ShafranovKirill/delivest.git"
                if "ls-tree" in argv:
                    return "\n".join(f"160000 commit {self.sha}\t{component}" for component in installer.LEGACY_COMPONENTS)
                return ""

            with mock.patch.object(installer, "__file__", str(root / "scripts" / "install-release.py")), \
                 mock.patch.object(installer, "manifest_for", return_value=self.manifest), \
                 mock.patch.object(installer, "run", side_effect=fake_run), \
                 mock.patch.object(installer.subprocess, "run", side_effect=installer.subprocess.CalledProcessError(1, "docker pull")), \
                 mock.patch("sys.argv", ["install-release.py", "1.2.3"]):
                with self.assertRaises(installer.subprocess.CalledProcessError):
                    installer.main()

            self.assertEqual((root / ".env").read_text(), "SECRET=kept\n")
            self.assertFalse(any("checkout" in argv for argv in calls))

    def test_apply_failure_keeps_previous_configuration_snapshot(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            (root / "scripts").mkdir()
            old_env = b"SECRET=kept\nDELIVEST_SERVER_IMAGE=previous\n"
            (root / ".env").write_bytes(old_env)
            (root / ".env").chmod(0o600)
            previous_head = "c" * 40
            refs = installer.validate(self.manifest, "1.2.3")

            def fake_run(*argv):
                if "checkout" in argv:
                    self.assertEqual(len(list((root / ".delivest-manual-release").iterdir())), 1)
                if "get-url" in argv:
                    return "https://github.com/ShafranovKirill/delivest.git"
                if "ls-tree" in argv:
                    return "\n".join(f"160000 commit {self.sha}\t{component}" for component in installer.LEGACY_COMPONENTS)
                if "rev-parse" in argv:
                    return previous_head
                return ""

            def fake_docker(argv, **kwargs):
                if argv[:3] == ["docker", "compose", "up"]:
                    raise installer.subprocess.CalledProcessError(1, argv)

            config = {"services": {component: {"image": ref} for component, ref in refs.items()}}
            with mock.patch.object(installer, "__file__", str(root / "scripts" / "install-release.py")), \
                 mock.patch.object(installer, "manifest_for", return_value=self.manifest), \
                 mock.patch.object(installer, "run", side_effect=fake_run), \
                 mock.patch.object(installer.subprocess, "run", side_effect=fake_docker), \
                 mock.patch.object(installer.subprocess, "check_output", return_value=json.dumps(config)), \
                 mock.patch("sys.argv", ["install-release.py", "1.2.3", "--apply"]):
                with self.assertRaises(installer.subprocess.CalledProcessError):
                    installer.main()

            snapshots = list((root / ".delivest-manual-release").iterdir())
            self.assertEqual(len(snapshots), 1)
            snapshot = snapshots[0]
            self.assertEqual(snapshot.stat().st_mode & 0o777, 0o700)
            self.assertEqual((snapshot / "previous.env").read_bytes(), old_env)
            self.assertEqual((snapshot / "previous.env").stat().st_mode & 0o777, 0o600)
            metadata = json.loads((snapshot / "previous.json").read_text())
            self.assertEqual(metadata["previous_head"], previous_head)
            self.assertEqual(metadata["previous_env_mode"], 0o600)
            self.assertEqual(metadata["target_manifest"], self.manifest)
            self.assertEqual((root / ".env").read_text().count(refs["server"]), 1)

    def test_clean_agent_source_drift_is_allowed(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            (root / "scripts").mkdir()
            calls = []

            def fake_run(*argv):
                calls.append(argv)
                if "get-url" in argv:
                    return "https://github.com/ShafranovKirill/delivest.git"
                if "ls-tree" in argv:
                    return "\n".join(f"160000 commit {self.sha}\t{component}" for component in installer.LEGACY_COMPONENTS)
                if "status" in argv and str(root / "agent") not in argv:
                    return "M agent"
                if "rev-parse" in argv:
                    return "c" * 40
                return ""

            refs = installer.validate(self.manifest, "1.2.3")
            config = {"services": {component: {"image": ref} for component, ref in refs.items()}}
            with mock.patch.object(installer, "__file__", str(root / "scripts" / "install-release.py")), \
                 mock.patch.object(installer, "manifest_for", return_value=self.manifest), \
                 mock.patch.object(installer, "run", side_effect=fake_run), \
                 mock.patch.object(installer.subprocess, "run"), \
                 mock.patch.object(installer.subprocess, "check_output", return_value=json.dumps(config)), \
                 mock.patch("sys.argv", ["install-release.py", "1.2.3"]):
                installer.main()

            self.assertIn(("git", "-C", str(root / "agent"), "status", "--porcelain"), calls)
            self.assertIn(("git", "-C", str(root), "submodule", "update", "--init", "server", "client", "agent"), calls)

    def test_real_git_porcelain_allows_only_clean_agent_commit_drift(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            agent = root / "agent"

            def git(directory, *args):
                return subprocess.check_output(["git", "-C", str(directory), *args], text=True, stderr=subprocess.DEVNULL).strip()

            def commit(directory, message):
                git(directory, "-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "-m", message)

            git(root, "init")
            agent.mkdir()
            git(agent, "init")
            (agent / "file").write_text("first")
            git(agent, "add", "file")
            commit(agent, "first")
            git(root, "add", "agent")
            commit(root, "record agent")
            (agent / "file").write_text("second")
            git(agent, "add", "file")
            commit(agent, "second")

            self.assertEqual(subprocess.check_output(["git", "-C", str(root), "status", "--porcelain"], text=True), " M agent\n")
            self.assertTrue(installer.checkout_clean(root))
            (agent / "file").write_text("local change")
            self.assertFalse(installer.checkout_clean(root))


if __name__ == "__main__":
    unittest.main()

#!/usr/bin/env python3
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest import mock

spec = importlib.util.spec_from_file_location("install_release", Path(__file__).with_name("install-release.py"))
installer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(installer)


class InstallReleaseTest(unittest.TestCase):
    def setUp(self):
        self.sha = "a" * 40
        self.digest = "sha256:" + "b" * 64
        self.manifest = {
            "version": "1.2.3", "root_sha": self.sha,
            "gitlinks": {component: self.sha for component in installer.COMPONENTS},
            "images": {component: self.digest for component in installer.COMPONENTS},
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
                    return "\n".join(f"160000 commit {self.sha}\t{component}" for component in installer.COMPONENTS)
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
            self.assertIn(("git", "-C", str(root), "checkout", "--detach", "c" * 40), calls)

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
                    return "\n".join(f"160000 commit {self.sha}\t{component}" for component in installer.COMPONENTS)
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


if __name__ == "__main__":
    unittest.main()

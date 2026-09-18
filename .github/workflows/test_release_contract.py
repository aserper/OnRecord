"""Offline publishing-policy regression tests; never contact a registry."""
import io
from email.message import Message
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from urllib.error import HTTPError

import yaml

ROOT = Path(__file__).resolve().parents[2]
WORKFLOW = yaml.safe_load((ROOT / '.github/workflows/publish.yml').read_text())
GUARD = next(s['run'] for s in WORKFLOW['jobs']['build']['steps'] if s.get('id') == 'guard')
SHA = 'a' * 40


class Registry(io.BytesIO):
    def __init__(self, value, digest=None):
        super().__init__(json.dumps(value).encode())
        self.headers = {'Docker-Content-Digest': digest}


class PublishPolicy(unittest.TestCase):
    def run_guard(self, tags, channel='stable', failure=None):
        records = {}
        for tag, (revision, version, tag_channel, digest) in tags.items():
            manifests = []
            for arch in ('amd64', 'arm64'):
                child = digest + '-' + arch
                manifests.append({'digest': child, 'platform': {'os': 'linux', 'architecture': arch}})
                records['manifests/' + child] = ({'config': {'digest': child + '-config'}}, child)
                records['blobs/' + child + '-config'] = ({'config': {'Labels': {
                    'org.opencontainers.image.revision': revision,
                    'org.opencontainers.image.version': version,
                    'io.onrecord.channel': tag_channel,
                }}}, None)
            records['manifests/' + tag] = ({'manifests': manifests}, digest)

        def urlopen(request):
            url = request.full_url
            if '/token?' in url:
                return Registry({'token': 'test-only'})
            if failure:
                raise HTTPError(url, failure, 'test failure', Message(), None)
            key = url.split('/onrecord/', 1)[1]
            if key not in records:
                raise HTTPError(url, 404, 'missing', Message(), None)
            return Registry(*records[key])

        with tempfile.NamedTemporaryFile() as output:
            env = {'IMAGE': 'ghcr.io/aserper/onrecord', 'GITHUB_ACTOR': 'test', 'GH_TOKEN': 'test-only',
                   'ONRECORD_CHANNEL': channel, 'ONRECORD_VERSION': '0.1.0', 'ONRECORD_COMMIT': SHA,
                   'IMMUTABLE': 'sha-' + SHA + ('-stable' if channel == 'stable' else ''),
                   'GITHUB_OUTPUT': output.name}
            with patch.dict(os.environ, env), patch('urllib.request.urlopen', side_effect=urlopen):
                exec(compile(GUARD, 'registry-guard', 'exec'), {})
            return Path(output.name).read_text()

    def test_docker_default_labels_do_not_claim_a_release(self):
        dockerfile = (ROOT / 'Dockerfile').read_text()
        self.assertIn('ARG ONRECORD_DISPLAY_VERSION=dev\n', dockerfile)
        self.assertNotIn('ARG ONRECORD_VERSION=0.1.0', dockerfile)

    def test_publish_has_lint_gate(self):
        commands = [s.get('run', '') for s in WORKFLOW['jobs']['build']['steps']]
        self.assertIn('pnpm lint:versioning', commands)

    def test_first_stable(self):
        self.assertEqual(self.run_guard({}), 'exists=false\n')

    def test_same_stable_is_noop(self):
        identity = (SHA, '0.1.0', 'stable', 'sha256:stable')
        self.assertEqual(self.run_guard({'0.1.0': identity, 'sha-' + SHA + '-stable': identity}), 'exists=true\n')

    def test_changed_source_refused(self):
        with self.assertRaises(AssertionError):
            self.run_guard({'0.1.0': ('b' * 40, '0.1.0', 'stable', 'sha256:other')})

    def test_partial_publish_refused(self):
        with self.assertRaises(AssertionError):
            self.run_guard({'0.1.0': (SHA, '0.1.0', 'stable', 'sha256:stable')})

    def test_edge_sha_does_not_collide_with_stable(self):
        self.assertEqual(self.run_guard({'sha-' + SHA: (SHA, '0.1.0-dev', 'edge', 'sha256:edge')}), 'exists=false\n')

    def test_edge_retry_noop(self):
        self.assertEqual(self.run_guard({'sha-' + SHA: (SHA, '0.1.0-dev', 'edge', 'sha256:edge')}, 'edge'), 'exists=true\n')

    def test_latest_rollback_refused(self):
        with self.assertRaises(AssertionError):
            self.run_guard({'latest': ('b' * 40, '0.2.0', 'stable', 'sha256:newer')})

    def test_legacy_edge_latest_can_be_replaced(self):
        self.assertEqual(self.run_guard({'latest': (SHA, '1.20.1', 'edge', 'sha256:legacy')}), 'exists=false\n')

    def test_registry_errors_fail_closed(self):
        for status in (401, 403, 429, 500):
            with self.subTest(status=status), self.assertRaises(HTTPError):
                self.run_guard({}, failure=status)

    def test_bootstrap_is_not_permanently_pinned(self):
        config = json.loads((ROOT / '.release-please-config.json').read_text())
        package = config['packages']['.']
        self.assertEqual(package['initial-version'], '0.1.0')
        self.assertNotIn('release-as', package)
        self.assertTrue(package['include-v-in-tag'])
        self.assertFalse(package['include-component-in-tag'])
        self.assertEqual(len(package['extra-files']), 3)


if __name__ == '__main__':
    unittest.main()

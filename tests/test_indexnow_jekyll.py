"""Integration check: Jekyll owns publication, URL generation and app dependencies."""

import importlib.util
import json
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location('indexnow', ROOT / 'scripts/indexnow.py')
indexnow = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(indexnow)
JEKYLL = shutil.which('jekyll')


@unittest.skipUnless(JEKYLL, 'Install Jekyll to run the rendered-site integration test')
class JekyllTest(unittest.TestCase):
    def test_verification_file_is_published_at_the_domain_root_with_no_source_alias(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / 'source'
            target = root / 'site'
            key_source = Path('assets/verification/site.txt')
            (source / key_source.parent).mkdir(parents=True)
            shutil.copyfile(ROOT / key_source, source / key_source)
            result = subprocess.run([
                JEKYLL, 'build', '--source', str(source), '--destination', str(target), '--quiet',
            ], capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            self.assertEqual(Path(indexnow.KEY_FILE).parent, Path('.'), 'The key must cover all site URLs')
            published_key = (target / indexnow.KEY_FILE).read_text().strip()
            expected_key = (ROOT / key_source).read_text().split('---', 2)[-1].strip()
            self.assertRegex(published_key, r'^[A-Za-z0-9-]{8,128}$')
            self.assertEqual(published_key, expected_key)
            self.assertFalse((target / key_source).exists())
            self.assertFalse((target / 'indexnow-key.txt').exists())

    def test_publication_rules_urls_and_dynamic_dependencies_come_from_jekyll(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / 'source'

            def write(path, text):
                target = source / path
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_text(text)

            def build(name):
                destination = root / name
                result = subprocess.run([
                    JEKYLL, 'build', '--source', str(source), '--destination', str(destination), '--quiet',
                ], capture_output=True, text=True)
                self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
                return indexnow.site_snapshot(destination)

            config = 'url: https://litovle.cz\npermalink: /special/:year/:title/\nexclude:\n  - internal-content\n'
            write('_config.yml', config)
            write('_layouts/default.html', '<main>{{ content }}</main>')
            write('_includes/canonical-url.html', (ROOT / '_includes/canonical-url.html').read_text())
            write('sitemap.xml', (ROOT / 'sitemap-static.xml').read_text())
            write(indexnow.DEPENDENCIES_FILE, (ROOT / indexnow.DEPENDENCIES_FILE).read_text())
            write('index.md', '---\nlayout: default\n---\nHome')
            write('assets/public.md', '---\nlayout: default\npermalink: /assets/public/\n---\nPublic')
            write('internal-content/index.md', '---\nlayout: default\n---\nInternal')
            write('search/index.md', '---\nlayout: default\nindexnow_dependencies:\n  - /data/\n---\nApp')
            write('data/records.json', '[1]')
            post = '_posts/2020-12-11-meeting.md'
            write(post, '---\nlayout: default\nslug: old-name\n---\nMeeting')
            before = build('before')
            self.assertEqual(len(before), 4)
            self.assertIn(indexnow.ORIGIN + '/assets/public/', before)
            self.assertNotIn(indexnow.ORIGIN + '/internal-content/', before)

            write('_config.yml', config + '  - assets\n')
            write('internal-content/index.md', '---\nlayout: default\n---\nChanged internal content')
            write(post, '---\nlayout: default\nslug: new-name\ndate: 2021-01-02\n---\nMeeting')
            write('data/records.json', '[1, 2]')
            after = build('after')
            self.assertEqual(len(after), 3)
            self.assertEqual(indexnow.changed_urls(before, after), [indexnow.ORIGIN + route for route in (
                '/assets/public/', '/search/', '/special/2020/old-name/', '/special/2021/new-name/',
            )])


if __name__ == '__main__':
    unittest.main()

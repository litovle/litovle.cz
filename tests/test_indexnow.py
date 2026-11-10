"""Rendered site comparisons, source exports and HTTP handling; no external requests."""

import importlib.util
import json
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from urllib.error import HTTPError, URLError

SPEC = importlib.util.spec_from_file_location('indexnow', Path(__file__).resolve().parents[1] / 'scripts/indexnow.py')
indexnow = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(indexnow)
TEST_KEY = 'a1234567890bcdef1234567890abcdef1'
NAMESPACE = 'http://www.sitemaps.org/schemas/sitemap/0.9'


class SiteTest(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)

    def write(self, path, content):
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content)

    def site(self, name, pages, dependencies=None):
        site = self.root / name
        site.mkdir()
        urls = []
        for route, content in pages.items():
            target = route.lstrip('/') + ('index.html' if route.endswith('/') else '')
            self.write(site / target, content)
            urls.append(f'<url><loc>{indexnow.ORIGIN}{route}</loc></url>')
        self.write(site / 'sitemap.xml', f'<urlset xmlns="{NAMESPACE}">{"".join(urls)}</urlset>')
        self.write(site / indexnow.KEY_FILE, TEST_KEY)
        if dependencies is not None:
            entries = [{'url': indexnow.ORIGIN + route, 'paths': paths}
                       for route, paths in dependencies.items()]
            self.write(site / indexnow.DEPENDENCIES_FILE, json.dumps(entries))
        return site


class SnapshotTest(SiteTest):
    def test_added_changed_removed_and_moved_pages(self):
        before = self.site('before', {
            '/removed/': 'Removed', '/changed/': 'Old', '/old/': 'Moved', '/same/': 'Same',
        })
        after = self.site('after', {
            '/added/': 'Added', '/changed/': 'New', '/new/': 'Moved', '/same/': 'Same',
        })
        urls = indexnow.changed_urls(indexnow.site_snapshot(before), indexnow.site_snapshot(after))
        self.assertEqual(urls, [indexnow.ORIGIN + path for path in (
            '/added/', '/changed/', '/new/', '/old/', '/removed/',
        )])

    def test_sitemaps_decide_eligibility_regardless_of_directory_names(self):
        site = self.site('site', {'/assets/public-page/': 'Public', '/scripts/public-page/': 'Public'})
        self.write(site / 'custom-excluded/page.html', 'Not listed')
        before = indexnow.site_snapshot(site)
        self.write(site / 'custom-excluded/page.html', 'Changed technical file')
        after = indexnow.site_snapshot(site)
        self.assertEqual(before, after)
        self.assertEqual(set(before), {
            indexnow.ORIGIN + '/assets/public-page/', indexnow.ORIGIN + '/scripts/public-page/',
        })

    def test_shared_layout_changes_notify_only_pages_with_changed_output(self):
        before = self.site('before', {'/one/': '<header>Old</header>', '/two/': 'Unchanged'})
        after = self.site('after', {'/one/': '<header>New</header>', '/two/': 'Unchanged'})
        self.assertEqual(
            indexnow.changed_urls(indexnow.site_snapshot(before), indexnow.site_snapshot(after)),
            [indexnow.ORIGIN + '/one/'],
        )

    def test_dynamic_data_changes_notify_the_page_that_declares_the_dependency(self):
        dependencies = {'/search/': ['/assets/search/', '/search/*.js']}
        site = self.site('site', {'/search/': 'App shell', '/other/': 'Same'}, dependencies)
        self.write(site / 'assets/search/records.json', '[1]')
        self.write(site / 'search/app.js', 'Application')
        before = indexnow.site_snapshot(site)
        self.write(site / 'assets/search/records.json', '[1, 2]')
        after = indexnow.site_snapshot(site)
        self.assertEqual(indexnow.changed_urls(before, after), [indexnow.ORIGIN + '/search/'])
        self.write(site / 'search/app.js', 'Changed application')
        self.assertNotEqual(after, indexnow.site_snapshot(site))

    def test_removed_dependency_files_change_the_page_hash(self):
        site = self.site('site', {'/search/': 'App'}, {'/search/': ['/assets/search/']})
        self.write(site / 'assets/search/one.json', '[1]')
        self.write(site / 'assets/search/two.json', '[2]')
        before = indexnow.site_snapshot(site)
        (site / 'assets/search/two.json').unlink()
        self.assertNotEqual(before, indexnow.site_snapshot(site))

    def test_missing_pages_or_declared_dependencies_fail_instead_of_advancing_state(self):
        site = self.site('site', {'/search/': 'App'}, {'/search/': ['/missing.json']})
        with self.assertRaises(FileNotFoundError):
            indexnow.site_snapshot(site)
        self.write(site / 'missing.json', '[]')
        (site / 'search/index.html').unlink()
        with self.assertRaises(FileNotFoundError):
            indexnow.site_snapshot(site)

    def test_nested_sitemap_indexes_and_duplicate_urls(self):
        site = self.site('site', {'/one/': 'One'})
        (site / 'sitemap.xml').rename(site / 'pages.xml')
        self.write(site / 'sitemap.xml', (
            f'<sitemapindex xmlns="{NAMESPACE}">'
            f'<sitemap><loc>{indexnow.ORIGIN}/pages.xml</loc></sitemap>'
            f'<sitemap><loc>{indexnow.ORIGIN}/sitemap.xml</loc></sitemap></sitemapindex>'
        ))
        self.assertEqual(indexnow.sitemap_urls(site), {indexnow.ORIGIN + '/one/'})

    def test_foreign_urls_and_local_path_escapes_are_rejected(self):
        site = self.site('site', {'/one/': 'One'})
        for url in ('https://other.example/', 'http://litovle.cz/', indexnow.ORIGIN + '/?query=1',
                    indexnow.ORIGIN + '/#fragment', indexnow.ORIGIN + '/%2e%2e/private'):
            with self.subTest(url=url), self.assertRaises(ValueError):
                indexnow.site_path(site, url)
        self.write(self.root / 'outside.html', 'Private')
        (site / 'one/index.html').unlink()
        (site / 'one/index.html').symlink_to(self.root / 'outside.html')
        with self.assertRaises(ValueError):
            indexnow.site_snapshot(site)


class PrepareTest(SiteTest):
    def setUp(self):
        super().setUp()
        root_patch = patch.object(indexnow, 'ROOT', self.root)
        root_patch.start()
        self.addCleanup(root_patch.stop)
        self.git('init', '-q')

    def git(self, *args):
        command = ['git', '-c', 'commit.gpgsign=false', '-c', 'user.name=Test',
                   '-c', 'user.email=test@example.test', *args]
        return subprocess.check_output(command, cwd=self.root).decode().strip()

    def commit(self, content):
        self.write(self.root / 'page.md', content)
        self.git('add', 'page.md')
        self.git('commit', '-qm', 'Fixture')
        return self.git('rev-parse', 'HEAD')

    def test_exports_pinned_revisions_and_excludes_untracked_working_files(self):
        before = self.commit('Before')
        after = self.commit('After')
        self.write(self.root / 'private.txt', 'Untracked')
        output = self.root / 'snapshots'
        revisions = indexnow.prepare_sources(before, after, output)
        self.assertEqual(revisions, {'before': before, 'after': after})
        self.assertEqual((output / 'before/page.md').read_text(), 'Before')
        self.assertEqual((output / 'after/page.md').read_text(), 'After')
        self.assertFalse((output / 'after/private.txt').exists())
        self.assertEqual(json.loads((output / 'revisions.json').read_text()), revisions)

    def test_checkpoint_overrides_the_previous_publication_without_mutating_it(self):
        checkpoint_commit = self.commit('Last processed')
        fallback = self.commit('Published but not processed')
        after = self.commit('Current publication')
        checkpoint = self.root / 'commit.txt'
        checkpoint.write_text(checkpoint_commit + '\n')
        revisions = indexnow.prepare_sources(fallback, after, self.root / 'snapshots', checkpoint)
        self.assertEqual(revisions['before'], checkpoint_commit)
        self.assertEqual(checkpoint.read_text(), checkpoint_commit + '\n')

    def test_existing_output_is_not_overwritten(self):
        ref = self.commit('Content')
        output = self.root / 'existing'
        self.write(output / 'keep.txt', 'Keep')
        with self.assertRaises(FileExistsError):
            indexnow.prepare_sources(ref, ref, output)
        self.assertEqual((output / 'keep.txt').read_text(), 'Keep')


class SubmissionTest(SiteTest):
    def test_key_verification_and_the_real_protocol_batch_limit(self):
        site = self.site('site', {'/': 'Home'})
        urls = [f'{indexnow.ORIGIN}/page/{number}/' for number in range(10001)]
        with patch.object(indexnow, 'fetch', side_effect=[
            (200, (TEST_KEY + '\n').encode()), (200, b''), (202, b''),
        ]) as fetch:
            indexnow.submit([*urls, urls[0]], site)
        self.assertEqual(fetch.call_args_list[0].args[0], indexnow.ORIGIN + '/' + indexnow.KEY_FILE)
        requests = [call.args[0] for call in fetch.call_args_list[1:]]
        payloads = [json.loads(request.data) for request in requests]
        self.assertEqual([len(payload['urlList']) for payload in payloads], [10000, 1])
        self.assertEqual(payloads[0]['key'], TEST_KEY)
        self.assertEqual(payloads[0]['host'], 'litovle.cz')
        for payload in payloads:
            self.assertEqual(payload['keyLocation'], indexnow.ORIGIN + '/' + indexnow.KEY_FILE)
        self.assertEqual(requests[0].full_url, indexnow.ENDPOINT)

    def test_wrong_public_key_prevents_submission(self):
        site = self.site('site', {'/': 'Home'})
        with patch.object(indexnow, 'fetch', return_value=(200, b'Wrong')) as fetch:
            with self.assertRaises(ValueError):
                indexnow.submit([indexnow.ORIGIN + '/'], site)
            fetch.assert_called_once()

    def test_no_changes_make_no_http_requests(self):
        with patch.object(indexnow, 'fetch') as fetch:
            indexnow.submit([], self.root)
            fetch.assert_not_called()

    def test_permanent_errors_are_not_retried(self):
        error = HTTPError(indexnow.ENDPOINT, 422, 'Invalid URL', {}, None)
        with (patch.object(indexnow, 'urlopen', side_effect=error) as request,
              patch.object(indexnow.time, 'sleep') as sleep):
            with self.assertRaises(HTTPError):
                indexnow.fetch(indexnow.ENDPOINT)
            request.assert_called_once()
            sleep.assert_not_called()

    def test_transient_errors_have_a_retry_limit(self):
        for error in (HTTPError(indexnow.ENDPOINT, 429, 'Slow down', {}, None), URLError('Offline')):
            with (self.subTest(error=error), patch.object(indexnow, 'urlopen', side_effect=error) as request,
                  patch.object(indexnow.time, 'sleep')):
                with self.assertRaises((HTTPError, URLError)):
                    indexnow.fetch(indexnow.ENDPOINT)
                self.assertEqual(request.call_count, 4)

    def test_retry_after_seconds_and_http_dates_are_respected(self):
        for header in ('120', 'Thu, 01 Jan 1970 00:02:00 GMT'):
            error = HTTPError(indexnow.ENDPOINT, 429, 'Slow down', {'Retry-After': header}, None)
            with (self.subTest(header=header), patch.object(indexnow, 'urlopen', side_effect=error),
                  patch.object(indexnow.time, 'time', return_value=0),
                  patch.object(indexnow.time, 'sleep') as sleep):
                with self.assertRaises(HTTPError):
                    indexnow.fetch(indexnow.ENDPOINT)
                self.assertEqual([call.args[0] for call in sleep.call_args_list], [120, 120, 120])

    def test_invalid_or_past_retry_after_uses_normal_backoff(self):
        for header in ('invalid', '-10', 'Thu, 01 Jan 1970 00:00:00 GMT'):
            with self.subTest(header=header), patch.object(indexnow.time, 'time', return_value=120):
                error = HTTPError(indexnow.ENDPOINT, 503, 'Unavailable', {'Retry-After': header}, None)
                self.assertEqual(indexnow.retry_delay(error, 1), 10)
                error.close()


class CommandTest(SiteTest):
    def arguments(self, before, after, same_revision=False, dry_run=False):
        revisions = self.root / 'revisions.json'
        revisions.write_text(json.dumps({'before': 'new' if same_revision else 'old', 'after': 'new'}))
        checkpoint = self.root / 'commit.txt'
        checkpoint.write_text('old\n')
        args = ['indexnow', 'submit', '--before-site', str(before), '--after-site', str(after),
                '--revisions', str(revisions), '--checkpoint', str(checkpoint)]
        if dry_run:
            args.append('--dry-run')
        return args, checkpoint

    def test_partial_submission_keeps_the_old_checkpoint(self):
        before = self.site('before', {'/first/': 'Old', '/second/': 'Old'})
        after = self.site('after', {'/first/': 'New', '/second/': 'New'})
        args, checkpoint = self.arguments(before, after)
        with (patch('sys.argv', args), patch.object(indexnow, 'BATCH_SIZE', 1),
              patch.object(indexnow, 'fetch', side_effect=[
                  (200, TEST_KEY.encode()), (200, b''), URLError('Connection lost'),
              ])):
            with self.assertRaises(URLError):
                indexnow.main()
        self.assertEqual(checkpoint.read_text(), 'old\n')

    def test_success_advances_checkpoint_and_dry_run_leaves_it_untouched(self):
        before = self.site('before', {'/page/': 'Old'})
        after = self.site('after', {'/page/': 'New'})
        for dry_run in (False, True):
            args, checkpoint = self.arguments(before, after, dry_run=dry_run)
            with self.subTest(dry_run=dry_run), patch('sys.argv', args), patch.object(indexnow, 'submit') as submit:
                indexnow.main()
                self.assertEqual(submit.call_count, 0 if dry_run else 1)
            self.assertEqual(checkpoint.read_text(), 'old\n' if dry_run else 'new\n')

    def test_first_publication_needs_no_previous_build_and_submits_no_history(self):
        after = self.site('after', {'/page/': 'Existing'})
        args, checkpoint = self.arguments(self.root / 'missing', after, same_revision=True)
        with patch('sys.argv', args), patch.object(indexnow, 'fetch') as fetch:
            indexnow.main()
            fetch.assert_not_called()
        self.assertEqual(checkpoint.read_text(), 'new\n')


if __name__ == '__main__':
    unittest.main()

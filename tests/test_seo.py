"""Integration checks for rendered Jekyll output; run after jekyll build."""
import json
import os
import re
import unittest
import xml.etree.ElementTree as ET
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
SITE = Path(os.environ.get('LITOVLE_SEO_SITE', ROOT / '_site'))


class Head(HTMLParser):
    def __init__(self, text):
        super().__init__()
        self.titles = []
        self.canonicals = []
        self.descriptions = []
        self.structured = []
        self.meta = {}
        self.title = None
        self.script = None
        self.feed(text.split('</head>', 1)[0])

    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        if tag == 'title':
            self.title = ''
        if tag == 'link' and values.get('rel') == 'canonical':
            self.canonicals.append(values.get('href'))
        if tag == 'meta':
            name = values.get('name') or values.get('property')
            self.meta[name] = values.get('content')
            if name == 'description':
                self.descriptions.append(values.get('content'))
        if tag == 'script' and values.get('type') == 'application/ld+json':
            self.script = ''

    def handle_data(self, data):
        if self.title is not None:
            self.title += data
        if self.script is not None:
            self.script += data

    def handle_endtag(self, tag):
        if tag == 'title' and self.title is not None:
            self.titles.append(self.title.strip())
            self.title = None
        if tag == 'script' and self.script is not None:
            self.structured.append(json.loads(self.script))
            self.script = None


def head(path):
    return Head((SITE / path.lstrip('/') / 'index.html').read_text())


class SeoTest(unittest.TestCase):
    maxDiff = 1000
    def test_all_resolution_metadata_and_document_schema(self):
        paths = [path for path in (SITE / 'usneseni').glob('*/*/index.html')
                 if re.fullmatch(r'(?:(?:RM|ZM)-\d+-\d+-\d{4}|U[RZ]-\d+-\d+-(?:\d{4}|\d{2}))', path.parent.name)]
        self.assertGreater(len(paths), 0, 'Run jekyll build first')
        for path in paths:
            with self.subTest(page=path.parent.name):
                info = Head(path.read_text())
                slug = path.parent.name
                official_id = '/'.join(slug.rsplit('-', 1)) if slug.startswith(('UR-', 'UZ-')) else slug.replace('-', '/')
                canonical = 'https://litovle.cz/' + str(path.relative_to(SITE)).removesuffix('index.html')
                self.assertEqual(info.canonicals, [canonical])
                self.assertEqual(len(info.titles), 1)
                self.assertIn(official_id, info.titles[0])
                self.assertIn('Litovel', info.titles[0])
                self.assertEqual(len(info.descriptions), 1)
                self.assertTrue(info.descriptions[0])
                self.assertLessEqual(len(info.descriptions[0]), 160)
                self.assertEqual(info.meta['og:url'], canonical)
                graph = info.structured[0]['@graph']
                document = next(node for node in graph if node['@type'] == 'Legislation')
                self.assertEqual(document['identifier'], official_id)
                self.assertEqual(document['legislationPassedBy']['@type'], 'GovernmentOrganization')
                self.assertNotIn('legislationBody', document)
                self.assertNotIn('datePublished', document)
                self.assertNotIn('legislationLegalForce', document)

    def test_description_of_multi_item_resolution_contains_actual_decision(self):
        info = head('/usneseni/2026/RM-2589-82-2026/')
        self.assertIn('výroční zprávu', info.descriptions[0])
        self.assertNotIn('Pozdější revokace', info.descriptions[0])
        history = head('/usneseni/2026/RM-2317-73-2026/')
        self.assertIn('revokuje usnesení', history.descriptions[0])
        self.assertNotIn('2377/76', history.descriptions[0])

    def test_breadcrumbs_follow_visible_hierarchy_and_have_existing_targets(self):
        examples = {
            '/usneseni/2026/': ['Úvod', 'Usnesení', '2026'],
            '/usneseni/2026/RM-82/': ['Úvod', 'Usnesení', '2026', 'RM-82'],
            '/usneseni/2026/RM-2592-82-2026/': ['Úvod', 'Usnesení', '2026', 'RM/2592/82/2026'],
            '/rozpoctova-opatreni/': ['Úvod', 'Rozpočtová opatření'],
            '/rozpoctova-opatreni/RO-17-2026/': ['Úvod', 'Rozpočtová opatření', 'RO/17/2026'],
        }
        for path, names in examples.items():
            with self.subTest(page=path):
                breadcrumb = next(node for node in head(path).structured if node.get('@type') == 'BreadcrumbList')
                items = breadcrumb['itemListElement']
                self.assertEqual([item['name'] for item in items], names)
                self.assertEqual([item['position'] for item in items], list(range(1, len(items) + 1)))
                for item in items:
                    target = urlsplit(item['item'])
                    self.assertEqual(target.netloc, 'litovle.cz')
                    self.assertFalse(target.query or target.fragment)
                    self.assertTrue((SITE / target.path.lstrip('/') / 'index.html').exists())

    def test_budget_page_is_not_classified_as_municipal_resolution(self):
        graph = head('/rozpoctova-opatreni/RO-17-2026/').structured[0]['@graph']
        self.assertFalse(any(node['@type'] == 'Legislation' for node in graph))
        document = next(node for node in graph if node['@type'] == 'DigitalDocument')
        self.assertEqual(document['identifier'], 'RO/17/2026')

    def test_main_pages_have_descriptions_and_use_their_own_canonical(self):
        for path in ['/', '/usneseni/', '/usneseni/2026/', '/usneseni/2026/RM-82/',
                     '/usneseni/archiv/', '/rozpoctova-opatreni/', '/o-projektu/']:
            with self.subTest(page=path):
                info = head(path)
                self.assertEqual(info.canonicals, ['https://litovle.cz' + path])
                self.assertEqual(len(info.titles), 1)
                self.assertEqual(len(info.descriptions), 1)
                self.assertTrue(info.descriptions[0])
                self.assertNotIn('Litovle.cz – Litovle.cz', info.titles[0])

    def test_legacy_redirect_canonical_points_to_destination(self):
        info = Head((SITE / 'uzemni-plan-litovel-faq/index.html').read_text())
        self.assertEqual(info.canonicals, ['https://litovle.cz/uzemni-plan/'])

    def test_sitemaps_include_archive_and_only_existing_canonical_pages(self):
        namespace = {'s': 'http://www.sitemaps.org/schemas/sitemap/0.9'}
        index = ET.parse(SITE / 'sitemap.xml')
        all_urls = []
        for sitemap in index.findall('s:sitemap/s:loc', namespace):
            path = SITE / urlsplit(sitemap.text).path.lstrip('/')
            self.assertTrue(path.exists())
            tree = ET.parse(path)
            urls = [node.text for node in tree.findall('s:url/s:loc', namespace)]
            self.assertTrue(urls, path.name)
            all_urls.extend(urls)
        self.assertEqual(len(all_urls), len(set(all_urls)), 'Sitemap URLs should not be duplicated')
        for url in all_urls:
            with self.subTest(url=url):
                parsed = urlsplit(url)
                self.assertEqual(parsed.netloc, 'litovle.cz')
                self.assertFalse(parsed.query or parsed.fragment)
                target = SITE / parsed.path.lstrip('/')
                if target.is_dir():
                    target /= 'index.html'
                self.assertTrue(target.is_file())
                self.assertEqual(Head(target.read_text()).canonicals, [url])
        archive_pages = list((SITE / 'usneseni/archiv').rglob('index.html'))
        self.assertGreater(len(archive_pages), 0)
        for page in archive_pages:
            url = 'https://litovle.cz/' + str(page.relative_to(SITE)).removesuffix('index.html')
            self.assertTrue(url in all_urls, url)
        report_urls = [path for path in all_urls if '/zastupitelstvo/' in path and path != 'https://litovle.cz/zastupitelstvo/']
        self.assertGreater(len(report_urls), 0, 'Council reports must also be included')


if __name__ == '__main__':
    unittest.main()

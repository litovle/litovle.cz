"""Compare rendered Jekyll sites and notify IndexNow (Python standard library only)."""

import argparse
import hashlib
import io
import json
import re
import subprocess
import tarfile
import time
import xml.etree.ElementTree as ET
from email.utils import parsedate_to_datetime
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import unquote, urlsplit
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
ORIGIN = 'https://litovle.cz'
HOST = urlsplit(ORIGIN).netloc
KEY_FILE = '22621afeb0fead6dbc67d18de72ec37d.txt'
DEPENDENCIES_FILE = 'indexnow-dependencies.json'
ENDPOINT = 'https://api.indexnow.org/indexnow'
BATCH_SIZE = 10000
SITEMAP_NAMESPACE = '{http://www.sitemaps.org/schemas/sitemap/0.9}'


def valid_url(url):
    parsed = urlsplit(url)
    if (parsed.scheme != 'https' or parsed.netloc != HOST
            or parsed.query or parsed.fragment or '..' in unquote(parsed.path).split('/')):
        raise ValueError(f'Invalid canonical URL: {url}')
    return url


def site_path(site, url):
    """Resolve a production URL inside one build, rejecting escapes and symlinks out."""
    valid_url(url)
    site = site.resolve()
    path = (site / unquote(urlsplit(url).path).lstrip('/')).resolve()
    if not path.is_relative_to(site):
        raise ValueError(f'URL escapes the rendered site: {url}')
    return path


def sitemap_urls(site, url=ORIGIN + '/sitemap.xml', seen=None):
    """Use only URLs listed by this build's sitemaps; never infer source routes."""
    seen = set() if seen is None else seen
    path = site_path(site, url)
    if path in seen:
        return set()
    seen.add(path)
    tree = ET.parse(path).getroot()
    namespace = SITEMAP_NAMESPACE
    urls = set()
    if tree.tag == namespace + 'sitemapindex':
        for node in tree.findall(f'{namespace}sitemap/{namespace}loc'):
            urls.update(sitemap_urls(site, node.text.strip(), seen))
    elif tree.tag == namespace + 'urlset':
        urls.update(valid_url(node.text.strip()) for node in tree.findall(f'{namespace}url/{namespace}loc'))
    else:
        raise ValueError(f'Invalid sitemap: {path}')
    return urls


def dependency_files(site, patterns):
    """Expand page-declared files, directories and globs within the rendered site."""
    if not isinstance(patterns, list) or not all(isinstance(item, str) for item in patterns):
        raise ValueError('indexnow_dependencies must be a list of site paths')
    site = site.resolve()
    files = set()
    for pattern in patterns:
        if not pattern.startswith('/') or '..' in pattern.split('/') or urlsplit(pattern).netloc:
            raise ValueError(f'Invalid IndexNow dependency: {pattern}')
        matches = list(site.glob(pattern.lstrip('/')))
        if not matches:
            raise FileNotFoundError(f'IndexNow dependency not found: {pattern}')
        for match in matches:
            candidates = match.rglob('*') if match.is_dir() else [match]
            for path in candidates:
                if not path.resolve().is_relative_to(site):
                    raise ValueError(f'IndexNow dependency escapes the site: {path}')
                if path.is_file():
                    files.add(path)
    return sorted(files)


def site_snapshot(site):
    """Hash rendered canonical pages and their declared dynamic content dependencies."""
    site = site.resolve()
    manifest = site / DEPENDENCIES_FILE
    entries = json.loads(manifest.read_text()) if manifest.exists() else []
    dependencies = {entry['url']: entry['paths'] for entry in entries}
    snapshot = {}
    for url in sorted(sitemap_urls(site)):
        page = site_path(site, url)
        if page.is_dir():
            page /= 'index.html'
        if not page.resolve().is_relative_to(site):
            raise ValueError(f'Page escapes the rendered site: {url}')
        digest = hashlib.sha256(page.read_bytes())
        for path in dependency_files(site, dependencies.get(url, [])):
            digest.update(b'\0' + path.relative_to(site).as_posix().encode('utf-8') + b'\0')
            digest.update(hashlib.sha256(path.read_bytes()).digest())
        snapshot[url] = digest.hexdigest()
    return snapshot


def changed_urls(before, after):
    """Include additions, content changes, removals and both sides of a moved URL."""
    return sorted(url for url in before.keys() | after.keys() if before.get(url) != after.get(url))


def prepare_sources(before, after, output, checkpoint=None):
    """Export immutable Git revisions for Jekyll; publication rules stay with Jekyll."""
    if checkpoint and checkpoint.exists():
        before = checkpoint.read_text().strip()
    revisions = {}
    for name, ref in (('before', before), ('after', after)):
        revisions[name] = subprocess.check_output([
            'git', 'rev-parse', '--verify', '--end-of-options', ref + '^{commit}',
        ], cwd=ROOT).decode().strip()
    output.mkdir(parents=True, exist_ok=False)
    for name, ref in revisions.items():
        archive = subprocess.check_output(['git', 'archive', '--format=tar', ref], cwd=ROOT)
        destination = output / name
        destination.mkdir()
        with tarfile.open(fileobj=io.BytesIO(archive)) as source:
            source.extractall(destination, filter='data')
    (output / 'revisions.json').write_text(json.dumps(revisions) + '\n')
    return revisions


def retry_delay(error, attempt):
    """Respect Retry-After seconds or an HTTP date, alongside exponential backoff."""
    delay = 5 * 2 ** attempt
    retry_after = error.headers.get('Retry-After') if error.headers else None
    if not retry_after:
        return delay
    try:
        requested_delay = int(retry_after)
    except ValueError:
        try:
            requested_delay = parsedate_to_datetime(retry_after).timestamp() - time.time()
        except (TypeError, ValueError, OverflowError):
            return delay
    return max(delay, requested_delay)


def fetch(request):
    for attempt in range(4):
        delay = 5 * 2 ** attempt
        try:
            with urlopen(request, timeout=30) as response:
                return response.status, response.read()
        except HTTPError as error:
            error.close()
            if (error.code != 429 and error.code < 500) or attempt == 3:
                raise
            delay = retry_delay(error, attempt)
        except (URLError, TimeoutError):
            if attempt == 3:
                raise
        time.sleep(delay)


def submit(urls, site):
    urls = sorted({valid_url(url) for url in urls})
    if not urls:
        print('IndexNow: no changed URLs.')
        return
    key = (site / KEY_FILE).read_text().strip()
    if not re.fullmatch(r'[A-Za-z0-9-]{8,128}', key):
        raise ValueError('Invalid IndexNow key in the rendered site')
    key_location = ORIGIN + '/' + KEY_FILE
    _, content = fetch(key_location)
    if content.decode('utf-8').strip() != key:
        raise ValueError(f'IndexNow key is not published at {key_location}')
    for start in range(0, len(urls), BATCH_SIZE):
        batch = urls[start:start + BATCH_SIZE]
        request = Request(ENDPOINT, data=json.dumps({
            'host': HOST, 'key': key, 'keyLocation': key_location, 'urlList': batch,
        }).encode('utf-8'), headers={'Content-Type': 'application/json; charset=utf-8'})
        status, _ = fetch(request)
        if status not in (200, 202):
            raise ValueError(f'Unexpected IndexNow response: HTTP {status}')
        print(f'IndexNow: HTTP {status}, {len(batch)} URLs received.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest='command', required=True)
    prepare = commands.add_parser('prepare', help='Export Git source revisions for Jekyll')
    prepare.add_argument('--before', required=True, help='Fallback base when no checkpoint is available')
    prepare.add_argument('--after', required=True, help='Successfully published revision')
    prepare.add_argument('--output', required=True, type=Path, help='New directory for source snapshots')
    prepare.add_argument('--checkpoint', type=Path)
    prepare.add_argument('--github-output', type=Path)
    notify = commands.add_parser('submit', help='Compare two builds and submit changed URLs')
    notify.add_argument('--before-site', required=True, type=Path)
    notify.add_argument('--after-site', required=True, type=Path)
    notify.add_argument('--revisions', required=True, type=Path, help='revisions.json created by prepare')
    notify.add_argument('--checkpoint', type=Path)
    notify.add_argument('--dry-run', action='store_true')
    args = parser.parse_args()
    if args.command == 'prepare':
        revisions = prepare_sources(args.before, args.after, args.output, args.checkpoint)
        if args.github_output:
            with args.github_output.open('a') as output:
                output.writelines(f'{name}={ref}\n' for name, ref in revisions.items())
        print(json.dumps(revisions, indent=2))
        return
    revisions = json.loads(args.revisions.read_text())
    after = site_snapshot(args.after_site)
    before = after if revisions['before'] == revisions['after'] else site_snapshot(args.before_site)
    urls = changed_urls(before, after)
    if args.dry_run:
        print(json.dumps(urls, ensure_ascii=False, indent=2))
        return
    submit(urls, args.after_site)
    if args.checkpoint:
        args.checkpoint.parent.mkdir(parents=True, exist_ok=True)
        args.checkpoint.write_text(revisions['after'] + '\n')


if __name__ == '__main__':
    main()

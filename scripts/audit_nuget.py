"""Audit resolved NuGet lock packages against Microsoft's official vulnerability feed.

Uses HTTPS with normal TLS verification and no proxy environment. Supports only
stable installed NuGet versions (one to four numeric segments), plus SemVer
prerelease advisory bounds. An unsupported installed version or relevant
advisory range makes the result indeterminate.
This supplemental audit does not replace the standard NuGet Audit CI gate.
"""
import argparse
import datetime as dt
import hashlib
import json
from pathlib import Path
import re
import sys
from urllib.parse import urlparse

import httpx

ROOT = Path(__file__).resolve().parent.parent
INDEX_URL = 'https://api.nuget.org/v3/vulnerabilities/index.json'
NUMERIC = re.compile(r'[0-9]+(?:\.[0-9]+){0,3}\Z', re.ASCII)
BOUND = re.compile(r'([0-9]+(?:\.[0-9]+){0,3})(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?\Z', re.ASCII)
PACKAGE_ID = re.compile(r'[A-Za-z0-9_.-]{1,100}\Z', re.ASCII)


class Indeterminate(ValueError):
    """The available input is insufficient for a conclusive audit."""


def stable_version(value):
    if not isinstance(value, str) or not NUMERIC.fullmatch(value) or len(value) > 43:
        raise Indeterminate(f'Unsupported stable numeric NuGet version: {value!r}')
    parts = [int(part) for part in value.split('.')]
    if any(part > 2147483647 for part in parts):
        raise Indeterminate('NuGet numeric version segment exceeds Int32 range.')
    return tuple(parts + [0] * (4-len(parts)))


def bound_version(value):
    if not isinstance(value,str) or len(value)>128:
        raise Indeterminate('Unsupported NuGet advisory bound.')
    match=BOUND.fullmatch(value)
    if not match:
        raise Indeterminate(f'Unsupported NuGet advisory bound: {value!r}')
    core=stable_version(match.group(1))
    labels=tuple(match.group(2).split('.')) if match.group(2) else None
    if labels and any(label.isdigit() and len(label)>1 and label.startswith('0') for label in labels):
        raise Indeterminate('Prerelease numeric identifiers with leading zeroes are outside the supported SemVer subset.')
    return core,labels


def compare_versions(left,right):
    """NuGet core ordering and SemVer labels with NuGet case-insensitivity."""
    if left[0]!=right[0]:
        return 1 if left[0]>right[0] else -1
    a,b=left[1],right[1]
    if a is None or b is None:
        return 0 if a is None and b is None else (1 if a is None else -1)
    for first,second in zip(a,b):
        first_numeric,second_numeric=first.isdigit(),second.isdigit()
        if first_numeric and second_numeric:
            aa,bb=int(first),int(second)
        elif first_numeric!=second_numeric:
            return -1 if first_numeric else 1
        else:
            aa,bb=first.lower(),second.lower()
        if aa!=bb:
            return 1 if aa>bb else -1
    return 0 if len(a)==len(b) else (1 if len(a)>len(b) else -1)


def in_range(version, vulnerable_range):
    """Stable installed version vs NuGet interval; unsupported syntax fails closed."""
    value = (stable_version(version),None)
    if not isinstance(vulnerable_range, str) or not vulnerable_range.strip() or len(vulnerable_range) > 128:
        raise Indeterminate('Missing or unsupported NuGet advisory range.')
    text = vulnerable_range.strip()
    if BOUND.fullmatch(text):
        return compare_versions(value,bound_version(text))>=0  # Bare NuGet version = inclusive minimum.
    if text.startswith('[') and text.endswith(']') and ',' not in text:
        return compare_versions(value,bound_version(text[1:-1].strip()))==0
    if text[0] not in '[(' or text[-1] not in '])' or text.count(',') != 1:
        raise Indeterminate(f'Unsupported NuGet advisory range: {text!r}')
    lower_text, upper_text = (part.strip() for part in text[1:-1].split(','))
    if (not lower_text and text[0] != '(') or (not upper_text and text[-1] != ')'):
        raise Indeterminate(f'Invalid unbounded NuGet interval: {text!r}')
    lower = bound_version(lower_text) if lower_text else None
    upper = bound_version(upper_text) if upper_text else None
    if lower is not None and upper is not None:
        ordering=compare_versions(lower,upper)
        if ordering>0 or (ordering==0 and (text[0] != '[' or text[-1] != ']')):
            raise Indeterminate(f'Invalid or empty NuGet interval: {text!r}')
    lower_comparison=compare_versions(value,lower) if lower else 1
    upper_comparison=compare_versions(value,upper) if upper else -1
    above = lower is None or lower_comparison>0 or (lower_comparison==0 and text[0]=='[')
    below = upper is None or upper_comparison<0 or (upper_comparison==0 and text[-1]==']')
    return above and below


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise Indeterminate('Duplicate JSON property in audit input.')
        result[key] = value
    return result


def read_json(data):
    try:
        return json.loads(data, object_pairs_hook=unique_object)
    except (UnicodeError, json.JSONDecodeError, RecursionError) as exc:
        raise Indeterminate('Invalid JSON in audit input.') from exc


def lock_packages(paths):
    packages = {}
    metadata = []
    for path in paths:
        raw = path.read_bytes()
        content = read_json(raw)
        if not isinstance(content, dict) or type(content.get('version')) is not int or content['version'] != 1 or not isinstance(content.get('dependencies'), dict):
            raise Indeterminate('Unsupported NuGet lock file schema.')
        try:
            label = path.resolve().relative_to(ROOT).as_posix()
        except ValueError:
            label = path.name
        metadata.append({'file':label, 'sha256':hashlib.sha256(raw).hexdigest()})
        for framework, entries in content['dependencies'].items():
            if not isinstance(framework, str) or not isinstance(entries, dict):
                raise Indeterminate('Invalid NuGet framework dependency block.')
            for name, entry in entries.items():
                if not PACKAGE_ID.fullmatch(name) or not isinstance(entry, dict):
                    raise Indeterminate('Invalid NuGet package entry.')
                kind = entry.get('type')
                if kind == 'Project':
                    continue
                if kind not in ('Direct', 'Transitive') or 'resolved' not in entry:
                    raise Indeterminate(f'Unresolved or unsupported lock entry for {name}.')
                version = entry['resolved']
                stable_version(version)  # Even an unlisted package must have a supported version.
                key = (name.lower(), version)
                item = packages.setdefault(key, {'id':name, 'version':version, 'dependency_types':set(), 'frameworks':set()})
                item['dependency_types'].add(kind.lower())
                item['frameworks'].add(framework)
    if not packages:
        raise Indeterminate('No resolved NuGet packages were found; refusing an empty audit.')
    result = []
    for _, item in sorted(packages.items()):
        item['dependency_types'] = sorted(item['dependency_types'])
        item['frameworks'] = sorted(item['frameworks'])
        result.append(item)
    return result, metadata


def official_url(value):
    if not isinstance(value, str):
        raise Indeterminate('Missing NuGet feed URL.')
    try:
        parsed = urlparse(value)
        port = parsed.port
    except ValueError as exc:
        raise Indeterminate('Malformed NuGet feed URL.') from exc
    if (parsed.scheme != 'https' or parsed.hostname not in ('api.nuget.org', 'data.nuget.org')
            or port not in (None,443) or parsed.username or parsed.password or parsed.query or parsed.fragment
            or not parsed.path.startswith(('/v3-vulnerabilities/', '/v3/vulnerabilities/'))):
        raise Indeterminate('NuGet feed URL is outside the allowed official HTTPS endpoints.')
    return value


def download_json(client, url, maximum):
    official_url(url)
    with client.stream('GET', url, headers={'Accept':'application/json'}) as response:
        response.raise_for_status()
        body = bytearray()
        for chunk in response.iter_bytes():
            if len(body) + len(chunk) > maximum:
                raise Indeterminate('NuGet vulnerability response exceeds the size limit.')
            body.extend(chunk)
    return read_json(body), hashlib.sha256(body).hexdigest()


def download_pages(client):
    index, index_hash = download_json(client, INDEX_URL, 262144)
    if not isinstance(index, list) or not 1 <= len(index) <= 16:
        raise Indeterminate('NuGet vulnerability index must have 1 to 16 pages.')
    pages, metadata, names = [], [], set()
    for entry in index:
        if not isinstance(entry, dict):
            raise Indeterminate('Invalid NuGet vulnerability index entry.')
        name = entry.get('@name')
        if not isinstance(name, str) or not re.fullmatch(r'[A-Za-z0-9_-]{1,32}',name) or name in names:
            raise Indeterminate('Invalid or duplicate NuGet vulnerability page name.')
        names.add(name)
        updated = entry.get('@updated')
        try:
            stamp = dt.datetime.fromisoformat(updated.replace('Z','+00:00'))
            if stamp.tzinfo is None:
                raise ValueError('Timezone absent')
        except (AttributeError, ValueError, TypeError) as exc:
            raise Indeterminate('Invalid NuGet vulnerability update timestamp.') from exc
        url = official_url(entry.get('@id'))
        page, sha256 = download_json(client, url, 64*1024*1024)
        if page == []:  # NuGet explicitly permits [] for an empty page.
            page = {}
        if not isinstance(page, dict) or any(not isinstance(v,list) for v in page.values()):
            raise Indeterminate('Invalid NuGet vulnerability page schema.')
        if any(not isinstance(k,str) or not PACKAGE_ID.fullmatch(k) or k != k.lower() for k in page):
            raise Indeterminate('Invalid package identifier in NuGet vulnerability page.')
        pages.append(page)
        metadata.append({'name':name,'url':url,'updated_at':updated,'sha256':sha256})
    return pages, {'url':INDEX_URL,'sha256':index_hash,'pages':metadata}


def audit_packages(packages, pages):
    checked = []
    for package in packages:
        stable_version(package['version'])
        findings, seen = [], set()
        for page in pages:
            for advisory in page.get(package['id'].lower(), []):
                if not isinstance(advisory, dict):
                    raise Indeterminate('Invalid relevant NuGet advisory object.')
                severity, url, versions = advisory.get('severity'), advisory.get('url'), advisory.get('versions')
                if type(severity) is not int or severity not in (0,1,2,3) or not isinstance(url, str):
                    raise Indeterminate('Invalid relevant NuGet advisory metadata.')
                try:
                    parsed = urlparse(url)
                    parsed.port  # Reject malformed URL syntax even though advisory URLs are never fetched.
                except ValueError as exc:
                    raise Indeterminate('Malformed relevant NuGet advisory URL.') from exc
                if parsed.scheme != 'https' or not parsed.hostname or parsed.username or parsed.password or len(url)>2048:
                    raise Indeterminate('Invalid relevant NuGet advisory URL.')
                affected = in_range(package['version'], versions)
                key = (url, versions, severity)
                if key not in seen:
                    seen.add(key)
                    findings.append({'url':url,'severity':('low','moderate','high','critical')[severity],
                                     'vulnerable_range':versions,'installed_version_affected':affected})
        checked.append({**package,'known_advisories':findings,
                        'vulnerabilities':[item for item in findings if item['installed_version_affected']]})
    return checked


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--lock', action='append', type=Path, help='NuGet packages.lock.json (repeatable; default api-dotnet)')
    parser.add_argument('--output', type=Path, default=ROOT/'tests/artifacts/nuget-audit.json')
    args = parser.parse_args(argv)
    report = {'schema_version':1,'audit':'Resolved NuGet dependencies / official vulnerability feed',
              'executed_at_utc':dt.datetime.now(dt.timezone.utc).isoformat(),
              'status':'indeterminate','tls_verification':True,'proxy_environment_used':False,
              'version_range_support':'Stable installed numeric NuGet versions, 1-4 segments; stable or SemVer prerelease advisory bounds; unsupported inputs fail closed',
              'packages':[], 'limitations':[
                  'Known advisories in the downloaded official feed at execution time only.',
                  'Audits resolved lock packages; does not audit installed shared .NET runtime, OS, or container images.',
                  'Supplemental HTTPS feed audit; standard NuGet Audit remains mandatory in CI.'
              ]}
    code = 2
    try:
        packages, locks = lock_packages(args.lock or [ROOT/'api-dotnet/packages.lock.json'])
        report['lock_files'] = locks
        # Explicitly retain the default certificate verification; never use verify=False.
        with httpx.Client(verify=True, trust_env=False, follow_redirects=False, timeout=httpx.Timeout(30,connect=10)) as client:
            pages, metadata = download_pages(client)
        report['source'] = metadata
        report['packages'] = audit_packages(packages,pages)
        affected = sum(len(item['vulnerabilities']) for item in report['packages'])
        report.update(packages_checked=len(packages), known_vulnerabilities=affected,
                      status='passed' if affected==0 else 'failed')
        code = 0 if affected==0 else 1
    except (Indeterminate, OSError, httpx.HTTPError) as exc:
        # Public package/range metadata only; no TLS bypass, credentials, or traceback.
        report['error'] = str(exc) if isinstance(exc,Indeterminate) else f'{type(exc).__name__}: could not complete the official NuGet audit.'
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'nuget_audit':report['status'],'packages_checked':report.get('packages_checked',0),
                      'known_vulnerabilities':report.get('known_vulnerabilities'),'exit_code':code}))
    return code


if __name__ == '__main__':
    raise SystemExit(main())

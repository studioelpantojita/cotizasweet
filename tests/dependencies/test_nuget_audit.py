import importlib.util
import json
from pathlib import Path

import httpx
import pytest

ROOT=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('nuget_audit',ROOT/'scripts/audit_nuget.py')
audit=importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)


def test_normalized_numeric_versions():
    assert audit.stable_version('1')==audit.stable_version('01.00.0.0')
    assert audit.stable_version('1.2.3.4')>audit.stable_version('1.2.3')


def test_interval_boundaries():
    for bound,at_low,at_high in [('[1,2]',True,True),('[1,2)',True,False),('(1,2]',False,True),('(1,2)',False,False)]:
        assert audit.in_range('1.0',bound) is at_low
        assert audit.in_range('2.0',bound) is at_high
        assert audit.in_range('1.5',bound)
        assert not audit.in_range('3',bound)


def test_unbounded_ranges():
    assert audit.in_range('0.0.1','(, 2.0)')
    assert not audit.in_range('2','(, 2.0)')
    assert audit.in_range('2','[2.0, )')
    assert not audit.in_range('1.9','[2.0, )')
    assert audit.in_range('2147483647','(,)')


def test_exact_and_bare_minimum_versions():
    assert audit.in_range('1.2.0.0','[1.2]')
    assert not audit.in_range('1.2.0.1','[1.2]')
    assert audit.in_range('1.3','1.2')
    assert not audit.in_range('1.1','1.2')


def test_unsupported_versions_fail_closed():
    for value in ['1.0-beta','1.0+build','1.*','v1.0','１.0','-1','1.2.3.4.5','2147483648','']:
        with pytest.raises(audit.Indeterminate):
            audit.in_range(value,'(,2)')
    with pytest.raises(audit.Indeterminate):
        audit.in_range('1','(,2.0-beta+metadata)')


def test_stable_installed_versions_vs_prerelease_bounds():
    assert not audit.in_range('7.0.0','(,7.0.0-preview)')
    assert not audit.in_range('7.0.0','(,7.0.0-preview]')
    assert audit.in_range('6.9.9','(,7.0.0-preview)')
    assert audit.in_range('7.0.0','[7.0.0-preview,7.0.0]')
    assert audit.in_range('7.0.0','(7.0.0-preview,8.0.0)')
    assert not audit.in_range('7.0.0','[7.0.0-preview]')
    assert audit.in_range('7.0.0','7.0.0-preview')
    assert not audit.in_range('6.9.9','7.0.0-preview')


def test_prerelease_bound_ordering_and_empty_intervals():
    compare=audit.compare_versions
    bound=audit.bound_version
    for lower,upper in [('7-alpha','7-beta'),('7-preview.2','7-preview.10'),('7-preview','7-preview.0'),('7-1','7-alpha'),('7-preview','7')]:
        assert compare(bound(lower),bound(upper))<0
        assert not audit.in_range('7.0',f'[{lower},{upper})')
    assert compare(bound('7-PREVIEW'),bound('7-preview'))==0
    with pytest.raises(audit.Indeterminate):
        audit.in_range('7','[7,7-preview]')
    with pytest.raises(audit.Indeterminate):
        audit.in_range('7','[7-preview.10,7-preview.2]')


def test_prerelease_syntax_still_fails_closed():
    for value in ['7-preview..1','7-preview.01','7-preview_1','7-','7-rc+build','7-préview']:
        with pytest.raises(audit.Indeterminate):
            audit.in_range('7',f'(,{value})')


def test_malformed_ranges_fail_closed():
    for value in ['(1.0)','[1,2','[2,1]','(1,1)','[,2]','[1,]','1.*','[1,2,3]','',None]:
        with pytest.raises(audit.Indeterminate):
            audit.in_range('1.0',value)


def test_additive_pages_and_deduplication():
    package={'id':'Example.Package','version':'2.0','frameworks':['net10.0'],'dependency_types':['direct']}
    first={'url':'https://github.com/advisories/GHSA-example-one','severity':2,'versions':'(,2)'}
    second={'url':'https://github.com/advisories/GHSA-example-two','severity':3,'versions':'[2,3)'}
    result=audit.audit_packages([package],[{'example.package':[first]},{'example.package':[first,second]}])[0]
    assert len(result['known_advisories'])==2
    assert len(result['vulnerabilities'])==1
    assert result['vulnerabilities'][0]['severity']=='critical'


def test_lock_resolved_dependencies_and_projects(tmp_path):
    path=tmp_path/'packages.lock.json'
    path.write_text(json.dumps({'version':1,'dependencies':{'net10.0':{
        'Example.Direct':{'type':'Direct','requested':'[1,)','resolved':'2.0'},
        'Example.Transitive':{'type':'Transitive','resolved':'1.0.1'},
        'Example.Project':{'type':'Project'}
    }}}))
    result,metadata=audit.lock_packages([path])
    assert len(result)==2 and len(metadata[0]['sha256'])==64
    assert result[1]['dependency_types']==['transitive']
    path.write_text('{"version":1,"dependencies":{}}')
    with pytest.raises(audit.Indeterminate):
        audit.lock_packages([path])
    with pytest.raises(audit.Indeterminate):
        audit.read_json('{"packages":{},"packages":{}}')


def test_malformed_advisory_and_untrusted_endpoint_fail_closed():
    package={'id':'Example.Package','version':'2.0'}
    for advisory in [{'severity':True,'url':'https://example.test/advisory','versions':'(,3)'},
                     {'severity':1,'url':'http://example.test/advisory','versions':'(,3)'},
                     {'severity':1,'url':'https://example.test/advisory','versions':'(,3-beta+metadata)'}]:
        with pytest.raises(audit.Indeterminate):
            audit.audit_packages([package],[{'example.package':[advisory]}])
    for url in ['http://api.nuget.org/v3/vulnerabilities/index.json','https://evil.example/v3/vulnerabilities/index.json',
                'https://api.nuget.org@evil.example/v3/vulnerabilities/index.json','https://api.nuget.org/v3/vulnerabilities/index.json?token=fake',
                'https://api.nuget.org:invalid/v3/vulnerabilities/index.json']:
        with pytest.raises(audit.Indeterminate):
            audit.official_url(url)


def test_network_failure_cannot_report_clean(monkeypatch,tmp_path):
    def unavailable(client):
        raise httpx.ConnectError('simulated offline')
    monkeypatch.setattr(audit,'download_pages',unavailable)
    output=tmp_path/'result.json'
    assert audit.main(['--output',str(output)])==2
    result=json.loads(output.read_text())
    assert result['status']=='indeterminate'
    assert result.get('known_vulnerabilities') is None
    assert not result['packages']

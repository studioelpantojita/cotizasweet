"""Offline security and concurrency regression checks; no provider credentials."""
import asyncio
import sys
import time
from pathlib import Path

import httpx
import pytest
from fastapi.testclient import TestClient

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'api-python'))
import ruc_service as service

@pytest.fixture(autouse=True)
def isolated(monkeypatch):
    monkeypatch.setenv('APP_ENV','development')
    monkeypatch.setenv('RUC_PROVIDER','demo')
    monkeypatch.setenv('INTEGRATION_SERVICE_KEY','x'*48)
    monkeypatch.delenv('RUC_API_TOKEN',raising=False)
    monkeypatch.delenv('OIDC_ALLOW_LOCAL_HTTP',raising=False)
    monkeypatch.setattr(service,'_cache',{})
    monkeypatch.setattr(service,'_inflight',{})
    monkeypatch.setattr(service,'_requests',[])
    monkeypatch.setattr(service,'_lock',asyncio.Lock())

def ruc(number):
    prefix='20'+f'{number:08d}'
    check=(11-sum(int(prefix[i])*w for i,w in enumerate(service.WEIGHTS))%11)%10
    return prefix+str(check)

def result(document):
    return service.normalized(document,{'ruc':document,'legalName':'Prueba de concurrencia'},'Prueba aislada',True)

@pytest.mark.parametrize('patch',[
    {'INTEGRATION_SERVICE_KEY':''},
    {'INTEGRATION_SERVICE_KEY':'short'},
    {'INTEGRATION_SERVICE_KEY':'a'*31+' '},
    {'INTEGRATION_SERVICE_KEY':'é'*48},
    {'RUC_PROVIDER':'unknown'},
    {'APP_ENV':'production','RUC_PROVIDER':'demo'},
    {'APP_ENV':'production','RUC_PROVIDER':'disabled','OIDC_ALLOW_LOCAL_HTTP':'true'},
    {'APP_ENV':'production','RUC_PROVIDER':'decolecta'},
])
def test_unsafe_configuration_rejected(monkeypatch,patch):
    for key,value in patch.items(): monkeypatch.setenv(key,value)
    with pytest.raises(RuntimeError): service.validate_configuration()

def test_safe_production_without_ruc_credentials_is_explicitly_disabled(monkeypatch):
    monkeypatch.setenv('APP_ENV','production')
    monkeypatch.setenv('RUC_PROVIDER','disabled')
    service.validate_configuration()

def test_auth_rejects_non_ascii_and_no_error_is_cached():
    with TestClient(service.app) as client:
        for key in ('','bad','é'*48):
            headers=[(b'x-service-key',key.encode('utf-8'))]
            response=client.get('/api/clients/ruc/20999999990',headers=headers)
            assert response.status_code==401
            assert response.headers['cache-control']=='no-store'
        response=client.get('/api/clients/ruc/20999999990',headers={'X-Service-Key':'x'*48})
        assert response.status_code==200
        assert response.json()['demo'] is True

def test_same_document_is_requested_once(monkeypatch):
    async def scenario():
        entered=asyncio.Event(); release=asyncio.Event(); calls=[]
        async def fetch(document,provider):
            calls.append(document); entered.set(); await release.wait(); return result(document)
        monkeypatch.setattr(service,'_fetch_ruc',fetch)
        tasks=[asyncio.create_task(service.lookup_ruc(ruc(1))) for _ in range(20)]
        await entered.wait(); await asyncio.sleep(0); release.set()
        records=await asyncio.gather(*tasks)
        assert len(calls)==1 and len(service._requests)==1
        assert all(record['ruc']==ruc(1) for record in records)
        records[0]['legalName']='changed'
        assert (await service.lookup_ruc(ruc(1)))['legalName']=='Prueba de concurrencia'
    asyncio.run(scenario())

def test_slow_provider_does_not_block_unrelated_cache_hits(monkeypatch):
    async def scenario():
        entered=asyncio.Event(); release=asyncio.Event()
        service._cache[('demo',ruc(2))]=(time.monotonic()+300,result(ruc(2)))
        async def fetch(document,provider):
            entered.set(); await release.wait(); return result(document)
        monkeypatch.setattr(service,'_fetch_ruc',fetch)
        task=asyncio.create_task(service.lookup_ruc(ruc(1)))
        await entered.wait()
        cached=await asyncio.wait_for(service.lookup_ruc(ruc(2)),timeout=.25)
        assert cached['ruc']==ruc(2)
        release.set(); await task
    asyncio.run(scenario())

def test_distinct_provider_calls_have_a_hard_concurrency_limit(monkeypatch):
    async def scenario():
        release=asyncio.Event(); entered=asyncio.Event(); calls=[]
        async def fetch(document,provider):
            calls.append(document)
            if len(calls)==service.MAX_INFLIGHT: entered.set()
            await release.wait(); return result(document)
        monkeypatch.setattr(service,'_fetch_ruc',fetch)
        tasks=[asyncio.create_task(service.lookup_ruc(ruc(i))) for i in range(service.MAX_INFLIGHT)]
        await entered.wait()
        with pytest.raises(service.LookupError) as error: await service.lookup_ruc(ruc(99))
        assert error.value.status==429 and error.value.retry_after==1
        assert len(calls)==service.MAX_INFLIGHT
        release.set(); await asyncio.gather(*tasks)
        assert service._inflight=={}
    asyncio.run(scenario())

def test_disconnected_caller_does_not_cancel_other_waiters(monkeypatch):
    async def scenario():
        entered=asyncio.Event(); release=asyncio.Event(); calls=[]
        async def fetch(document,provider):
            calls.append(document); entered.set(); await release.wait(); return result(document)
        monkeypatch.setattr(service,'_fetch_ruc',fetch)
        first=asyncio.create_task(service.lookup_ruc(ruc(1))); await entered.wait()
        second=asyncio.create_task(service.lookup_ruc(ruc(1))); await asyncio.sleep(0)
        first.cancel()
        with pytest.raises(asyncio.CancelledError): await first
        release.set(); record=await second
        assert record['ruc']==ruc(1) and len(calls)==1
        assert service._inflight=={}
    asyncio.run(scenario())

def test_failures_clear_pending_work_and_allow_retry(monkeypatch):
    async def scenario():
        async def failed(document,provider): raise service.LookupError(503,'Proveedor no disponible')
        monkeypatch.setattr(service,'_fetch_ruc',failed)
        with pytest.raises(service.LookupError): await service.lookup_ruc(ruc(1))
        assert service._inflight=={} and service._cache=={}
        async def successful(document,provider): return result(document)
        monkeypatch.setattr(service,'_fetch_ruc',successful)
        assert (await service.lookup_ruc(ruc(1)))['ruc']==ruc(1)
    asyncio.run(scenario())

def test_provider_budget_is_shared_and_returns_retry_after():
    service._requests[:]=[time.monotonic()]*30
    with TestClient(service.app) as client:
        response=client.get('/api/clients/ruc/20999999990',headers={'X-Service-Key':'x'*48})
        assert response.status_code==429
        assert response.headers['retry-after']=='60'
        assert response.headers['cache-control']=='no-store'

@pytest.mark.parametrize('status,body',[(200,b'not json'),(200,b'[]'),(200,b'x'*16385),(500,b'credential=private-example'),(302,b'')])
def test_upstream_errors_are_bounded_and_sanitized(monkeypatch,status,body):
    monkeypatch.setenv('RUC_PROVIDER','decolecta')
    monkeypatch.setenv('RUC_API_TOKEN','private-example')
    client_class=httpx.AsyncClient
    transport=httpx.MockTransport(lambda request:httpx.Response(status,content=body))
    monkeypatch.setattr(service.httpx,'AsyncClient',lambda **kwargs:client_class(transport=transport,**kwargs))
    with pytest.raises(service.LookupError) as error:
        asyncio.run(service.lookup_ruc(ruc(1)))
    assert error.value.status==503
    assert 'private-example' not in str(error.value)
    assert service._inflight=={} and service._cache=={}

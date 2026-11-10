"""Local production-build smoke and bounded public HTTP load; no external accounts."""
import asyncio
import json
import os
from pathlib import Path
import statistics
import subprocess
import tempfile
import time
import httpx
from process_tree import OwnedProcess

ROOT=Path(__file__).resolve().parents[1]
ORIGIN='http://127.0.0.1:3390'

async def public_load():
    semaphore=asyncio.Semaphore(8)
    latencies=[]
    async with httpx.AsyncClient(base_url=ORIGIN,timeout=10,trust_env=False) as client:
        # Warm the SQLite catalog and production routes before measured requests.
        for route in ('/api/health','/api/catalog','/','/catalogo','/cotizar'):
            response=await client.get(route)
            assert response.status_code==200,(route,response.status_code)
            assert response.headers.get('x-content-type-options')=='nosniff'
            assert response.headers.get('x-frame-options')=='DENY'
        assert (await client.get('/api/quotes')).status_code==401
        async def request(index):
            async with semaphore:
                started=time.perf_counter()
                response=await client.get('/api/catalog' if index%2 else '/api/health')
                elapsed=(time.perf_counter()-started)*1000
                assert response.status_code==200,response.status_code
                assert 'no-store' in response.headers.get('cache-control','')
                latencies.append(elapsed)
        started=time.perf_counter()
        await asyncio.gather(*(request(i) for i in range(80)))
        duration=time.perf_counter()-started
    samples=sorted(latencies);p95=samples[int(len(samples)*.95)-1]
    assert p95<2000,f'p95 exceeds previously defined 2000ms threshold: {p95}'
    assert duration<30,f'80-request batch exceeds 30 seconds: {duration}'
    return {'requests':80,'concurrency':8,'p50_ms':round(statistics.median(samples),2),'p95_ms':round(p95,2),'max_ms':round(max(samples),2),'batch_seconds':round(duration,3),'thresholds':{'p95_ms':2000,'batch_seconds':30}}

def main():
    with tempfile.TemporaryDirectory(prefix='sweet-production-smoke-') as temp:
        env={k:v for k,v in os.environ.items() if not k.lower().endswith('_proxy')}
        env.update(NODE_ENV='production',NEXT_TELEMETRY_DISABLED='1',APP_ORIGIN='https://smoke.invalid',API_BACKEND='next',DATABASE_PATH=str(Path(temp)/'smoke.sqlite'))
        with (Path(temp)/'next.log').open('w',encoding='utf-8') as log:
            proc=OwnedProcess([os.environ.get('NODE_EXEC','node'),'node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3390'],cwd=ROOT/'web',env=env,stdout=log,stderr=log)
            try:
                for _ in range(60):
                    if proc.poll() is not None:raise RuntimeError('Production server failed to start')
                    try:
                        if httpx.get(ORIGIN+'/api/health',timeout=1,trust_env=False).status_code==200:break
                    except httpx.HTTPError:pass
                    time.sleep(.25)
                else:raise TimeoutError('Production server did not become ready')
                report={'status':'passed','scope':'Local production build; public routes only. Authenticated writes and real OIDC/RUC are covered separately or pending external setup.','smoke_routes':5,'result':asyncio.run(public_load())}
                artifact=ROOT/'tests/artifacts/production-smoke.json';artifact.parent.mkdir(parents=True,exist_ok=True);artifact.write_text(json.dumps(report,indent=2),encoding='utf-8')
                print(json.dumps(report))
            finally:
                proc.stop()

if __name__=='__main__':main()

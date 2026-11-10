"""Additional v2 quality checks. No real customers, provider credentials, or TCP ports.

Requires application Python dependencies. --node runs cross-language parity;
--dotnet-probe uses the compiled FinancialProbe.dll. Writes machine-readable evidence.
The HTTP component suite deliberately substitutes identity: real OIDC belongs to
tests/integration.py. Mutants execute isolated in memory, never replacing app files.
"""
import argparse
import copy
import datetime as dt
import hashlib
import importlib
import json
import math
import os
from pathlib import Path
import random
import platform
import sqlite3
import statistics
import subprocess
import sys
import tempfile
import time
import types
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager, closing
from decimal import Decimal, ROUND_HALF_UP

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'api-python'))
import domain

BASE = json.loads((ROOT / 'contracts/example-quote.json').read_text(encoding='utf-8'))
EVIDENCE = []


def require(condition, message):
    if not condition:
        raise AssertionError(message)


def qcase(**changes):
    q = copy.deepcopy(BASE)
    q.update(documentType='dni', clientType='persona_natural', clientDocument='12345678',
             client='Cliente sintético de QA', contact='900000000', materials=[],
             locationMode='pickup', provinceId='', districtId='', address='Recojo de prueba')
    q.update(changes)
    return q


def oracle(q):
    """Decimal-based reference, independent of application percent helpers."""
    def pct(value, rate):
        return int((Decimal(value) * Decimal(rate) / Decimal(100)).quantize(Decimal('1'), rounding=ROUND_HALF_UP))
    packs = sum(int(i['priceCents']) * int(i['quantity']) for i in q['items'] if i['category'] != 'addon')
    addons = sum(int(i['priceCents']) * int(i['quantity']) for i in q['items'] if i['category'] == 'addon')
    subtotal = packs + addons
    rate = 5 if q['pricingVersion'] == 2 and q['locationMode'] == 'on_location' else 0
    mobility = pct(subtotal, rate) if q['pricingVersion'] == 2 else q['deliveryCents']
    base = subtotal + mobility
    tax = pct(base, 18) if q['pricingVersion'] == 2 else 0
    total = base + tax
    advance = pct(total, q['advancePercent'])
    return dict(subtotal=subtotal, total=total, advance=advance, balance=total-advance,
                packs=packs, addons=addons, mobility=mobility, mobilityRate=rate, base=base, tax=tax)


def financial_cases():
    cases = []
    # Every cent near half-cent ties, both service modes and all advance endpoints.
    for cents in range(101):
        for location in ('pickup', 'on_location'):
            for advance in (0, 1, 49, 50, 51, 99, 100):
                q = qcase(advancePercent=advance, locationMode=location)
                q['items'] = [{**q['items'][0], 'priceCents': cents, 'quantity': 1}]
                if location == 'on_location':
                    q.update(provinceId='1501', districtId='150130', address='Dirección sintética QA')
                cases.append(q)
    rng = random.Random(20261110)
    for _ in range(150):
        q = qcase(advancePercent=rng.randrange(101), currency=rng.choice(('PEN', 'USD')))
        q['items'] = [{**q['items'][0], 'id': f'qa-{i}', 'category':rng.choice(('pack','addon')),
                       'priceCents':rng.randrange(100000001), 'quantity':rng.randrange(1,1000)}
                      for i in range(rng.randrange(1,31))]
        cases.append(q)
    q = qcase(advancePercent=99, locationMode='on_location', provinceId='1501', districtId='150130', address='QA')
    q['items'] = [{**q['items'][0], 'id':f'max-{i}', 'quantity':999, 'priceCents':100000000} for i in range(30)]
    cases.append(q)
    return cases


CASES = financial_cases()


def financial_assertions(module, full=True):
    cases = CASES if full else CASES[:400] + CASES[-151:]
    for idx, q in enumerate(cases):
        actual = module.totals(module.validate_quote(q, creating=True))
        require(actual == oracle(q), f'financial case {idx}: {actual} != {oracle(q)}')
        require(all(isinstance(v, int) for v in actual.values()), 'Amounts must remain integer cents')
        require(actual['advance'] + actual['balance'] == actual['total'], 'Advance/balance identity')
        require(actual['total'] >= 0 and actual['balance'] >= 0, 'Negative amounts')


def invalid_cases():
    q = qcase()
    invalid = [qcase(**patch) for patch in (
        {'formVersion':1}, {'pricingVersion':1}, {'contact':'90000000'}, {'contact':'9000000000'},
        {'contact':'90000000x'}, {'advancePercent':-1}, {'advancePercent':101}, {'advancePercent':0.5},
        {'currency':'EUR'}, {'currency':None}, {'client':'  '}, {'client':'A'*301},
        {'notes':'A'*1601}, {'event':'A'*121}, {'issued':'2026-02-30'}, {'eventDate':'2026-01-01'},
        {'validUntil':'2026-12-31'}, {'validUntil':str(__import__('datetime').date.fromisoformat(q['issued']) + __import__('datetime').timedelta(days=22))},
        {'locationMode':'on_location','provinceId':'1501','districtId':'150130','address':'  '},
        {'locationMode':'on_location','provinceId':'1501','districtId':'010101','address':'QA'},
        {'taxPercent':0}, {'deliveryCents':1}, {'allergenReviewed':True, 'allergenNotes':''},
    )]
    for patch in ({'priceCents':-1}, {'priceCents':100000001}, {'priceCents':0.5},
                  {'quantity':0}, {'quantity':1000}, {'quantity':0.5}, {'name':'  '}, {'portfolioId':'unknown'}):
        invalid.append(qcase(items=[{**q['items'][0], **patch}]))
    invalid.extend([qcase(items=[]), qcase(items=[{**q['items'][0], 'id':str(i)} for i in range(31)])])
    return invalid


def validation_assertions(module):
    for idx, q in enumerate(invalid_cases()):
        try:
            module.validate_quote(q, creating=True)
        except (ValueError, TypeError, KeyError):
            continue
        raise AssertionError(f'Accepted invalid case {idx}')
    # Historical documents remain readable; creating a new version has current rules.
    historical = qcase(formVersion=1, pricingVersion=1, taxPercent=0, contact='Contacto histórico')
    require(module.validate_quote(historical)['contact']=='Contacto histórico', 'Historical read compatibility')
    require(module.validate_quote(qcase(client='  Cliente sintético  '),creating=True)['client']=='Cliente sintético', 'Normalization')


def record(name, category, action):
    before = time.perf_counter()
    try:
        result = action()
    except Exception as exc:
        EVIDENCE.append(dict(name=name, category=category, status='failed', seconds=round(time.perf_counter()-before,3), error=f'{type(exc).__name__}: {exc}'))
        raise
    elapsed = round(time.perf_counter()-before, 3)
    EVIDENCE.append(dict(name=name, category=category, status='passed', seconds=elapsed, details=result or {}))
    print(f'PASS {name} ({elapsed}s)', flush=True)


def cross_language(node, dotnet_probe):
    with tempfile.TemporaryDirectory(prefix='cotizasweet-parity-') as temp:
        path = Path(temp) / 'cases.json'
        invalid=invalid_cases()
        path.write_text(json.dumps({'valid':CASES,'invalid':invalid}, ensure_ascii=False), encoding='utf-8')
        expected = [oracle(q) for q in CASES]
        commands = []
        if node:
            commands.append(('TypeScript', [node, str(ROOT/'web/scripts/run-ts.cjs'), str(ROOT/'tests/v2/financial-probe.ts'), str(path)]))
        if dotnet_probe:
            commands.append(('.NET', [os.environ.get('DOTNET_EXEC','dotnet'), str(Path(dotnet_probe).resolve()), str(path)]))
        for language, cmd in commands:
            result = subprocess.run(cmd,cwd=ROOT/'web',text=True,encoding='utf-8',capture_output=True,timeout=180)
            require(result.returncode==0, f'{language} probe failed: {result.stderr[-3000:]}')
            actual = json.loads(result.stdout)
            require(actual['totals']==expected, f'{language} differs from independent oracle')
            require(actual['invalidAccepted']==[False]*len(invalid), f'{language} accepted invalid cases: {[i for i,x in enumerate(actual["invalidAccepted"]) if x]}')
        return {'cases_per_language':len(CASES), 'invalid_cases_per_language':len(invalid), 'languages':[x[0] for x in commands], 'seed':20261110}


def mutations():
    source = (ROOT/'api-python/domain.py').read_text(encoding='utf-8')
    definitions = [
        ('round-half-down', 'return (value * rate + 50) // 100', 'return (value * rate + 49) // 100'),
        ('omit-mobility', "rate = 5 if q['pricingVersion']", "rate = 0 if q['pricingVersion']"),
        ('omit-tax', 'tax = percent(base, 18)', 'tax = percent(base, 0)'),
        ('fixed-advance', "advance = percent(total, q['advancePercent'])", 'advance = percent(total, 50)'),
        ('balance-addition', 'balance=total-advance', 'balance=total+advance'),
        ('allow-historical-create', "if creating and (q.get('formVersion')!=2 or q.get('pricingVersion')!=2):", "if False:"),
        ('omit-phone-check', "if creating and not re.fullmatch(r'(?:\\+51 ?)?[0-9]{9}',q['contact']):", 'if False:'),
        ('omit-address-check', "if creating and q['locationMode'] == 'on_location' and not q['address']:", 'if False:'),
        ('extend-validity', 'dt.timedelta(days=21)', 'dt.timedelta(days=22)'),
    ]
    results = []
    for name, old, new in definitions:
        require(source.count(old)==1, f'Mutant {name} is stale; source pattern count {source.count(old)}')
        mutated = types.ModuleType(f'qa_mutant_{name.replace("-","_")}')
        mutated.__file__ = str(ROOT/'api-python/domain.py')
        exec(compile(source.replace(old,new),mutated.__file__,'exec'), mutated.__dict__)
        killed = False
        try:
            financial_assertions(mutated, full=False)
            validation_assertions(mutated)
        except AssertionError as exc:
            killed = True
            reason = str(exc)[:250]
        results.append(dict(mutant=name, status='killed' if killed else 'survived', reason=reason if killed else 'No assertion failed'))
    survivors = [x['mutant'] for x in results if x['status']!='killed']
    require(not survivors, 'Surviving mutants: '+', '.join(survivors))
    return {'generated':len(results), 'killed':len(results), 'survived':0, 'score_percent':100, 'scope':'Directed Python finance/validation mutants; no whole-repository claim', 'mutants':results}


def component_storage():
    from fastapi import Request
    from fastapi.testclient import TestClient
    main = importlib.import_module('main')
    with tempfile.TemporaryDirectory(prefix='cotizasweet-storage-') as temp:
        main.DATABASE = Path(temp)/'quotes.sqlite'
        @asynccontextmanager
        async def isolated_lifespan(app):
            main.initialize_database()
            yield
        def test_identity(request:Request):
            # Test-only injection. Never added to production app source.
            return request.headers.get('X-Test-Owner','alice'), request.headers.get('X-Test-Scopes','quotes:read quotes:write').split()
        main.app.router.lifespan_context=isolated_lifespan
        main.app.dependency_overrides[main.identity]=test_identity
        latencies=[]
        try:
            with TestClient(main.app) as client:
                # No provider lookup: DNI only. Real credentials are never loaded.
                q=qcase()
                def save(index):
                    started=time.perf_counter()
                    r=client.post('/api/quotes',json={**q,'event':f'QA concurrent {index}'},headers={'X-Test-Owner':'alice' if index%2==0 else 'bob'})
                    elapsed=(time.perf_counter()-started)*1000
                    require(r.status_code==201, f'Concurrent write: {r.status_code} {r.text[:200]}')
                    require(r.json()['totalCents']==oracle(q)['total'], 'Stored total mismatch')
                    return r.json(),elapsed
                started=time.perf_counter()
                with ThreadPoolExecutor(max_workers=8) as pool:
                    writes=list(pool.map(save,range(64)))
                duration=time.perf_counter()-started
                latencies=[x[1] for x in writes]
                require(len({x[0]['id'] for x in writes})==64, 'Duplicate quote IDs')
                for owner in ('alice','bob'):
                    rows=client.get('/api/quotes',headers={'X-Test-Owner':owner}).json()['quotes']
                    require(len(rows)==32, f'User isolation/count failure {owner}')
                    require(all(int(x['quote']['event'].rsplit(' ',1)[1])%2==(0 if owner=='alice' else 1) for x in rows), 'Cross-owner disclosure')
                injection="alice' OR 1=1 --"
                require(client.get('/api/quotes',headers={'X-Test-Owner':injection}).json()['quotes']==[], 'SQL injection/owner isolation')
                require(client.get('/api/quotes',headers={'X-Test-Scopes':'quotes:write'}).status_code==403, 'Read scope ignored')
                require(client.post('/api/quotes',json=q,headers={'X-Test-Scopes':'quotes:read'}).status_code==403, 'Write scope ignored')
                require(client.post('/api/quotes',content='{bad json',headers={'Content-Type':'application/json'}).status_code==400, 'Malformed JSON')
                require(client.post('/api/quotes',content='A'*70001,headers={'Content-Type':'application/json'}).status_code==413, 'Body size limit')
                require(client.post('/api/quotes',content='{}',headers={'Content-Type':'text/plain'}).status_code==415, 'Content type limit')
                before_count=len(client.get('/api/quotes').json()['quotes'])
                for invalid in invalid_cases():
                    r=client.post('/api/quotes',json=invalid)
                    require(r.status_code==400, f'Invalid payload returned {r.status_code}')
                require(len(client.get('/api/quotes').json()['quotes'])==before_count, 'Invalid submissions changed data')
                # Empty owner must not disclose another account; no synthetic token used.
                require(client.get('/api/quotes',headers={'X-Test-Owner':'unknown'}).json()['quotes']==[], 'Empty-history isolation')
            # Reopen persisted file independently after application client shutdown.
            with closing(sqlite3.connect(main.DATABASE)) as db:
                require(db.execute('PRAGMA quick_check').fetchone()[0]=='ok', 'SQLite corruption')
                require(db.execute('PRAGMA journal_mode').fetchone()[0].lower()=='wal', 'WAL not enabled')
                require(db.execute('SELECT COUNT(*) FROM quotes').fetchone()[0]==64, 'Durability after reopen')
                require(db.execute('SELECT COUNT(DISTINCT id) FROM quotes').fetchone()[0]==64, 'ID uniqueness')
                # SQLite online backup includes committed WAL records. This validates
                # the database mechanism, not an absent application backup feature.
                backup=sqlite3.connect(Path(temp)/'restored.sqlite')
                try:
                    db.backup(backup)
                    require(backup.execute('PRAGMA quick_check').fetchone()[0]=='ok', 'Backup corruption')
                    require(backup.execute('SELECT id,payload,total_cents FROM quotes ORDER BY id').fetchall()==db.execute('SELECT id,payload,total_cents FROM quotes ORDER BY id').fetchall(), 'Backup lost data')
                finally:
                    backup.close()
            p95=sorted(latencies)[math.ceil(len(latencies)*.95)-1]
            # Generous local guardrails, set before execution. No public capacity claim.
            require(p95<2500, f'Local concurrent write p95 {p95:.1f}ms exceeds 2500ms')
            require(duration<30, f'64 writes took {duration:.2f}s, threshold 30s')
            return {'component':'Python route + real SQLite (identity substituted)', 'writes':64, 'workers':8,
                    'durable_records':64,'backup_restore_equivalent':True,'quick_check':'ok',
                    'write_latency_ms':{'median':round(statistics.median(latencies),2),'p95':round(p95,2),'max':round(max(latencies),2)},
                    'elapsed_seconds':round(duration,3),'thresholds':{'p95_ms':2500,'total_seconds':30},
                    'scope':'In-process local component performance; no network or production capacity assertion'}
        finally:
            main.app.dependency_overrides.clear()


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--node',help='Node executable to include TypeScript parity')
    parser.add_argument('--dotnet-probe',help='Compiled tests/v2/dotnet-probe/.../FinancialProbe.dll')
    parser.add_argument('--output',default=str(ROOT/'tests/artifacts/v2-quality.json'))
    args=parser.parse_args()
    source_paths=('api-python/domain.py','api-python/main.py','web/lib/quote.ts','api-dotnet/QuoteDomain.cs','api-dotnet/Program.cs','contracts/quote.schema.json','web/package-lock.json','api-python/requirements.lock.txt')
    report={'suite':'CotizaSweet v2 necessary additional QA','schema_version':1,
            'executed_at_utc':dt.datetime.now(dt.timezone.utc).isoformat(),
            'environment':{'python':platform.python_version(),'sqlite':sqlite3.sqlite_version,'os':platform.platform()},
            'source_sha256':{name:hashlib.sha256((ROOT/name).read_bytes()).hexdigest() for name in source_paths},
            'financial_cases':len(CASES),'results':EVIDENCE,'limitations':[
                'Component HTTP identity is substituted; OIDC/JWT requires tests/integration.py.',
                'Mutations cover directed Python finance/validation changes, not every source file.',
                'Performance uses synthetic local requests and SQLite, not internet or production load.',
                'SQLite backup API verified; no automated operational backup policy is implied.'
            ]}
    status=0
    try:
        record('financial-integer-oracle', 'unit/regression', lambda:(financial_assertions(domain),{'cases':len(CASES)})[1])
        record('validation-boundaries', 'unit/security/regression', lambda:(validation_assertions(domain),{'invalid_cases':len(invalid_cases())})[1])
        if args.node or args.dotnet_probe:
            record('cross-language-financial-parity','integration',lambda:cross_language(args.node,args.dotnet_probe))
        record('directed-real-source-mutations','mutation',mutations)
        record('route-sqlite-concurrency-durability','integration/security/performance',component_storage)
        report['status']='passed'
    except Exception as exc:
        report['status']='failed'
        report['error']=f'{type(exc).__name__}: {exc}'
        print(report['error'],file=sys.stderr)
        status=1
    finally:
        path=Path(args.output)
        path.parent.mkdir(parents=True,exist_ok=True)
        path.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
        print(f'Evidence: {path}',flush=True)
    return status


if __name__=='__main__':
    raise SystemExit(main())

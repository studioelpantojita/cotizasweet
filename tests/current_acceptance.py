"""Reproduce account, guest and campaign acceptance with disposable local state.

No operator configuration, account, production volume, external identity or mail
provider is used. Credentials and service logs live only in the temporary folder
and are never uploaded. The .NET Release application must already be built.
"""
import json
import os
from pathlib import Path
import secrets
import shutil
import socket
import subprocess
import sys
import time
from datetime import datetime, timedelta, timezone

import httpx
from integration import isolated_directory
from process_tree import OwnedProcess

ROOT = Path(__file__).resolve().parents[1]
ARTIFACT = ROOT / 'tests/artifacts/current-acceptance.json'


def free_port():
    with socket.socket() as listener:
        listener.bind(('127.0.0.1', 0))
        return listener.getsockname()[1]


def ready(url, process):
    for _ in range(180):
        if process.poll() is not None:
            raise RuntimeError('Disposable acceptance service exited before readiness.')
        try:
            if httpx.get(url, trust_env=False, timeout=2).status_code == 200:
                return
        except httpx.HTTPError:
            pass
        time.sleep(.5)
    raise TimeoutError('Disposable acceptance service did not become ready.')


def main():
    report = {'status': 'failed', 'scope': 'Disposable loopback .NET, web accounts, guest quotations, immutable PDFs and administrator inbox. RUC demo; no external identity or email.', 'suites': []}
    processes = []
    dist = ROOT / 'web/.next-acceptance'
    generated_files = {ROOT / 'web' / name: (ROOT / 'web' / name).read_bytes() if (ROOT / 'web' / name).exists() else None
                       for name in ('tsconfig.json', 'next-env.d.ts')}
    # This directory is owned exclusively by this runner. Do not touch local instances.
    if dist.exists():
        raise RuntimeError('Acceptance build directory already exists; verify no acceptance run is active before removing it.')
    try:
        with isolated_directory() as temporary:
            folder = Path(temporary)
            web_port, api_port, ruc_port = free_port(), free_port(), free_port()
            if len({web_port, api_port, ruc_port}) != 3:
                raise RuntimeError('Disposable service ports collided. Retry the acceptance command.')
            origin = f'http://127.0.0.1:{web_port}'
            api_origin = f'http://127.0.0.1:{api_port}'
            ruc_origin = f'http://127.0.0.1:{ruc_port}'
            configuration = {'synthetic': True, 'origin': origin, 'apiOrigin': api_origin,
                             'webDatabase': str(folder / 'web.sqlite'), 'apiDatabase': str(folder / 'api.sqlite'),
                             'accounts': [{'username': 'qa_' + role, 'password': secrets.token_urlsafe(24), 'role': role}
                                          for role in ('admin', 'customer')]}
            credentials = folder / 'acceptance.json'
            credentials.write_text(json.dumps(configuration), encoding='utf-8')
            credentials.chmod(0o600)
            env = {key: value for key, value in os.environ.items() if not key.lower().endswith('_proxy')}
            for key in ('RUC_API_TOKEN', 'OIDC_CLIENT_SECRET', 'NODE_OPTIONS', 'PYTHONPATH'):
                env.pop(key, None)
            env.update(NODE_ENV='development', APP_ENV='development', ASPNETCORE_ENVIRONMENT='Development',
                       APP_ORIGIN=origin, ACCOUNT_AUTH_ENABLED='true', ACCOUNT_ISSUER=origin + '/accounts',
                       ACCOUNT_JWT_SECRET=secrets.token_hex(32), SESSION_SECRET=secrets.token_hex(32),
                       OIDC_EXTERNAL_LOGIN_ENABLED='false', OIDC_PROVIDER='standard', OIDC_ISSUER='https://oidc.invalid',
                       OIDC_AUDIENCE='ea-cotiza-api', OIDC_ALLOW_LOCAL_HTTP='false', API_BACKEND='dotnet',
                       API_BASE_URL=api_origin, RUC_SERVICE_URL=ruc_origin, RUC_PROVIDER='demo',
                       INTEGRATION_SERVICE_KEY=secrets.token_urlsafe(48), RUC_QUOTA_PATH=str(folder / 'ruc.sqlite'),
                       DATABASE_PATH=configuration['webDatabase'], BACKUP_DIR=str(folder / 'backups'),
                       BACKUP_INTERVAL_HOURS='2', BACKUP_KEEP='2', NEXT_DIST_DIR='.next-acceptance',
                       NEXT_TELEMETRY_DISABLED='1', PYTHONUTF8='1', TRUSTED_CLIENT_IP_HEADER='',
                       E2E_CREDENTIALS_FILE=str(credentials), E2E_ORIGIN=origin, EA_EPHEMERAL_ACCEPTANCE='1')
            node = os.environ.get('NODE_EXEC', 'node')
            dotnet = os.environ.get('DOTNET_EXEC', 'dotnet')
            with open(folder / 'services.log', 'w+', encoding='utf-8') as log:
                def start(command, cwd, extra=None):
                    process = OwnedProcess(command, cwd=cwd, env={**env, **(extra or {})}, stdout=log, stderr=log)
                    processes.append(process)
                    return process

                def run(name, command):
                    print('Running disposable acceptance: ' + name, flush=True)
                    subprocess.run(command, cwd=ROOT, env=env, check=True, timeout=600)
                    report['suites'].append({'name': name, 'status': 'passed'})

                try:
                    subprocess.run([node, str(ROOT / 'web/scripts/run-ts.cjs'), str(ROOT / 'tests/seed_acceptance_accounts.ts')],
                                   cwd=ROOT, env=env, check=True, timeout=90)
                    ruc = start([sys.executable, '-m', 'uvicorn', 'ruc_service:app', '--host', '127.0.0.1', '--port', str(ruc_port), '--no-access-log'], ROOT / 'api-python')
                    ready(ruc_origin + '/health', ruc)
                    api = start([dotnet, str(ROOT / 'api-dotnet/bin/Release/net10.0/Cotiza.Api.dll')], ROOT / 'api-dotnet',
                                {'DATABASE_PATH': configuration['apiDatabase'], 'ASPNETCORE_URLS': api_origin})
                    ready(api_origin + '/health', api)
                    web = start([node, 'node_modules/next/dist/bin/next', 'dev', '--webpack', '--hostname', '127.0.0.1', '--port', str(web_port)], ROOT / 'web')
                    ready(origin + '/api/health', web)
                    run('account HTTP', [sys.executable, 'tests/account_workflow.py'])
                    run('guest HTTP', [sys.executable, 'tests/guest_workflow.py'])
                    if os.environ.get('RUN_BROWSER_E2E') == '1':
                        run('guest browser', [node, str(ROOT / 'tests/guest-quote.e2e.mjs')])
                    today = datetime.now(timezone(timedelta(hours=-5))).date().isoformat()
                    if '2026-11-23' <= today <= '2027-01-02':
                        run('promotion HTTP', [sys.executable, 'tests/promotion_workflow.py'])
                        if os.environ.get('RUN_BROWSER_E2E') == '1':
                            for name, script in [('Christmas announcement browser', 'christmas-offer.e2e.mjs'),
                                                 ('promotion registration browser', 'promotion-register.e2e.mjs')]:
                                run(name, [node, str(ROOT / 'tests' / script)])
                    else:
                        report['suites'].append({'name': 'seasonal live-clock campaign acceptance', 'status': 'skipped',
                                                 'reason': 'Campaign registration is closed on the real server date. Deterministic boundary and expired-campaign tests remain in npm test.'})
                    report.update(status='passed', temporary_state=True, external_email='not_configured')
                finally:
                    for process in reversed(processes):
                        process.stop()
    except Exception as error:
        # Do not include child output, environment, service logs or credentials.
        report['error'] = type(error).__name__
        raise
    finally:
        if dist.exists():
            expected = (ROOT / 'web/.next-acceptance').resolve()
            if dist.resolve() != expected or expected.parent != (ROOT / 'web').resolve():
                raise RuntimeError('Invalid disposable build cleanup target.')
            for attempt in range(50):
                try:
                    shutil.rmtree(dist)
                    break
                except PermissionError:
                    if attempt == 49:
                        raise
                    time.sleep(.1)
        for path, content in generated_files.items():
            if content is None:
                path.unlink(missing_ok=True)
            elif not path.exists() or path.read_bytes() != content:
                path.write_bytes(content)
        ARTIFACT.parent.mkdir(parents=True, exist_ok=True)
        ARTIFACT.write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps(report))


if __name__ == '__main__':
    main()

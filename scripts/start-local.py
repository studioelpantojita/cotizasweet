"""Inicia Next.js + .NET + Python y una identidad local OIDC desde Visual Studio."""
import argparse, json, os, secrets, signal, socket, subprocess, sys, time, webbrowser
from pathlib import Path
import httpx

# Redirected Windows output may default to cp1252. Logging must never stop services.
for stream in (sys.stdout, sys.stderr):
    if hasattr(stream, 'reconfigure'):
        stream.reconfigure(encoding='utf-8', errors='replace')

ROOT = Path(__file__).resolve().parent.parent
parser = argparse.ArgumentParser()
parser.add_argument('--configuration', choices=['Debug','Release'], default='Debug')
parser.add_argument('--no-browser',action='store_true')
args = parser.parse_args()
settings = json.loads((ROOT/'local.settings.json').read_text(encoding='utf-8-sig'))
ports = {'web':3340, 'api':8340, 'ruc':8341, 'identity':9340, **settings.get('ports',{})}
if any(type(port) is not int or not 1024 <= port <= 65535 for port in ports.values()) or len(set(ports.values())) != len(ports):
    raise ValueError('Los puertos de local.settings.json deben ser enteros distintos entre 1024 y 65535.')
urls = {name:f'http://127.0.0.1:{port}' for name,port in ports.items()}
env = {k:v for k,v in os.environ.items() if not k.lower().endswith('_proxy')}
private = ROOT/'.env.ruc.local'
if private.exists():
    for line in private.read_text(encoding='utf-8-sig').splitlines():
        if '=' in line and not line.lstrip().startswith('#'):
            key,value = line.split('=',1)
            if key.strip() in ('RUC_PROVIDER','RUC_API_TOKEN'): env[key.strip()] = value.strip().strip('"').strip("'")
env.update(APP_ENV='development',NODE_ENV='development',ASPNETCORE_ENVIRONMENT='Development',OIDC_ISSUER=urls['identity'],OIDC_AUDIENCE='ea-cotiza-api',OIDC_CLIENT_ID='ea-cotiza-local',OIDC_CLIENT_SECRET=secrets.token_urlsafe(40),SESSION_SECRET=secrets.token_hex(32),OIDC_ALLOW_LOCAL_HTTP='true',APP_ORIGIN=urls['web'],API_BACKEND='dotnet',API_BASE_URL=urls['api'],RUC_SERVICE_URL=urls['ruc'],INTEGRATION_SERVICE_KEY=secrets.token_urlsafe(48),NEXT_TELEMETRY_DISABLED='1',PYTHONUTF8='1',LOCAL_WEB_PORT=str(ports['web']),LOCAL_IDENTITY_PORT=str(ports['identity']))
env['PYTHONPATH'] = settings.get('pythonModules','')
# Each local web port has independent build files, so parallel previews do not lock each other.
env['NEXT_DIST_DIR'] = f".next-local-{ports['web']}"
env['PATH'] = str(Path(settings['node']).parent)+os.pathsep+env.get('PATH','')
logs = ROOT/'logs'; logs.mkdir(exist_ok=True)
data = ROOT/'data'; data.mkdir(exist_ok=True)
processes,files = [],[]

def start(name,command,cwd,extra=None):
    output = open(logs/(name+'.log'),'w',encoding='utf-8'); files.append(output)
    service_env={**env,**(extra or {})}
    if name!='python-ruc': service_env.pop('RUC_API_TOKEN',None)
    proc = subprocess.Popen(command,cwd=cwd,env=service_env,stdout=output,stderr=output)
    processes.append((name,proc)); print('Iniciando '+name+'…',flush=True); return proc
def ready(url,proc):
    for _ in range(180):
        if proc.poll() is not None: raise RuntimeError('Un servicio terminó. Revisa la carpeta logs.')
        try:
            if httpx.get(url,timeout=2,trust_env=False).status_code < 500: return
        except httpx.HTTPError: pass
        time.sleep(.5)
    raise RuntimeError('No inició '+url)
def stop(*_): raise KeyboardInterrupt()
signal.signal(signal.SIGTERM,stop)
try:
    for port in ports.values():
        with socket.socket() as probe:
            try: probe.bind(('127.0.0.1',port))
            except OSError: raise RuntimeError(f'El puerto {port} está ocupado. Revisa la instancia anterior o configura otros puertos en local.settings.json.')
    identity = start('identidad-local',[settings['python'],str(ROOT/'scripts/local-identity.py')],ROOT)
    ready(urls['identity']+'/.well-known/openid-configuration',identity)
    ruc = start('python-ruc',[settings['python'],'-m','uvicorn','ruc_service:app','--host','127.0.0.1','--port',str(ports['ruc']),'--no-access-log'],ROOT/'api-python')
    ready(urls['ruc']+'/health',ruc)
    api = start('dotnet-api',[settings['dotnet'],str(ROOT/f'api-dotnet/bin/{args.configuration}/net10.0/Cotiza.Api.dll')],ROOT/'api-dotnet',{'ASPNETCORE_URLS':urls['api'],'DATABASE_PATH':str(data/'quotes.sqlite')})
    ready(urls['api']+'/health',api)
    web = start('next-typescript',[settings['node'],'node_modules/next/dist/bin/next','dev','--webpack','--hostname','127.0.0.1','--port',str(ports['web'])],ROOT/'web',{'DATABASE_PATH':str(data/'sessions.sqlite')})
    ready(urls['web']+'/cotizar',web)
    print('\nAplicación: '+urls['web']+'/cotizar\nTypeScript / Next.js → .NET → Python → proveedor RUC\nIdentidad de desarrollo local. Detén la depuración para cerrar los servicios.',flush=True)
    if not args.no_browser: webbrowser.open(urls['web']+'/cotizar')
    while all(p.poll() is None for _,p in processes): time.sleep(1)
    raise RuntimeError('Un servicio se detuvo. Revisa logs y reinicia la aplicación.')
except KeyboardInterrupt: print('Cerrando servicios locales.',flush=True)
finally:
    for name,proc in reversed(processes):
        if proc.poll() is None:
            if os.name == 'nt': subprocess.run(['taskkill','/PID',str(proc.pid),'/T','/F'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
            else: proc.terminate()
        try: proc.wait(timeout=10)
        except subprocess.TimeoutExpired: proc.kill(); proc.wait()
    for file in files: file.close()

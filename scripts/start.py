"""Development launcher for Windows, Linux and macOS. No secrets are printed."""
import argparse, os, shutil, subprocess, sys, time
from pathlib import Path
from urllib.parse import urlparse
ROOT=Path(__file__).resolve().parent.parent
parser=argparse.ArgumentParser(description='Iniciar E&A Cotiza Pastelería en desarrollo.')
parser.add_argument('--backend',choices=['next','python','dotnet'])
args=parser.parse_args()
env=dict(os.environ)
file=ROOT/'.env'
if file.exists():
    for line in file.read_text(encoding='utf-8-sig').splitlines():
        line=line.strip()
        if not line or line.startswith('#'):continue
        key,separator,value=line.partition('=')
        if not separator:raise SystemExit('Línea sin = en .env')
        env[key.strip()]=value.strip().strip('\"\'')
backend=args.backend or env.get('API_BACKEND','next')
env['API_BACKEND']=backend
env['NODE_ENV']='development';env['APP_ENV']='development';env['ASPNETCORE_ENVIRONMENT']='Development'
env.setdefault('APP_ORIGIN','http://localhost:3000')
env['API_BASE_URL']='http://127.0.0.1:8000'
processes=[]
try:
    if backend=='python':
        processes.append(subprocess.Popen([sys.executable,'-m','uvicorn','main:app','--host','127.0.0.1','--port','8000'],cwd=ROOT/'api-python',env={**env,'DATABASE_PATH':str(ROOT/'data/python.sqlite')}))
    elif backend=='dotnet':
        dotnet=shutil.which('dotnet')
        if not dotnet:raise SystemExit('Instala el SDK .NET 10.')
        processes.append(subprocess.Popen([dotnet,'run','--no-launch-profile','--urls','http://127.0.0.1:8000'],cwd=ROOT/'api-dotnet',env={**env,'DATABASE_PATH':str(ROOT/'data/dotnet.sqlite')}))
    node=shutil.which('node')
    if not node:raise SystemExit('Instala Node.js 24.')
    port=urlparse(env['APP_ORIGIN']).port or 3000
    processes.append(subprocess.Popen([node,'node_modules/next/dist/bin/next','dev','--webpack','--port',str(port)],cwd=ROOT/'web',env={**env,'DATABASE_PATH':str(ROOT/'data/web.sqlite')}))
    print('E&A Cotiza: '+env['APP_ORIGIN']+' | backend: '+backend+' | Ctrl+C para detener',flush=True)
    while all(p.poll() is None for p in processes):time.sleep(.5)
    if any(p.returncode not in (None,0) for p in processes):raise SystemExit('Uno de los servicios terminó con error. Revisa su mensaje anterior.')
except KeyboardInterrupt:pass
finally:
    for p in reversed(processes):
        if p.poll() is None:
            p.terminate()
            try:p.wait(timeout=10)
            except subprocess.TimeoutExpired:p.kill();p.wait()

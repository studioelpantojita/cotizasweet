"""Production-image smoke using disposable, uniquely named Docker resources."""
import argparse
import json
import os
from pathlib import Path
import re
import secrets
import subprocess
import time
import urllib.request
import urllib.error

ROOT=Path(__file__).resolve().parents[1]
PREFIX='cotizasweet-ci-'+secrets.token_hex(5)
KEY=secrets.token_urlsafe(48)
ENV={**os.environ,'INTEGRATION_SERVICE_KEY':KEY,'SESSION_SECRET':secrets.token_hex(32)}
owned_containers=[];owned_volumes=[];owned_images=[];network_created=False

def diagnostic(value):
    text=str(value)
    for secret in (KEY,ENV['SESSION_SECRET']):text=text.replace(secret,'[redacted]')
    text=re.sub(r'(?i)\bBearer[ \t]+[^\s"\'<>]+','Bearer [redacted]',text)
    text=re.sub(r'\beyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*','[redacted-jwt]',text)
    return text[:2000]

def docker(*args):
    result=subprocess.run(['docker',*args],capture_output=True,text=True,
        encoding='utf-8',errors='replace',env=ENV)
    if result.returncode:raise RuntimeError('Docker operation failed: '+args[0]+': '+diagnostic(result.stderr or 'No stderr returned.'))
    return result.stdout.strip()

def http(path,expected=200,headers=None):
    try:
        with urllib.request.urlopen(urllib.request.Request(path,headers=headers or {}),timeout=5) as response:status=response.status;data=response.read()
    except urllib.error.HTTPError as error:status=error.code;data=error.read()
    if status!=expected:raise AssertionError('Unexpected HTTP status '+str(status))
    return data

def ready(url):
    for _ in range(120):
        try:http(url);return
        except (OSError,AssertionError):time.sleep(.5)
    raise TimeoutError('Container healthcheck did not become ready')

def start(label,image,port,variables,volume=None,alias=None):
    name=PREFIX+'-'+label
    args=['run','-d','--name',name,'--network',PREFIX]
    if alias:args+=['--network-alias',alias]
    args+=['-p','127.0.0.1:'+port]
    if volume:args+=['-v',volume+':/app/data']
    args+=['-e','INTEGRATION_SERVICE_KEY']
    for value in variables:args+=['-e',value]
    if label=='web':args+=['-e','SESSION_SECRET']
    args+=[image]
    docker(*args);owned_containers.append(name)
    return name

def main(build=False):
    global network_created
    result={'status':'failed','scope':'Production Docker images with synthetic configuration; external OIDC/RUC and public HTTPS remain separate.'}
    try:
        images={label:f'cotizasweet-{label}:ci' for label in ('web','api','ruc')}
        if build:
            images={label:f'cotizasweet-{label}:{PREFIX}' for label in images}
            docker('info','--format','{{.ServerVersion}}')
            for label,folder in (('web','web'),('api','api-dotnet'),('ruc','api-python')):
                print('Construyendo imagen de '+folder+'…',flush=True)
                owned_images.append(images[label])
                docker('build','-f',str(ROOT/folder/'Dockerfile'),'-t',images[label],str(ROOT))
        docker('network','create',PREFIX);network_created=True
        for label in ('web','quotes','ruc'):
            volume=PREFIX+'-'+label;docker('volume','create',volume);owned_volumes.append(volume)
        ruc=start('ruc',images['ruc'],'8389:8000',['APP_ENV=production','RUC_PROVIDER=disabled','OIDC_ALLOW_LOCAL_HTTP=false','RUC_QUOTA_PATH=/app/data/ruc-quota.sqlite'],owned_volumes[2],'api-python')
        ready('http://127.0.0.1:8389/health')
        api=start('api',images['api'],'8388:8000',['ASPNETCORE_ENVIRONMENT=Production','OIDC_ISSUER=https://oidc.invalid','OIDC_AUDIENCE=cotizasweet-test','OIDC_ALLOW_LOCAL_HTTP=false','RUC_SERVICE_URL=http://api-python:8000'],owned_volumes[1],'api-dotnet')
        ready('http://127.0.0.1:8388/health')
        web=start('web',images['web'],'3388:3000',['NODE_ENV=production','APP_ORIGIN=https://smoke.invalid','API_BACKEND=dotnet','API_BASE_URL=http://api-dotnet:8000','OIDC_ISSUER=https://oidc.invalid','OIDC_ALLOW_LOCAL_HTTP=false'],owned_volumes[0])
        ready('http://127.0.0.1:3388/api/health')
        for path in ('/','/catalogo','/cotizar','/api/catalog'):http('http://127.0.0.1:3388'+path)
        http('http://127.0.0.1:3388/api/quotes',401)
        http('http://127.0.0.1:8389/api/clients/ruc/20999999990',401)
        http('http://127.0.0.1:3388/api/clients/ruc/20999999990',403)
        http('http://127.0.0.1:3388/api/clients/ruc/20999999990',503,{'X-Cotiza-Request':'ruc'})
        users={}
        for name in owned_containers:
            status=docker('exec',name,'cat','/proc/1/status')
            uid=next(line.split()[1] for line in status.splitlines() if line.startswith('Uid:'))
            assert uid!='0','Application must drop root privileges';users[name.rsplit('-',1)[-1]]=int(uid)
        # Login quota is persisted before the intentionally unconfigured OIDC login fails.
        http('http://127.0.0.1:3388/auth/login',503)
        probe="const {DatabaseSync}=require('node:sqlite');const d=new DatabaseSync('/app/data/cotiza.sqlite',{readOnly:true});console.log(d.prepare('select sum(hits) as n from request_limits').get().n);d.close();"
        before=int(docker('exec',web,'node','-e',probe))
        docker('restart',web);ready('http://127.0.0.1:3388/api/health')
        after=int(docker('exec',web,'node','-e',probe));assert before==after and after>0
        docker('restart',api);ready('http://127.0.0.1:8388/health');http('http://127.0.0.1:3388/api/catalog')
        # Reserve a synthetic paid-attempt counter through the same atomic implementation.
        # The provider stays disabled, so this makes no paid network call.
        quota_probe="import ruc_service as r; r._reserve_paid_lookup(); print('reserved')"
        assert docker('exec',ruc,'python','-c',quota_probe)=='reserved'
        quota_read="import sqlite3; d=sqlite3.connect('/app/data/ruc-quota.sqlite'); print(d.execute('SELECT sum(used) FROM paid_ruc_quota').fetchone()[0])"
        before_ruc=int(docker('exec',ruc,'python','-c',quota_read))
        docker('restart',ruc);ready('http://127.0.0.1:8389/health')
        assert int(docker('exec',ruc,'python','-c',quota_read))==before_ruc==1
        snapshots=docker('exec',api,'find','/app/data/backups','-name','cotiza-*.sqlite').splitlines()
        assert len(snapshots)==1,'Automatic API backup must exist after startup'
        result.update(status='passed',services=3,volumes=3,application_uids=users,persistent_web_quota=True,persistent_ruc_daily_quota=True,automatic_api_backup=True,api_volume_restart=True,anonymous_quotes=401,ruc_without_credentials=401,ruc_cross_site_guard=403,ruc_disabled=503)
    except Exception as error:
        result['error']=diagnostic(type(error).__name__+': '+str(error))
        raise
    finally:
        failed_before_cleanup=result['status']=='failed'
        cleanup_errors=[]
        cleanup=[('rm','-f',name) for name in reversed(owned_containers)]
        cleanup += [('volume','rm',volume) for volume in owned_volumes]
        if network_created:cleanup.append(('network','rm',PREFIX))
        cleanup += [('image','rm',image) for image in owned_images]
        for operation in cleanup:
            try:docker(*operation)
            except Exception as error:cleanup_errors.append(diagnostic(type(error).__name__+': '+str(error)))
        if cleanup_errors:result.update(status='failed',cleanup_errors=cleanup_errors)
        artifact=ROOT/'tests/artifacts/container-smoke.json';artifact.parent.mkdir(parents=True,exist_ok=True);artifact.write_text(json.dumps(result,indent=2),encoding='utf-8')
        if cleanup_errors and not failed_before_cleanup:raise RuntimeError('Synthetic Docker resource cleanup failed; see sanitized report.')
    print(json.dumps(result))

if __name__=='__main__':
    parser=argparse.ArgumentParser(description='Construir y comprobar tres imágenes con datos sintéticos y recursos temporales de Docker.')
    parser.add_argument('--build',action='store_true',help='Construye imágenes con etiquetas únicas antes del smoke y retira esas etiquetas al terminar.')
    main(parser.parse_args().build)

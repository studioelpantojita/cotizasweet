"""Production-image smoke using disposable, uniquely named Docker resources."""
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
owned_containers=[];owned_volumes=[];network_created=False

def diagnostic(value):
    text=str(value)
    for secret in (KEY,ENV['SESSION_SECRET']):text=text.replace(secret,'[redacted]')
    text=re.sub(r'(?i)\bBearer[ \t]+[^\s"\'<>]+','Bearer [redacted]',text)
    text=re.sub(r'\beyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*','[redacted-jwt]',text)
    return text[:2000]

def docker(*args):
    result=subprocess.run(['docker',*args],capture_output=True,text=True,env=ENV)
    if result.returncode:raise RuntimeError('Docker operation failed: '+args[0]+': '+diagnostic(result.stderr or 'No stderr returned.'))
    return result.stdout.strip()

def http(path,expected=200):
    try:
        with urllib.request.urlopen(path,timeout=5) as response:status=response.status;data=response.read()
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

def main():
    global network_created
    result={'status':'failed','scope':'Production Docker images with synthetic configuration; external OIDC/RUC and public HTTPS remain separate.'}
    try:
        docker('network','create',PREFIX);network_created=True
        for label in ('web','quotes'):
            volume=PREFIX+'-'+label;docker('volume','create',volume);owned_volumes.append(volume)
        ruc=start('ruc','cotizasweet-ruc:ci','8389:8000',['APP_ENV=production','RUC_PROVIDER=disabled','OIDC_ALLOW_LOCAL_HTTP=false'],alias='api-python')
        ready('http://127.0.0.1:8389/health')
        api=start('api','cotizasweet-api:ci','8388:8000',['ASPNETCORE_ENVIRONMENT=Production','OIDC_ISSUER=https://oidc.invalid','OIDC_AUDIENCE=cotizasweet-test','OIDC_ALLOW_LOCAL_HTTP=false','RUC_SERVICE_URL=http://api-python:8000'],owned_volumes[1],'api-dotnet')
        ready('http://127.0.0.1:8388/health')
        web=start('web','cotizasweet-web:ci','3388:3000',['NODE_ENV=production','APP_ORIGIN=https://smoke.invalid','API_BACKEND=dotnet','API_BASE_URL=http://api-dotnet:8000','OIDC_ISSUER=https://oidc.invalid','OIDC_ALLOW_LOCAL_HTTP=false'],owned_volumes[0])
        ready('http://127.0.0.1:3388/api/health')
        for path in ('/','/catalogo','/cotizar','/api/catalog'):http('http://127.0.0.1:3388'+path)
        http('http://127.0.0.1:3388/api/quotes',401)
        http('http://127.0.0.1:8389/api/clients/ruc/20999999990',401)
        http('http://127.0.0.1:3388/api/clients/ruc/20999999990',503)
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
        result.update(status='passed',services=3,application_uids=users,persistent_web_quota=True,api_volume_restart=True,anonymous_quotes=401,ruc_without_credentials=401,ruc_disabled=503)
    except Exception as error:
        result['error']=diagnostic(type(error).__name__+': '+str(error))
        raise
    finally:
        failed_before_cleanup=result['status']=='failed'
        cleanup_errors=[]
        cleanup=[('rm','-f',name) for name in reversed(owned_containers)]
        cleanup += [('volume','rm',volume) for volume in owned_volumes]
        if network_created:cleanup.append(('network','rm',PREFIX))
        for operation in cleanup:
            try:docker(*operation)
            except Exception as error:cleanup_errors.append(diagnostic(type(error).__name__+': '+str(error)))
        if cleanup_errors:result.update(status='failed',cleanup_errors=cleanup_errors)
        artifact=ROOT/'tests/artifacts/container-smoke.json';artifact.parent.mkdir(parents=True,exist_ok=True);artifact.write_text(json.dumps(result,indent=2),encoding='utf-8')
        if cleanup_errors and not failed_before_cleanup:raise RuntimeError('Synthetic Docker resource cleanup failed; see sanitized report.')
    print(json.dumps(result))

if __name__=='__main__':main()

"""Local integration suite. Ephemeral OIDC test issuer; never run as an identity service."""
import argparse, base64, hashlib, json, os, secrets, shutil, subprocess, sys, tempfile, threading, time
from pathlib import Path
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs, urlencode
from contextlib import contextmanager
from process_tree import OwnedProcess
import httpx, jwt
from cryptography.hazmat.primitives.asymmetric import rsa

ROOT=Path(__file__).resolve().parent.parent
KEY=rsa.generate_private_key(public_exponent=65537,key_size=2048)
ISSUER='http://127.0.0.1:9190'
AUDIENCE='ea-cotiza-api'
CLIENT='ea-cotiza-web'
SECRET=secrets.token_urlsafe(32)
CODES={}
CHECK_COUNT=0

@contextmanager
def isolated_directory():
    folder=Path(tempfile.mkdtemp(prefix='ea-test-')).resolve()
    try:yield str(folder)
    finally:
        # Windows can release inherited service-log handles after process exit.
        # Keep cleanup strict but allow that bounded release delay.
        if folder.parent!=Path(tempfile.gettempdir()).resolve() or not folder.name.startswith('ea-test-'):
            raise RuntimeError('Invalid isolated test directory')
        for attempt in range(50):
            try:shutil.rmtree(folder);break
            except PermissionError:
                if attempt==49:raise
                time.sleep(.1)
def token(sub='alice',scope='quotes:read quotes:write',**overrides):
    now=int(time.time())
    claims=dict(iss=ISSUER,sub=sub,aud=AUDIENCE,iat=now,exp=now+900,scope=scope)
    claims.update(overrides)
    return jwt.encode(claims,KEY,algorithm='RS256',headers={'kid':'test-key'})

class Issuer(BaseHTTPRequestHandler):
    def log_message(self,*args):pass
    def json(self,payload,status=200):
        data=json.dumps(payload).encode();self.send_response(status);self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(data)));self.end_headers();self.wfile.write(data)
    def do_GET(self):
        url=urlparse(self.path)
        if url.path=='/.well-known/openid-configuration':
            self.json(dict(issuer=ISSUER,authorization_endpoint=ISSUER+'/authorize',token_endpoint=ISSUER+'/token',jwks_uri=ISSUER+'/jwks',response_types_supported=['code'],subject_types_supported=['public'],id_token_signing_alg_values_supported=['RS256'],token_endpoint_auth_methods_supported=['client_secret_post','client_secret_basic'],code_challenge_methods_supported=['S256']))
        elif url.path=='/jwks':
            key=json.loads(jwt.algorithms.RSAAlgorithm.to_jwk(KEY.public_key()));key.update(kid='test-key',use='sig',alg='RS256');self.json({'keys':[key]})
        elif url.path=='/authorize':
            p={k:v[0] for k,v in parse_qs(url.query).items()};code=secrets.token_urlsafe(24);CODES[code]=p
            self.send_response(302);self.send_header('Location',p['redirect_uri']+'?'+urlencode({'code':code,'state':p['state']}));self.end_headers()
        else:self.json({},404)
    def do_POST(self):
        p={k:v[0] for k,v in parse_qs(self.rfile.read(int(self.headers.get('Content-Length','0'))).decode()).items()}
        authorization=self.headers.get('Authorization','')
        valid_secret=p.get('client_secret')==SECRET or authorization=='Basic '+base64.b64encode(f'{CLIENT}:{SECRET}'.encode()).decode()
        original=CODES.pop(p.get('code',''),None)
        challenge=base64.urlsafe_b64encode(hashlib.sha256(p.get('code_verifier','').encode()).digest()).decode().rstrip('=')
        if not valid_secret or not original or challenge!=original['code_challenge'] or p.get('redirect_uri')!=original['redirect_uri']:
            self.json({'error':'invalid_grant'},400);return
        sub=original.get('test_user','alice');scope=original.get('scope','')
        identity=token(sub,aud=CLIENT,nonce=original['nonce'],name='Usuario de prueba',email='demo@example.test')
        self.json(dict(access_token=token(sub,scope),id_token=identity,token_type='Bearer',expires_in=900,scope=scope))

def check(condition,message):
    global CHECK_COUNT
    if not condition:raise AssertionError(message)
    CHECK_COUNT+=1

def wait_http(url,proc):
    for _ in range(120):
        if proc.poll() is not None:raise RuntimeError('El proceso terminó antes de iniciar.')
        try:
            r=httpx.get(url,timeout=1,trust_env=False)
            if r.status_code<500:return
        except httpx.HTTPError:pass
        time.sleep(.5)
    raise RuntimeError('No inició el servicio: '+url)

def catalog_checks(client):
    result=client.get('/api/catalog')
    check(result.status_code==200,'Catálogo público no disponible: '+result.text[:200])
    data=result.json()
    check(len(data['products'])==6,'Catálogo incompleto')
    check({p['service'] for p in data['products']}=={'packs','insumos'},'Grupos incorrectos')
    check(all(p['published'] for p in data['products']),'Filtra productos privados')
    check(data['products'][0]['variants'][0]['prices']=={'PEN':8500},'Precio o moneda alterado')
    check(all(p['confirmation']['status']=='pending' for p in data['products']),'Confirmación ficticia')
    check(not any(term in result.text for term in ['costCents','access_token','clientDocument','owner']),'Fuga de campos privados')
    check('no-store' in result.headers.get('cache-control',''),'Caché comercial no controlada')
    check(client.post('/api/catalog',json=data).status_code==405,'Publicación anónima permitida')
    check(client.delete('/api/catalog').status_code==405,'Borrado anónimo permitido')

def api_checks(base):
    quote=json.loads((ROOT/'contracts/example-quote.json').read_text(encoding='utf-8'))
    cases=json.loads((ROOT/'contracts/pricing-cases.json').read_text(encoding='utf-8'))
    with httpx.Client(base_url=base,timeout=15,trust_env=False) as client:
        catalog_checks(client)
        check(client.get('/api/quotes').status_code==401,'API acepta anónimo')
        for bad in [token(aud='another-api'),token(iss='https://wrong.example'),token(exp=int(time.time())-100),token()+'broken']:
            check(client.get('/api/quotes',headers={'Authorization':'Bearer '+bad}).status_code==401,'API acepta token inválido')
        check(client.get('/api/quotes',headers={'Authorization':'Bearer '+token(scope='openid')}).status_code==403,'Falta control de scope')
        auth={'Authorization':'Bearer '+token()}
        for case in cases:
            if case['quote']['pricingVersion']!=2:
                check(client.post('/api/quotes',json=case['quote'],headers=auth).status_code==400,'Permite precio histórico al crear')
                continue
            r=client.post('/api/quotes',json=case['quote'],headers=auth)
            check(r.status_code==201,f'No guardó: {r.status_code} {r.text}')
            check(r.json()['totalCents']==case['expected']['total'],'Diferencia en cálculo')
            check(r.json()['quote']['currency']==case['quote'].get('currency','PEN'),'No conserva moneda')
        check(len(client.get('/api/quotes',headers=auth).json()['quotes'])==sum(c['quote']['pricingVersion']==2 for c in cases),'Historial incorrecto')
        check(client.get('/api/quotes',headers={'Authorization':'Bearer '+token('bob')}).json()['quotes']==[],'Fuga entre usuarios')
        for patch in [{'formVersion':1,'contact':'','event':''},{'client':'   '},{'items':[{**quote['items'][0],'name':'   '}]},{'documentType':'ruc','clientType':'empresa','clientDocument':'00000000000'},{'validUntil':'2026-11-20'},{'taxPercent':0},{'deliveryCents':100},{'clientDocument':'1'},{'clientEmail':'invalid'},{'locationMode':'on_location','provinceId':'1501','districtId':'010101'},{'items':[]},{'locationMode':'on_location','provinceId':'1501','districtId':'150130','address':'   '},{'advancePercent':101},{'advancePercent':12.5},{'items':[{**quote['items'][0],'quantity':1.5}]},{'items':[{**quote['items'][0],'priceCents':123.4}]}]:
            r=client.post('/api/quotes',json={**quote,**patch},headers=auth);check(r.status_code==400,'API acepta dato inválido: '+str(patch))
        wrong=json.loads(json.dumps(quote));wrong['materials'][0]['configuration']['selections']={'sweetener':['Miel','Sin endulzante añadido']}
        for patch in [{'currency':'EUR'},{'currency':'usd'},{'currency':None},{'contact':'90000000'},{'contact':'9000000000'},{'contact':'+57 900000000'},{'contact':'90000000x'},{'client':'A'*301},{'event':'A'*121},{'clientEmail':'a'*181},{'notes':'A'*1601}]:
            check(client.post('/api/quotes',json={**quote,**patch},headers=auth).status_code==400,'API acepta moneda/contacto/límite inválido: '+str(list(patch)))
        usd={**quote,'currency':'USD','contact':'+51 900000000'}
        result=client.post('/api/quotes',json=usd,headers=auth)
        check(result.status_code==201 and result.json()['quote']['currency']=='USD' and result.json()['totalCents']==33984,'USD cambia importes o contacto válido rechazado')
        saved=result.json()['id'];stored=next(q for q in client.get('/api/quotes',headers=auth).json()['quotes'] if q['id']==saved)
        check(stored['quote']['currency']=='USD','Historial pierde USD')
        check(client.post('/api/quotes',json=wrong,headers=auth).status_code==400,'API acepta endulzantes incompatibles')
        ruc_quote={**quote,'documentType':'ruc','clientType':'empresa','clientDocument':'20999999990','client':'PASTELERÍA DE DEMOSTRACIÓN S.A.C.'}
        check(client.post('/api/quotes',json={**ruc_quote,'client':'Nombre manipulado'},headers=auth).status_code==400,'Acepta un nombre distinto del RUC')
        r=client.post('/api/quotes',json=ruc_quote,headers=auth);check(r.status_code==201,'No guarda RUC verificado: '+r.text)
        check(r.json()['quote']['clientLookup']['demo'] is True,'No conserva procedencia RUC')
        natural={**ruc_quote,'clientType':'persona_natural','clientDocument':'10999999994','client':'CLIENTE DE DEMOSTRACIÓN CON RUC'}
        check(client.post('/api/quotes',json=natural,headers=auth).status_code==201,'Rechaza persona natural con RUC')
        check(client.post('/api/quotes',content='x'*71000,headers={**auth,'Content-Type':'application/json'}).status_code==413,'Falta límite de tamaño')
        portfolio_checks(client,quote,auth)

def portfolio_checks(client,quote,headers):
    item={**quote['items'][0],'portfolioId':'delicia-fresas','image':'none','name':'Delicia de fresas','description':'Contenido: 12 porciones.\nPresentación: caja marfil.\nAlcance: recojo, sin montaje.','quantity':2,'priceCents':15000}
    custom={**quote,'items':[item],'locationMode':'pickup','provinceId':'','districtId':'','address':'Tienda LosPantojados','materials':[],'materialNotes':''}
    saved=client.post('/api/quotes',json=custom,headers=headers)
    check(saved.status_code==201,'No guarda servicio de cartera: '+saved.text)
    check(saved.json()['totalCents']==35400,'Importe incorrecto para servicio de cartera')
    stored=next(q for q in client.get('/api/quotes',headers=headers).json()['quotes'] if q['id']==saved.json()['id'])
    check(stored['quote']['items'][0]['portfolioId']=='delicia-fresas' and stored['quote']['items'][0]['description']==item['description'],'Pierde referencia o alcance en historial')
    check(stored['quote']['address']=='Tienda LosPantojados' and stored['quote']['materials']==[],'Altera recojo o requiere insumos')
    check(client.post('/api/quotes',json={**custom,'items':[{**item,'portfolioId':'unknown'}]},headers=headers).status_code==400,'Acepta una referencia de cartera inexistente')

def login(client,user):
    start=client.get('/auth/login');check(start.status_code==307,'No inicia OIDC: '+start.text)
    location=start.headers['location']+'&test_user='+user
    query=parse_qs(urlparse(location).query)
    check(query.get('code_challenge_method')==['S256'] and all(x in query for x in ['state','nonce','code_challenge']),'Falta PKCE/state/nonce')
    authorize=client.get(location);callback=authorize.headers['location']
    result=client.get(callback);check(result.status_code==307,'Callback falló: '+result.text)
    cookie=result.headers.get('set-cookie','').lower()
    check('httponly' in cookie and 'samesite=lax' in cookie,'Cookie insegura')
    check('access_token' not in cookie,'Token expuesto al navegador')
    check(client.get(callback).status_code==401,'Reutilización de callback aceptada')

def web_checks():
    quote=json.loads((ROOT/'contracts/example-quote.json').read_text(encoding='utf-8'))
    origin='http://127.0.0.1:3190'
    with httpx.Client(base_url=origin,timeout=60,trust_env=False) as a, httpx.Client(base_url=origin,timeout=60,trust_env=False) as b:
        catalog_checks(a)
        check(a.get('/catalogo').status_code==200,'Página de catálogo no disponible')
        check(a.get('/').status_code==200,'HOME no responde')
        check(a.get('/cotizar').status_code==200,'Cotizador no responde')
        check(a.get('/api/quotes',headers={'oai-authenticated-user-id':'spoofed','oai-authenticated-user-email':'fake@example.test'}).status_code==401,'Se aceptó identidad por cabecera')
        for ruc,status in [('00000000000',400),('20131312954',400),('20131312955',404),('20999999990',200)]:
            result=a.get('/api/clients/ruc/'+ruc);check(result.status_code==status,'Consulta RUC: '+result.text)
        ruc_quote={**quote,'documentType':'ruc','clientType':'empresa','clientDocument':'20999999990','client':'PASTELERÍA DE DEMOSTRACIÓN S.A.C.'}
        check(a.post('/api/quotes/validate',json=ruc_quote,headers={'Origin':'https://evil.example'}).status_code==403,'PDF permite CSRF')
        check(a.post('/api/quotes/validate',json={**ruc_quote,'client':'Manipulado'},headers={'Origin':origin}).status_code==400,'PDF acepta razón social manipulada')
        check(a.post('/api/quotes/validate',json=ruc_quote,headers={'Origin':origin}).status_code==200,'PDF no verifica RUC')
        check(a.post('/api/quotes/validate',json={**quote,'formVersion':1},headers={'Origin':origin}).status_code==400,'PDF acepta formulario histórico nuevo')
        login(a,'web-alice');login(b,'web-bob')
        check(a.post('/api/quotes',json=quote,headers={'Origin':'https://evil.example'}).status_code==403,'CSRF aceptado')
        r=a.post('/api/quotes',json=quote,headers={'Origin':origin});check(r.status_code==201,'BFF no guarda: '+r.text)
        check(r.json()['totalCents']==33984,'BFF importe incorrecto')
        check(len(a.get('/api/quotes').json()['quotes'])==1,'BFF historial incorrecto')
        check(b.get('/api/quotes').json()['quotes']==[],'BFF fuga entre cuentas')
        for patch in [{'currency':'EUR'},{'currency':None},{'contact':'90000000'},{'contact':'9000000000'},{'contact':'90000000x'}]:
            check(a.post('/api/quotes/validate',json={**quote,**patch},headers={'Origin':origin}).status_code==400,'BFF permite moneda o contacto inválido')
        usd=a.post('/api/quotes',json={**quote,'currency':'USD','contact':'+51 900000000'},headers={'Origin':origin})
        check(usd.status_code==201 and usd.json()['quote']['currency']=='USD' and usd.json()['totalCents']==33984,'BFF no conserva USD y sus importes')
        check(any(q['id']==usd.json()['id'] and q['quote']['currency']=='USD' for q in a.get('/api/quotes').json()['quotes']),'BFF pierde moneda al cargar historial')
        portfolio_checks(a,quote,{'Origin':origin})
        bad=a.post('/api/quotes',json={**quote,'taxPercent':0},headers={'Origin':origin});check(bad.status_code==400,'BFF acepta IGV inválido')
        check(a.post('/api/auth/logout',headers={'Origin':'https://evil.example'}).status_code==403,'Logout CSRF aceptado')
        check(a.post('/api/auth/logout',headers={'Origin':origin}).status_code==200,'Logout falló')
        check(a.get('/api/quotes').status_code==401,'Sesión revocada sigue vigente')
    with httpx.Client(base_url=origin,timeout=30,trust_env=False) as c:
        start=c.get('/auth/login');authorize=c.get(start.headers['location']);url=authorize.headers['location']
        url=url.split('&state=')[0]+'&state=invalid'
        check(c.get(url).status_code==401,'State inválido aceptado')

def run(mode):
    processes=[]
    with isolated_directory() as temp:
        env={**{k:v for k,v in os.environ.items() if not k.lower().endswith('_proxy')},'OIDC_ISSUER':ISSUER,'OIDC_AUDIENCE':AUDIENCE,'OIDC_CLIENT_ID':CLIENT,'OIDC_CLIENT_SECRET':SECRET,'SESSION_SECRET':secrets.token_hex(32),'OIDC_ALLOW_LOCAL_HTTP':'true','APP_ENV':'development','ASPNETCORE_ENVIRONMENT':'Development','APP_ORIGIN':'http://127.0.0.1:3190','API_BACKEND':mode,'API_BASE_URL':'http://127.0.0.1:8190','NEXT_TELEMETRY_DISABLED':'1','NODE_ENV':'development','NEXT_DIST_DIR':'.next-test','RUC_PROVIDER':'demo','INTEGRATION_SERVICE_KEY':secrets.token_urlsafe(48),'RUC_SERVICE_URL':'http://127.0.0.1:8191'}
        with open(Path(temp)/'services.log','w+') as log:
            try:
                ruc=OwnedProcess([sys.executable,'-m','uvicorn','ruc_service:app','--host','127.0.0.1','--port','8191','--no-access-log'],cwd=ROOT/'api-python',env=env,stdout=log,stderr=log);processes.append(ruc);wait_http('http://127.0.0.1:8191/health',ruc)
                check(httpx.get('http://127.0.0.1:8191/api/clients/ruc/20999999990',trust_env=False).status_code==401,'Python RUC sin autenticación')
                if mode!='next':
                    env_api={**env,'DATABASE_PATH':str(Path(temp)/'api.sqlite'),'ASPNETCORE_URLS':'http://127.0.0.1:8190'}
                    command=[sys.executable,'-m','uvicorn','main:app','--host','127.0.0.1','--port','8190'] if mode=='python' else [os.environ.get('DOTNET_EXEC','dotnet'),str(ROOT/'api-dotnet/bin/Release/net10.0/Cotiza.Api.dll')]
                    proc=OwnedProcess(command,cwd=ROOT/('api-python' if mode=='python' else 'api-dotnet'),env=env_api,stdout=log,stderr=log);processes.append(proc);wait_http('http://127.0.0.1:8190/health',proc);api_checks('http://127.0.0.1:8190')
                proc=OwnedProcess([os.environ.get('NODE_EXEC','node'),'node_modules/next/dist/bin/next','dev','--webpack','--hostname','127.0.0.1','--port','3190'],cwd=ROOT/'web',env={**env,'DATABASE_PATH':str(Path(temp)/'web.sqlite')},stdout=log,stderr=log);processes.append(proc);wait_http('http://127.0.0.1:3190/',proc);web_checks()
                if os.environ.get('RUN_BROWSER_E2E')=='1' and mode=='dotnet':
                    subprocess.run([os.environ.get('NODE_EXEC','node'),str(ROOT/'tests/browser.e2e.mjs')],cwd=ROOT,env=env,check=True)
                print('PASS:',mode,'— OIDC/PKCE, sesiones, permisos, historial aislado, cotizaciones, importes y validaciones',flush=True)
            except Exception:
                log.flush();log.seek(0)
                # Do not output callback URLs/codes or tokens from dev logs.
                lines=log.readlines();print('Últimos errores:', ''.join(x for x in lines[-30:] if '/auth/' not in x and 'token' not in x.lower()),file=sys.stderr)
                raise
            finally:
                for proc in reversed(processes):
                    proc.stop()

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--backend',choices=['next','python','dotnet','all'],default='all');args=parser.parse_args()
    server=ThreadingHTTPServer(('127.0.0.1',9190),Issuer);threading.Thread(target=server.serve_forever,daemon=True).start()
    try:
        for mode in (['next','python','dotnet'] if args.backend=='all' else [args.backend]):run(mode)
    finally:server.shutdown();server.server_close()
    evidence=ROOT/'tests/artifacts';evidence.mkdir(parents=True,exist_ok=True)
    (evidence/'integration-results.json').write_text(json.dumps({'status':'passed','backend':args.backend,'assertions':CHECK_COUNT,'real_services':True,'oidc':'ephemeral test issuer','ruc':'demo'},indent=2),encoding='utf-8')

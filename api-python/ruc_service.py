"""RUC resolver used by the integrated .NET API. Secrets never reach the browser."""
import asyncio
import datetime as dt
import hmac
import json
import math
import os
import re
import sqlite3
import time
from contextlib import asynccontextmanager, closing
from pathlib import Path
import httpx
from fastapi import FastAPI, Header, HTTPException
from fastapi.responses import JSONResponse

WEIGHTS = (5,4,3,2,7,6,5,4,3,2)
def valid_ruc(value):
    return isinstance(value,str) and len(value)==11 and value.isascii() and value.isdigit() and value[:2] in ('10','15','16','17','20') and (11-sum(int(value[i])*w for i,w in enumerate(WEIGHTS))%11)%10==int(value[-1])

class LookupError(Exception):
    def __init__(self, status, message, retry_after=None):
        self.status=status; self.retry_after=retry_after; super().__init__(message)

_cache={}
_lock=asyncio.Lock()
_requests=[]
_inflight={}
MAX_INFLIGHT=4
LIMA = dt.timezone(dt.timedelta(hours=-5), 'America/Lima')


def _quota_limit():
    value = os.getenv('RUC_DAILY_LIMIT', '500')
    if not re.fullmatch(r'[0-9]{1,6}', value) or not 1 <= int(value) <= 100_000:
        raise RuntimeError('RUC_DAILY_LIMIT debe ser un entero entre 1 y 100000.')
    return int(value)


def _quota_path():
    configured = os.getenv('RUC_QUOTA_PATH', '')
    if configured:
        path = Path(configured)
        if path.is_absolute():
            return path
        raise RuntimeError('RUC_QUOTA_PATH debe ser una ruta absoluta.')
    if os.getenv('APP_ENV') == 'development':
        root = Path(__file__).resolve().parents[1] / 'data'
        root.mkdir(exist_ok=True, mode=0o700)
        return root / 'ruc-quota.sqlite'
    raise RuntimeError('Configura RUC_QUOTA_PATH en el volumen persistente del servicio RUC.')


def _reserve_paid_lookup(now=None):
    """Reserve before the request since a failed response may still be billed."""
    local_now = (now or dt.datetime.now(dt.timezone.utc)).astimezone(LIMA)
    day = local_now.date()
    limit = _quota_limit()
    try:
        with closing(sqlite3.connect(_quota_path(), timeout=2, autocommit=True)) as connection:
            connection.execute('CREATE TABLE IF NOT EXISTS paid_ruc_quota (day TEXT PRIMARY KEY, used INTEGER NOT NULL)')
            update = connection.execute(
                'INSERT INTO paid_ruc_quota (day, used) VALUES (?, 1) '
                'ON CONFLICT(day) DO UPDATE SET used = used + 1 WHERE used < ?',
                (day.isoformat(), limit),
            )
            if update.rowcount == 1:
                return
    except (sqlite3.Error, OSError, RuntimeError, ValueError):
        raise LookupError(503, 'No se pudo verificar la cuota de consultas RUC. Intenta más tarde.') from None
    midnight = dt.datetime.combine(day + dt.timedelta(days=1), dt.time.min, tzinfo=LIMA)
    retry_after = max(1, math.ceil((midnight - local_now).total_seconds()))
    raise LookupError(429, 'Se alcanzó la cuota diaria de consultas RUC. Vuelve a intentarlo después de medianoche en Perú.', retry_after)

def validate_configuration():
    """Reject an unsafe deployment before accepting requests; never log values."""
    secret=os.getenv('INTEGRATION_SERVICE_KEY','')
    if not 32 <= len(secret) <= 256 or not all(33 <= ord(c) <= 126 for c in secret):
        raise RuntimeError('INTEGRATION_SERVICE_KEY requiere entre 32 y 256 caracteres ASCII sin espacios.')
    provider=os.getenv('RUC_PROVIDER','disabled')
    if provider not in ('disabled','demo','decolecta'):
        raise RuntimeError('RUC_PROVIDER debe ser disabled, demo o decolecta.')
    _quota_limit()
    if provider=='decolecta':
        _quota_path()
    if os.getenv('APP_ENV')!='development':
        if provider=='demo':
            raise RuntimeError('El proveedor de demostración solo está permitido en desarrollo.')
        if os.getenv('OIDC_ALLOW_LOCAL_HTTP')=='true':
            raise RuntimeError('OIDC_ALLOW_LOCAL_HTTP no está permitido en producción.')
        if provider=='decolecta' and not os.getenv('RUC_API_TOKEN','').strip():
            raise RuntimeError('Configura la credencial del proveedor RUC antes de iniciar.')
def normalized(ruc,data,source,demo=False,data_date=None):
    if not isinstance(data,dict): raise LookupError(503,'El proveedor devolvió una respuesta inválida.')
    name=data.get('legalName',data.get('razon_social',''))
    returned=data.get('ruc',data.get('numero_documento',''))
    if returned!=ruc or not isinstance(name,str) or not name.strip() or len(name.strip())>300:
        raise LookupError(503,'La fuente devolvió datos de RUC incompletos o incongruentes.')
    result={'ruc':ruc,'legalName':name.strip(),'status':str(data.get('status',data.get('estado','No informado')))[:80],
            'condition':str(data.get('condition',data.get('condicion','No informada')))[:80],
            'source':source,'checkedAt':dt.datetime.now(dt.timezone.utc).isoformat(),'demo':demo}
    if data_date: result['dataDate']=data_date
    return result

async def _fetch_ruc(ruc, provider):
    if provider=='demo':
        if os.getenv('APP_ENV')!='development': raise LookupError(503,'El proveedor de demostración está deshabilitado fuera de desarrollo.')
        names={'20999999990':'PASTELERÍA DE DEMOSTRACIÓN S.A.C.', '10999999994':'CLIENTE DE DEMOSTRACIÓN CON RUC'}
        if ruc not in names: raise LookupError(404,'RUC no incluido en la demostración. Usa 20999999990 o configura una fuente real.')
        return normalized(ruc,{'ruc':ruc,'legalName':names[ruc],'status':'DEMO','condition':'DATOS FICTICIOS'},'Demostración local: no consultado en SUNAT',True)
    if provider!='decolecta':
        raise LookupError(503,'La consulta RUC requiere configurar el proveedor Decolecta.')
    token=os.getenv('RUC_API_TOKEN','')
    if not token: raise LookupError(503,'Falta configurar la credencial del proveedor RUC en el servidor.')
    await asyncio.to_thread(_reserve_paid_lookup)
    try:
        async with asyncio.timeout(10):
            async with httpx.AsyncClient(timeout=8,follow_redirects=False,trust_env=False) as client:
                async with client.stream('GET','https://api.decolecta.com/v1/sunat/ruc',params={'numero':ruc},headers={'Authorization':'Bearer '+token,'Accept':'application/json'}) as response:
                    if response.status_code==404: raise LookupError(404,'RUC no encontrado por el proveedor.')
                    if response.status_code==429: raise LookupError(429,'El proveedor alcanzó su límite de consultas. Intenta más tarde.',60)
                    if response.status_code!=200: raise LookupError(503,'El proveedor RUC no está disponible; revisa su configuración.')
                    body=bytearray()
                    async for chunk in response.aiter_bytes():
                        body.extend(chunk)
                        if len(body)>16384: raise LookupError(503,'El proveedor devolvió una respuesta demasiado grande.')
        return normalized(ruc,json.loads(body),'Decolecta / SUNAT')
    except (httpx.HTTPError,ValueError,TypeError,TimeoutError):
        raise LookupError(503,'No se pudo consultar el RUC. Vuelve a intentarlo.') from None

async def _resolve_and_cache(key, ruc, provider):
    try:
        # Network I/O never holds the shared cache lock.
        result=await _fetch_ruc(ruc,provider)
        async with _lock:
            now=time.monotonic()
            for old in list(_cache):
                if _cache[old][0]<=now: _cache.pop(old)
            if len(_cache)>=500: _cache.pop(next(iter(_cache)))
            _cache[key]=(now+300,result)
        return result
    finally:
        async with _lock:
            _inflight.pop(key,None)

def _observe_result(task):
    # A disconnected caller must not leave an unobserved background exception.
    if not task.cancelled(): task.exception()

async def lookup_ruc(ruc):
    if not valid_ruc(ruc): raise LookupError(400,'El RUC debe tener 11 dígitos y un dígito verificador válido.')
    provider=os.getenv('RUC_PROVIDER','disabled')
    key=(provider,ruc)
    async with _lock:
        now=time.monotonic()
        if key in _cache and _cache[key][0]>now: return dict(_cache[key][1])
        task=_inflight.get(key)
        if task is None:
            _requests[:]=[t for t in _requests if t>now-60]
            if len(_requests)>=30:
                raise LookupError(429,'Se alcanzó el límite de consultas. Espera un minuto.',60)
            if len(_inflight)>=MAX_INFLIGHT:
                raise LookupError(429,'Hay consultas en curso. Intenta de nuevo en unos segundos.',1)
            _requests.append(now)
            task=asyncio.create_task(_resolve_and_cache(key,ruc,provider))
            task.add_done_callback(_observe_result)
            _inflight[key]=task
    # Concurrent requests for one RUC share one upstream call. A client leaving
    # must not cancel the result awaited by other clients.
    return dict(await asyncio.shield(task))

async def verify_quote_identity(q):
    doc_type=q.get('documentType') or ('ruc' if q['clientType']=='empresa' or len(q['clientDocument'])==11 else 'dni')
    q['documentType']=doc_type
    if doc_type=='ruc':
        result=await lookup_ruc(q['clientDocument'])
        if q['client'].strip()!=result['legalName']:
            raise LookupError(400,'El nombre no coincide con el RUC consultado. Vuelve a consultar el documento.')
        q['clientLookup']=result
    else: q.pop('clientLookup',None)
    return q

@asynccontextmanager
async def lifespan(app):
    validate_configuration()
    yield
    pending=list(_inflight.values())
    for task in pending: task.cancel()
    if pending: await asyncio.gather(*pending,return_exceptions=True)

app=FastAPI(title='E&A Cotiza · Resolución RUC',version='2.2.1',docs_url=None,redoc_url=None,lifespan=lifespan)
@app.middleware('http')
async def no_store(request,call_next):
    response=await call_next(request)
    response.headers['Cache-Control']='no-store'
    return response
@app.exception_handler(LookupError)
async def lookup_error(request,exc):
    headers={'Cache-Control':'no-store'}
    if exc.retry_after: headers['Retry-After']=str(exc.retry_after)
    return JSONResponse({'error':str(exc)},status_code=exc.status,headers=headers)
@app.get('/health')
def health(): return {'status':'ok','service':'python-ruc','provider':os.getenv('RUC_PROVIDER','disabled')}
@app.get('/api/clients/ruc/{ruc}')
async def resolve_ruc(ruc:str,x_service_key:str=Header(default='')):
    expected=os.getenv('INTEGRATION_SERVICE_KEY','')
    if len(expected)<32 or not hmac.compare_digest(x_service_key.encode('utf-8'),expected.encode('utf-8')):
        raise HTTPException(401,'Servicio no autorizado.')
    return JSONResponse(await lookup_ruc(ruc),headers={'Cache-Control':'no-store'})

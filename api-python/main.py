import datetime as dt
import hashlib
import json
import os
import sqlite3
import uuid
import math
import threading
import time
import re
from contextlib import asynccontextmanager, contextmanager
from pathlib import Path
from urllib.parse import urlparse
import httpx
import jwt
from fastapi import Depends, FastAPI, HTTPException, Request, Response
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import JSONResponse
from starlette.concurrency import run_in_threadpool
from domain import validate_quote, totals
from catalog_store import initialize_catalog, read_catalog
from ruc_service import verify_quote_identity, validate_configuration, LookupError

ISSUER = os.environ.get('OIDC_ISSUER', '')
AUDIENCE = os.environ.get('OIDC_AUDIENCE', '')
DATABASE = Path(os.environ.get('DATABASE_PATH', './data/python.sqlite'))
bearer = HTTPBearer(auto_error=False)
jwks = None
_rate_buckets={}
_rate_lock=threading.Lock()
_rate_cleanup=0

def rate_limit(owner,operation):
    """Per-owner limits mirror the .NET read/write policies for a single node."""
    global _rate_cleanup
    now=time.monotonic()
    with _rate_lock:
        if now>=_rate_cleanup:
            for key in list(_rate_buckets):
                if _rate_buckets[key][0]+60<=now: _rate_buckets.pop(key)
            _rate_cleanup=now+60
        key=(owner,operation)
        start,count=_rate_buckets.get(key,(now,0))
        if start+60<=now: start,count=now,0
        if count>=120 or (key not in _rate_buckets and len(_rate_buckets)>=10000):
            raise HTTPException(429,'Se alcanzó el límite de solicitudes. Intenta más tarde.',headers={'Retry-After':str(max(1,math.ceil(start+60-now)))})
        _rate_buckets[key]=(start,count+1)

async def read_quote_body(request):
    content_type=request.headers.get('content-type','')
    media_type=content_type.split(';',1)[0].strip().lower()
    if media_type!='application/json':raise HTTPException(415,'Se requiere JSON.')
    charset=re.search(r';\s*charset\s*=\s*"?([^;"\s]+)',content_type,re.I)
    if charset and charset[1].lower()!='utf-8':raise HTTPException(415,'El JSON debe usar UTF-8.')
    body=bytearray()
    async for chunk in request.stream():
        body.extend(chunk)
        if len(body)>70000:raise HTTPException(413,'Presupuesto demasiado grande.')
    try:
        def reject_constant(value): raise ValueError('Número JSON inválido')
        value=json.loads(body.decode('utf-8','strict'),parse_constant=reject_constant)
        stack=[(value,0)]
        while stack:
            item,depth=stack.pop()
            if depth>64:raise ValueError('JSON demasiado profundo')
            if isinstance(item,str):item.encode('utf-8','strict')
            elif isinstance(item,dict):
                for name in item:name.encode('utf-8','strict')
                stack.extend((child,depth+1) for child in item.values())
            elif isinstance(item,list):stack.extend((child,depth+1) for child in item)
        return value
    except (ValueError,RecursionError):
        raise HTTPException(400,'JSON inválido.') from None

def validate_url(value):
    url = urlparse(value)
    local = os.environ.get('APP_ENV') == 'development' and os.environ.get('OIDC_ALLOW_LOCAL_HTTP') == 'true' and url.hostname in ('localhost','127.0.0.1')
    if url.scheme != 'https' and not local:
        raise RuntimeError('OIDC requiere HTTPS.')

@contextmanager
def connection():
    db = sqlite3.connect(DATABASE, timeout=5)
    db.row_factory = sqlite3.Row
    try:
        with db:
            yield db
    finally:
        db.close()

def initialize_database():
    DATABASE.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    with connection() as db:
        db.executescript('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS quotes (id TEXT PRIMARY KEY, owner TEXT NOT NULL, payload TEXT NOT NULL, total_cents INTEGER NOT NULL, created_at TEXT NOT NULL); CREATE INDEX IF NOT EXISTS quotes_owner ON quotes(owner,created_at DESC);')
    DATABASE.chmod(0o600)

@asynccontextmanager
async def lifespan(app):
    global jwks
    validate_configuration()
    if not ISSUER or not AUDIENCE:
        raise RuntimeError('Configura OIDC_ISSUER y OIDC_AUDIENCE.')
    validate_url(ISSUER)
    async with httpx.AsyncClient(timeout=10, follow_redirects=False) as client:
        response = await client.get(ISSUER.rstrip('/') + '/.well-known/openid-configuration')
        response.raise_for_status()
        metadata = response.json()
    if metadata.get('issuer') != ISSUER:
        raise RuntimeError('Emisor OIDC inesperado.')
    validate_url(metadata['jwks_uri'])
    jwks = jwt.PyJWKClient(metadata['jwks_uri'], cache_jwk_set=True, lifespan=300, timeout=10)
    initialize_database()
    initialize_catalog(DATABASE, os.environ.get('CATALOG_FILE'))
    yield

app = FastAPI(title='CotizaSweet API',version='2.1.0',lifespan=lifespan,docs_url=None,redoc_url=None)

@app.middleware('http')
async def no_store(request, call_next):
    response = await call_next(request)
    response.headers['Cache-Control'] = 'no-store'
    return response

@app.exception_handler(HTTPException)
async def http_error(request, exc):
    return JSONResponse({'error':exc.detail}, status_code=exc.status_code, headers=exc.headers)

def identity(credentials: HTTPAuthorizationCredentials | None = Depends(bearer)):
    if not credentials or not jwks:
        raise HTTPException(401,'Token requerido.',headers={'WWW-Authenticate':'Bearer'})
    try:
        key = jwks.get_signing_key_from_jwt(credentials.credentials)
        claims = jwt.decode(credentials.credentials,key.key,algorithms=['RS256'],audience=AUDIENCE,issuer=ISSUER,options={'require':['exp','iss','aud','sub','iat']},leeway=30)
        if not isinstance(claims['sub'],str) or not claims['sub']:
            raise ValueError('Subject inválido')
    except Exception:
        raise HTTPException(401,'Token inválido o expirado.',headers={'WWW-Authenticate':'Bearer'})
    owner = hashlib.sha256(json.dumps([ISSUER,claims['sub']],ensure_ascii=False,separators=(',',':')).encode()).hexdigest()
    scopes = claims.get('scope',claims.get('scp',''))
    if not isinstance(scopes,str): scopes = ''
    return owner, scopes.split()

def record(row):
    return dict(id=row['id'],quote=json.loads(row['payload']),totalCents=row['total_cents'],createdAt=row['created_at'])

@app.get('/api/catalog')
def catalog():
    return read_catalog(DATABASE)

@app.get('/health')
def health():return {'status':'ok'}

@app.get('/api/quotes')
def get_quotes(user=Depends(identity)):
    owner, scopes = user
    if 'quotes:read' not in scopes: raise HTTPException(403,'Permiso quotes:read requerido.')
    rate_limit(owner,'read')
    with connection() as db:
        rows = db.execute('SELECT * FROM quotes WHERE owner=? ORDER BY created_at DESC,id DESC LIMIT 200',(owner,)).fetchall()
    return {'quotes':[record(row) for row in rows]}

@app.post('/api/quotes',status_code=201)
async def post_quote(request:Request,user=Depends(identity)):
    owner, scopes = user
    if 'quotes:write' not in scopes: raise HTTPException(403,'Permiso quotes:write requerido.')
    rate_limit(owner,'write')
    value=await read_quote_body(request)
    try:
        q=validate_quote(value,creating=True)
    except (ValueError,TypeError,KeyError):
        raise HTTPException(400,'Cotización inválida. Revisa los campos.')
    try:
        q=await verify_quote_identity(q)
    except LookupError as exc:
        raise HTTPException(exc.status,str(exc))
    result=dict(id=str(uuid.uuid4()),quote=q,totalCents=totals(q)['total'],createdAt=dt.datetime.now(dt.timezone.utc).isoformat(timespec='milliseconds').replace('+00:00','Z'))
    def save():
        with connection() as db:
            db.execute('INSERT INTO quotes VALUES (?,?,?,?,?)',(result['id'],owner,json.dumps(q,ensure_ascii=False),result['totalCents'],result['createdAt']))
    await run_in_threadpool(save)
    return result

"""Emisor OIDC exclusivo para desarrollo local. No publicar ni usar en producción."""
import base64, hashlib, hmac, json, os, secrets, time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs, urlencode
import jwt
from cryptography.hazmat.primitives.asymmetric import rsa

if os.environ.get('APP_ENV') != 'development':
    raise RuntimeError('El emisor local solo puede ejecutarse en desarrollo.')
IDENTITY_PORT = int(os.environ.get('LOCAL_IDENTITY_PORT','9000'))
WEB_PORT = int(os.environ.get('LOCAL_WEB_PORT','3000'))
ISSUER = f'http://127.0.0.1:{IDENTITY_PORT}'
CLIENT = 'ea-cotiza-local'
SECRET = os.environ['OIDC_CLIENT_SECRET']
REDIRECT = f'http://127.0.0.1:{WEB_PORT}/auth/callback'
KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)
CODES = {}

def token(aud, **extra):
    now = int(time.time())
    return jwt.encode(dict(iss=ISSUER, sub='local-developer', aud=aud, iat=now, exp=now+3600, **extra), KEY, algorithm='RS256', headers={'kid':'local-development'})

class Identity(BaseHTTPRequestHandler):
    def log_message(self, *args): pass  # No registrar códigos ni tokens.
    def json(self, data, status=200):
        body = json.dumps(data).encode()
        self.send_response(status); self.send_header('Content-Type', 'application/json'); self.send_header('Cache-Control','no-store'); self.send_header('Content-Length', str(len(body))); self.end_headers(); self.wfile.write(body)
    def do_GET(self):
        url = urlparse(self.path)
        if url.path == '/.well-known/openid-configuration':
            self.json(dict(issuer=ISSUER, authorization_endpoint=ISSUER+'/authorize', token_endpoint=ISSUER+'/token', jwks_uri=ISSUER+'/jwks', response_types_supported=['code'], subject_types_supported=['public'], id_token_signing_alg_values_supported=['RS256'], token_endpoint_auth_methods_supported=['client_secret_post'], code_challenge_methods_supported=['S256']))
        elif url.path == '/jwks':
            key = json.loads(jwt.algorithms.RSAAlgorithm.to_jwk(KEY.public_key())); key.update(kid='local-development', use='sig', alg='RS256'); self.json({'keys':[key]})
        elif url.path == '/authorize':
            p = {k:v[0] for k,v in parse_qs(url.query).items()}
            if p.get('client_id') != CLIENT or p.get('redirect_uri') != REDIRECT or p.get('response_type') != 'code' or p.get('code_challenge_method') != 'S256' or not all(p.get(k) for k in ['nonce','state','code_challenge']):
                self.json({'error':'invalid_request'},400); return
            for code in list(CODES):
                if CODES[code]['expires'] < time.time(): CODES.pop(code, None)
            if len(CODES) >= 200: self.json({'error':'temporarily_unavailable'},503); return
            code = secrets.token_urlsafe(32); CODES[code] = {**p, 'expires':time.time()+120}
            self.send_response(302); self.send_header('Cache-Control','no-store'); self.send_header('Location',REDIRECT+'?'+urlencode(dict(code=code,state=p['state']))); self.end_headers()
        else: self.json({'error':'not_found'},404)
    def do_POST(self):
        if self.path != '/token': self.json({'error':'not_found'},404); return
        size = int(self.headers.get('Content-Length','0'))
        if size > 8192: self.json({'error':'invalid_request'},400); return
        p = {k:v[0] for k,v in parse_qs(self.rfile.read(size).decode()).items()}
        original = CODES.pop(p.get('code',''),None)
        challenge = base64.urlsafe_b64encode(hashlib.sha256(p.get('code_verifier','').encode()).digest()).decode().rstrip('=')
        if p.get('grant_type') != 'authorization_code' or p.get('client_id') != CLIENT or not hmac.compare_digest(p.get('client_secret',''),SECRET) or not original or original['expires'] < time.time() or p.get('redirect_uri') != REDIRECT or challenge != original['code_challenge']:
            self.json({'error':'invalid_grant'},400); return
        scope = 'openid profile email quotes:read quotes:write'
        self.json(dict(access_token=token('ea-cotiza-api',scope=scope),id_token=token(CLIENT,nonce=original['nonce'],name='Desarrollo local',email='local@example.test'),token_type='Bearer',expires_in=3600,scope=scope))

ThreadingHTTPServer(('127.0.0.1',IDENTITY_PORT),Identity).serve_forever()

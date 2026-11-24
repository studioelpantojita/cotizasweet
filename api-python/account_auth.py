"""Strict optional application-account JWT trust; never accepts unsigned/browser identity."""
import os,re,uuid
from urllib.parse import urlparse
import jwt

def configuration():
    if os.environ.get('ACCOUNT_AUTH_ENABLED')!='true':return None
    secret=os.environ.get('ACCOUNT_JWT_SECRET','')
    origin=os.environ.get('APP_ORIGIN','').rstrip('/')
    issuer=os.environ.get('ACCOUNT_ISSUER','')
    try:
        url=urlparse(origin)
        port=url.port
    except ValueError:
        raise RuntimeError('Configura un origen de aplicación válido.') from None
    local=os.environ.get('APP_ENV')=='development' and url.scheme=='http' and url.hostname in ('localhost','127.0.0.1')
    if not re.fullmatch(r'[a-fA-F0-9]{64}',secret) or issuer!=origin+'/accounts' or not url.netloc or not url.hostname or (port is not None and not 1 <= port <= 65535) or any(c.isspace() for c in origin) or '\\' in origin or not (url.scheme=='https' or local) or url.username or url.password or url.path not in ('','/') or url.query or url.fragment:
        raise RuntimeError('Configura la identidad y el secreto de cuentas de aplicación.')
    return {'secret':bytes.fromhex(secret),'issuer':issuer}

def is_account_token(token):
    cfg=configuration()
    if not cfg:return False
    # The unverified issuer selects a validator; it never establishes identity.
    return jwt.decode(token,options={'verify_signature':False}).get('iss')==cfg['issuer']

def verify_account_token(token):
    cfg=configuration()
    if not cfg:raise ValueError('Cuentas no habilitadas')
    if jwt.get_unverified_header(token).get('typ')!='JWT':raise ValueError('Tipo inválido')
    claims=jwt.decode(token,cfg['secret'],algorithms=['HS256'],audience='ea-cotiza-api',issuer=cfg['issuer'],options={'require':['iss','aud','sub','exp','iat']},leeway=30)
    if not isinstance(claims['sub'],str) or str(uuid.UUID(claims['sub']))!=claims['sub'] or claims.get('role') not in ('admin','customer'):
        raise ValueError('Identidad incompleta')
    return claims

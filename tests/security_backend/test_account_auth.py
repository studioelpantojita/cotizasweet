"""Application-account JWT trust uses synthetic keys and isolated environment settings."""
import asyncio
import hashlib
import json
import os
import sys
import time
import uuid
from pathlib import Path
from unittest.mock import Mock, patch

import jwt
import pytest
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'api-python'))
import account_auth
import main

# Synthetic test-only key. Never read an installation's private settings.
SECRET_HEX='9f'*32
ORIGIN='https://app.example.test'
ISSUER=ORIGIN+'/accounts'
SUBJECT=str(uuid.UUID('cc532049-bde1-4a50-9ab4-cfb455ca4cde'))


@pytest.fixture(autouse=True)
def isolated_account_environment():
    with patch.dict(os.environ,{
        'ACCOUNT_AUTH_ENABLED':'true','ACCOUNT_JWT_SECRET':SECRET_HEX,
        'APP_ENV':'production','APP_ORIGIN':ORIGIN,'ACCOUNT_ISSUER':ISSUER,
    },clear=False):
        yield


def claims(**changes):
    now=int(time.time())
    value=dict(iss=ISSUER,aud='ea-cotiza-api',sub=SUBJECT,role='customer',iat=now,exp=now+300,scope='quotes:read quotes:write')
    value.update(changes)
    return value


def token(value=None,*,algorithm='HS256',key=None,headers=None):
    return jwt.encode(claims() if value is None else value,bytes.fromhex(SECRET_HEX) if key is None else key,algorithm=algorithm,headers=headers)


@pytest.mark.parametrize('role',['customer','admin'])
def test_valid_hs256_account_token_with_canonical_subject(role):
    encoded=token(claims(role=role))
    config=account_auth.configuration()
    assert config=={'secret':bytes.fromhex(SECRET_HEX),'issuer':ISSUER}
    assert account_auth.is_account_token(encoded)
    verified=account_auth.verify_account_token(encoded)
    assert verified['sub']==SUBJECT and verified['role']==role
    assert verified['aud']=='ea-cotiza-api' and verified['scope']=='quotes:read quotes:write'


@pytest.mark.parametrize('changes',[
    {'aud':'another-api'},{'iss':'https://another.example.test/accounts'},
    {'exp':int(time.time())-120},{'iat':int(time.time())+120},
    {'sub':'not-a-uuid'},{'sub':SUBJECT.upper()},{'sub':123},
    {'role':'administrator'},{'role':None},{'role':['admin']},
])
def test_rejects_wrong_audience_issuer_lifetime_or_identity(changes):
    with pytest.raises((jwt.PyJWTError,ValueError,TypeError,AttributeError)):
        account_auth.verify_account_token(token(claims(**changes)))


@pytest.mark.parametrize('field',['iss','aud','sub','exp','iat','role'])
def test_required_identity_claims_cannot_be_omitted(field):
    value=claims();value.pop(field)
    with pytest.raises((jwt.PyJWTError,ValueError,TypeError,AttributeError)):
        account_auth.verify_account_token(token(value))


def test_issuer_selection_does_not_authenticate_a_forged_signature():
    encoded=token(key=bytes.fromhex('a1'*32))
    assert account_auth.is_account_token(encoded),'Unverified issuer may select a validator only'
    with pytest.raises(jwt.InvalidSignatureError):account_auth.verify_account_token(encoded)
    assert not account_auth.is_account_token(token(claims(iss='https://other.example.test/accounts')))


@pytest.mark.parametrize('algorithm,key',[
    ('HS384',bytes.fromhex('b3'*64)),('none',''),
])
def test_rejects_algorithm_substitution_and_unsigned_tokens(algorithm,key):
    encoded=token(algorithm=algorithm,key=key)
    with pytest.raises(jwt.InvalidAlgorithmError):account_auth.verify_account_token(encoded)


@pytest.mark.parametrize('kind',[None,'at+jwt','jwt'])
def test_requires_exact_jwt_type_header(kind):
    with pytest.raises(ValueError):account_auth.verify_account_token(token(headers={'typ':kind}))


@pytest.mark.parametrize('encoded',['','not-a-token','a.b.c'])
def test_malformed_jws_does_not_establish_identity(encoded):
    with pytest.raises((jwt.PyJWTError,ValueError)):
        account_auth.verify_account_token(encoded)


@pytest.mark.parametrize('enabled',['false','FALSE','1',''])
def test_account_validator_is_explicitly_disabled_without_true(enabled):
    with patch.dict(os.environ,{'ACCOUNT_AUTH_ENABLED':enabled}):
        assert account_auth.configuration() is None
        assert not account_auth.is_account_token(token())
        with pytest.raises(ValueError):account_auth.verify_account_token(token())


@pytest.mark.parametrize('secret',['','a'*63,'z'*64,'a'*65])
def test_requires_a_32_byte_hexadecimal_application_secret(secret):
    with patch.dict(os.environ,{'ACCOUNT_JWT_SECRET':secret}):
        with pytest.raises(RuntimeError):account_auth.configuration()


@pytest.mark.parametrize('origin,environment',[
    ('http://app.example.test','production'),('http://127.0.0.1:3370','production'),
    ('http://app.example.test','development'),('http://localhost.evil.example:3370','development'),
    ('https://user:secret@app.example.test','production'),('https://app.example.test/path','production'),
    ('https://app.example.test?token=x','production'),('https://app.example.test#fragment','production'),
    ('https:','production'),('https://app.example.test:bad','production'),('https://app.example.test:0','production'),
])
def test_rejects_insecure_or_malformed_application_origins(origin,environment):
    with patch.dict(os.environ,{'APP_ORIGIN':origin,'APP_ENV':environment,'ACCOUNT_ISSUER':origin.rstrip('/')+'/accounts'}):
        with pytest.raises((RuntimeError,ValueError)):account_auth.configuration()


@pytest.mark.parametrize('origin',['http://127.0.0.1:3370','http://localhost:3370'])
def test_local_http_is_permitted_only_for_development(origin):
    with patch.dict(os.environ,{'APP_ORIGIN':origin,'APP_ENV':'development','ACCOUNT_ISSUER':origin+'/accounts'}):
        assert account_auth.configuration()['issuer']==origin+'/accounts'


def test_account_issuer_must_match_the_application_origin():
    with patch.dict(os.environ,{'ACCOUNT_ISSUER':'https://other.example.test/accounts'}):
        with pytest.raises(RuntimeError):account_auth.configuration()


def test_main_uses_account_trust_without_oidc_fallback_or_google_scope_elevation(monkeypatch):
    jwks=Mock();jwks.get_signing_key_from_jwt.side_effect=AssertionError('Account JWT must not consult OIDC keys')
    monkeypatch.setattr(main,'jwks',jwks)
    monkeypatch.setattr(main,'OIDC_PROVIDER','google')
    encoded=token(claims(scope='quotes:read'))
    owner,scopes=main.identity(HTTPAuthorizationCredentials(scheme='Bearer',credentials=encoded))
    expected=hashlib.sha256(json.dumps([ISSUER,SUBJECT],separators=(',',':')).encode()).hexdigest()
    assert owner==expected and scopes==['quotes:read']
    jwks.get_signing_key_from_jwt.assert_not_called()
    with pytest.raises(HTTPException) as error:
        asyncio.run(main.post_quote(None,user=(owner,scopes)))
    assert error.value.status_code==403
    with pytest.raises(HTTPException) as error:main.get_quotes(None,user=(owner,[]))
    assert error.value.status_code==403


def test_main_maps_forged_account_token_to_401_without_identity_leak(monkeypatch):
    jwks=Mock();monkeypatch.setattr(main,'jwks',jwks)
    forged=token(key=bytes.fromhex('b6'*32))
    with pytest.raises(HTTPException) as error:
        main.identity(HTTPAuthorizationCredentials(scheme='Bearer',credentials=forged))
    assert error.value.status_code==401 and error.value.headers=={'WWW-Authenticate':'Bearer'}
    assert SECRET_HEX not in error.value.detail and SUBJECT not in error.value.detail
    jwks.get_signing_key_from_jwt.assert_not_called()

def test_application_identity_does_not_require_external_jwks(monkeypatch):
    monkeypatch.setattr(main,'jwks',None)
    owner,scopes=main.identity(HTTPAuthorizationCredentials(scheme='Bearer',credentials=token(claims(scope='quotes:read'))))
    assert owner and scopes==['quotes:read']

@pytest.mark.parametrize('role,promotion,expected',[
    ('customer','navidad-2026',True),('admin','navidad-2026',False),('customer','other',False),('customer',None,False),
])
def test_promotion_entitlement_requires_account_customer_claim(role,promotion,expected):
    encoded=token(claims(role=role,promotion=promotion))
    assert main.trusted_promotion(HTTPAuthorizationCredentials(scheme='Bearer',credentials=encoded)) is expected

def test_forged_or_external_promotion_claim_does_not_grant_discount():
    forged=token(claims(promotion='navidad-2026'),key=bytes.fromhex('b6'*32))
    external=token(claims(promotion='navidad-2026',iss='https://other.example.test/accounts'))
    for encoded in (forged,external):assert main.trusted_promotion(HTTPAuthorizationCredentials(scheme='Bearer',credentials=encoded)) is False

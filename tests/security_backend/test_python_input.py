"""Boundary checks for the Python alternative API without starting services."""
import asyncio
import json
import sys
from pathlib import Path

import pytest
from fastapi import HTTPException

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'api-python'))
import main

class Input:
    def __init__(self,body,content_type='application/json',chunk=1024):
        self.body=body;self.headers={'content-type':content_type};self.chunk=chunk
    async def stream(self):
        for index in range(0,len(self.body),self.chunk):yield self.body[index:index+self.chunk]

@pytest.mark.parametrize('content_type',['application/jsonfoo','text/plain','application/problem+json','','application/json; charset=latin1','application/json; charset="UTF-16"','application/json; charset=utf8'])
def test_exact_json_media_type(content_type):
    with pytest.raises(HTTPException) as error:asyncio.run(main.read_quote_body(Input(b'{}',content_type)))
    assert error.value.status_code==415

@pytest.mark.parametrize('body',[
    b'{"x":"\xff"}',b'{',b'{"x":NaN}',b'{"x":Infinity}',b'{"x":"\\ud800"}',b'{"\\udfff":0}',
    '['.encode()*66+b'0'+b']'*66,
    '['.encode()*1100+b'0'+b']'*1100,
    '{"x":0}'.encode('utf-16'),
])
def test_malformed_unicode_json_and_depth_return_400(body):
    with pytest.raises(HTTPException) as error:asyncio.run(main.read_quote_body(Input(body)))
    assert error.value.status_code==400

def test_utf8_and_exact_size_limit():
    body=b'{"x":"'+b'a'*69992+b'"}'
    assert len(body)==70000
    parsed=asyncio.run(main.read_quote_body(Input(body,'Application/JSON; charset=UTF-8',chunk=511)))
    assert len(parsed['x'])==69992
    assert asyncio.run(main.read_quote_body(Input('{"nombre":"José 🍰"}'.encode('utf-8'))))=={'nombre':'José 🍰'}
    with pytest.raises(HTTPException) as error:asyncio.run(main.read_quote_body(Input(body+b' ')))
    assert error.value.status_code==413

def test_rate_limit_owner_operation_and_expiry_are_independent(monkeypatch):
    monkeypatch.setattr(main,'_rate_buckets',{})
    monkeypatch.setattr(main,'_rate_cleanup',0)
    now=[100.0];monkeypatch.setattr(main.time,'monotonic',lambda:now[0])
    for _ in range(120):main.rate_limit('alice','write')
    with pytest.raises(HTTPException) as error:main.rate_limit('alice','write')
    assert error.value.status_code==429 and error.value.headers['Retry-After']=='60'
    main.rate_limit('bob','write');main.rate_limit('alice','read')
    now[0]+=60
    main.rate_limit('alice','write')
    assert main._rate_buckets[('alice','write')][1]==1

@pytest.mark.parametrize('path',[(),('items',0),('materials',0),('materials',0,'configuration'),('clientLookup',)])
def test_shared_domain_rejects_unknown_contract_properties(path):
    quote=json.loads((ROOT/'contracts/example-quote.json').read_text(encoding='utf-8'))
    quote['clientLookup']={'ruc':'20999999990','legalName':'Identidad sintética','status':'DEMO','condition':'DEMO','source':'Prueba aislada','checkedAt':'2026-11-10T10:00:00Z','demo':True}
    target=quote
    for name in path:target=target[name]
    target['unexpectedField']='Un campo fuera del contrato'
    with pytest.raises(ValueError):main.validate_quote(quote,creating=True)

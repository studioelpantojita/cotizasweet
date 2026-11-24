import copy,datetime as dt,json,sys
from pathlib import Path
from unittest.mock import patch
import pytest

ROOT=Path(__file__).resolve().parents[2];sys.path.insert(0,str(ROOT/'api-python'))
from domain import validate_quote,totals
NOW=dt.datetime(2026,11,23,17,tzinfo=dt.timezone.utc)
BASE=json.loads((ROOT/'contracts/example-quote.json').read_text(encoding='utf8'))
def quote(event='2026-11-30'):
    return {**copy.deepcopy(BASE),'issued':'2026-11-23','validUntil':'2026-12-14','eventDate':event,'promotion':{'campaignId':'navidad-2026','percent':20}}

@pytest.mark.parametrize('event',['2026-11-30','2026-12-01','2026-12-31','2027-01-02'])
def test_enrolled_event_dates_are_inclusive(event):
    result=validate_quote(quote(event),creating=True,allow_promotion=True,now=NOW)
    assert result['promotion']['percent']==20

@pytest.mark.parametrize('event',['2026-11-29','2027-01-03','2026-11-31'])
def test_event_dates_outside_campaign_are_rejected(event):
    with pytest.raises((ValueError,TypeError)):validate_quote(quote(event),creating=True,allow_promotion=True,now=NOW)

@pytest.mark.parametrize('clock',['2026-11-23T04:59:59+00:00','2027-01-03T05:00:00+00:00'])
def test_issued_date_cannot_bypass_server_clock_expiry(clock):
    with pytest.raises(ValueError):validate_quote(quote(),creating=True,allow_promotion=True,now=dt.datetime.fromisoformat(clock))

@pytest.mark.parametrize('clock',['2026-11-23T05:00:00+00:00','2027-01-03T04:59:59+00:00'])
def test_campaign_follows_peru_midnight(clock):
    assert validate_quote(quote(),creating=True,allow_promotion=True,now=dt.datetime.fromisoformat(clock))['promotion']

def test_claim_authorization_is_not_derived_from_quote_body():
    with pytest.raises(ValueError):validate_quote(quote(),creating=True,now=NOW)
    assert validate_quote(quote())['promotion']['percent']==20
    for promotion in ({'campaignId':'other','percent':20},{'campaignId':'navidad-2026','percent':100},{'campaignId':'navidad-2026','percent':20,'extra':True}):
        with pytest.raises(ValueError):validate_quote({**quote(),'promotion':promotion},creating=True,allow_promotion=True,now=NOW)

def test_cents_discount_mobility_tax_and_advance_parity():
    q=validate_quote(quote(),creating=True,allow_promotion=True,now=NOW)
    result=totals(q)
    assert (result['discount'],result['netServices'],result['tax'],result['total'],result['advance'],result['balance'])==(5760,23040,4147,27187,13594,13593)
    delivered=totals({**q,'locationMode':'on_location','provinceId':'1501','districtId':'150130','address':'Referencia de prueba'})
    assert (delivered['mobility'],delivered['base'],delivered['tax'],delivered['total'])==(1152,24192,4355,28547)
    historical={**q};historical.pop('promotion');assert totals(historical)['total']==33984

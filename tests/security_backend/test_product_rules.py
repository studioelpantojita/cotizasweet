"""Current creation rules and historical compatibility, using only synthetic data."""
import copy
import json
import sys
from pathlib import Path

import pytest

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'api-python'))
from domain import validate_quote

BASE=json.loads((ROOT/'contracts/example-quote.json').read_text(encoding='utf-8'))
PRICING=json.loads((ROOT/'contracts/product-pricing.json').read_text(encoding='utf-8'))


def portfolio_quote():
    q=copy.deepcopy(BASE)
    flavors=['vainilla','chocolate']
    q['items']=[dict(id='synthetic-service',portfolioId='delicia-fresas',name='Delicia de fresas',image='none',category='pack',
                    flavors=flavors,presentation='Caja marfil',scope='Unknown.',
                    description='Contenido: vainilla, chocolate\nPresentación: Caja marfil\nAlcance: Unknown.',
                    quantity=2,priceCents=PRICING['portfolio']['delicia-fresas']['prices']['PEN'],unit='unidad')]
    return q


@pytest.mark.parametrize('patch',[
    {'eventDate':''},{'advancePercent':0},{'advancePercent':30},{'advancePercent':100},
    {'clientType':'persona_natural','documentType':'ruc','clientDocument':'10999999994'},
])
def test_new_business_rules_rejected_without_destroying_historical_reads(patch):
    q={**copy.deepcopy(BASE),**patch}
    with pytest.raises(ValueError):validate_quote(q,creating=True)
    assert validate_quote(q)


@pytest.mark.parametrize('patch',[
    {'priceCents':0},{'priceCents':14399},{'unit':'box'},{'flavors':[]},
    {'flavors':['vainilla']*2},{'flavors':['fresa']},{'flavors':['vainilla','chocolate','café','pistacho','almendras']},
    {'presentation':''},{'description':'Texto sustituido'},{'catalogId':'minibox'},
])
def test_portfolio_tampering_is_rejected(patch):
    q=portfolio_quote();q['items'][0].update(patch)
    with pytest.raises(ValueError):validate_quote(q,creating=True)


def test_empty_scope_canonicalizes_and_four_flavors_supported():
    q=portfolio_quote();q['items'][0]['scope']=' '
    assert validate_quote(q,creating=True)['items'][0]['scope']=='Unknown.'
    q['items'][0]['flavors']=['vainilla','chocolate','café','pistacho']
    q['items'][0]['description']='Contenido: vainilla, chocolate, café, pistacho\nPresentación: Caja marfil\nAlcance: Unknown.'
    assert len(validate_quote(q,creating=True)['items'][0]['flavors'])==4


def test_catalog_reference_cannot_be_repriced_or_stripped_to_free_form_price():
    for patch in [{'priceCents':1},{'unit':'texto libre'},{'catalogId':None},{'catalogId':'sweet'}]:
        q=copy.deepcopy(BASE);q['items'][0].update(patch)
        with pytest.raises(ValueError):validate_quote(q,creating=True)
    pending=copy.deepcopy(BASE)
    pending['items']=[dict(id='pending',name='Servicio por evaluar',description='Solicitud sin precio aprobado.',image='none',quantity=1,priceCents=0,category='pack',unit='servicio')]
    assert validate_quote(pending,creating=True)['items'][0]['priceCents']==0

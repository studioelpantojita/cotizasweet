"""Canonical quote validation and integer-cent pricing, compatible with web/lib/quote.ts."""
import copy
import datetime as dt
import json
import re
from pathlib import Path
from jsonschema import Draft7Validator, validators
from ruc_service import valid_ruc

CONTRACTS = Path(__file__).resolve().parent.parent / 'contracts'
SCHEMA = json.loads((CONTRACTS / 'quote.schema.json').read_text(encoding='utf-8'))
INGREDIENTS = json.loads((CONTRACTS / 'ingredients.json').read_text(encoding='utf-8'))
UBIGEO = json.loads((CONTRACTS / 'ubigeo.json').read_text(encoding='utf-8'))

def set_defaults(validator, properties, instance, schema):
    if isinstance(instance, dict):
        for key, subschema in properties.items():
            if key not in instance and 'default' in subschema:
                instance[key] = copy.deepcopy(subschema['default'])
    yield from Draft7Validator.VALIDATORS['properties'](validator, properties, instance, schema)

Validator = validators.extend(Draft7Validator, {'properties': set_defaults})

def normalize(value):
    if isinstance(value,str): return value.strip()
    if isinstance(value,list): return [normalize(v) for v in value]
    if isinstance(value,dict): return {k:normalize(v) for k,v in value.items()}
    return value

def validate_quote(value, *, creating=False):
    if not isinstance(value,dict): raise ValueError('Se requiere una cotización JSON.')
    q = normalize(copy.deepcopy(value))
    if creating and (q.get('formVersion')!=2 or q.get('pricingVersion')!=2):
        raise ValueError('Las nuevas cotizaciones requieren versión 2.')
    errors = list(Validator(SCHEMA).iter_errors(q))
    if errors:
        raise ValueError('Formato de cotización inválido: ' + '.'.join(str(p) for p in errors[0].absolute_path))
    # Inputs are the normalized JSON contract exported by the Next.js form.
    for field in ['client', 'contact', 'event', 'clientEmail']:
        q[field] = q[field].strip()
    if not q['client']:
        raise ValueError('Escribe el nombre del cliente.')
    if q['formVersion'] == 2:
        kind=q.get('documentType') or ('ruc' if q['clientType']=='empresa' or len(q['clientDocument'])==11 else 'dni')
        correct=valid_ruc(q['clientDocument']) if kind=='ruc' else bool(re.fullmatch(r'[0-9]{8}',q['clientDocument']))
        if (q['clientType']=='empresa' and kind!='ruc') or not correct or not q['contact'] or not q['event']:
            raise ValueError('Revisa documento, contacto y proyecto.')
    if q['clientEmail'] and not re.fullmatch(r"(?!\.)(?!.*\.\.)([A-Za-z0-9_'+\-.]*)[A-Za-z0-9_+-]@([A-Za-z0-9][A-Za-z0-9\-]*\.)+[A-Za-z]{2,}", q['clientEmail']):
        raise ValueError('Correo inválido.')
    issued, valid = dt.date.fromisoformat(q['issued']), dt.date.fromisoformat(q['validUntil'])
    if valid < issued or (q['eventDate'] and dt.date.fromisoformat(q['eventDate']) < issued):
        raise ValueError('Fechas inválidas.')
    if q['pricingVersion'] == 2 and (q['taxPercent'] != 18 or valid > issued + dt.timedelta(days=21) or q['locationMode'] == 'legacy' or q['deliveryCents'] != 0):
        raise ValueError('Revisa vigencia, movilidad e IGV.')
    province = next((p for p in UBIGEO['provinces'] if p['id'] == q['provinceId']), None)
    district = next((p for p in UBIGEO['districts'] if p['id'] == q['districtId']), None)
    if (q['provinceId'] and not province) or (q['districtId'] and (not district or district['provinceId'] != q['provinceId'])) or (q['locationMode'] == 'on_location' and (not province or not district)):
        raise ValueError('Provincia y distrito inválidos.')
    if creating and q['locationMode'] == 'on_location' and not q['address']:
        raise ValueError('Indica la dirección o referencia para entregar el pedido en locación.')
    if creating and not re.fullmatch(r'(?:\+51 ?)?[0-9]{9}',q['contact']):
        raise ValueError('Ingresa un teléfono de 9 dígitos, sin incluir el código +51.')
    for material in q['materials']:
        definition = next((d for d in INGREDIENTS if d['name'] == material['name']), None)
        selections = material['configuration']['selections']
        for key, values in selections.items():
            group = next((g for g in definition['groups'] if g['id'] == key), None) if definition else None
            if not group or any(v not in group['options'] for v in values) or len(values) != len(set(values)):
                raise ValueError('Opciones de insumos inválidas.')
        sweet = selections.get('sweetener', [])
        if 'Sin endulzante añadido' in sweet and len(sweet) > 1:
            raise ValueError('Selección de endulzante incompatible.')
        if material['confirmed'] and not material['detail'].strip():
            raise ValueError('Falta la especificación histórica.')
    if q['allergenReviewed'] and not q['allergenNotes'].strip():
        raise ValueError('Falta la revisión registrada.')
    return q

def percent(value, rate):
    return (value * rate + 50) // 100

def totals(q):
    packs = sum(i['priceCents'] * i['quantity'] for i in q['items'] if i['category'] != 'addon')
    addons = sum(i['priceCents'] * i['quantity'] for i in q['items'] if i['category'] == 'addon')
    subtotal = packs + addons
    rate = 5 if q['pricingVersion'] == 2 and q['locationMode'] == 'on_location' else 0
    mobility = percent(subtotal, rate) if q['pricingVersion'] == 2 else q['deliveryCents']
    base = subtotal + mobility
    tax = percent(base, 18) if q['pricingVersion'] == 2 else 0
    total = base + tax
    advance = percent(total, q['advancePercent'])
    return dict(subtotal=subtotal,total=total,advance=advance,balance=total-advance,packs=packs,addons=addons,mobility=mobility,mobilityRate=rate,base=base,tax=tax)

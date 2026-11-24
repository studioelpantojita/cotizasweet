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
PRICING = json.loads((CONTRACTS / 'product-pricing.json').read_text(encoding='utf-8'))

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

def validate_quote(value, *, creating=False, allow_promotion=False, now=None):
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
    if q.get('promotion'):
        if q['pricingVersion'] != 2 or not '2026-11-30' <= q['eventDate'] <= '2027-01-02':
            raise ValueError('La promoción navideña sólo corresponde a eventos del 30/11/2026 al 02/01/2027.')
        if creating:
            current = now if now is not None else dt.datetime.now(dt.timezone.utc)
            if current.tzinfo is None: raise ValueError('El reloj de promoción requiere zona horaria.')
            today = current.astimezone(dt.timezone(dt.timedelta(hours=-5))).date().isoformat()
            if allow_promotion is not True or not '2026-11-23' <= today <= '2027-01-02':
                raise ValueError('La cuenta no tiene una promoción navideña vigente.')
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
    if creating:
        if not q['eventDate']: raise ValueError('La fecha del evento es obligatoria.')
        if q['advancePercent'] != 50: raise ValueError('El anticipo para nuevas propuestas es 50%.')
        if q['clientType'] == 'persona_natural' and (q.get('documentType') or ('ruc' if len(q['clientDocument']) == 11 else 'dni')) != 'dni':
            raise ValueError('Selecciona Persona Natural con DNI o Empresa con RUC.')
        for item in q['items']:
            portfolio, catalog = item.get('portfolioId'), item.get('catalogId')
            if portfolio and catalog: raise ValueError('Referencia de producto ambigua.')
            rate = PRICING['portfolio'].get(portfolio) if portfolio else PRICING['catalog'].get(catalog) if catalog else None
            if (portfolio or catalog) and not rate: raise ValueError('Tarifa de producto no configurada.')
            if rate and (item['priceCents'] != rate['prices'][q['currency']] or item['unit'] != rate['unit']):
                raise ValueError('El precio y la unidad los define el producto seleccionado.')
            if not portfolio and not catalog and (item['priceCents'] != 0 or item['unit'] != 'servicio'):
                raise ValueError('El servicio sin referencia queda pendiente de evaluación, con importe 0 por servicio.')
            if portfolio:
                flavors = item.get('flavors', [])
                if not 1 <= len(flavors) <= 4 or len(set(flavors)) != len(flavors) or any(f not in PRICING['flavors'] for f in flavors):
                    raise ValueError('Selecciona entre 1 y 4 sabores distintos de la lista.')
                if not item.get('presentation', '').strip(): raise ValueError('La presentación es obligatoria.')
                item['scope'] = item.get('scope', '').strip() or 'Unknown.'
                expected = f"Contenido: {', '.join(flavors)}\nPresentación: {item['presentation']}\nAlcance: {item['scope']}"
                if item['description'] != expected: raise ValueError('El detalle no coincide con los datos del servicio.')
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
    discount = percent(subtotal,q['promotion']['percent']) if q.get('promotion') else 0
    net_services = subtotal - discount
    rate = 5 if q['pricingVersion'] == 2 and q['locationMode'] == 'on_location' else 0
    mobility = percent(net_services, rate) if q['pricingVersion'] == 2 else q['deliveryCents']
    base = net_services + mobility
    tax = percent(base, 18) if q['pricingVersion'] == 2 else 0
    total = base + tax
    advance = percent(total, q['advancePercent'])
    return dict(subtotal=subtotal,total=total,advance=advance,balance=total-advance,packs=packs,addons=addons,mobility=mobility,mobilityRate=rate,base=base,tax=tax,discount=discount,netServices=net_services)

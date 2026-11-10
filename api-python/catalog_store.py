"""Validated read-only catalog snapshot; no public publishing endpoint."""
import datetime as dt
import hashlib
import json
import sqlite3
from pathlib import Path
import jsonschema

CONTRACTS = Path(__file__).resolve().parent.parent / 'contracts'
SCHEMA = json.loads((CONTRACTS / 'catalog.schema.json').read_text(encoding='utf-8'))
def validate_catalog(data):
    jsonschema.Draft7Validator(SCHEMA, format_checker=jsonschema.FormatChecker()).validate(data)
    ids = [p['id'] for p in data['products']]
    if len(ids) != len(set(ids)):
        raise ValueError('Productos duplicados.')
    for product in data['products']:
        variants = [v['id'] for v in product['variants']]
        if len(variants) != len(set(variants)) or any(not v['prices'] for v in product['variants']):
            raise ValueError('Variantes inválidas.')
        c = product['confirmation']
        if c['status'] == 'confirmed' and dt.date.fromisoformat(c['date']) > dt.date.fromisoformat(c['validUntil']):
            raise ValueError('Confirmación inválida.')
    return data

def initialize_catalog(database, source=None):
    raw = Path(source or CONTRACTS / 'catalog.json').read_text(encoding='utf-8')
    if len(raw.encode('utf-8')) > 300000:
        raise ValueError('Catálogo demasiado grande.')
    data = validate_catalog(json.loads(raw))
    Path(database).parent.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(database, timeout=5)
    try:
        with db:
            db.execute('CREATE TABLE IF NOT EXISTS catalog_snapshot (id INTEGER PRIMARY KEY CHECK(id=1), content_hash TEXT NOT NULL, payload TEXT NOT NULL CHECK(json_valid(payload)), imported_at TEXT NOT NULL)')
            db.execute('INSERT INTO catalog_snapshot VALUES (1,?,?,?) ON CONFLICT(id) DO UPDATE SET content_hash=excluded.content_hash,payload=excluded.payload,imported_at=excluded.imported_at WHERE content_hash<>excluded.content_hash',
                       (hashlib.sha256(raw.encode()).hexdigest(), json.dumps(data, ensure_ascii=False), dt.datetime.now(dt.timezone.utc).isoformat()))
    finally:
        db.close()

def read_catalog(database):
    db = sqlite3.connect(database, timeout=5)
    try:
        raw = db.execute('SELECT payload FROM catalog_snapshot WHERE id=1').fetchone()[0]
        data = validate_catalog(json.loads(raw))
        data['products'] = [p for p in data['products'] if p['published']]
        return data
    finally:
        db.close()

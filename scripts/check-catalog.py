"""Validate the deployment catalog; optional import into an explicitly selected database."""
import argparse
import json
import sys
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
sys.path.insert(0,str(ROOT/'api-python'))
from catalog_store import validate_catalog, initialize_catalog
parser=argparse.ArgumentParser()
parser.add_argument('--source',type=Path,default=ROOT/'contracts/catalog.json')
parser.add_argument('--database',type=Path,help='Optional SQLite target. Import replaces only catalog_snapshot.')
args=parser.parse_args()
raw=args.source.read_text(encoding='utf-8')
if len(raw.encode())>300000:raise ValueError('Catálogo demasiado grande.')
data=validate_catalog(json.loads(raw))
for product in data['products']:
    for image in product['images']:
        if not (ROOT/'web/public'/image['src'].lstrip('/')).is_file():raise ValueError('Imagen ausente: '+image['src'])
if args.database:initialize_catalog(args.database,args.source)
print(f"Catálogo válido: {len(data['products'])} productos, revisión {data['revision']}.")

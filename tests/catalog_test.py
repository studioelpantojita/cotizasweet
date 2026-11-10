import copy, json, sqlite3, sys, tempfile, unittest
from contextlib import contextmanager, closing
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
sys.path.insert(0,str(ROOT/'api-python'))
from catalog_store import initialize_catalog, read_catalog, validate_catalog
SEED=json.loads((ROOT/'contracts/catalog.json').read_text(encoding='utf-8'))
@contextmanager
def connection(path):
 with closing(sqlite3.connect(path)) as conn:
  with conn:yield conn
class CatalogTest(unittest.TestCase):
 def test_atomic_import_and_quotes_preserved(self):
  with tempfile.TemporaryDirectory() as temp:
   db=Path(temp)/'catalog.sqlite';source=Path(temp)/'catalog.json'
   with connection(db) as conn:
    conn.execute('CREATE TABLE quotes (id TEXT PRIMARY KEY, payload TEXT)')
    conn.execute("INSERT INTO quotes VALUES ('existing','untouched')")
   initialize_catalog(db)
   self.assertEqual(len(read_catalog(db)['products']),6)
   with connection(db) as conn:
    original=conn.execute('SELECT imported_at FROM catalog_snapshot').fetchone()[0]
   initialize_catalog(db)
   with connection(db) as conn:
    self.assertEqual(conn.execute('SELECT imported_at FROM catalog_snapshot').fetchone()[0],original)
    self.assertEqual(conn.execute('SELECT payload FROM quotes').fetchone()[0],'untouched')
   bad=copy.deepcopy(SEED);bad['products'][0]['variants'][0]['prices']['PEN']=-1
   source.write_text(json.dumps(bad),encoding='utf-8')
   with self.assertRaises(Exception):initialize_catalog(db,source)
   self.assertEqual(read_catalog(db)['products'][0]['variants'][0]['prices']['PEN'],8500)
   hidden=copy.deepcopy(SEED);hidden['products'][0]['published']=False
   source.write_text(json.dumps(hidden),encoding='utf-8');initialize_catalog(db,source)
   self.assertEqual(len(read_catalog(db)['products']),5)
 def test_malformed_and_private_data_rejected(self):
  for mutate in [lambda c:c['products'][0].update(costCents=1),lambda c:c['products'][0]['images'][0].update(src='https://evil.example/a.jpg'),lambda c:c['products'][0]['variants'][0].update(prices={}),lambda c:c['products'].append(c['products'][0]),lambda c:c['products'][0]['variants'].append(c['products'][0]['variants'][0]),lambda c:c['products'][0].update(confirmation={'status':'confirmed','note':'Missing evidence'})]:
   c=copy.deepcopy(SEED);mutate(c)
   with self.assertRaises(Exception):validate_catalog(c)
if __name__=='__main__':unittest.main()

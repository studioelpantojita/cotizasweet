import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {db} from './store';
import {publicCatalog,validateCatalog} from '@/lib/commercial-catalog';
export function localCatalog(){
 const raw=readFileSync(resolve(process.env.CATALOG_FILE||'../contracts/catalog.json'),'utf8');
 const seed=validateCatalog(JSON.parse(raw)),hash=createHash('sha256').update(raw).digest('hex');
 const connection=db();
 connection.exec('CREATE TABLE IF NOT EXISTS catalog_snapshot (id INTEGER PRIMARY KEY CHECK(id=1), content_hash TEXT NOT NULL, payload TEXT NOT NULL CHECK(json_valid(payload)), imported_at TEXT NOT NULL)');
 connection.prepare("INSERT INTO catalog_snapshot VALUES (1,?,?,?) ON CONFLICT(id) DO UPDATE SET content_hash=excluded.content_hash,payload=excluded.payload,imported_at=excluded.imported_at WHERE content_hash<>excluded.content_hash").run(hash,JSON.stringify(seed),new Date().toISOString());
 const row=connection.prepare('SELECT payload FROM catalog_snapshot WHERE id=1').get();
 return publicCatalog(JSON.parse(String(row!.payload)));
}

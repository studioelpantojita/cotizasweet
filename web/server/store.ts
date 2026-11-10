import {DatabaseSync} from 'node:sqlite';
import {mkdirSync, chmodSync} from 'node:fs';
import {resolve, dirname} from 'node:path';
import {createHash, createCipheriv, createDecipheriv, randomBytes, randomUUID} from 'node:crypto';
import {totals, type Quote, type SavedQuote} from '@/lib/quote';

let connection: DatabaseSync | undefined;
export function db() {
  if (!connection) {
    const path = resolve(process.env.DATABASE_PATH || './data/cotiza.sqlite');
    mkdirSync(dirname(path), {recursive:true,mode:0o700});
    connection = new DatabaseSync(path);
    chmodSync(path,0o600);
    connection.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS secure_state (id TEXT PRIMARY KEY, kind TEXT NOT NULL, payload TEXT NOT NULL, expires INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS quotes (id TEXT PRIMARY KEY, owner TEXT NOT NULL, payload TEXT NOT NULL, total_cents INTEGER NOT NULL, created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS request_limits (bucket TEXT PRIMARY KEY, hits INTEGER NOT NULL, reset_at INTEGER NOT NULL);
      CREATE INDEX IF NOT EXISTS request_limits_expiry ON request_limits(reset_at);
      CREATE INDEX IF NOT EXISTS quotes_owner ON quotes(owner,created_at DESC);`);
  }
  return connection;
}
export function closeDatabase(){connection?.close();connection=undefined;}
export const digest = (s:string) => createHash('sha256').update(s).digest('hex');
export const ownerKey = (issuer:string, subject:string) => digest(JSON.stringify([issuer,subject]));
function key() {
  const value=process.env.SESSION_SECRET || '';
  if (!/^[a-fA-F0-9]{64}$/.test(value)) throw new Error('SESSION_SECRET requiere 32 bytes aleatorios en hexadecimal.');
  return Buffer.from(value,'hex');
}
function seal(value:unknown) {
  const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key(),iv);
  const encrypted=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]);
  return Buffer.concat([iv,cipher.getAuthTag(),encrypted]).toString('base64');
}
function unseal<T>(value:string):T {
  const bytes=Buffer.from(value,'base64'),decipher=createDecipheriv('aes-256-gcm',key(),bytes.subarray(0,12));
  decipher.setAuthTag(bytes.subarray(12,28));
  return JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)),decipher.final()]).toString('utf8')) as T;
}
export function putState(kind:string,value:unknown,seconds:number) {
  const id=randomBytes(32).toString('base64url');
  db().prepare('DELETE FROM secure_state WHERE expires <= ?').run(Date.now());
  db().prepare('INSERT INTO secure_state VALUES (?,?,?,?)').run(digest(id),kind,seal(value),Date.now()+seconds*1000);
  return id;
}
export function readState<T>(id:string,kind:string,consume=false):T|null {
  if (!/^[\w-]{43}$/.test(id)) return null;
  const sql=consume?'DELETE FROM secure_state WHERE id=? AND kind=? AND expires>? RETURNING payload':'SELECT payload FROM secure_state WHERE id=? AND kind=? AND expires>?';
  const row=db().prepare(sql).get(digest(id),kind,Date.now());
  if(!row)return null;
  try{return unseal<T>(String(row.payload));}catch{return null;}
}
export function deleteState(id:string) { db().prepare('DELETE FROM secure_state WHERE id=?').run(digest(id)); }
export function listQuotes(owner:string):SavedQuote[] {
  return db().prepare('SELECT * FROM quotes WHERE owner=? ORDER BY created_at DESC, id DESC LIMIT 200').all(owner).map(r=>({id:String(r.id),quote:JSON.parse(String(r.payload)),totalCents:Number(r.total_cents),createdAt:String(r.created_at)}));
}
export function saveQuote(owner:string,quote:Quote):SavedQuote {
  const record={id:randomUUID(),quote,totalCents:totals(quote).total,createdAt:new Date().toISOString()};
  db().prepare('INSERT INTO quotes VALUES (?,?,?,?,?)').run(record.id,owner,JSON.stringify(quote),record.totalCents,record.createdAt);
  return record;
}

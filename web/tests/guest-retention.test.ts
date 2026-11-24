import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {pruneExpiredGuestDrafts,guestDraftRetentionHours} from '../server/guest-retention';
import {db,closeDatabase} from '../server/store';
const folder=resolve('../tests/artifacts');mkdirSync(folder,{recursive:true});
process.env.DATABASE_PATH=resolve(folder,'guest-retention-'+randomUUID()+'.sqlite');
after(()=>closeDatabase());
const now=new Date('2026-11-23T12:00:00.000Z');
const old=new Date(now.getTime()-25*3600_000).toISOString(),boundary=new Date(now.getTime()-24*3600_000).toISOString();
const guest='guest:'+'a'.repeat(64),account='b'.repeat(64);
function initialize(){
 db().exec(`CREATE TABLE IF NOT EXISTS quote_documents(id TEXT PRIMARY KEY,owner TEXT,payload TEXT,pdf BLOB,pdf_sha256 TEXT,created_at TEXT);
 CREATE TABLE IF NOT EXISTS quote_submissions(id TEXT PRIMARY KEY,quote_id TEXT,owner TEXT,display_name TEXT,submitted_at TEXT);`);
}
function seed(id:string,owner:string,date:string,document=true){
 db().prepare('INSERT INTO quotes VALUES (?,?,?,?,?)').run(id,owner,'{}',0,date);
 if(document)db().prepare('INSERT INTO quote_documents VALUES (?,?,?,?,?,?)').run(id,owner,'{}',Buffer.from('synthetic'),'synthetic',date);
}
test('retention distinguishes 4h access from 24h unsubmitted data and preserves protected records',()=>{
 assert.equal(guestDraftRetentionHours,24);assert.deepEqual(pruneExpiredGuestDrafts(now),{draftsRemoved:0,documentsRemoved:0,quotesRemoved:0});initialize();
 seed('expired',guest,old);seed('orphaned-save',guest,old,false);seed('boundary',guest,boundary);seed('fresh',guest,now.toISOString());seed('account',account,old);seed('submitted',guest,old);seed('unknown-owner','guest:'+'z'.repeat(64),old);
 db().prepare('INSERT INTO quote_submissions VALUES (?,?,?,?,?)').run('receipt','submitted',guest,'Cliente invitado',old);
 const result=pruneExpiredGuestDrafts(now);
 assert.deepEqual(result,{draftsRemoved:2,documentsRemoved:1,quotesRemoved:2});
 for(const id of ['boundary','fresh','account','submitted','unknown-owner'])assert.ok(db().prepare('SELECT id FROM quotes WHERE id=?').get(id),id);
 assert.ok(db().prepare('SELECT id FROM quote_documents WHERE id=?').get('submitted'));
 assert.ok(db().prepare('SELECT id FROM quote_submissions WHERE quote_id=?').get('submitted'));
 assert.throws(()=>pruneExpiredGuestDrafts(new Date('invalid')));
});
test('each cleanup is bounded to 100 complete drafts and can resume without affecting newer copies',()=>{
 for(let index=0;index<105;index++)seed('bounded-'+String(index).padStart(3,'0'),guest,old);
 assert.equal(pruneExpiredGuestDrafts(now).draftsRemoved,100);
 assert.equal(db().prepare("SELECT count(*) AS n FROM quotes WHERE id LIKE 'bounded-%'").get()?.n,5);
 assert.equal(pruneExpiredGuestDrafts(now).draftsRemoved,5);
 seed('mixed-age',guest,old);db().prepare('UPDATE quote_documents SET created_at=? WHERE id=?').run(now.toISOString(),'mixed-age');
 assert.equal(pruneExpiredGuestDrafts(now).draftsRemoved,0);assert.ok(db().prepare('SELECT id FROM quotes WHERE id=?').get('mixed-age'));
});

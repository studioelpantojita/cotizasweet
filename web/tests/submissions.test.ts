import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {initialQuote,catalog,totals,type SavedQuote} from '../lib/quote';
import {archiveQuote,archivedDocument,submitQuote,listSubmissions,getSubmission} from '../server/submissions';
import {db,closeDatabase} from '../server/store';

const folder=resolve('../tests/artifacts');mkdirSync(folder,{recursive:true});
process.env.DATABASE_PATH=resolve(folder,'submissions-'+randomUUID()+'.sqlite');
after(()=>closeDatabase());
const owner='test-owner-alice',other='test-owner-bob';
function record():SavedQuote{
 const quote={...initialQuote(),client:'Cliente sintético QA',clientDocument:'12345678',contact:'999999999',projectBrief:'Evento de prueba',event:'Evento de prueba',eventDate:initialQuote().issued,items:[{...catalog[0],id:randomUUID()}]};
 return{id:randomUUID(),createdAt:new Date().toISOString(),quote,totalCents:totals(quote).total};
}
test('Guardar conserva PDF verificable y aisla el documento por propietario',()=>{
 const saved=record();archiveQuote(owner,saved);
 const document=archivedDocument(owner,saved.id)!;
 assert.equal(document.bytes.subarray(0,5).toString(),'%PDF-');assert.match(document.sha256,/^[a-f0-9]{64}$/);
 assert.deepEqual(document.record,saved);assert.equal(archivedDocument(other,saved.id),null);
 assert.equal(archivedDocument(owner,'../../etc'),null);
 archiveQuote(owner,saved);assert.equal(archivedDocument(owner,saved.id)!.sha256,document.sha256);
 assert.throws(()=>archiveQuote(other,saved));assert.throws(()=>archiveQuote(owner,{...saved,quote:{...saved.quote,client:'Otro cliente'}}));
 writeFileSync(resolve(folder,'solicitud-archivada-ejemplo.pdf'),document.bytes);
});
test('Enviar es idempotente, no admite cotizacion ajena y entrega exactamente el documento archivado',()=>{
 const saved=record();archiveQuote(owner,saved);
 assert.equal(submitQuote(other,'Otro',saved.id),null);
 const first=submitQuote(owner,'Cliente QA',saved.id)!,second=submitQuote(owner,'Cliente QA',saved.id)!;
 assert.equal(first.id,second.id);assert.equal(first.submittedAt,second.submittedAt);
 assert.equal(first.pdfSha256,archivedDocument(owner,saved.id)!.sha256);assert.equal(first.emailStatus,'not_configured');
 assert.equal(listSubmissions().entries.filter(row=>row.quoteId===saved.id).length,1);
 assert.deepEqual(getSubmission(first.id),first);assert.equal(getSubmission('invalid'),null);
 assert.throws(()=>listSubmissions('invalid'));
});
test('Corrupcion de PDF se rechaza y el snapshot no se reemplaza silenciosamente',()=>{
 const saved=record();archiveQuote(owner,saved);
 db().prepare('UPDATE quote_documents SET pdf=? WHERE id=?').run(Buffer.from('corrupted'),saved.id);
 assert.throws(()=>archivedDocument(owner,saved.id),/integridad/);
});

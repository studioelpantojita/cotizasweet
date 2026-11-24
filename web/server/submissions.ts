import {createHash,randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {db} from './store';
import {decodeHistoryCursor,encodeHistoryCursor} from './history-page';
import {quoteSchema,totals,type SavedQuote} from '@/lib/quote';
import {createQuotePdf,type PdfFonts} from '@/lib/pdf';

// Snapshots belong to the authenticated account, independently of the selected API.
// Never accept a PDF or an owner identifier supplied by a browser.
export type QuoteSubmission={id:string;quoteId:string;owner:string;displayName:string;submittedAt:string;pdfSha256:string;record:SavedQuote;emailStatus:'not_configured'};
const idPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
let fonts:PdfFonts|undefined;
function tables(){
 const connection=db();
 connection.exec(`CREATE TABLE IF NOT EXISTS quote_documents (
  id TEXT PRIMARY KEY,owner TEXT NOT NULL,payload TEXT NOT NULL,pdf BLOB NOT NULL,pdf_sha256 TEXT NOT NULL,created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS quote_submissions (
  id TEXT PRIMARY KEY,quote_id TEXT NOT NULL UNIQUE,owner TEXT NOT NULL,display_name TEXT NOT NULL,submitted_at TEXT NOT NULL);
 CREATE INDEX IF NOT EXISTS quote_submissions_history ON quote_submissions(submitted_at DESC,id DESC);`);
 return connection;
}
function pdfFonts(){
 if(!fonts)fonts={regular:readFileSync(join(process.cwd(),'public/fonts/quote-regular.ttf')).toString('base64'),bold:readFileSync(join(process.cwd(),'public/fonts/quote-bold.ttf')).toString('base64')};
 return fonts;
}
export function archiveQuote(owner:string,input:SavedQuote):SavedQuote{
 if(!idPattern.test(input.id)||!Number.isFinite(Date.parse(input.createdAt)))throw new TypeError('Referencia de cotización inválida.');
 const quote=quoteSchema.parse(input.quote),total=totals(quote).total;
 if(total!==input.totalCents)throw new TypeError('El total guardado no coincide con la cotización.');
 const record={id:input.id,quote,totalCents:total,createdAt:input.createdAt};
 const connection=tables(),existing=connection.prepare('SELECT owner,payload FROM quote_documents WHERE id=?').get(input.id);
 if(existing){
  if(existing.owner!==owner||existing.payload!==JSON.stringify(record))throw new Error('La referencia ya tiene otro documento.');
  return record;
 }
 const bytes=Buffer.from(createQuotePdf(quote,input.id,pdfFonts()).output('arraybuffer'));
 if(bytes.length>2_000_000)throw new Error('El documento supera el tamaño admitido.');
 connection.prepare('INSERT INTO quote_documents VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING').run(input.id,owner,JSON.stringify(record),bytes,createHash('sha256').update(bytes).digest('hex'),input.createdAt);
 const stored=connection.prepare('SELECT owner,payload FROM quote_documents WHERE id=?').get(input.id)!;
 if(stored.owner!==owner||stored.payload!==JSON.stringify(record))throw new Error('La referencia ya tiene otro documento.');
 return record;
}
export function archivedDocument(owner:string,id:string){
 if(!idPattern.test(id))return null;
 const row=tables().prepare('SELECT payload,pdf,pdf_sha256 FROM quote_documents WHERE owner=? AND id=?').get(owner,id);
 if(!row)return null;
 const bytes=Buffer.from(row.pdf as Uint8Array),sha256=String(row.pdf_sha256);
 if(createHash('sha256').update(bytes).digest('hex')!==sha256)throw new Error('La integridad del documento no coincide.');
 return {record:JSON.parse(String(row.payload)) as SavedQuote,bytes,sha256};
}
function rowSubmission(row:Record<string,unknown>):QuoteSubmission{
 return {id:String(row.id),quoteId:String(row.quote_id),owner:String(row.owner),displayName:String(row.display_name),submittedAt:String(row.submitted_at),pdfSha256:String(row.pdf_sha256),record:JSON.parse(String(row.payload)) as SavedQuote,emailStatus:'not_configured'};
}
const selection=`SELECT s.*,d.payload,d.pdf_sha256 FROM quote_submissions s JOIN quote_documents d ON d.id=s.quote_id AND d.owner=s.owner`;
export function submitQuote(owner:string,displayName:string,quoteId:string){
 if(!archivedDocument(owner,quoteId))return null;
 const connection=tables();
 connection.prepare('INSERT INTO quote_submissions VALUES (?,?,?,?,?) ON CONFLICT(quote_id) DO NOTHING').run(randomUUID(),quoteId,owner,displayName.slice(0,160),new Date().toISOString());
 const row=connection.prepare(selection+' WHERE s.owner=? AND s.quote_id=?').get(owner,quoteId);
 return row?rowSubmission(row):null;
}
export function submissionForOwner(owner:string,quoteId:string){
 if(!idPattern.test(quoteId))return null;
 const row=tables().prepare(selection+' WHERE s.owner=? AND s.quote_id=?').get(owner,quoteId);
 return row?rowSubmission(row):null;
}
// Call only behind an administrator guard. Returned snapshots remain immutable.
export function listSubmissions(cursor?:string){
 const parsed=cursor?decodeHistoryCursor(cursor):null;
 if(cursor&&!parsed)throw new TypeError('Cursor inválido.');
 const rows=tables().prepare(selection+(parsed?' WHERE (s.submitted_at,s.id)<(?,?)':'')+' ORDER BY s.submitted_at DESC,s.id DESC LIMIT 21').all(...(parsed?[parsed.createdAt,parsed.id]:[]));
 const entries=rows.slice(0,20).map(rowSubmission),last=entries.at(-1);
 return {entries,nextCursor:rows.length>20&&last?encodeHistoryCursor({createdAt:last.submittedAt,id:last.id}):null};
}
export function getSubmission(id:string){
 if(!idPattern.test(id))return null;
 const row=tables().prepare(selection+' WHERE s.id=?').get(id);
 return row?rowSubmission(row):null;
}
export function documentResponse(document:NonNullable<ReturnType<typeof archivedDocument>>){
 return new Response(new Uint8Array(document.bytes),{headers:{'Content-Type':'application/pdf','Content-Disposition':`attachment; filename="E-A-Cotiza-${document.record.id.slice(0,8).toUpperCase()}.pdf"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','X-Document-SHA256':document.sha256}});
}

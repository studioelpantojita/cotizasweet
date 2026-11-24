import {db} from './store';

export const guestDraftRetentionHours=24;
/** Bounded maintenance of unsubmitted guest drafts; never removes an account or a submitted document. */
export function pruneExpiredGuestDrafts(now=new Date()){
 if(!Number.isFinite(now.getTime()))throw new TypeError('Fecha de mantenimiento inválida.');
 const connection=db();
 const tables=new Set(connection.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(row=>String(row.name)));
 if(!['quotes','quote_documents','quote_submissions'].every(name=>tables.has(name)))return {draftsRemoved:0,documentsRemoved:0,quotesRemoved:0};
 const cutoff=new Date(now.getTime()-guestDraftRetentionHours*60*60*1000).toISOString();
 connection.exec('BEGIN IMMEDIATE');
 try{
  const rows=connection.prepare(`WITH candidates AS (
   SELECT id,owner,created_at FROM quotes
   UNION SELECT id,owner,created_at FROM quote_documents
  ) SELECT c.id,c.owner FROM candidates c
  WHERE substr(c.owner,1,6)='guest:' AND length(c.owner)=70
   AND substr(c.owner,7) NOT GLOB '*[^0-9a-f]*'
   AND NOT EXISTS (SELECT 1 FROM quote_submissions s WHERE s.quote_id=c.id)
  GROUP BY c.id,c.owner HAVING max(c.created_at)<?
  ORDER BY max(c.created_at),c.id LIMIT 100`).all(cutoff);
  let documentsRemoved=0,quotesRemoved=0;
  const document=connection.prepare('DELETE FROM quote_documents WHERE id=? AND owner=? AND created_at<?');
  const quote=connection.prepare('DELETE FROM quotes WHERE id=? AND owner=? AND created_at<?');
  for(const row of rows){
   documentsRemoved+=Number(document.run(String(row.id),String(row.owner),cutoff).changes);
   quotesRemoved+=Number(quote.run(String(row.id),String(row.owner),cutoff).changes);
  }
  connection.exec('COMMIT');return {draftsRemoved:rows.length,documentsRemoved,quotesRemoved};
 }catch(error){connection.exec('ROLLBACK');throw error;}
}

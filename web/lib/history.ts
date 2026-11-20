import {quoteSchema,type SavedQuote} from './quote';

/** A stored proposal that no longer satisfies the current form rules (an older version or a damaged row). */
export type UnreadableQuote={id:string;createdAt:string;client:string;unreadable:true};
export type HistoryEntry=SavedQuote|UnreadableQuote;
export const isUnreadable=(entry:HistoryEntry):entry is UnreadableQuote=>'unreadable' in entry;

const text=(value:unknown,fallback:string,max:number)=>typeof value==='string'&&value.trim()?value.trim().slice(0,max):fallback;

/**
 * Validates each saved proposal on its own, so one record that the current rules reject
 * never hides the valid ones. Only a response that is not a list fails as a whole.
 */
export function readHistory(rows:unknown):HistoryEntry[]{
 if(!Array.isArray(rows))throw new Error('El servidor devolvió un historial con un formato inesperado.');
 return rows.map((row,index):HistoryEntry=>{
  const record=row&&typeof row==='object'?row as Record<string,unknown>:{};
  const id=text(record.id,`desconocida-${index+1}`,80),createdAt=text(record.createdAt,'',40);
  const parsed=quoteSchema.safeParse(record.quote);
  const totalCents=record.totalCents;
  if(parsed.success&&typeof totalCents==='number'&&Number.isSafeInteger(totalCents)&&totalCents>=0)return {id,createdAt,totalCents,quote:parsed.data};
  const raw=record.quote&&typeof record.quote==='object'?record.quote as Record<string,unknown>:{};
  return {id,createdAt,client:text(raw.client,'Propuesta sin nombre',120),unreadable:true};
 });
}

/** Reads one page of GET /api/quotes: {quotes, nextCursor}. */
export function readHistoryPage(body:unknown):{entries:HistoryEntry[];nextCursor:string|null}{
 const page=body&&typeof body==='object'?body as Record<string,unknown>:{};
 const cursor=page.nextCursor;
 if(cursor!==null&&cursor!==undefined&&(typeof cursor!=='string'||cursor.length>120))throw new Error('El servidor devolvió un historial con un formato inesperado.');
 return {entries:readHistory(page.quotes),nextCursor:cursor||null};
}

/** Appends a later page, ignoring any proposal already shown. */
export const appendHistory=(shown:HistoryEntry[],next:HistoryEntry[])=>{const ids=new Set(shown.map(h=>h.id));return [...shown,...next.filter(h=>!ids.has(h.id))];};

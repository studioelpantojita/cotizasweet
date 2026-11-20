// History pagination shared by the Next store and the BFF. The .NET and Python APIs apply
// the same rules: limit 1–50 (20 by default) and an opaque `before` cursor made of the last
// row's createdAt and id, matching the ORDER BY created_at DESC, id DESC of every store.
export const HISTORY_PAGE_DEFAULT=20;
export const HISTORY_PAGE_MAX=50;
const cursorPattern=/^([0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z)_([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/;
export type HistoryPage={limit:number;before?:{createdAt:string;id:string}};

/** Returns null for any malformed, repeated or out-of-range parameter. */
export function parseHistoryPage(params:URLSearchParams):HistoryPage|null{
 const limits=params.getAll('limit'),cursors=params.getAll('before');
 if(limits.length>1||cursors.length>1)return null;
 let limit=HISTORY_PAGE_DEFAULT;
 if(limits.length){
  if(!/^[0-9]{1,3}$/.test(limits[0]))return null;
  limit=Number(limits[0]);
  if(limit<1||limit>HISTORY_PAGE_MAX)return null;
 }
 if(!cursors.length)return {limit};
 const match=cursorPattern.exec(cursors[0]);
 return match?{limit,before:{createdAt:match[1],id:match[2]}}:null;
}

export const historyCursor=(row:{createdAt:string;id:string})=>`${row.createdAt}_${row.id}`;

/** Query string forwarded to the private APIs, rebuilt from validated values only. */
export function historyQuery(page:HistoryPage){
 const query=new URLSearchParams({limit:String(page.limit)});
 if(page.before)query.set('before',historyCursor(page.before));
 return query;
}

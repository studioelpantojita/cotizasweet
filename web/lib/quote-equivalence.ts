import {quoteSchema,type Quote} from './quote';
function canonical(value:unknown):unknown {
 if(Array.isArray(value))return value.map(canonical);
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([key,item])=>[key,canonical(item)]));
 return value;
}
export function sameQuote(a:Quote,b:Quote):boolean {
 const left=quoteSchema.safeParse(a),right=quoteSchema.safeParse(b);
 if(!left.success||!right.success)return false;
 // Source verification timestamps refresh on the server without editing the form.
 const {clientLookup:unusedLeft,...first}=left.data,{clientLookup:unusedRight,...second}=right.data;
 return JSON.stringify(canonical(first))===JSON.stringify(canonical(second));
}

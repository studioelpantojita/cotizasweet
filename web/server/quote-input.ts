import {RucError} from './ruc';
export const MAX_QUOTE_BYTES=70000;
export async function readQuoteBody(request:Request):Promise<unknown>{
 const contentType=request.headers.get('content-type')||'';
 if(contentType.split(';',1)[0].trim().toLowerCase()!=='application/json')throw new RucError('Se requiere JSON.',415);
 const charset=/;\s*charset\s*=\s*"?([^;"\s]+)/i.exec(contentType)?.[1];
 if(charset&&charset.toLowerCase()!=='utf-8')throw new RucError('El JSON debe usar UTF-8.',415);
 const declared=request.headers.get('content-length');
 if(declared&&/^\d+$/.test(declared)&&Number(declared)>MAX_QUOTE_BYTES)throw new RucError('Presupuesto demasiado grande.',413);
 const reader=request.body?.getReader();if(!reader)throw new RucError('Datos inválidos.',400);
 const chunks:Uint8Array[]=[];let size=0;
 try{
  for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>MAX_QUOTE_BYTES){await reader.cancel();throw new RucError('Presupuesto demasiado grande.',413);}chunks.push(value);}
 }finally{reader.releaseLock();}
 try{
  const value:unknown=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks)));
  // Bound recursive normalization and reject escaped lone surrogates before PDF/DB use.
  const pending:Array<[unknown,number]>=[[value,0]];
  while(pending.length){
   const [node,depth]=pending.pop()!;if(depth>64)throw new Error('depth');
   if(typeof node==='string'&&/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(node))throw new Error('unicode');
   if(Array.isArray(node))for(const item of node)pending.push([item,depth+1]);
   else if(node&&typeof node==='object')for(const [key,item] of Object.entries(node)){pending.push([key,depth+1],[item,depth+1]);}
  }
  return value;
 }catch{throw new RucError('JSON inválido o codificación UTF-8 incorrecta.',400);}
}

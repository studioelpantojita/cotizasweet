import {sameOrigin} from './config';
import {AccountError} from './accounts';
export const accountJson=(value:unknown,status=200,headers:Record<string,string>={})=>Response.json(value,{status,headers:{'Cache-Control':'no-store',...headers}});
export async function accountInput(request:Request):Promise<Record<string,unknown>>{
 if(!sameOrigin(request))throw new AccountError('Origen no permitido.',403);
 if(request.headers.get('content-type')?.split(';',1)[0].trim().toLowerCase()!=='application/json')throw new AccountError('Se requiere JSON.',415);
 const reader=request.body?.getReader();if(!reader)throw new AccountError('Completa los campos obligatorios.');
 let size=0;const chunks:Uint8Array[]=[];
 try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>4096){await reader.cancel();throw new AccountError('Solicitud demasiado grande.',413);}chunks.push(value);}}finally{reader.releaseLock();}
 try{const data:unknown=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks)));if(!data||typeof data!=='object'||Array.isArray(data))throw new Error();return data as Record<string,unknown>;}catch{throw new AccountError('Solicitud inválida.');}
}
export function accountFailure(error:unknown){return error instanceof AccountError?accountJson({error:error.message},error.status):accountJson({error:'No se pudo completar el acceso. Intenta más tarde.'},503);}

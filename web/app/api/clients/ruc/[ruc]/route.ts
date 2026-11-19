import {lookupRuc,RucError} from '@/server/ruc';
import {rateLimit} from '@/server/rate-limit';
import {sameOriginRucRequest} from '@/server/config';
export const runtime='nodejs';
export async function GET(request:Request,{params}:{params:Promise<{ruc:string}>}){
 const headers=new Headers({'Cache-Control':'no-store'});
 try{
  if(!sameOriginRucRequest(request))return Response.json({error:'Origen no permitido.'},{status:403,headers});
  const limited=rateLimit(request,'ruc');
  if(limited)return limited;
  return Response.json(await lookupRuc((await params).ruc),{headers});
 }catch(e){
  if(e instanceof RucError&&e.retryAfter)headers.set('Retry-After',String(e.retryAfter));
  return Response.json({error:e instanceof RucError?e.message:'No se pudo consultar el RUC.'},{status:e instanceof RucError?e.status:503,headers});
 }
}

import {lookupRuc,RucError} from '@/server/ruc';
import {rateLimit} from '@/server/rate-limit';
import {sameOriginRucRequest} from '@/server/config';
import {getQuoteActor,quoteActorCan,guestOperationLimit} from '@/server/quote-actor';
export const runtime='nodejs';
export async function GET(request:Request,{params}:{params:Promise<{ruc:string}>}){
 const headers=new Headers({'Cache-Control':'no-store'});
 try{
  if(!sameOriginRucRequest(request))return Response.json({error:'Origen no permitido.'},{status:403,headers});
  const actor=await getQuoteActor();if(!actor)return Response.json({error:'Elige continuar como invitado o accede a tu cuenta para consultar el documento.'},{status:401,headers});
  if(!quoteActorCan(actor,'write'))return Response.json({error:'Sin permiso para consultar el documento.'},{status:403,headers});
  if(actor.kind==='guest'){const blocked=guestOperationLimit(actor,'ruc');if(blocked)return blocked;}
  const limited=rateLimit(request,'ruc');
  if(limited)return limited;
  return Response.json(await lookupRuc((await params).ruc),{headers});
 }catch(e){
  if(e instanceof RucError&&e.retryAfter)headers.set('Retry-After',String(e.retryAfter));
  return Response.json({error:e instanceof RucError?e.message:'No se pudo consultar el RUC.'},{status:e instanceof RucError?e.status:503,headers});
 }
}

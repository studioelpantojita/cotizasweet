import {getQuoteActor,quoteActorCan} from '@/server/quote-actor';
import {archivedDocument,documentResponse} from '@/server/submissions';
import {takeRateLimit} from '@/server/rate-limit';
export const runtime='nodejs';
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
 try{
  const actor=await getQuoteActor();
  if(!actor)return Response.json({error:'La visita expiró. Inicia una cotización nueva o accede a tu cuenta.'},{status:401,headers:{'Cache-Control':'no-store'}});
  if(!quoteActorCan(actor,'document'))return Response.json({error:'Sin permiso.'},{status:403,headers:{'Cache-Control':'no-store'}});
  const limit=takeRateLimit('documents:read:'+actor.owner,60,60);
  if(!limit.allowed)return Response.json({error:'Intenta más tarde.'},{status:429,headers:{'Retry-After':String(limit.retryAfter)}});
  const document=archivedDocument(actor.owner,(await params).id);
  return document?documentResponse(document):Response.json({error:'Documento no encontrado.'},{status:404,headers:{'Cache-Control':'no-store'}});
 }catch{return Response.json({error:'No se pudo recuperar el documento.'},{status:503,headers:{'Cache-Control':'no-store'}});}
}

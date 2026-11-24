import {getQuoteActor,quoteActorCan} from '@/server/quote-actor';
import {sameOrigin} from '@/server/config';
import {submissionForOwner,submitQuote} from '@/server/submissions';
import {takeRateLimit} from '@/server/rate-limit';
export const runtime='nodejs';
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
 try{
  const actor=await getQuoteActor();if(!actor)return json({error:'La visita expiró. Inicia una cotización nueva o accede a tu cuenta.'},401);
  if(!quoteActorCan(actor,'document'))return json({error:'Sin permiso.'},403);
  const limit=takeRateLimit('submissions:read:'+actor.owner,60,60);
  if(!limit.allowed)return Response.json({error:'Intenta más tarde.'},{status:429,headers:{'Cache-Control':'no-store','Retry-After':String(limit.retryAfter)}});
  const receipt=submissionForOwner(actor.owner,(await params).id);
  return json({receipt:receipt?{id:receipt.id,submittedAt:receipt.submittedAt,pdfSha256:receipt.pdfSha256,emailStatus:receipt.emailStatus}:null});
 }catch{return json({error:'No se pudo consultar el estado del envío.'},503);}
}
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
 try{
  const actor=await getQuoteActor();if(!actor)return json({error:'La visita expiró. Inicia una cotización nueva o accede a tu cuenta.'},401);
  if(!sameOrigin(request))return json({error:'Origen no permitido.'},403);
  if(!quoteActorCan(actor,'write'))return json({error:'Sin permiso para enviar.'},403);
  const limit=takeRateLimit('submissions:write:'+actor.owner,20,60);
  if(!limit.allowed)return Response.json({error:'Intenta más tarde.'},{status:429,headers:{'Cache-Control':'no-store','Retry-After':String(limit.retryAfter)}});
  const receipt=submitQuote(actor.owner,actor.displayName,(await params).id);
  return receipt?json({receipt:{id:receipt.id,submittedAt:receipt.submittedAt,pdfSha256:receipt.pdfSha256,emailStatus:receipt.emailStatus},message:'Cotización recibida en la bandeja del administrador. El correo está pendiente de configuración.'}):json({error:'Guarda y descarga esta cotización antes de enviarla.'},404);
 }catch{return json({error:'No se confirmó el envío. Puedes volver a intentarlo sin duplicarlo.'},503);}
}

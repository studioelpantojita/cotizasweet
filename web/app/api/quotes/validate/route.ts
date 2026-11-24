import {createQuoteSchema} from '@/lib/quote';
import {sameOrigin} from '@/server/config';
import {verifyIdentity,RucError} from '@/server/ruc';
import {readQuoteBody} from '@/server/quote-input';
import {rateLimit} from '@/server/rate-limit';
import {getQuoteActor,quoteActorCan,guestOperationLimit} from '@/server/quote-actor';
import {priceForActor} from '@/server/quote-pricing';
export const runtime='nodejs';
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
export async function POST(request:Request){
 if(!sameOrigin(request))return json({error:'Origen no permitido.'},403);
 try{
  const actor=await getQuoteActor();if(!actor)return json({error:'Elige continuar como invitado o accede a tu cuenta para cotizar.'},401);
  if(!quoteActorCan(actor,'write'))return json({error:'Sin permiso para cotizar.'},403);
  if(actor.kind==='guest'){const blocked=guestOperationLimit(actor,'validate');if(blocked)return blocked;}
  const limited=rateLimit(request,'validate');if(limited)return limited;
  const input=await readQuoteBody(request),result=createQuoteSchema.safeParse(input);
  if(!result.success)return json({error:result.error.issues.map(i=>i.message).join(' '),issues:result.error.issues.map(i=>({path:i.path,message:i.message}))},400);
  return json({quote:await verifyIdentity(priceForActor(result.data,actor))});
 }catch(e){
  const response=json({error:e instanceof RucError?e.message:'No se pudo validar la propuesta.'},e instanceof RucError?e.status:503);
  if(e instanceof RucError&&e.retryAfter)response.headers.set('Retry-After',String(e.retryAfter));
  return response;
 }
}

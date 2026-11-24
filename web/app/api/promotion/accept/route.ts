import {cookies} from 'next/headers';
import {NextResponse} from 'next/server';
import {getSession,cookieName,cookieOptions} from '@/server/session';
import {sameOrigin} from '@/server/config';
import {putState} from '@/server/store';
import {takeRateLimit} from '@/server/rate-limit';
import {readOfferIntent,type OfferIntent} from '@/server/promotions';
import {promotionCampaignId,promotionOfferActive} from '@/lib/promotion';
export const runtime='nodejs';
export async function POST(request:Request){
 const json=(body:unknown,status:number)=>NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}});
 try{
  if(!sameOrigin(request))return json({error:'Origen no permitido.'},403);
  if(await getSession())return json({error:'Esta promoción de registro corresponde a cuentas nuevas.'},409);
  if(!promotionOfferActive())return json({error:'La promoción ya finalizó. Puedes continuar sin registro.'},410);
  const limit=takeRateLimit('promotion-intent:global',60,3600);if(!limit.allowed)return json({error:'Intenta nuevamente más tarde o continúa como invitado.'},429);
  const jar=await cookies(),old=jar.get(cookieName('promotion'))?.value;
  const response=json({ok:true,next:'/auth/register?promocion='+promotionCampaignId},200);
  if(!readOfferIntent(old)){
   const intent:OfferIntent={campaignId:promotionCampaignId,acceptedAt:new Date().toISOString()};
   response.cookies.set(cookieName('promotion'),putState('promotion',intent,1800),cookieOptions(1800));
  }
  return response;
 }catch{return json({error:'No se pudo preparar el registro. Puedes continuar como invitado.'},503);}
}

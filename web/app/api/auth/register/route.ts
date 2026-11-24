import {accountConfig,createAccount,accountSession,AccountError} from '@/server/accounts';
import {cookies} from 'next/headers';
import {NextResponse} from 'next/server';
import {cookieName,cookieOptions} from '@/server/session';
import {putState,deleteState} from '@/server/store';
import {readOfferIntent,enrollNewAccount} from '@/server/promotions';
import {promotionCampaignId} from '@/lib/promotion';
import {accountInput,accountJson,accountFailure} from '@/server/account-http';
import {takeRateLimit} from '@/server/rate-limit';
export const runtime='nodejs';
export async function POST(request:Request){
 try{
  const data=await accountInput(request);accountConfig();
  if(Object.keys(data).some(k=>!['username','password','confirmation','displayName','promotionCampaign'].includes(k)))throw new AccountError('Solicitud inválida.');
  const limited=takeRateLimit('account-registration:global',10,3600);
  if(!limited.allowed)return accountJson({error:'Se alcanzó el límite temporal de registro. Intenta más tarde.'},429,{'Retry-After':String(limited.retryAfter)});
  if(data.password!==data.confirmation)throw new AccountError('Las contraseñas no coinciden.');
  const jar=await cookies(),intentToken=jar.get(cookieName('promotion'))?.value;
  const wantsPromotion=data.promotionCampaign===promotionCampaignId;
  if(data.promotionCampaign!==undefined&&!wantsPromotion)throw new AccountError('La promoción indicada no es válida.');
  if(wantsPromotion&&!readOfferIntent(intentToken))throw new AccountError('La invitación venció. Vuelve al cotizador para revisar la oferta.',409);
  const account=await createAccount(data.username,data.password,data.displayName,'customer',wantsPromotion?id=>enrollNewAccount(id,intentToken!):undefined);
  const {ttl,session}=await accountSession(account);
  for(const kind of ['session','guest']){const old=jar.get(cookieName(kind))?.value;if(old)deleteState(old);}
  const response=NextResponse.json({ok:true,signedIn:true,next:'/cotizar',promotionEnrolled:wantsPromotion},{status:201,headers:{'Cache-Control':'no-store'}});
  response.cookies.set(cookieName(),putState('session',session,ttl),cookieOptions(ttl));
  for(const kind of ['guest','promotion'])response.cookies.set(cookieName(kind),'',cookieOptions(0));
  return response;
 }catch(e){return accountFailure(e);}
}

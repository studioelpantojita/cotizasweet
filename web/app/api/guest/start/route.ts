import {NextResponse} from 'next/server';
import {sameOrigin} from '@/server/config';
import {cookieName,cookieOptions} from '@/server/session';
import {getQuoteActor,guestStartLimit,issueGuestContext,guestContextSeconds} from '@/server/quote-actor';
import {pruneExpiredGuestDrafts} from '@/server/guest-retention';
export const runtime='nodejs';
export async function POST(request:Request){
 if(!sameOrigin(request))return Response.json({error:'Origen no permitido.'},{status:403,headers:{'Cache-Control':'no-store'}});
 try{
  const current=await getQuoteActor();
  if(current)return Response.json(current.kind==='guest'?{kind:'guest',expiresAt:current.expiresAt}:{kind:'account'},{headers:{'Cache-Control':'no-store'}});
  const blocked=guestStartLimit(request);if(blocked)return blocked;
  pruneExpiredGuestDrafts();
  const {actor,token}=issueGuestContext();
  const response=NextResponse.json({kind:'guest',expiresAt:actor.expiresAt},{headers:{'Cache-Control':'no-store'}});
  response.cookies.set(cookieName('guest'),token,cookieOptions(guestContextSeconds));
  return response;
 }catch{return Response.json({error:'No se pudo preparar la cotización de invitado. Intenta nuevamente.'},{status:503,headers:{'Cache-Control':'no-store'}});}
}

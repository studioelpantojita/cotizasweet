import {cookies} from 'next/headers';
import {NextResponse} from 'next/server';
import {accountConfig,authenticateAccount,accountSession,AccountError} from '@/server/accounts';
import {accountInput,accountJson,accountFailure} from '@/server/account-http';
import {rateLimit,takeRateLimit} from '@/server/rate-limit';
import {deleteState,putState,digest} from '@/server/store';
import {cookieName,cookieOptions} from '@/server/session';
export const runtime='nodejs';
export async function POST(request:Request){
 try{
  const data=await accountInput(request);accountConfig();
  if(Object.keys(data).some(k=>!['username','password'].includes(k)))throw new AccountError('Solicitud inválida.');
  const limited=rateLimit(request,'login');if(limited)return limited;
  const bucket=takeRateLimit('credentials:'+digest(String(data.username||'').trim().toLowerCase()),10,900);
  if(!bucket.allowed)return accountJson({error:'Demasiados intentos. Vuelve a intentarlo más tarde.'},429,{'Retry-After':String(bucket.retryAfter)});
  const account=await authenticateAccount(data.username,data.password);
  if(!account)return accountJson({error:'User o Password incorrectos, o la cuenta no está disponible.'},401);
  const {ttl,session}=await accountSession(account),jar=await cookies(),old=jar.get(cookieName())?.value;
  if(old)deleteState(old);
  const guest=jar.get(cookieName('guest'))?.value;if(guest)deleteState(guest);
  const response=NextResponse.json({ok:true,next:account.role==='admin'?'/admin':'/cotizar'},{headers:{'Cache-Control':'no-store'}});
  response.cookies.set(cookieName(),putState('session',session,ttl),cookieOptions(ttl));
  response.cookies.set(cookieName('guest'),'',cookieOptions(0));
  return response;
 }catch(e){return accountFailure(e);}
}

import {NextResponse} from 'next/server';
import {getSession,cookieName,cookieOptions} from '@/server/session';
import {getAccount,authenticateAccount,changePassword,AccountError} from '@/server/accounts';
import {accountInput,accountJson,accountFailure} from '@/server/account-http';
import {takeRateLimit} from '@/server/rate-limit';
export const runtime='nodejs';
export async function POST(request:Request){try{
 const session=await getSession();if(!session?.accountId)return accountJson({error:'Inicia sesión con tu cuenta de usuario.'},401);
 const input=await accountInput(request);
 if(Object.keys(input).some(k=>!['currentPassword','password','confirmation'].includes(k)))throw new AccountError('Solicitud inválida.');
 const limit=takeRateLimit('password-change:'+session.accountId,5,900);if(!limit.allowed)return accountJson({error:'Intenta más tarde.'},429,{'Retry-After':String(limit.retryAfter)});
 if(input.password!==input.confirmation)throw new AccountError('Las contraseñas no coinciden.');
 const account=getAccount(session.accountId);if(!account||!await authenticateAccount(account.username,input.currentPassword))return accountJson({error:'La contraseña actual no es correcta.'},401);
 await changePassword(account.id,input.password);
 const response=NextResponse.json({ok:true},{headers:{'Cache-Control':'no-store'}});response.cookies.set(cookieName(),'',cookieOptions(0));return response;
 }catch(e){return accountFailure(e);}}

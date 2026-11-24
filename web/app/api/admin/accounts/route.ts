import {getSession} from '@/server/session';
import {createAccount,AccountError,listAccounts} from '@/server/accounts';
import {accountInput,accountJson,accountFailure} from '@/server/account-http';
import {takeRateLimit} from '@/server/rate-limit';
export const runtime='nodejs';
export async function GET(){try{const session=await getSession();if(!session)return accountJson({error:'Inicia sesión.'},401);if(session.role!=='admin')return accountJson({error:'Acceso exclusivo del administrador.'},403);return accountJson({accounts:listAccounts()});}catch(e){return accountFailure(e);}}
export async function POST(request:Request){try{const session=await getSession();if(!session)return accountJson({error:'Inicia sesión.'},401);if(session.role!=='admin')return accountJson({error:'Acceso exclusivo del administrador.'},403);const data=await accountInput(request);if(Object.keys(data).some(k=>!['username','password','displayName'].includes(k)))throw new AccountError('Solicitud inválida.');if(!takeRateLimit('admin:create-account:'+session.owner,20,3600).allowed)return accountJson({error:'Se alcanzó el límite temporal.'},429);const account=await createAccount(data.username,data.password,data.displayName,'customer');return accountJson({account},201);}catch(e){return accountFailure(e);}}

import {cookies} from 'next/headers';
import {appOrigin} from './config';
import {readState} from './store';
import {accountsEnabled,getAccount} from './accounts';
export type Session={owner:string;displayName:string;accessToken:string;scopes:string[];role?:'admin'|'customer';accountId?:string;authVersion?:number};
export function cookieName(kind='session') {const origin=new URL(appOrigin());return origin.protocol==='https:'?`__Host-ea_${kind}`:`ea_v230_${origin.port||'80'}_${kind}`;}
export function cookieOptions(seconds:number) {return {httpOnly:true,secure:appOrigin().startsWith('https:'),sameSite:'lax' as const,path:'/',maxAge:seconds};}
export async function getSession():Promise<Session|null> {
  const jar=await cookies();
  // No identity is ever accepted from headers supplied by a browser.
  const token=jar.get(cookieName())?.value;
  const session=token?readState<Session>(token,'session'):null;
  if(!session)return null;
  if(session.accountId){
    if(!accountsEnabled())return null;
    const account=getAccount(session.accountId);
    if(!account?.active||account.authVersion!==session.authVersion)return null;
    return {...session,role:account.role,displayName:account.displayName};
  }
  // External identity sessions are customers; a display name or JWT role cannot elevate them.
  return {...session,role:'customer'};
}

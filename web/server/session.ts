import {cookies} from 'next/headers';
import {appOrigin} from './config';
import {readState} from './store';
export type Session={owner:string;displayName:string;accessToken:string;scopes:string[]};
export function cookieName(kind='session') {return appOrigin().startsWith('https:')?`__Host-ea_${kind}`:`ea_${kind}`;}
export function cookieOptions(seconds:number) {return {httpOnly:true,secure:appOrigin().startsWith('https:'),sameSite:'lax' as const,path:'/',maxAge:seconds};}
export async function getSession():Promise<Session|null> {
  const jar=await cookies();
  // No identity is ever accepted from headers supplied by a browser.
  const token=jar.get(cookieName())?.value;
  return token?readState<Session>(token,'session'):null;
}

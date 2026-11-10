import * as oidc from 'openid-client';
import {cookies} from 'next/headers';
import {NextResponse} from 'next/server';
import {appOrigin} from '@/server/config';
import {oidcConfig,type LoginState} from '@/server/oidc';
import {readState,putState,ownerKey,deleteState} from '@/server/store';
import {cookieName,cookieOptions} from '@/server/session';
export const runtime='nodejs';
export async function GET(request:Request) {
  try {
    const jar=await cookies(),transaction=jar.get(cookieName('login'))?.value;
    const login=transaction?readState<LoginState>(transaction,'login',true):null;
    if(!login)throw new Error('Transacción expirada.');
    const config=await oidcConfig();
    const url=new URL('/auth/callback',appOrigin());url.search=new URL(request.url).search;
    const tokens=await oidc.authorizationCodeGrant(config,url,{pkceCodeVerifier:login.verifier,expectedState:login.state,expectedNonce:login.nonce,idTokenExpected:true});
    const claims=tokens.claims();
    if(!claims?.sub||!claims.iss||!tokens.access_token)throw new Error('Identidad incompleta.');
    const ttl=Math.min(3600,Number(tokens.expires_in||300));
    if(!Number.isFinite(ttl)||ttl<1)throw new Error('Token expirado.');
    const old=jar.get(cookieName())?.value;if(old)deleteState(old);
    const session=putState('session',{owner:ownerKey(claims.iss,claims.sub),displayName:String(claims.name||claims.email||'Mi cuenta'),accessToken:tokens.access_token,scopes:(tokens.scope||'').split(' ')},ttl);
    const response=NextResponse.redirect(new URL('/cotizar',appOrigin()));
    response.cookies.set(cookieName(),session,cookieOptions(ttl));
    response.cookies.set(cookieName('login'),'',cookieOptions(0));
    response.headers.set('Cache-Control','no-store');return response;
  }catch{
    const response=NextResponse.json({error:'No pudimos verificar la sesión. Vuelve a iniciar sesión.'},{status:401,headers:{'Cache-Control':'no-store'}});
    response.cookies.set(cookieName('login'),'',cookieOptions(0));return response;
  }
}

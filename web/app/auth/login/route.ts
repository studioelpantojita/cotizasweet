import * as oidc from 'openid-client';
import {NextResponse} from 'next/server';
import {appOrigin} from '@/server/config';
import {oidcConfig} from '@/server/oidc';
import {putState} from '@/server/store';
import {cookieName,cookieOptions} from '@/server/session';
import {rateLimit} from '@/server/rate-limit';
export const runtime='nodejs';
export async function GET(request:Request) {
  try {
    const limited=rateLimit(request,'login');if(limited)return limited;
    const config=await oidcConfig(),verifier=oidc.randomPKCECodeVerifier(),state=oidc.randomState(),nonce=oidc.randomNonce();
    const scope=process.env.OIDC_SCOPE||'openid profile email quotes:read quotes:write';
    if(!scope.split(' ').includes('openid'))throw new Error('OIDC requiere openid.');
    const params:Record<string,string>={redirect_uri:`${appOrigin()}/auth/callback`,scope,state,nonce,code_challenge:await oidc.calculatePKCECodeChallenge(verifier),code_challenge_method:'S256'};
    if(process.env.OIDC_AUDIENCE)params.audience=process.env.OIDC_AUDIENCE;
    const response=NextResponse.redirect(oidc.buildAuthorizationUrl(config,params));
    response.cookies.set(cookieName('login'),putState('login',{verifier,state,nonce},600),cookieOptions(600));
    response.headers.set('Cache-Control','no-store');
    return response;
  }catch{return NextResponse.json({error:'El inicio de sesión no está configurado o el proveedor no está disponible. Contacta al administrador.'},{status:503,headers:{'Cache-Control':'no-store'}});}
}

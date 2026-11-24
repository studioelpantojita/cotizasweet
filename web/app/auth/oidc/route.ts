import * as oidc from 'openid-client';
import {NextResponse} from 'next/server';
import {appOrigin,oidcProvider} from '@/server/config';
import {oidcConfig,requestedOidcScope} from '@/server/oidc';
import {putState} from '@/server/store';
import {cookieName,cookieOptions} from '@/server/session';
import {rateLimit} from '@/server/rate-limit';
export const runtime='nodejs';
export async function GET(request:Request) {
  if(process.env.OIDC_EXTERNAL_LOGIN_ENABLED!=='true')return NextResponse.json({error:'El acceso externo no está habilitado.'},{status:404});
  try {
    const limited=rateLimit(request,'login');if(limited)return limited;
    const config=await oidcConfig(),verifier=oidc.randomPKCECodeVerifier(),state=oidc.randomState(),nonce=oidc.randomNonce();
    const scope=requestedOidcScope();
    const params:Record<string,string>={redirect_uri:`${appOrigin()}/auth/callback`,scope,state,nonce,code_challenge:await oidc.calculatePKCECodeChallenge(verifier),code_challenge_method:'S256'};
    if(oidcProvider()==='google')params.prompt='select_account';
    else if(process.env.OIDC_AUDIENCE)params.audience=process.env.OIDC_AUDIENCE;
    const response=NextResponse.redirect(oidc.buildAuthorizationUrl(config,params));
    response.cookies.set(cookieName('login'),putState('login',{verifier,state,nonce,requestedScope:scope},600),cookieOptions(600));
    response.headers.set('Cache-Control','no-store');
    return response;
  }catch{return NextResponse.json({error:'El inicio de sesión no está configurado o el proveedor no está disponible. Contacta al administrador.'},{status:503,headers:{'Cache-Control':'no-store'}});}
}

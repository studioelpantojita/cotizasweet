import * as oidc from 'openid-client';
import {createRemoteJWKSet,jwtVerify} from 'jose';
import {backend,oidcProvider} from './config';
let promise:Promise<oidc.Configuration>|undefined;
export function oidcConfig() {
  oidcProvider();
  if(!promise) promise=(async()=>{
    const issuer=new URL(process.env.OIDC_ISSUER || '');
    const id=process.env.OIDC_CLIENT_ID,secret=process.env.OIDC_CLIENT_SECRET;
    if(!id||!secret)throw new Error('Configura el cliente confidencial OIDC.');
    const local=process.env.NODE_ENV!=='production'&&process.env.OIDC_ALLOW_LOCAL_HTTP==='true'&&['localhost','127.0.0.1'].includes(issuer.hostname);
    if(issuer.protocol!=='https:'&&!local)throw new Error('El emisor OIDC requiere HTTPS.');
    const config=await oidc.discovery(issuer,id,secret,undefined,local?{execute:[oidc.allowInsecureRequests]}:undefined);
    oidc.enableNonRepudiationChecks(config);
    return config;
  })().catch(e=>{promise=undefined;throw e;});
  return promise;
}
const defaultScope='openid profile email quotes:read quotes:write';
const quoteScopes=['quotes:read','quotes:write'];

function parseScope(value:string){
  const values=value.split(' ').filter(Boolean);
  // RFC 6749 scope-token excludes spaces, double quotes and backslashes.
  return values.every(scope=>/^[\x21\x23-\x5B\x5D-\x7E]+$/.test(scope))?new Set(values):null;
}

export function requestedOidcScope(){
  if(oidcProvider()==='google')return 'openid profile email';
  const scopes=parseScope(process.env.OIDC_SCOPE??defaultScope);
  if(!scopes?.has('openid'))throw new Error('OIDC requiere openid y permisos válidos.');
  return [...scopes].join(' ');
}

export function grantedQuoteScopes(requested:string,returned:unknown){
  const requestedScopes=parseScope(requested);
  if(!requestedScopes?.has('openid'))return [];
  // RFC 6749 §5.1: the token response may omit scope only when unchanged.
  const granted=returned===undefined?requestedScopes:typeof returned==='string'?parseScope(returned):null;
  return quoteScopes.filter(scope=>requestedScopes.has(scope)&&granted?.has(scope));
}

const signingKeys=new WeakMap<oidc.Configuration,ReturnType<typeof createRemoteJWKSet>>();

export async function grantedSessionScopes(
  requested:string,returned:unknown,accessToken:string,subject:string,config:oidc.Configuration,
){
  const granted=grantedQuoteScopes(requested,returned);
  if(returned!==undefined||backend()!=='next')return granted;
  try{
    const metadata=config.serverMetadata();
    if(!metadata.jwks_uri||!process.env.OIDC_AUDIENCE)return [];
    const url=new URL(metadata.jwks_uri);
    const local=process.env.NODE_ENV!=='production'&&process.env.OIDC_ALLOW_LOCAL_HTTP==='true'&&
      ['localhost','127.0.0.1'].includes(url.hostname);
    if(url.protocol!=='https:'&&!local)return [];
    let keys=signingKeys.get(config);
    if(!keys){
      keys=createRemoteJWKSet(url,{timeoutDuration:5000});
      signingKeys.set(config,keys);
    }
    const {payload}=await jwtVerify(accessToken,keys,{
      issuer:metadata.issuer,audience:process.env.OIDC_AUDIENCE,algorithms:['RS256'],
      requiredClaims:['sub','iat','exp'],
    });
    if(payload.sub!==subject)return [];
    const scopes=typeof payload.scope==='string'?payload.scope:typeof payload.scp==='string'?payload.scp:'';
    return grantedQuoteScopes(requested,scopes);
  }catch{return [];}
}

export type LoginState={verifier:string;state:string;nonce:string;requestedScope:string};

import * as oidc from 'openid-client';
let promise:Promise<oidc.Configuration>|undefined;
export function oidcConfig() {
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
export type LoginState={verifier:string;state:string;nonce:string};

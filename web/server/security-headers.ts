import {createHash} from 'node:crypto';
import {appOrigin} from './config';

export const logoutScript='sessionStorage.removeItem("ea-pastry-draft");location.replace("/")';
const logoutHash=createHash('sha256').update(logoutScript).digest('base64');
const noContentPolicy="default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; object-src 'none'";

export function contentSecurityPolicy(path:string,nonce:string,development:boolean){
 if(path==='/api/auth/logout')return `${noContentPolicy}; script-src 'sha256-${logoutHash}'`;
 if(path.startsWith('/api/'))return noContentPolicy;
 return [
  "default-src 'self'",
  `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${development?" 'unsafe-eval'":''}`,
  // React components and the PDF viewer set inline styles.
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self' blob: data:",
  "connect-src 'self' blob:",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
 ].join('; ');
}

export function strictTransportSecurity(){
 if(process.env.NODE_ENV!=='production')return null;
 try{return appOrigin().startsWith('https:')?'max-age=63072000':null;}
 catch{return null;}
}

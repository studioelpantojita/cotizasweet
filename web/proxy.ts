import {randomBytes} from 'node:crypto';
import {NextResponse,type NextRequest} from 'next/server';
import {contentSecurityPolicy,strictTransportSecurity} from './server/security-headers';

export function proxy(request:NextRequest){
 const nonce=randomBytes(18).toString('base64');
 const policy=contentSecurityPolicy(request.nextUrl.pathname,nonce,process.env.NODE_ENV==='development');
 const requestHeaders=new Headers(request.headers);
 // The renderer reads the policy from the request to nonce its inline bootstrap.
 requestHeaders.set('Content-Security-Policy',policy);
 const response=NextResponse.next({request:{headers:requestHeaders}});
 response.headers.set('Content-Security-Policy',policy);
 const hsts=strictTransportSecurity();
 if(hsts)response.headers.set('Strict-Transport-Security',hsts);
 return response;
}

export const config={
 matcher:['/((?!_next/static|_next/image|favicon.ico).*)'],
};

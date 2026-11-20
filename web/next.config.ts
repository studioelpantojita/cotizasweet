import type {NextConfig} from "next";
const isDev=process.env.NODE_ENV==='development';
// Without nonces, following node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md,
// so pages stay static. blob: serves the PDF.js preview of locally generated PDFs. No
// upgrade-insecure-requests: local http://127.0.0.1 runs must keep loading their assets.
const contentSecurityPolicy=[
 "default-src 'self'",
 `script-src 'self' 'unsafe-inline'${isDev?" 'unsafe-eval'":''}`,
 "style-src 'self' 'unsafe-inline'",
 "img-src 'self' blob: data:",
 "font-src 'self' data:",
 "connect-src 'self' blob:",
 "worker-src 'self' blob:",
 "object-src 'none'",
 "base-uri 'self'",
 "form-action 'self'",
 "frame-ancestors 'none'",
].join('; ');
const config: NextConfig = {
 output:"standalone",distDir:process.env.NEXT_DIST_DIR||'.next',
 async headers(){return [{source:'/:path*',headers:[
  {key:'Content-Security-Policy',value:contentSecurityPolicy},
  // Browsers ignore HSTS over plain HTTP. No includeSubDomains/preload: the operator's
  // other subdomains may not serve HTTPS, and preload is hard to undo.
  {key:'Strict-Transport-Security',value:'max-age=63072000'},
  {key:'X-Content-Type-Options',value:'nosniff'},
  {key:'X-Frame-Options',value:'DENY'},
  {key:'Referrer-Policy',value:'strict-origin-when-cross-origin'},
  {key:'Permissions-Policy',value:'camera=(), microphone=(), geolocation=()'},
 ]}];},
};
export default config;

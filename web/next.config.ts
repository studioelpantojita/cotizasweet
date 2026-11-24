import type {NextConfig} from "next";
const config: NextConfig = {
 output:"standalone",distDir:process.env.NEXT_DIST_DIR||'.next',
 outputFileTracingIncludes:{'/api/quotes':['./public/fonts/quote-regular.ttf','./public/fonts/quote-bold.ttf']},
 async headers(){return [{source:'/:path*',headers:[
  {key:'X-Content-Type-Options',value:'nosniff'},
  {key:'X-Frame-Options',value:'DENY'},
  {key:'Referrer-Policy',value:'strict-origin-when-cross-origin'},
  {key:'Permissions-Policy',value:'camera=(), microphone=(), geolocation=()'},
 ]}];},
};
export default config;

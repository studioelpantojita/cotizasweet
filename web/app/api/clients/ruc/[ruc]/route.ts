import {lookupRuc,RucError} from '@/server/ruc';
import {rateLimit} from '@/server/rate-limit';
import {crossSiteBrowserRequest} from '@/server/config';
export const runtime='nodejs';
const headers={'Cache-Control':'no-store'};
export async function GET(request:Request,{params}:{params:Promise<{ruc:string}>}){
 if(crossSiteBrowserRequest(request))return Response.json({error:'Origen no permitido.'},{status:403,headers});
 try{const limited=rateLimit(request,'ruc');if(limited)return limited;return Response.json(await lookupRuc((await params).ruc),{headers});}
 catch(e){return Response.json({error:e instanceof RucError?e.message:'No se pudo consultar el RUC.'},{status:e instanceof RucError?e.status:503,headers});}
}

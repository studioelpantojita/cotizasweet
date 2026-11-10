import {lookupRuc,RucError} from '@/server/ruc';
import {rateLimit} from '@/server/rate-limit';
export const runtime='nodejs';
export async function GET(_request:Request,{params}:{params:Promise<{ruc:string}>}){
 try{const limited=rateLimit(_request,'ruc');if(limited)return limited;return Response.json(await lookupRuc((await params).ruc),{headers:{'Cache-Control':'no-store'}});}
 catch(e){return Response.json({error:e instanceof RucError?e.message:'No se pudo consultar el RUC.'},{status:e instanceof RucError?e.status:503,headers:{'Cache-Control':'no-store'}});}
}

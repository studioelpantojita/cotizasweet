import {createQuoteSchema} from '@/lib/quote';
import {sameOrigin} from '@/server/config';
import {verifyIdentity,RucError} from '@/server/ruc';
import {readQuoteBody} from '@/server/quote-input';
import {rateLimit} from '@/server/rate-limit';
export const runtime='nodejs';
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
export async function POST(request:Request){
 if(!sameOrigin(request))return json({error:'Origen no permitido.'},403);
 try{
  const limited=rateLimit(request,'validate');if(limited)return limited;
  const input=await readQuoteBody(request),result=createQuoteSchema.safeParse(input);
  if(!result.success)return json({error:result.error.issues.map(i=>i.message).join(' '),issues:result.error.issues.map(i=>({path:i.path,message:i.message}))},400);
  return json({quote:await verifyIdentity(result.data)});
 }catch(e){return json({error:e instanceof RucError?e.message:'No se pudo validar la propuesta.'},e instanceof RucError?e.status:503);}
}

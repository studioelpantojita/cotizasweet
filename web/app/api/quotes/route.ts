import {getSession,type Session} from '@/server/session';
import {backend,apiUrl,sameOrigin} from '@/server/config';
import {listQuotes,saveQuote} from '@/server/store';
import {createQuoteSchema,type Quote} from '@/lib/quote';
import {verifyIdentity,RucError} from '@/server/ruc';
import {readQuoteBody} from '@/server/quote-input';
import {takeRateLimit} from '@/server/rate-limit';
export const runtime='nodejs';
const json=(body:unknown,status=200,headers:Record<string,string>={})=>Response.json(body,{status,headers:{'Cache-Control':'no-store',...headers}});
function ownerRateLimit(owner:string,operation:'read'|'write'){
  const limit=takeRateLimit(`quotes:${operation}:${owner}`,120,60);
  return limit.allowed?null:json({error:'Se alcanzó el límite de solicitudes. Intenta más tarde.'},429,{'Retry-After':String(limit.retryAfter)});
}
async function forward(session:Session,quote?:Quote){
  const res=await fetch(apiUrl(),{method:quote?'POST':'GET',headers:{Authorization:`Bearer ${session.accessToken}`,...(quote?{'Content-Type':'application/json'}:{})},body:quote?JSON.stringify(quote):undefined,cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000)});
  if(!res.ok){
    if(res.status===429){
      const supplied=res.headers.get('retry-after')||'';
      const retryAfter=/^[0-9]{1,4}$/.test(supplied)&&Number(supplied)>=1&&Number(supplied)<=3600?String(Number(supplied)):'60';
      return json({error:'Se alcanzó el límite de solicitudes. Intenta más tarde.'},429,{'Retry-After':retryAfter});
    }
    return json({error:res.status===401?'La sesión expiró. Inicia sesión nuevamente.':res.status===403?'Tu cuenta no tiene permiso para esta operación.':'No se pudo completar la operación en el API.'},[400,401,403,413,415].includes(res.status)?res.status:503);
  }
  return json(await res.json(),res.status);
}
export async function GET(){
  try{
    const session=await getSession();if(!session)return json({error:'Inicia sesión para consultar tus presupuestos.'},401);
    if(!session.scopes.includes('quotes:read'))return json({error:'Permiso quotes:read requerido.'},403);
    if(backend()==='next'){
      const limited=ownerRateLimit(session.owner,'read');if(limited)return limited;
      return json({quotes:listQuotes(session.owner)});
    }
    return await forward(session);
  }catch{return json({error:'No pudimos cargar el historial.'},503);}
}
export async function POST(request:Request){
  try{
    const session=await getSession();if(!session)return json({error:'Inicia sesión para guardar tus presupuestos.'},401);
    if(!sameOrigin(request))return json({error:'Origen no permitido.'},403);
    if(!session.scopes.includes('quotes:write'))return json({error:'Permiso quotes:write requerido.'},403);
    const local=backend()==='next';
    if(local){const limited=ownerRateLimit(session.owner,'write');if(limited)return limited;}
    const input=await readQuoteBody(request);
    const parsed=createQuoteSchema.safeParse(input);if(!parsed.success)return json({error:parsed.error.issues[0]?.message||'Revisa los campos.'},400);
    const verified=await verifyIdentity(parsed.data);
    return local?json(saveQuote(session.owner,verified),201):await forward(session,verified);
  }catch(e){return json({error:e instanceof RucError?e.message:'No pudimos guardar. Tus cambios siguen en pantalla.'},e instanceof RucError?e.status:503);}
}

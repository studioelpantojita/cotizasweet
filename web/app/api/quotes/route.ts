import {getSession,type Session} from '@/server/session';
import {backend,apiUrl,sameOrigin} from '@/server/config';
import {listQuotes,saveQuote} from '@/server/store';
import {createQuoteSchema,type Quote} from '@/lib/quote';
import {verifyIdentity,RucError} from '@/server/ruc';
import {readQuoteBody} from '@/server/quote-input';
import {takeRateLimit} from '@/server/rate-limit';
import {invalidHistoryCursor,readHistoryCursor} from '@/server/history-page';
import {archiveQuote} from '@/server/submissions';
import {getQuoteActor,quoteActorCan,guestOperationLimit} from '@/server/quote-actor';
import {priceForActor} from '@/server/quote-pricing';
export const runtime='nodejs';
const json=(body:unknown,status=200,headers:Record<string,string>={})=>Response.json(body,{status,headers:{'Cache-Control':'no-store',...headers}});
function ownerRateLimit(owner:string,operation:'read'|'write'){
  const limit=takeRateLimit(`quotes:${operation}:${owner}`,120,60);
  return limit.allowed?null:json({error:'Se alcanzó el límite de solicitudes. Intenta más tarde.'},429,{'Retry-After':String(limit.retryAfter)});
}
async function forward(session:Session,quote?:Quote,cursor?:string){
  const url=apiUrl();
  if(cursor)url.searchParams.set('cursor',cursor);
  const res=await fetch(url,{method:quote?'POST':'GET',headers:{Authorization:`Bearer ${session.accessToken}`,...(quote?{'Content-Type':'application/json'}:{})},body:quote?JSON.stringify(quote):undefined,cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000)});
  if(!res.ok){
    if(res.status===429){
      const supplied=res.headers.get('retry-after')||'';
      const seconds=Number(supplied),maxRetryAfter=quote?86400:3600;
      const retryAfter=/^[0-9]{1,5}$/.test(supplied)&&seconds>=1&&seconds<=maxRetryAfter?String(seconds):'60';
      return json({error:'Se alcanzó el límite de solicitudes. Intenta más tarde.'},429,{'Retry-After':retryAfter});
    }
    return json({error:res.status===401?'La sesión expiró. Inicia sesión nuevamente.':res.status===403?'Tu cuenta no tiene permiso para esta operación.':'No se pudo completar la operación en el API.'},[400,401,403,413,415].includes(res.status)?res.status:503);
  }
  return json(await res.json(),res.status);
}
export async function GET(request:Request){
  try{
    const session=await getSession();if(!session)return json({error:'Inicia sesión para consultar tus presupuestos.'},401);
    if(!session.scopes.includes('quotes:read'))return json({error:'Permiso quotes:read requerido.'},403);
    const values=new URL(request.url).searchParams.getAll('cursor');
    let cursor;
    try{cursor=readHistoryCursor(values);}catch{return json({error:invalidHistoryCursor},400);}
    if(backend()==='next'){
      const limited=ownerRateLimit(session.owner,'read');if(limited)return limited;
      return json(listQuotes(session.owner,cursor));
    }
    return await forward(session,undefined,values[0]);
  }catch{return json({error:'No pudimos cargar el historial.'},503);}
}
export async function POST(request:Request){
  try{
    const actor=await getQuoteActor();if(!actor)return json({error:'Elige continuar como invitado o accede a tu cuenta para cotizar.'},401);
    if(!sameOrigin(request))return json({error:'Origen no permitido.'},403);
    if(!quoteActorCan(actor,'write'))return json({error:'Permiso quotes:write requerido.'},403);
    const local=actor.kind==='guest'||backend()==='next';
    if(actor.kind==='guest'){const limited=guestOperationLimit(actor,'write');if(limited)return limited;}
    else if(local){const limited=ownerRateLimit(actor.owner,'write');if(limited)return limited;}
    const input=await readQuoteBody(request);
    const parsed=createQuoteSchema.safeParse(input);if(!parsed.success)return json({error:parsed.error.issues[0]?.message||'Revisa los campos.'},400);
    const verified=await verifyIdentity(priceForActor(parsed.data,actor));
    if(local)return json(archiveQuote(actor.owner,saveQuote(actor.owner,verified)),201);
    if(actor.kind!=='account')throw new Error('Una visita no se reenvía al backend de cuentas.');
    const response=await forward(actor.session,verified);
    if(!response.ok)return response;
    return json(archiveQuote(actor.owner,await response.json()),response.status);
  }catch(e){
    if(e instanceof RucError){
      const responseHeaders:Record<string,string>={};
      if(e.status===429&&e.retryAfter)responseHeaders['Retry-After']=String(e.retryAfter);
      return json({error:e.message},e.status,responseHeaders);
    }
    return json({error:'No pudimos guardar. Tus cambios siguen en pantalla.'},503);
  }
}

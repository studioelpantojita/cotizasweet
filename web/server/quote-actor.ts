import {cookies} from 'next/headers';
import {randomBytes} from 'node:crypto';
import {getSession,cookieName,type Session} from './session';
import {putState,readState} from './store';
import {takeRateLimit,trustedClientAddress} from './rate-limit';

export const guestContextSeconds=4*60*60;
export type GuestQuoteActor={kind:'guest';owner:string;displayName:string;expiresAt:string};
export type QuoteActor={kind:'account';owner:string;displayName:string;session:Session}|GuestQuoteActor;
const guestOwner=/^guest:[a-f0-9]{64}$/;
export function issueGuestContext(){
 const actor:GuestQuoteActor={kind:'guest',owner:'guest:'+randomBytes(32).toString('hex'),displayName:'Cliente invitado',expiresAt:new Date(Date.now()+guestContextSeconds*1000).toISOString()};
 return {actor,token:putState('guest',actor,guestContextSeconds)};
}
export function readGuestContext(token:string):GuestQuoteActor|null{
 const actor=readState<GuestQuoteActor>(token,'guest');
 if(!actor||actor.kind!=='guest'||!guestOwner.test(actor.owner)||actor.displayName!=='Cliente invitado'||!Number.isFinite(Date.parse(actor.expiresAt))||Date.parse(actor.expiresAt)<=Date.now())return null;
 return actor;
}
export async function getQuoteActor():Promise<QuoteActor|null>{
 const session=await getSession();
 if(session)return {kind:'account',owner:session.owner,displayName:session.displayName,session};
 const token=(await cookies()).get(cookieName('guest'))?.value;
 return token?readGuestContext(token):null;
}
export function quoteActorCan(actor:QuoteActor,operation:'write'|'document'){
 return actor.kind==='guest'||actor.session.scopes.includes(operation==='write'?'quotes:write':'quotes:read');
}
function limited(limit:{allowed:boolean;retryAfter:number}){
 return limit.allowed?null:Response.json({error:'Se alcanzó el límite temporal. Intenta nuevamente más tarde.'},{status:429,headers:{'Cache-Control':'no-store','Retry-After':String(limit.retryAfter)}});
}
export function guestStartLimit(request:Request){
 const global=takeRateLimit('guest:start:global',100,3600),blocked=limited(global);
 if(blocked)return blocked;
 const address=trustedClientAddress(request);
 return address?limited(takeRateLimit('guest:start:address:'+address,15,3600)):null;
}
export function guestOperationLimit(actor:GuestQuoteActor,operation:'write'|'validate'|'ruc'){
 const policy={write:{owner:5,global:50,seconds:3600},validate:{owner:30,global:120,seconds:60},ruc:{owner:10,global:60,seconds:60}}[operation];
 // Owner is exclusively server-issued; no browser-supplied owner/IP can reset it.
 const owner=limited(takeRateLimit(`guest:${operation}:owner:${actor.owner}`,policy.owner,policy.seconds));
 return owner||limited(takeRateLimit(`guest:${operation}:global`,policy.global,policy.seconds));
}

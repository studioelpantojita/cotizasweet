import {isIP} from 'node:net';
import {db,digest} from './store';

const policies={login:{global:20,client:10},validate:{global:120,client:30},ruc:{global:60,client:20}} as const;
type Policy=keyof typeof policies;

// SQLite makes the counters survive restarts and share the same window across workers.
export function takeRateLimit(bucket:string,limit:number,seconds:number,now=Date.now()){
 const connection=db();
 connection.prepare('DELETE FROM request_limits WHERE reset_at<=?').run(now);
 const row=connection.prepare(`INSERT INTO request_limits(bucket,hits,reset_at) VALUES (?,1,?)
  ON CONFLICT(bucket) DO UPDATE SET hits=request_limits.hits+1
  RETURNING hits,reset_at`).get(digest(bucket),now+seconds*1000)!;
 return {allowed:Number(row.hits)<=limit,retryAfter:Math.max(1,Math.ceil((Number(row.reset_at)-now)/1000))};
}

export function trustedClientAddress(request:Request):string|null{
 const header=process.env.TRUSTED_CLIENT_IP_HEADER?.toLowerCase();
 // Enable only behind a proxy that removes client-supplied copies of this header.
 if(!header||!['x-forwarded-for','x-real-ip','cf-connecting-ip'].includes(header))return null;
 const value=request.headers.get(header)?.split(',')[0].trim()||'';
 return isIP(value)?value:null;
}

export function rateLimit(request:Request,policy:Policy):Response|null{
 const limits=policies[policy],address=trustedClientAddress(request);
 const global=takeRateLimit(`${policy}:global`,limits.global,60);
 const result=global.allowed&&address?takeRateLimit(`${policy}:client:${address}`,limits.client,60):global;
 if(result.allowed)return null;
 return Response.json({error:'Se alcanzó el límite temporal de solicitudes. Vuelve a intentarlo en un minuto.'},{status:429,headers:{'Cache-Control':'no-store','Retry-After':String(result.retryAfter)}});
}

import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {readQuoteBody,MAX_QUOTE_BYTES} from '../server/quote-input';
import {closeDatabase,db} from '../server/store';
import {takeRateLimit,trustedClientAddress,rateLimit} from '../server/rate-limit';
import {GET as getQuotes,POST as postQuote} from '../app/api/quotes/route';

const temp=mkdtempSync(join(tmpdir(),'sweet-http-'));
process.env.DATABASE_PATH=join(temp,'security.sqlite');
test.after(()=>{closeDatabase();rmSync(temp,{recursive:true,force:true});delete process.env.TRUSTED_CLIENT_IP_HEADER;});
const request=(body:BodyInit,contentType='application/json',headers:Record<string,string>={})=>new Request('http://localhost/api/quotes',{method:'POST',headers:{'content-type':contentType,...headers},body});
const status=(expected:number)=>(error:unknown)=>typeof error==='object'&&error!==null&&'status' in error&&error.status===expected;

test('JSON reader accepts UTF-8 JSON and rejects media-type prefix spoofing',async()=>{
 assert.deepEqual(await readQuoteBody(request('{"client":"José"}','Application/JSON; charset="UTF-8"')),{client:'José'});
 for(const type of ['application/jsonp','application/json-bad','text/plain','application/json; charset=latin1'])await assert.rejects(readQuoteBody(request('{}',type)),status(415));
});

test('JSON reader rejects malformed JSON, invalid UTF-8, empty bodies and excess bytes',async()=>{
 await assert.rejects(readQuoteBody(request('{')),status(400));
 await assert.rejects(readQuoteBody(request(new Uint8Array([123,34,120,34,58,34,0xc3,0x28,34,125]))),status(400));
 await assert.rejects(readQuoteBody(new Request('http://localhost',{method:'POST',headers:{'content-type':'application/json'}})),status(400));
 await assert.rejects(readQuoteBody(request('x'.repeat(MAX_QUOTE_BYTES+1))),status(413));
 await assert.rejects(readQuoteBody(request('{}','application/json',{'content-length':String(MAX_QUOTE_BYTES+1)})),status(413));
 const max='"'+'x'.repeat(MAX_QUOTE_BYTES-2)+'"';
 assert.equal((await readQuoteBody(request(max)) as string).length,MAX_QUOTE_BYTES-2);
});

test('streamed requests cannot evade the byte limit by omitting Content-Length',async()=>{
 let cancelled=false;
 const body=new ReadableStream<Uint8Array>({start(controller){controller.enqueue(new Uint8Array(40000));controller.enqueue(new Uint8Array(40000));},cancel(){cancelled=true;}});
 const streamed=new Request('http://localhost',{method:'POST',headers:{'content-type':'application/json'},body,duplex:'half'} as RequestInit & {duplex:string});
 await assert.rejects(readQuoteBody(streamed),status(413));
 assert.equal(cancelled,true);
});

test('deep JSON and escaped lone Unicode surrogates are rejected before validation',async()=>{
 for(const body of ['{"client":"\\ud800"}','{"\\udfff":"x"}','['.repeat(66)+'0'+']'.repeat(66)])await assert.rejects(readQuoteBody(request(body)),status(400));
 assert.deepEqual(await readQuoteBody(request('{"client":"🧁"}')),{client:'🧁'});
});

test('rate counters persist across connections, reset at expiry, and isolate buckets',()=>{
 assert.equal(takeRateLimit('test:persistence',2,60,1000).allowed,true);
 closeDatabase();
 assert.equal(takeRateLimit('test:persistence',2,60,2000).allowed,true);
 assert.deepEqual(takeRateLimit('test:persistence',2,60,3000),{allowed:false,retryAfter:58});
 assert.equal(takeRateLimit('test:other',2,60,3000).allowed,true);
 assert.equal(takeRateLimit('test:persistence',2,60,61000).allowed,true);
 assert.equal(db().prepare('SELECT count(*) AS count FROM request_limits').get()!.count,2);
});

test('forwarded IPs are ignored unless the exact trusted-proxy header is configured',()=>{
 const req=new Request('http://localhost',{headers:{'x-forwarded-for':'203.0.113.5, 127.0.0.1','x-real-ip':'198.51.100.1'}});
 delete process.env.TRUSTED_CLIENT_IP_HEADER;
 assert.equal(trustedClientAddress(req),null);
 process.env.TRUSTED_CLIENT_IP_HEADER='x-real-ip';assert.equal(trustedClientAddress(req),'198.51.100.1');
 process.env.TRUSTED_CLIENT_IP_HEADER='x-forwarded-for';assert.equal(trustedClientAddress(req),'203.0.113.5');
 assert.equal(trustedClientAddress(new Request('http://localhost',{headers:{'x-forwarded-for':'spoofed'}})),null);
 process.env.TRUSTED_CLIENT_IP_HEADER='authorization';assert.equal(trustedClientAddress(req),null);
 delete process.env.TRUSTED_CLIENT_IP_HEADER;
});

test('login limit returns 429 and Retry-After; spoofing an untrusted header cannot bypass it',async()=>{
 db().prepare('DELETE FROM request_limits').run();
 for(let i=0;i<20;i++)assert.equal(rateLimit(new Request('http://localhost/auth/login',{headers:{'x-forwarded-for':`203.0.113.${i}`}}),'login'),null);
 const blocked=rateLimit(new Request('http://localhost/auth/login'),'login')!;
 assert.equal(blocked.status,429);assert.equal(blocked.headers.get('cache-control'),'no-store');
 assert.ok(Number(blocked.headers.get('retry-after'))>0);
 assert.match((await blocked.json()).error,/límite/);
 assert.equal(rateLimit(new Request('http://localhost/api/quotes/validate'),'validate'),null);
});

test('trusted clients have independent budgets below the global ceiling',()=>{
 db().prepare('DELETE FROM request_limits').run();
 process.env.TRUSTED_CLIENT_IP_HEADER='x-real-ip';
 const one=new Request('http://localhost',{headers:{'x-real-ip':'192.0.2.1'}}),two=new Request('http://localhost',{headers:{'x-real-ip':'192.0.2.2'}});
 for(let i=0;i<10;i++)assert.equal(rateLimit(one,'login'),null);
 assert.equal(rateLimit(one,'login')!.status,429);
 assert.equal(rateLimit(two,'login'),null);
 delete process.env.TRUSTED_CLIENT_IP_HEADER;
});

test('quote proxy preserves upstream 429 and only accepts bounded numeric Retry-After',async t=>{
 const sessionModule=require('../server/session');
 t.mock.method(sessionModule,'getSession',async()=>({owner:'synthetic-owner',displayName:'Synthetic user',accessToken:'synthetic-token',scopes:['quotes:read']}));
 const oldBackend=process.env.API_BACKEND,oldUrl=process.env.API_BASE_URL;
 process.env.API_BACKEND='dotnet';process.env.API_BASE_URL='http://127.0.0.1:8000';
 try{
  for(const [retry,expected] of [['19','19'],['1','1'],['3600','3600'],['0','60'],['86400','60'],['2.5','60'],['tomorrow','60'],['','60']]){
   const fetchMock=t.mock.method(globalThis,'fetch',async()=>new Response('{"error":"private upstream details"}',{status:429,headers:retry?{'Retry-After':retry}:{}}));
   const response=await getQuotes();
   assert.equal(response.status,429);assert.equal(response.headers.get('retry-after'),expected);
   assert.equal(response.headers.get('cache-control'),'no-store');
   const body=await response.json();assert.match(body.error,/límite/);assert.doesNotMatch(body.error,/private/);
   fetchMock.mock.restore();
  }
 }finally{
  if(oldBackend===undefined)delete process.env.API_BACKEND;else process.env.API_BACKEND=oldBackend;
  if(oldUrl===undefined)delete process.env.API_BASE_URL;else process.env.API_BASE_URL=oldUrl;
  t.mock.restoreAll();
 }
});

test('Next quote routes persist separate per-owner read and write limits',async t=>{
 db().prepare('DELETE FROM request_limits').run();
 const sessionModule=require('../server/session');let owner='synthetic-alice';
 t.mock.method(sessionModule,'getSession',async()=>({owner,displayName:'Synthetic user',accessToken:'synthetic-token',scopes:['quotes:read','quotes:write']}));
 const oldBackend=process.env.API_BACKEND,oldOrigin=process.env.APP_ORIGIN;
 process.env.API_BACKEND='next';process.env.APP_ORIGIN='http://localhost:3000';
 const invalid=()=>request('{','application/json',{'Origin':'http://localhost:3000'});
 try{
  for(let i=0;i<120;i++)assert.equal((await getQuotes()).status,200);
  closeDatabase();
  const blocked=await getQuotes();assert.equal(blocked.status,429);
  assert.equal(blocked.headers.get('cache-control'),'no-store');assert.ok(Number(blocked.headers.get('retry-after'))>=1);
  for(let i=0;i<120;i++)assert.equal((await postQuote(invalid())).status,400);
  assert.equal((await postQuote(invalid())).status,429);
  owner='synthetic-bob';assert.equal((await getQuotes()).status,200);assert.equal((await postQuote(invalid())).status,400);
 }finally{
  if(oldBackend===undefined)delete process.env.API_BACKEND;else process.env.API_BACKEND=oldBackend;
  if(oldOrigin===undefined)delete process.env.APP_ORIGIN;else process.env.APP_ORIGIN=oldOrigin;
  t.mock.restoreAll();
 }
});

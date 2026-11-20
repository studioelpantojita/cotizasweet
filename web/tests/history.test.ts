import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {parseHistoryPage,mergeHistoryEntries} from '../lib/history';
import {closeDatabase,db,listQuotes} from '../server/store';
import {decodeHistoryCursor,encodeHistoryCursor,readHistoryCursor} from '../server/history-page';
import {grantedQuoteScopes} from '../server/oidc';
import {contentSecurityPolicy,strictTransportSecurity} from '../server/security-headers';
import {sameOriginRucRequest} from '../server/config';

const folder=mkdtempSync(join(tmpdir(),'cotiza-history-'));
process.env.DATABASE_PATH=join(folder,'quotes.sqlite');
const fixture=JSON.parse(readFileSync('../contracts/example-quote.json','utf8'));
test.after(()=>{closeDatabase();rmSync(folder,{recursive:true,force:true});});

test('one historical or malformed row preserves the valid proposals',()=>{
  const rows=[
    {id:'current',quote:fixture,totalCents:33984,createdAt:'2026-11-18T12:00:00.000Z'},
    {id:'legacy',quote:{...fixture,projectType:'navidad',client:'Cliente anterior'},totalCents:33984,createdAt:'2026-11-17T12:00:00.000Z'},
    {id:'malformed',quote:null,totalCents:3,createdAt:'2026-11-16T12:00:00.000Z'},
    {id:'bad-total',quote:fixture,totalCents:null,createdAt:'2026-11-15T12:00:00.000Z'},
    null,
  ];
  const page=parseHistoryPage({quotes:rows,nextCursor:null});
  assert.equal(page.entries.length,4);
  assert.equal(page.entries[0].kind,'current');
  assert.ok(page.entries.slice(1).every(row=>row.kind==='legacy'));
  assert.equal(page.entries[1].kind==='legacy'&&page.entries[1].client,'Cliente anterior');
});

test('history pages reject invalid containers and de-duplicate repeated entries',()=>{
  for(const bad of [null,[],{quotes:null,nextCursor:null},{quotes:[],nextCursor:42},{quotes:Array(21).fill({}),nextCursor:null}]){
    assert.throws(()=>parseHistoryPage(bad));
  }
  const page=parseHistoryPage({quotes:[{id:'x',quote:null}],nextCursor:null});
  assert.equal(mergeHistoryEntries(page.entries,page.entries).length,1);
});

test('API 2.1 history without nextCursor accepts its bounded result during a staged deployment',()=>{
  for(const count of [0,1,41,200]){
    const rows=Array.from({length:count},(_,index)=>({
      id:`api-21-${index}`,quote:fixture,totalCents:33984,createdAt:'2026-11-18T12:00:00.000Z',
    }));
    const page=parseHistoryPage({quotes:rows});
    assert.equal(page.entries.length,count);
    assert.equal(page.nextCursor,null);
    assert.ok(page.entries.every(entry=>entry.kind==='current'));
  }
  assert.throws(()=>parseHistoryPage({quotes:Array(201).fill({})}));
});

test('compatibility with API 2.1 preserves row isolation and removes duplicate IDs',()=>{
  const rows=[
    {id:'valid',quote:fixture,totalCents:33984,createdAt:'2026-11-18T12:00:00.000Z'},
    {id:'legacy',quote:{...fixture,projectType:'navidad'},totalCents:33984,createdAt:'2026-11-17T12:00:00.000Z'},
    {id:'broken',quote:null,totalCents:null,createdAt:'2026-11-16T12:00:00.000Z'},
    {id:'valid',quote:fixture,totalCents:33984,createdAt:'2026-11-18T12:00:00.000Z'},
    null,
  ];
  const page=parseHistoryPage({quotes:rows});
  assert.deepEqual(page.entries.map(entry=>entry.kind),['current','legacy','legacy']);
  assert.equal(page.nextCursor,null);
});

test('a present pagination field continues to require the current cursor contract',()=>{
  const rows=Array.from({length:21},(_,index)=>({id:`row-${index}`,quote:null}));
  for(const nextCursor of [undefined,'','unknown','2026-11-18T12:00:00.000Z_00000000-0000-0000-0000-000000000001',42]){
    assert.throws(()=>parseHistoryPage({quotes:[],nextCursor}));
  }
  assert.throws(()=>parseHistoryPage({quotes:rows,nextCursor:null}));
  const cursor=encodeHistoryCursor({createdAt:'2026-11-18T12:00:00.000Z',id:'00000000-0000-0000-0000-000000000001'});
  assert.equal(parseHistoryPage({quotes:[],nextCursor:cursor}).nextCursor,cursor);
});

test('history cursor is canonical, bounded and rejects duplicate query values',()=>{
  const record={createdAt:'2026-11-18T12:00:00.000Z',id:'00000000-0000-0000-0000-000000000001'};
  const cursor=encodeHistoryCursor(record);
  assert.equal(cursor.length,85);
  assert.deepEqual(decodeHistoryCursor(cursor),record);
  assert.deepEqual(readHistoryCursor([cursor]),record);
  assert.equal(readHistoryCursor([]),null);
  for(const values of [[''],['bad'],[cursor,cursor],[cursor+'='],[encodeHistoryCursor({...record,createdAt:'2026-02-30T12:00:00.000Z'})]]){
    assert.throws(()=>readHistoryCursor(values));
  }
});

test('keyset pages handle ties, isolate owners and return each row once',()=>{
  const insert=db().prepare('INSERT INTO quotes VALUES (?,?,?,?,?)');
  for(let i=0;i<45;i++){
    insert.run(randomUUID(),'owner',i===0?'{invalid':JSON.stringify(fixture),33984,'2026-11-18T12:00:00.000Z');
  }
  insert.run(randomUUID(),'other',JSON.stringify(fixture),33984,'2026-11-18T12:00:00.000Z');
  const found:string[]=[];
  let cursor=null;
  let pages=0;
  do{
    const page=listQuotes('owner',cursor);
    assert.ok(page.quotes.length<=20);
    found.push(...page.quotes.map(row=>row.id));
    cursor=page.nextCursor?decodeHistoryCursor(page.nextCursor):null;
    pages++;
    assert.ok(pages<5);
  }while(cursor);
  assert.equal(found.length,45);
  assert.equal(new Set(found).size,45);
  assert.equal(pages,3);
  assert.equal(listQuotes('other').quotes.length,1);
  assert.equal(listQuotes("owner' OR 1=1 --").quotes.length,0);
});

test('oversized and corrupted quote payloads cannot fail an entire history page',()=>{
  const insert=db().prepare('INSERT INTO quotes VALUES (?,?,?,?,?)');
  for(const payload of ['{invalid','null','[]','x'.repeat(131073)])insert.run(randomUUID(),'broken',payload,'invalid','2026-11-18T12:00:00.000Z');
  const page=listQuotes('broken');
  assert.equal(page.quotes.length,4);
  assert.ok(page.quotes.every(row=>row.quote===null&&row.totalCents===null));
  assert.equal(parseHistoryPage(page).entries.length,4);
});

test('OIDC omission fallback is bounded by requested scopes and explicit empty stays empty',()=>{
  const requested='openid quotes:read quotes:write';
  assert.deepEqual(grantedQuoteScopes(requested,undefined),['quotes:read','quotes:write']);
  assert.deepEqual(grantedQuoteScopes(requested,''),[]);
  assert.deepEqual(grantedQuoteScopes('openid quotes:read','quotes:read quotes:write'),['quotes:read']);
  for(const bad of [null,42,'quotes:read\nquotes:write'])assert.deepEqual(grantedQuoteScopes(requested,bad),[]);
});

test('CSP constrains script execution, embeds and PDF workers',()=>{
  const policy=contentSecurityPolicy('/cotizar','synthetic-nonce',false);
  assert.ok(policy.includes("'nonce-synthetic-nonce'")&&policy.includes("'strict-dynamic'"));
  assert.ok(!policy.includes("'unsafe-eval'")&&!policy.includes("script-src 'unsafe-inline'"));
  assert.ok(policy.includes("frame-ancestors 'none'")&&policy.includes("worker-src 'self' blob:"));
  assert.ok(contentSecurityPolicy('/api/quotes','x',false).includes("default-src 'none'"));
  const previousNode=process.env.NODE_ENV,previousOrigin=process.env.APP_ORIGIN;
  try{
    Object.assign(process.env,{NODE_ENV:'production',APP_ORIGIN:'https://qa.example.test'});
    assert.equal(strictTransportSecurity(),'max-age=63072000');
  }finally{
    if(previousNode===undefined)Reflect.deleteProperty(process.env,'NODE_ENV');else Object.assign(process.env,{NODE_ENV:previousNode});
    if(previousOrigin===undefined)delete process.env.APP_ORIGIN;else process.env.APP_ORIGIN=previousOrigin;
  }
});

test('RUC endpoint accepts its own client and rejects cross-site browser requests',()=>{
  const previous=process.env.APP_ORIGIN;
  process.env.APP_ORIGIN='https://qa.example.test';
  try{
    const request=(headers:Record<string,string>)=>new Request('https://qa.example.test/api/clients/ruc/20999999990',{headers});
    assert.equal(sameOriginRucRequest(request({'x-cotiza-request':'ruc','sec-fetch-site':'same-origin'})),true);
    assert.equal(sameOriginRucRequest(request({'x-cotiza-request':'ruc',origin:'https://qa.example.test'})),true);
    for(const headers of [{},{'sec-fetch-site':'same-origin'},{'x-cotiza-request':'ruc','sec-fetch-site':'cross-site'},{'x-cotiza-request':'ruc',origin:'https://another.example.test'}] as Record<string,string>[]){
      assert.equal(sameOriginRucRequest(request(headers)),false);
    }
  }finally{if(previous===undefined)delete process.env.APP_ORIGIN;else process.env.APP_ORIGIN=previous;}
});

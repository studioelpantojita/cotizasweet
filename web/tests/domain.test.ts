import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomBytes} from 'node:crypto';
import {quoteSchema,createQuoteSchema,totals,paymentConditions,money,initialQuote} from '../lib/quote';
import {isValidRuc} from '../lib/identity';
import {ownerKey,putState,readState,saveQuote,listQuotes,deleteState,closeDatabase} from '../server/store';
const cases=JSON.parse(readFileSync(new URL('../../contracts/pricing-cases.json',import.meta.url),'utf8'));
const temp=mkdtempSync(join(tmpdir(),'ea-store-'));
process.env.DATABASE_PATH=join(temp,'test.sqlite');process.env.SESSION_SECRET=randomBytes(32).toString('hex');
test.after(()=>{closeDatabase();rmSync(temp,{recursive:true,force:true});});
test('pricing parity, including historical pricing and rounding',()=>{
  for(const c of cases)assert.deepEqual(totals(quoteSchema.parse(c.quote)),c.expected);
});
test('new quotes reject historical version bypass and empty product names',()=>{
 const q=cases[0].quote;
 for(const patch of [{formVersion:1},{pricingVersion:1},{client:'   '},{items:[{...q.items[0],name:'\n\t '}]},{clientType:'empresa',documentType:'ruc',clientDocument:'00000000000'}])assert.equal(createQuoteSchema.safeParse({...q,...patch}).success,false);
 assert.equal(quoteSchema.safeParse(cases[2].quote).success,true);
});
test('RUC checksum and independent document type for natural persons',()=>{
 for(const ruc of ['20131312955','20999999990','10999999994'])assert.equal(isValidRuc(ruc),true);
 for(const ruc of ['00000000000','20131312954','2013131295','99999999999','２０１３１３１２９５５'])assert.equal(isValidRuc(ruc),false);
 assert.equal(createQuoteSchema.safeParse({...cases[0].quote,documentType:'ruc',clientDocument:'10999999994'}).success,true);
});
test('payment conditions match advance and balance',()=>{
 const q=cases[0].quote;
 assert.match(paymentConditions({...q,advancePercent:100}).join(' '),/No queda saldo pendiente/);
 assert.match(paymentConditions({...q,advancePercent:0}).join(' '),/Sin anticipo/);
 assert.doesNotMatch(paymentConditions({...q,advancePercent:0}).join(' '),/reserva/);
 assert.match(paymentConditions({...q,advancePercent:50}).join(' '),/al recoger el pedido/);
 assert.match(paymentConditions({...q,advancePercent:30,locationMode:'on_location'}).join(' '),/al recibir el pedido final/);
 assert.match(paymentConditions({...q,items:q.items.map((i:any)=>({...i,priceCents:0}))}).join(' '),/no tiene importe a pagar/);
 for(const rate of [0,1,30,50,99,100]){const t=totals({...q,advancePercent:rate});assert.equal(t.advance+t.balance,t.total);}
});

test('PEN and USD persist their currency without converting any amounts',()=>{
 const pen=createQuoteSchema.parse(cases[0].quote),usd=createQuoteSchema.parse({...pen,currency:'USD'});
 assert.deepEqual(totals(pen),totals(usd));assert.deepEqual(pen.items,usd.items);
 assert.equal(usd.currency,'USD');assert.match(money(totals(usd).total,usd.currency),/US\$/);
 assert.doesNotMatch(paymentConditions(usd).join(' '),/S\//);
 assert.match(paymentConditions(usd).join(' '),/US\$/);
 for(const currency of ['EUR','usd','',null,1])assert.equal(createQuoteSchema.safeParse({...pen,currency}).success,false);
 const {currency,...old}=pen;assert.equal(quoteSchema.parse(old).currency,'PEN');
 assert.equal(initialQuote().advancePercent,50);
});

test('new contacts require nine digits and field length limits are enforced',()=>{
 const q=cases[0].quote;
 for(const contact of ['900000000','+51 900000000','+51900000000'])assert.equal(createQuoteSchema.safeParse({...q,contact}).success,true);
 for(const contact of ['90000000','9000000000','+57 900000000','90000000x','９００００００００','contacto@ejemplo.com'])assert.equal(createQuoteSchema.safeParse({...q,contact}).success,false);
 for(const [field,limit] of [['client',300],['event',120],['notes',1600]] as const){
  assert.equal(createQuoteSchema.safeParse({...q,[field]:'A'.repeat(limit)}).success,true);
  assert.equal(createQuoteSchema.safeParse({...q,[field]:'A'.repeat(limit+1)}).success,false);
 }
 assert.equal(quoteSchema.safeParse({...q,contact:'Contacto registrado anteriormente'}).success,true);
});

test('creation requires an address on location and rejects invalid numerical values',()=>{
 const q=cases[0].quote,delivery={...q,locationMode:'on_location',provinceId:'1501',districtId:'150130',address:''};
 assert.equal(createQuoteSchema.safeParse(delivery).success,false);
 assert.equal(quoteSchema.safeParse(delivery).success,true,'historical reads keep the original address');
 assert.equal(createQuoteSchema.safeParse({...delivery,address:'Referencia de entrega de prueba'}).success,true);
 for(const advancePercent of [-1,101,12.5,NaN])assert.equal(createQuoteSchema.safeParse({...q,advancePercent}).success,false);
 for(const patch of [{quantity:0},{quantity:1.5},{priceCents:NaN},{priceCents:123.4}])assert.equal(createQuoteSchema.safeParse({...q,items:[{...q.items[0],...patch}]}).success,false);
});
test('private owner and immutable quote versions',()=>{
  const owner=ownerKey('https://id.example','alice'),other=ownerKey('https://id.example','bob');
  const quote=quoteSchema.parse(cases[0].quote),a=saveQuote(owner,quote),b=saveQuote(owner,quote);
  assert.notEqual(a.id,b.id);assert.equal(listQuotes(owner).length,2);assert.deepEqual(listQuotes(other),[]);
  assert.notEqual(owner,ownerKey('https://other.example','alice'));
});
test('encrypted, one-use transactions and session revocation',()=>{
  const id=putState('login',{value:'private'},60);assert.deepEqual(readState(id,'login',true),{value:'private'});assert.equal(readState(id,'login',true),null);
  const expired=putState('session',{value:'expired'},-1);assert.equal(readState(expired,'session'),null);
  const session=putState('session',{accessToken:'test-secret-token'},60);
  assert.equal(readFileSync(process.env.DATABASE_PATH!).includes(Buffer.from('test-secret-token')),false);
  deleteState(session);assert.equal(readState(session,'session'),null);
});

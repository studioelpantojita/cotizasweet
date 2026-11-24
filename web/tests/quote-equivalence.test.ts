import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {quoteSchema} from '../lib/quote';
import {sameQuote} from '../lib/quote-equivalence';
const quote=quoteSchema.parse(JSON.parse(readFileSync('../contracts/example-quote.json','utf8')));
test('saved detection ignores JSON key order and server-only provenance timestamps',()=>{
 const reversed=Object.fromEntries(Object.entries(quote).reverse()) as typeof quote;
 assert.ok(sameQuote(quote,reversed));
 assert.ok(sameQuote(quote,{...quote,clientLookup:{ruc:'20999999990',legalName:'DEMO',status:'DEMO',condition:'DEMO',source:'demo',demo:true,checkedAt:'2026-11-22T00:00:00.000Z'}}));
});
test('saved detection rejects changed fields, prices and invalid content',()=>{
 assert.ok(!sameQuote(quote,{...quote,client:'Otro'}));
 assert.ok(!sameQuote(quote,{...quote,items:quote.items.map(item=>({...item,priceCents:1}))}));
 assert.ok(!sameQuote(quote,{...quote,items:[]}));
});

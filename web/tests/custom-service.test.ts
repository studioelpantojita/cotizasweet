import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {portfolioService,quoteItemPhoto,serviceDetailSchema} from '../lib/custom-service';
import {showcase} from '../lib/sweet-showcase';
import {createQuoteSchema,quoteSchema,initialQuote,itemSchema,totals,draftSchema,catalog} from '../lib/quote';
import {pickupAddress,pickupPatch} from '../lib/pickup-location';
import {productRate,hasPendingPrice,repriceItems,referencePricing} from '../lib/product-pricing';
const detail={flavors:['vainilla','chocolate'],presentation:'Caja de regalo con lazo marfil',scope:'Una torta terminada por unidad, sin montaje ni menaje',quantity:2};
const quote=(item=portfolioService(showcase[0].id,detail))=>({...initialQuote(),client:'Cliente de prueba',clientDocument:'12345678',contact:'+51 900000000',event:'Servicio de prueba',eventDate:'2026-12-31',items:[item],...pickupPatch()});

test('Las17 referencias conservan foto, sabores y tarifa definida por producto',()=>{
 for(const p of showcase){const item=portfolioService(p.id,detail),rate=productRate('portfolio',p.id)!;assert.equal(item.portfolioId,p.id);assert.equal(quoteItemPhoto(item),'/images/'+p.image);assert.ok(item.description.includes('Alcance: '+detail.scope));assert.equal(item.priceCents,rate.prices.PEN);assert.equal(item.unit,rate.unit);assert.deepEqual(item.flavors,detail.flavors);assert.equal(draftSchema.parse({...initialQuote(),items:[item]}).items[0].portfolioId,p.id);assert.ok(createQuoteSchema.safeParse(quote(item)).success);}
 assert.throws(()=>portfolioService('unknown',detail));
 assert.equal(itemSchema.safeParse({...portfolioService(showcase[0].id,detail),portfolioId:'unknown'}).success,false);
 assert.ok(referencePricing.referencePrices);
});

test('Contenido admite1..4 sabores de la lista sin duplicados; presentación requerida',()=>{
 for(const patch of [{quantity:0},{quantity:1.5},{quantity:1000},{flavors:[]},{flavors:['vainilla','chocolate','café','pistacho','almendras']},{flavors:['vainilla','vainilla']},{flavors:['fresa']},{presentation:''},{presentation:'a'.repeat(81)},{scope:'s'.repeat(81)},{priceCents:100},{unit:'otra'}])assert.equal(serviceDetailSchema.safeParse({...detail,...patch}).success,false,JSON.stringify(patch));
 assert.ok(serviceDetailSchema.safeParse({...detail,flavors:['vainilla','chocolate','café','pistacho'],scope:''}).success);
 const item=portfolioService(showcase[0].id,{...detail,scope:''});assert.equal(item.scope,'Unknown.');assert.ok(item.description.endsWith('Alcance: Unknown.'));
 for(const scope of ['',undefined])assert.equal(createQuoteSchema.parse(quote({...item,scope})).items[0].scope,'Unknown.');
});

test('Servidor rechaza manipular precio, unidad, sabores, texto o referencia combinada',()=>{
 const q=quote(),original=q.items[0];
 for(const patch of [{priceCents:0},{priceCents:original.priceCents+1},{unit:'box'},{presentation:''},{flavors:['otro']},{flavors:['vainilla','vainilla']},{flavors:['vainilla','chocolate','café','pistacho','almendras']},{description:'Texto manipulado'},{catalogId:'minibox'}])assert.equal(createQuoteSchema.safeParse({...q,items:[{...original,...patch}]}).success,false,JSON.stringify(patch));
 const pack={...catalog[0],id:'uuid-test'};assert.ok(createQuoteSchema.safeParse(quote(pack)).success);
 assert.ok(!createQuoteSchema.safeParse(quote({...pack,priceCents:1})).success);
 assert.ok(!createQuoteSchema.safeParse(quote({...pack,unit:'libre'})).success);
 const historical={...q,eventDate:'',advancePercent:30,items:[{...original,flavors:undefined,presentation:undefined,scope:undefined,priceCents:15000,unit:'torta de12porciones',description:'Texto histórico independiente'}]};
 assert.ok(quoteSchema.safeParse(historical).success,'Historical records retain their original tariff and detail');
 assert.ok(!createQuoteSchema.safeParse(historical).success);
});

test('Nuevas propuestas requieren fecha, DNI natural y50%de anticipo; borradores no',()=>{
 const q=quote();assert.ok(createQuoteSchema.safeParse(q).success);
 for(const patch of [{eventDate:''},{advancePercent:30},{advancePercent:0},{clientType:'persona_natural',documentType:'ruc',clientDocument:'10999999994'}])assert.ok(!createQuoteSchema.safeParse({...q,...patch}).success);
 assert.ok(createQuoteSchema.safeParse({...q,clientType:'empresa',documentType:'ruc',clientDocument:'20999999990'}).success);
 assert.ok(draftSchema.safeParse({...q,eventDate:'',items:[]}).success);
 assert.ok(quoteSchema.safeParse({...q,eventDate:'',advancePercent:30}).success);
});

test('Solicitud sin referencia queda por cotizar y no permite autofijar un precio',()=>{
 const pending={id:'custom',name:'Servicio a medida',description:'Servicio por evaluar',image:'none' as const,quantity:1,priceCents:0,category:'pack' as const,unit:'servicio'};
 assert.ok(createQuoteSchema.safeParse(quote(pending)).success);assert.ok(hasPendingPrice(quote(pending)));
 assert.ok(!hasPendingPrice(quote()));
 for(const patch of [{priceCents:1},{unit:'unidad'}])assert.ok(!createQuoteSchema.safeParse(quote({...pending,...patch})).success);
 const revalued=repriceItems([{...catalog[0],priceCents:3}], 'PEN');assert.equal(revalued[0].priceCents,8500);
});

test('Ficha de insumos opcional, recojo, IGV y anticipo conservan cálculo',()=>{
 const q=createQuoteSchema.parse(quote());assert.equal(q.address,pickupAddress);assert.ok(!q.materials.some(m=>m.selected));
 const price=productRate('portfolio',showcase[0].id)!.prices.PEN;
 assert.equal(totals(q).mobility,0);assert.equal(totals(q).total,Math.round(price*2*1.18));assert.equal(totals(q).advance,Math.round(totals(q).total/2));
 assert.equal(totals({...q,locationMode:'on_location',provinceId:'1501',districtId:'150101',address:'Dirección de prueba'}).mobility,Math.round(price*2*.05));
});

test('Contrato compartido contiene referencias y nuevos atributos sin invalidar historial',()=>{
 const schema=JSON.parse(readFileSync('../contracts/quote.schema.json','utf8'));
 assert.deepEqual(schema.definitions.Quote.properties.items.items.properties.portfolioId.enum,showcase.map(p=>p.id));
 const old=JSON.parse(readFileSync('../contracts/example-quote.json','utf8'));assert.ok(createQuoteSchema.safeParse(old).success);
 assert.equal(schema.definitions.Quote.properties.items.items.properties.flavors.maxItems,4);
});

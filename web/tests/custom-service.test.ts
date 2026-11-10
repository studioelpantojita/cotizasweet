import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {portfolioService,quoteItemPhoto,serviceDetailSchema} from '../lib/custom-service';
import {showcase} from '../lib/sweet-showcase';
import {createQuoteSchema,initialQuote,itemSchema,totals,draftSchema} from '../lib/quote';
import {pickupAddress,pickupPatch} from '../lib/pickup-location';
const detail={content:'Torta de vainilla y fresas para 12 personas',presentation:'Caja de regalo con lazo marfil',scope:'Una torta terminada por unidad, sin montaje ni menaje',quantity:2,priceCents:15000,unit:'torta de 12 porciones'};
test('Las 17 referencias se convierten en servicios y conservan foto y alcance',()=>{
 for(const p of showcase){const item=portfolioService(p.id,detail);assert.equal(item.portfolioId,p.id);assert.equal(quoteItemPhoto(item),'/images/'+p.image);assert.ok(item.description.includes('Alcance: '+detail.scope));assert.equal(draftSchema.parse({...initialQuote(),items:[item]}).items[0].portfolioId,p.id);}
 assert.throws(()=>portfolioService('unknown',detail));
 assert.equal(itemSchema.safeParse({...portfolioService(showcase[0].id,detail),portfolioId:'unknown'}).success,false);
});
test('No acepta precio vacío, negativo, precisión extra ni cantidades fraccionarias',()=>{
 for(const patch of [{priceCents:NaN},{priceCents:-1},{priceCents:1.5},{priceCents:100000001},{quantity:0},{quantity:1.5},{quantity:1000},{content:' '},{presentation:''},{scope:''}]){
  assert.equal(serviceDetailSchema.safeParse({...detail,...patch}).success,false,JSON.stringify(patch));
 }
 assert.equal(serviceDetailSchema.safeParse({...detail,priceCents:0}).success,true);
 const maximum=portfolioService(showcase[0].id,{...detail,content:'a'.repeat(80),presentation:'b'.repeat(80),scope:'c'.repeat(80)});
 assert.ok(maximum.description.length<=300);
});
test('Cotiza sin ficha de insumos y calcula recojo, IGV y anticipo',()=>{
 const q=createQuoteSchema.parse({...initialQuote(),client:'Cliente de prueba',clientDocument:'12345678',contact:'+51 900000000',event:'Servicio de prueba',items:[portfolioService(showcase[0].id,detail)],...pickupPatch()});
 assert.equal(q.address,pickupAddress);assert.ok(!q.materials.some(m=>m.selected));
 assert.equal(totals(q).mobility,0);assert.equal(totals(q).total,35400);assert.equal(totals(q).advance,17700);
 assert.equal(totals({...q,locationMode:'on_location',provinceId:'1501',districtId:'150101',address:'Dirección de prueba'}).mobility,1500);
});
test('El contrato compartido permite referencias conocidas y preserva los servicios anteriores',()=>{
 const schema=JSON.parse(readFileSync('../contracts/quote.schema.json','utf8'));
 assert.deepEqual(schema.definitions.Quote.properties.items.items.properties.portfolioId.enum,showcase.map(p=>p.id));
 const old=JSON.parse(readFileSync('../contracts/example-quote.json','utf8'));
 assert.equal(createQuoteSchema.safeParse(old).success,true);
});

import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {validateCatalog,publicCatalog,filterProducts,priceLabel,confirmationCurrent} from '../lib/commercial-catalog';
const seed=JSON.parse(readFileSync('../contracts/catalog.json','utf8'));
const clone=()=>structuredClone(seed);
test('Only the six requested groups and products are published',()=>{const c=publicCatalog(seed);assert.equal(c.products.length,6);assert.equal(filterProducts(c.products,'packs','').length,3);assert.equal(filterProducts(c.products,'insumos','').length,3);});
test('Search ignores accents and includes variant qualities',()=>{assert.equal(filterProducts(seed.products,'insumos','organicos')[0].id,'insumos-organicos');assert.equal(filterProducts(seed.products,'packs','no-existe').length,0);assert.equal(filterProducts(seed.products,'packs','autor').length,3);});
test('Unpublished products never appear in the public snapshot',()=>{const c=clone();c.products[0].published=false;assert.equal(publicCatalog(c).products.length,5);assert.equal(filterProducts(c.products,'all','').length,5);});
test('Prices use integer minor units, preserve zero and never convert currency',()=>{assert.match(priceLabel(8500,'PEN'),/85/);assert.match(priceLabel(0,'PEN'),/0/);assert.equal(priceLabel(undefined,'USD'),'Precio por confirmar');for(const n of [-1,0.5,Infinity,100000001]){const c=clone();c.products[0].variants[0].prices.PEN=n;assert.throws(()=>validateCatalog(c));}});
test('Unknown private fields, duplicate IDs, remote URLs and empty prices are rejected',()=>{
 for(const mutate of [(c:any)=>c.products[0].costCents=3,(c:any)=>c.products[0].variants[0].prices={EUR:20},(c:any)=>c.products[0].images[0].src='https://evil.example/a.jpg',(c:any)=>c.products[0].images[0].src='/images/../../private.jpg',(c:any)=>c.products.push(c.products[0]),(c:any)=>c.products[0].variants.push(c.products[0].variants[0]),(c:any)=>c.products[0].variants[0].prices={}]){
  const c=clone();mutate(c);assert.throws(()=>validateCatalog(c));
 }
});
test('Business confirmation requires evidence fields and a valid date interval',()=>{
 const c=clone();c.products[0].confirmation={status:'confirmed',note:'Composición revisada'};
 assert.throws(()=>validateCatalog(c));
 c.products[0].confirmation={status:'confirmed',note:'Revisado',by:'Negocio de prueba',date:'2026-10-01',validUntil:'2026-10-31'};
 assert.doesNotThrow(()=>validateCatalog(c));
 assert.equal(confirmationCurrent(c.products[0].confirmation,'2026-10-12'),true);
 assert.equal(confirmationCurrent(c.products[0].confirmation,'2026-11-01'),false);
 assert.equal(confirmationCurrent(c.products[0].confirmation,'2026-09-01'),false);
 c.products[0].confirmation.date='2026-02-30';assert.throws(()=>validateCatalog(c));
});

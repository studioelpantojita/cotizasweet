import {writeFileSync} from 'node:fs';
import {z} from 'zod';
import {quoteSchema,initialQuote,catalog,totals} from '../lib/quote';
import {ingredientDefinitions} from '../lib/ingredients';
import ubigeo from '../lib/peru-ubigeo.json';
const save=(name:string,value:unknown)=>writeFileSync(new URL(`../../contracts/${name}`,import.meta.url),JSON.stringify(value,null,2)+'\n');
const {$schema,...quoteContract}=z.toJSONSchema(quoteSchema,{target:'draft-7',io:'input'});
// Preserve the shared contract's established reference for Python/.NET consumers.
save('quote.schema.json',{$schema,$ref:'#/definitions/Quote',definitions:{Quote:quoteContract}});
save('ingredients.json',ingredientDefinitions);save('ubigeo.json',ubigeo);
const quote={...initialQuote(),client:'Cliente de ejemplo',clientDocument:'12345678',contact:'900000000',event:'Cumpleaños',issued:'2026-10-07',validUntil:'2026-10-28',eventDate:'2026-10-28',projectBrief:'servicio de mini repostería para 30 invitados',items:[{...catalog[1],quantity:2}]};
save('example-quote.json',quoteSchema.parse(quote));
save('pricing-cases.json',[quote,{...quote,locationMode:'on_location',provinceId:'1501',districtId:'150130',address:'Referencia de entrega de prueba'},{...quote,pricingVersion:1,taxPercent:0,locationMode:'legacy',deliveryCents:1700,advancePercent:30},{...quote,items:[{...catalog[0],priceCents:101}],locationMode:'on_location',provinceId:'1501',districtId:'150130',address:'Referencia de entrega de prueba'}].map(q=>({quote:quoteSchema.parse(q),expected:totals(quoteSchema.parse(q))})));

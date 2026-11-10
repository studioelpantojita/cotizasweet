import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {quoteSchema,createQuoteSchema,totals} from '../lib/quote';
import {createQuotePdf} from '../lib/pdf';
import assert from 'node:assert/strict';
const root=resolve('..');
const base=JSON.parse(readFileSync(root+'/contracts/example-quote.json','utf8'));
const variants:Record<string,any>={
 base, bad_currency:{...base,currency:'EUR'}, bad_phone:{...base,contact:'90000000'}, ruc_zeros:{...base,clientType:'empresa',clientDocument:'00000000000'},
 ruc_short:{...base,clientType:'empresa',clientDocument:'123'},
 legacy_form_bypass:{...base,formVersion:1,clientDocument:'',contact:'',event:''},
 legacy_pricing_bypass:{...base,pricingVersion:1,taxPercent:0,locationMode:'legacy',validUntil:'2027-12-31',deliveryCents:0},
 no_items:{...base,items:[]}, bad_email:{...base,clientEmail:'incorrecto'},
 blank_item:{...base,items:[{...base.items[0],name:'   '}]},
 no_address:{...base,locationMode:'on_location',provinceId:'1501',districtId:'150122',address:''},
 bad_date:{...base,eventDate:'2026-02-30'}, wrong_district:{...base,locationMode:'on_location',provinceId:'1501',districtId:'010101'},
 long_description:{...base,items:[{...base.items[0],description:'X\n'.repeat(149)+'Z'}]},
 max_normal:{...base,client:('Compañía de Celebraciones Álvarez y Asociados ').repeat(9).slice(0,300),contact:'+51 900000000',packageName:'Colección especial de celebraciones '.repeat(5).slice(0,120),projectBrief:'Descripción de la celebración y sus requerimientos. '.repeat(15).slice(0,600),items:Array.from({length:30},(_,i)=>({...base.items[0],id:'test-'+i,name:'Servicio de celebración '.repeat(5).slice(0,120),description:'Detalle del producto y de su preparación. '.repeat(9).slice(0,300),unit:'Presentación de regalo para invitados '.repeat(2).slice(0,60),quantity:999,priceCents:100000000})),notes:'Condiciones comerciales y detalles de entrega. '.repeat(40).slice(0,1600)},
 unicode_material:{...base,materials:[{...base.materials[0],selected:true,configuration:{selections:{sweetener:['Azúcar de caña']},cacaoPercent:70,specification:''}}]},
 no_advance:{...base,advancePercent:0}, full_advance:{...base,advancePercent:100},
 zero_total:{...base,items:base.items.map((i:any)=>({...i,priceCents:0}))},
 long_headers:{...base,event:'PROYECTO'.repeat(17).slice(0,120),projectBrief:'Detalle\n'.repeat(70),notes:'Nota\n'.repeat(310),materials:[{...base.materials[0],name:'ESPECIFICACIÓN PERSONALIZADA '.repeat(5).slice(0,120),selected:true,detail:'Detalle conservado para verificar el encabezado largo.'}],items:[{...base.items[0],name:'W'.repeat(120),unit:'UNIDAD'.repeat(10)}]},
 test_project:{...base,event:'PRUEBA · Aniversario de Valentina - mesa dulce y regalos',projectType:'cumpleanos',projectBrief:'Mini repostería y cajas de regalo para 30 invitados. Colores marfil y borgoña, etiquetas con el nombre de la celebración.',advancePercent:30,notes:'Confirmar sabores y presentación antes de producir.\nCoordinar el horario de recojo.\nLos cambios de alcance se cotizan por separado.'}
};
const redesigned={...base,contact:'+51 900000000',client:'Cliente de prueba · Valentina',clientEmail:'valentina@example.test',event:'Celebración de Valentina · colección de mini repostería',projectType:'cumpleanos',issued:'2026-10-12',validUntil:'2026-11-02',eventDate:'2026-10-30',projectBrief:'Selección para 30 invitados, presentación en tonos marfil y borgoña.',advancePercent:50,notes:'Confirmar sabores y diseño antes de iniciar la producción.\nCoordinar el horario de recojo. Los cambios de alcance se cotizan por separado.'};
variants.redesign_pen={...redesigned,currency:'PEN'};variants.redesign_usd={...redesigned,currency:'USD'};
const results:any={validation:{},pricing:[],pdf:[]};
for(const [key,q] of Object.entries(variants)){const v=createQuoteSchema.safeParse(q);results.validation[key]={accepted:v.success,issues:v.success?[]:v.error.issues.map(i=>({path:i.path,message:i.message}))};}
const rejected=new Set(['bad_currency','bad_phone','ruc_zeros','ruc_short','legacy_form_bypass','legacy_pricing_bypass','no_items','bad_email','blank_item','no_address','bad_date','wrong_district']);
for(const [key,result] of Object.entries(results.validation))assert.equal((result as any).accepted,!rejected.has(key),`Validation regression: ${key}`);
const cases=JSON.parse(readFileSync(root+'/contracts/pricing-cases.json','utf8'));
results.pricing=cases.map((c:any)=>({match:JSON.stringify(totals(quoteSchema.parse(c.quote)))===JSON.stringify(c.expected),actual:totals(quoteSchema.parse(c.quote)),expected:c.expected}));
const fonts={regular:readFileSync(root+'/web/public/fonts/quote-regular.ttf').toString('base64'),bold:readFileSync(root+'/web/public/fonts/quote-bold.ttf').toString('base64')};
mkdirSync('../tests/artifacts/pdf',{recursive:true});
for(const key of ['base','long_description','max_normal','unicode_material','no_advance','full_advance','zero_total','long_headers','test_project','redesign_pen','redesign_usd']){
 const doc=createQuotePdf(variants[key],'audit-'+key,fonts);writeFileSync('../tests/artifacts/pdf/'+key+'.pdf',Buffer.from(doc.output('arraybuffer')));results.pdf.push({key,pages:doc.getNumberOfPages()});
}
writeFileSync('../tests/artifacts/pdf-results.json',JSON.stringify(results,null,2));
writeFileSync('../tests/artifacts/inputs.json',JSON.stringify(variants,null,2));
console.log(JSON.stringify({pricing:results.pricing.every((p:any)=>p.match),pdf:results.pdf},null,2));

import {z} from 'zod';
const text=(max:number)=>z.string().trim().min(1).max(max);
const id=z.string().regex(/^[a-z0-9][a-z0-9-]{0,59}$/);
export const serviceSchema=z.enum(['packs','insumos']);
export const confirmationSchema=z.discriminatedUnion('status',[
 z.object({status:z.literal('pending'),note:text(500)}).strict(),
 z.object({status:z.literal('confirmed'),note:text(500),by:text(100),date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),validUntil:z.string().regex(/^\d{4}-\d{2}-\d{2}$/)}).strict()
]);
export const variantSchema=z.object({
 id,label:text(100),quality:text(100),detail:text(500),unit:text(80),
 prices:z.object({PEN:z.number().int().min(0).max(100000000).optional(),USD:z.number().int().min(0).max(100000000).optional()}).strict(),
}).strict();
export const productSchema=z.object({
 id,service:serviceSchema,name:text(120),summary:text(300),description:text(1200),
 images:z.array(z.object({src:z.string().regex(/^\/images\/[a-z0-9-]+\.(jpg|png|webp)$/),alt:text(200),caption:text(200)}).strict()).min(1).max(5),
 features:z.array(text(250)).min(1).max(10),conditions:z.array(text(500)).min(1).max(10),
 variants:z.array(variantSchema).min(1).max(10),confirmation:confirmationSchema,
 published:z.boolean(),
}).strict();
export const catalogSchema=z.object({schemaVersion:z.literal(1),revision:id,updatedAt:z.string().datetime(),
 referencePrices:z.boolean(),products:z.array(productSchema).max(60)}).strict();
export type CommercialCatalog=z.infer<typeof catalogSchema>;
export type CatalogProduct=z.infer<typeof productSchema>;
export type CatalogVariant=z.infer<typeof variantSchema>;
export type CatalogCurrency='PEN'|'USD';
export function validateCatalog(input:unknown):CommercialCatalog {
 const data=catalogSchema.parse(input);
 if(new Set(data.products.map(p=>p.id)).size!==data.products.length)throw new Error('Productos duplicados.');
 for(const p of data.products){
  if(new Set(p.variants.map(v=>v.id)).size!==p.variants.length)throw new Error('Variantes duplicadas.');
  if(p.variants.some(v=>Object.keys(v.prices).length===0))throw new Error('Cada variante requiere un precio.');
  const c=p.confirmation;
  if(c.status==='confirmed'&&(![c.date,c.validUntil].every(d=>!Number.isNaN(Date.parse(d))&&new Date(d).toISOString().slice(0,10)===d)||c.date>c.validUntil))throw new Error('Confirmación inválida.');
 }
 return data;
}
export function publicCatalog(input:unknown):CommercialCatalog {
 const data=validateCatalog(input);
 return {...data,products:data.products.filter(p=>p.published)};
}
export function confirmationCurrent(c:CatalogProduct['confirmation'],today=new Date().toISOString().slice(0,10)){
 return c.status==='confirmed'&&c.date<=today&&c.validUntil>=today;
}
export function filterProducts(products:CatalogProduct[],service:string,query:string){
 const normalize=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es');
 const terms=normalize(query).trim().split(/\s+/).filter(Boolean);
 return products.filter(p=>p.published&&(service==='all'||p.service===service)&&terms.every(t=>normalize([p.name,p.summary,...p.variants.flatMap(v=>[v.label,v.quality])].join(' ')).includes(t)));
}
export function priceLabel(cents:number|undefined,currency:CatalogCurrency){
 return cents===undefined?'Precio por confirmar':new Intl.NumberFormat('es-PE',{style:'currency',currency}).format(cents/100);
}

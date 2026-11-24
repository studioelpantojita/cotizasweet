import {z} from './zod';
import {showcase} from './sweet-showcase';
import {itemSchema,type QuoteItem} from './quote';
import {acceptedFlavors,productRate,serviceDescription} from './product-pricing';

export const serviceDetailSchema=z.object({
 flavors:z.array(z.enum(acceptedFlavors)).min(1,'Selecciona al menos un sabor.').max(4,'Selecciona como máximo 4 sabores.').refine(values=>new Set(values).size===values.length,'No repitas sabores.'),
 presentation:z.string().trim().min(1,'Describe la presentación.').max(80),
 scope:z.string().trim().max(80),
 quantity:itemSchema.shape.quantity,
}).strict();
export type ServiceDetail=z.infer<typeof serviceDetailSchema>;
export function portfolioService(portfolioId:string,detail:ServiceDetail,currency:'PEN'|'USD'='PEN'):QuoteItem{
 const product=showcase.find(p=>p.id===portfolioId),rate=productRate('portfolio',portfolioId);
 if(!product||!rate)throw new Error('Selecciona un producto de la cartera con tarifa configurada.');
 const d=serviceDetailSchema.parse(detail),scope=d.scope||'Unknown.';
 return itemSchema.parse({id:portfolioId,portfolioId,name:product.name,flavors:d.flavors,presentation:d.presentation,scope,
  description:serviceDescription(d.flavors,d.presentation,scope),
  image:'none',quantity:d.quantity,priceCents:rate.prices[currency],category:'pack',unit:rate.unit});
}
export function quoteItemPhoto(item:QuoteItem){
 const product=showcase.find(p=>p.id===item.portfolioId);
 return product?'/images/'+product.image:item.image!=='none'?'/images/'+item.image+'.jpg':null;
}

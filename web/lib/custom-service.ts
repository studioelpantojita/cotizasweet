import {z} from 'zod';
import {showcase} from './sweet-showcase';
import {itemSchema,type QuoteItem} from './quote';

export const serviceDetailSchema=z.object({
 content:z.string().trim().min(1,'Describe el contenido.').max(80),
 presentation:z.string().trim().min(1,'Describe la presentación.').max(80),
 scope:z.string().trim().min(1,'Describe el alcance.').max(80),
 quantity:itemSchema.shape.quantity,
 priceCents:itemSchema.shape.priceCents,
 unit:itemSchema.shape.unit,
});
export type ServiceDetail=z.infer<typeof serviceDetailSchema>;
export function portfolioService(portfolioId:string,detail:ServiceDetail):QuoteItem{
 const product=showcase.find(p=>p.id===portfolioId);
 if(!product)throw new Error('Selecciona un producto de la cartera.');
 const d=serviceDetailSchema.parse(detail);
 return itemSchema.parse({id:portfolioId,portfolioId,name:product.name,
  description:`Contenido: ${d.content}\nPresentación: ${d.presentation}\nAlcance: ${d.scope}`,
  image:'none',quantity:d.quantity,priceCents:d.priceCents,category:'pack',unit:d.unit});
}
export function quoteItemPhoto(item:QuoteItem){
 const product=showcase.find(p=>p.id===item.portfolioId);
 return product?'/images/'+product.image:item.image!=='none'?'/images/'+item.image+'.jpg':null;
}

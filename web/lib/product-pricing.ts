import pricing from '../../contracts/product-pricing.json';

export const referencePricing=pricing;
export const acceptedFlavors=pricing.flavors as [string,...string[]];
export const saleUnits=pricing.saleUnits;
export type ProductRate={unit:string;prices:{PEN:number;USD:number};basis?:string};
// An invalid operator configuration must fail closed before quotes are accepted.
for(const rates of [pricing.catalog,pricing.portfolio])for(const rate of Object.values(rates)){
 if(!saleUnits.includes(rate.unit)||Object.values(rate.prices).some(value=>!Number.isSafeInteger(value)||value<0||value>100000000))throw new Error('Configuración de tarifas inválida.');
}
export type PricedItem={portfolioId?:string;catalogId?:string;priceCents:number;unit:string;flavors?:string[];presentation?:string;scope?:string;description:string};
export function productRate(kind:'portfolio'|'catalog',id:string):ProductRate|undefined {
 const rates=pricing[kind] as Record<string,ProductRate>;return Object.hasOwn(rates,id)?rates[id]:undefined;
}
export function itemRate(item:Pick<PricedItem,'portfolioId'|'catalogId'>){
 return item.portfolioId?productRate('portfolio',item.portfolioId):item.catalogId?productRate('catalog',item.catalogId):undefined;
}
export function repriceItems<T extends PricedItem>(items:T[],currency:'PEN'|'USD'):T[]{return items.map(item=>{const rate=itemRate(item);return rate?{...item,priceCents:rate.prices[currency],unit:rate.unit}:item;});}
export function hasPendingPrice(quote:{items:Pick<PricedItem,'portfolioId'|'catalogId'>[]}){return quote.items.some(item=>!item.portfolioId&&!item.catalogId);}
export function serviceDescription(flavors:string[],presentation:string,scope:string){
 return `Contenido: ${flavors.join(', ')}\nPresentación: ${presentation.trim()}\nAlcance: ${scope.trim()||'Unknown.'}`;
}
export function productCreationIssues(item:PricedItem,currency:'PEN'|'USD'):{field:string;message:string}[]{
 const issues:{field:string;message:string}[]=[];
 const fail=(field:string,message:string)=>issues.push({field,message});
 if(item.portfolioId&&item.catalogId)fail('catalogId','El servicio sólo admite una referencia de producto.');
 const rate=itemRate(item);
 if((item.portfolioId||item.catalogId)&&!rate)fail('priceCents','La referencia del producto no está tarifada.');
 if(rate){
  if(item.priceCents!==rate.prices[currency])fail('priceCents','El precio unitario lo define la tarifa del producto y no se puede editar.');
  if(item.unit!==rate.unit)fail('unit','La unidad de venta la define el producto seleccionado.');
 }
 if(!item.portfolioId&&!item.catalogId){
  if(item.priceCents!==0)fail('priceCents','El precio de un servicio sin referencia queda pendiente de evaluación y debe ser 0.');
  if(item.unit!=='servicio')fail('unit','La solicitud sin referencia se expresa por servicio.');
 }
 if(item.portfolioId){
  const flavors=item.flavors??[];
  if(flavors.length<1||flavors.length>4||new Set(flavors).size!==flavors.length||flavors.some(f=>!acceptedFlavors.includes(f)))fail('flavors','Selecciona entre 1 y 4 sabores distintos de la lista.');
  if(!item.presentation?.trim())fail('presentation','La presentación es obligatoria.');
  if(item.description!==serviceDescription(flavors,item.presentation??'',item.scope??''))fail('description','El detalle del producto debe coincidir con los sabores, la presentación y el alcance seleccionados.');
 }
 return issues;
}

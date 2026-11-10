import {z} from 'zod';
import type {Quote} from './quote';
export type IngredientGroup={id:string;label:string;options:readonly string[]};
export type IngredientDefinition={name:string;intro:string;groups:IngredientGroup[]};
export const ingredientDefinitions:IngredientDefinition[]=[
 {name:'Chocolates finos',intro:'Define el chocolate, el cacao y el endulzante de tu propuesta.',groups:[
  {id:'chocolate',label:'Tipo de chocolate',options:['Negro / bitter','Con leche','Blanco','Rubí']},
  {id:'sweetener',label:'Tipo de endulzante',options:['Azúcar de caña','Panela','Miel','Stevia','Eritritol','Sin endulzante añadido']},
 ]},
 {name:'Insumos orgánicos',intro:'Compón la selección de ingredientes. Su origen orgánico se confirma con el proveedor.',groups:[
  {id:'dairy',label:'Lácteos y grasas',options:['Leche entera','Bebida vegetal','Mantequilla','Crema de leche','Aceite de coco','Manteca de cacao']},
  {id:'flour',label:'Harinas y granos',options:['Harina de trigo','Harina integral','Avena','Harina de almendras','Harina de arroz','Quinua']},
  {id:'aroma',label:'Especias y aromas',options:['Vainilla natural','Canela','Cardamomo','Café','Ralladura de cítricos','Cacao en polvo']},
  {id:'fruit',label:'Frutas de estación',options:['Fresas','Arándanos','Frambuesas','Mango','Maracuyá','Lúcuma','Plátano']},
 ]},
 {name:'Producción artesanal',intro:'Define la elaboración, el acabado y la presentación del pedido.',groups:[
  {id:'process',label:'Proceso de elaboración',options:['Producción en pequeños lotes','Horneado al pedido','Rellenos elaborados en el taller','Decoración manual']},
  {id:'finish',label:'Acabado y decoración',options:['Buttercream','Ganache','Fondant','Frutas frescas','Flores comestibles','Detalles de chocolate']},
  {id:'presentation',label:'Formato y presentación',options:['Porciones individuales','Mini repostería','Torta para compartir','Caja de regalo','Mesa dulce']},
 ]},
];
export const ingredientConfigSchema=z.object({selections:z.record(z.string().max(40),z.array(z.string().max(80)).max(12)).default({}),cacaoPercent:z.number().min(0).max(100).nullable().default(null),specification:z.string().trim().max(500).default('')}).strict();
export const emptyIngredientConfig=()=>({selections:{},cacaoPercent:null,specification:''});
export const ingredientDefinition=(name:string)=>ingredientDefinitions.find(d=>d.name===name);
export const isSelected=(m:Quote['materials'][number])=>m.selected??!!m.detail.trim();
export function ingredientDetails(q:Quote):string[]{
 const lines:string[]=[];
 for(const m of q.materials.filter(isSelected)){
  const d=ingredientDefinition(m.name);lines.push(m.name.toUpperCase());
  let detailCount=0;
  for(const g of d?.groups??[]){const values=m.configuration.selections[g.id]??[];if(values.length){lines.push(`${g.label}: ${values.join(', ')}.`);detailCount++;}}
  if(m.name==='Chocolates finos'&&m.configuration.cacaoPercent!==null){lines.push(`Porcentaje de cacao declarado: ${m.configuration.cacaoPercent}%.`);detailCount++;}
  if(m.configuration.specification){lines.push(`Especificación adicional: ${m.configuration.specification}`);detailCount++;}
  if(m.detail){lines.push(`Especificación registrada anteriormente: ${m.detail}`);detailCount++;}
  if(!detailCount)lines.push('Especificaciones por definir con el cliente.');
  lines.push('');
 }
 if(q.materialNotes.trim())lines.push('NOTAS CONSERVADAS DEL PEDIDO',q.materialNotes.trim(),'');
 // Prior saved dietary statements are preserved as historical notes, not editable current requirements.
 if(q.dietaryRequirements.trim())lines.push('SOLICITUD REGISTRADA ANTERIORMENTE',q.dietaryRequirements.trim());
 if(q.allergenNotes.trim())lines.push('REVISIÓN REGISTRADA ANTERIORMENTE',q.allergenNotes.trim());
 return lines;
}
export const orderNotes=(q:Quote)=>ingredientDetails(q).join('\n').trim();

import { z } from 'zod';
import {showcase} from './sweet-showcase';
import {pickupAddress} from './pickup-location';
import {clientDocumentType,isValidRuc} from './identity';
import {ingredientConfigSchema,emptyIngredientConfig,ingredientDefinition} from './ingredients';
import {provinces,districts} from './peru-ubigeo';
z.setErrorMap(issue=>({message:issue.code==='too_small'?'Completa el campo requerido o revisa el valor mínimo.':issue.code==='too_big'?'El dato supera el límite permitido.':issue.code==='invalid_type'?'Revisa el tipo de dato de este campo.':issue.code==='invalid_format'?'El formato del dato no es válido.':'Revisa el valor de este campo.'}));
const short=z.string().trim().max(120);
export const rucIdentitySchema=z.object({ruc:z.string().regex(/^\d{11}$/),legalName:z.string().min(1).max(300),status:z.string().max(80),condition:z.string().max(80),source:z.string().max(160),checkedAt:z.string().datetime({offset:true}),dataDate:z.string().max(40).optional(),demo:z.boolean()}).strict();
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>!Number.isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v,'Fecha inválida');
export const projectTypes=[
 {id:'bodas',label:'Bodas',group:'celebraciones',brief:'Mesa dulce y detalles para invitados',focus:'Paleta, presentación y número de invitados'},
 {id:'cumpleanos',label:'Cumpleaños',group:'celebraciones',brief:'Packs y detalles personalizados para celebrar un cumpleaños',focus:'Edad, temática, invitados y presentación'},
 {id:'quinceaneras',label:'Quinceañeras',group:'celebraciones',brief:'Colección temática para una celebración de quince años',focus:'Temática, colores y detalles personalizados'},
 {id:'baby-shower',label:'Baby Showers VIP',group:'celebraciones',brief:'Mini repostería y obsequios para Baby Shower VIP',focus:'Diseño delicado y presentación de cada obsequio'},
 {id:'empresas',label:'Empresas',group:'corporativo',brief:'Regalos y catering para encuentros empresariales',focus:'Cantidad de destinatarios y presentación institucional'},
 {id:'rrpp',label:'Agencias de RRPP',group:'corporativo',brief:'Obsequios de prensa y experiencias para invitados',focus:'Identidad de la campaña y lista de entregas'},
 {id:'bancos',label:'Entidades y bancos',group:'corporativo',brief:'Atenciones para clientes y eventos institucionales',focus:'Identidad corporativa y coordinación de entrega'},
 {id:'fitness',label:'Clientes fitness',group:'amedida',brief:'Selección según preferencias alimentarias del cliente',focus:'Ingredientes y porciones; valores nutricionales solo si se verifican'},
 {id:'alergias',label:'Personas con alergias',group:'amedida',brief:'Solicitud de adaptación sujeta a revisión de ingredientes y preparación',focus:'Alérgenos declarados, proveedores y contacto cruzado'},
 {id:'cocteles',label:'Cócteles de moda',group:'experiencias',brief:'Bocados de autor para recepción y cóctel',focus:'Formato de degustación, montaje y ritmo de servicio'},
 {id:'lanzamientos',label:'Lanzamientos de marca',group:'experiencias',brief:'Colección dulce inspirada en la identidad de marca',focus:'Concepto creativo, etiquetas y presentación'},
 {id:'custom',label:'Proyecto a medida',group:'amedida',brief:'Propuesta personalizada',focus:'Alcance y preferencias del cliente'},
] as const;
export type ProjectType=typeof projectTypes[number]['id'];
export const collections=[
 {id:'celebraciones',number:'01',title:'Celebraciones privadas',subtitle:'Bodas · Cumpleaños · Quinceañeras · Baby Showers VIP',description:'Detalles que acompañan los momentos que se recuerdan.',defaultProject:'bodas'},
 {id:'corporativo',number:'02',title:'Regalos corporativos',subtitle:'Empresas · Agencias de RRPP · Entidades y bancos',description:'Una atención que habla con el lenguaje de tu marca.',defaultProject:'empresas'},
 {id:'amedida',number:'03',title:'Selección a medida',subtitle:'Proyecto a medida · Clientes fitness · Personas con alergias',description:'Preferencias e ingredientes, definidos con precisión.',defaultProject:'fitness'},
 {id:'experiencias',number:'04',title:'Experiencias de marca',subtitle:'Cócteles de moda · Lanzamientos de marca',description:'Pequeñas piezas de autor para una gran presentación.',defaultProject:'lanzamientos'},
] as const;
export const projectInfo=(id:string)=>projectTypes.find(p=>p.id===id)||projectTypes[projectTypes.length-1];
export const imageKeys=['cake','cupcakes','wedding','breakfast','minibox','sweet','none'] as const;
export type ImageKey=typeof imageKeys[number];
export const itemSchema=z.object({id:z.string().max(60),name:short.min(1),description:z.string().trim().max(300),image:z.enum(imageKeys),portfolioId:z.enum(showcase.map(p=>p.id) as [string,...string[]]).optional(),quantity:z.number({error:'Ingresa una cantidad entera entre 1 y 999.'}).int('La cantidad debe ser entera.').min(1,'La cantidad mínima es 1.').max(999,'La cantidad máxima es 999.'),priceCents:z.number({error:'Ingresa un precio con hasta dos decimales; escribe 0 si no tiene cargo.'}).int('El precio admite hasta dos decimales.').min(0,'El precio no puede ser negativo.').max(100000000,'El precio unitario máximo es 1,000,000.00 en la moneda seleccionada.'),category:z.enum(['pack','addon']).default('pack'),unit:z.string().trim().min(1).max(60).default('unidad')}).strict();
export const materialSchema=z.object({name:short.min(1),detail:z.string().trim().max(400),confirmed:z.boolean().default(false),selected:z.boolean().optional(),configuration:ingredientConfigSchema.default(emptyIngredientConfig)}).strict();
const quoteFields=z.object({
 currency:z.enum(['PEN','USD']).default('PEN'),
 documentType:z.enum(['dni','ruc']).optional(),clientLookup:rucIdentitySchema.optional(),
 formVersion:z.union([z.literal(1),z.literal(2)]).default(1),clientType:z.enum(['persona_natural','empresa']).default('persona_natural'),clientDocument:z.string().trim().max(11).default(''),clientEmail:z.string().trim().max(180).default(''),
 packageId:z.enum(['custom','essential','signature','premium']).default('custom'),packageName:z.string().trim().max(120).default(''),clientBudgetCents:z.number().int().min(0).max(100000000).nullable().default(null),
 business:short.default(''),businessRuc:z.string().trim().max(11).default(''),contact:z.string().trim().max(220),client:z.string().trim().min(1,'Escribe el nombre del cliente.').max(300),clientContact:z.string().trim().max(180),event:short,eventDate:z.union([date,z.literal('')]),issued:date,validUntil:date,
 projectType:z.enum(['bodas','cumpleanos','quinceaneras','baby-shower','empresas','rrpp','bancos','fitness','alergias','cocteles','lanzamientos','custom']).default('custom'),
 projectBrief:z.string().trim().max(600).default(''),
 items:z.array(itemSchema).min(1,'Añade al menos un servicio.').max(30),
 materials:z.array(materialSchema).max(8).default([]),
 dietaryRequirements:z.string().trim().max(600).default(''),allergenNotes:z.string().trim().max(600).default(''),allergenReviewed:z.boolean().default(false),
 pricingVersion:z.union([z.literal(1),z.literal(2)]).default(1),
 locationMode:z.enum(['on_location','pickup','legacy']).default('legacy'),provinceId:z.string().max(4).default(''),districtId:z.string().max(6).default(''),address:z.string().trim().max(220).default(''),
 taxPercent:z.union([z.literal(0),z.literal(18)]).default(0),materialNotes:z.string().trim().max(1600).default(''),
 deliveryCents:z.number().int().min(0).max(100000000),advancePercent:z.number({error:'Ingresa un porcentaje entero entre 0 y 100.'}).int('El anticipo debe ser un porcentaje entero.').min(0,'El anticipo no puede ser menor a 0%.').max(100,'El anticipo no puede superar el 100%.'),notes:z.string().trim().max(1600),
}).strict();
export const draftSchema=quoteFields.extend({business:short,client:z.string().trim().max(300),items:quoteFields.shape.items.min(0)});
export const quoteSchema=quoteFields.superRefine((q,ctx)=>{
 const fail=(path:string,message:string)=>ctx.addIssue({code:'custom',path:[path],message});
 if(q.formVersion===2){
  const kind=clientDocumentType(q);
  if(q.clientType==='empresa'&&kind!=='ruc')fail('documentType','Las empresas requieren RUC.');
  if(kind==='ruc'?!isValidRuc(q.clientDocument):!/^\d{8}$/.test(q.clientDocument))fail('clientDocument',kind==='ruc'?'Ingresa un RUC válido, incluido su dígito verificador.':'Ingresa el DNI del cliente con 8 dígitos.');
  if(!q.contact.trim())fail('contact','Completa el contacto de tu negocio.');
  if(!q.event.trim())fail('event','Escribe el nombre del proyecto.');
 }
 if(q.clientEmail&&!z.string().email().safeParse(q.clientEmail).success)fail('clientEmail','Escribe un correo válido para el cliente.');
 for(const m of q.materials){const d=ingredientDefinition(m.name);for(const [key,values] of Object.entries(m.configuration.selections)){const g=d?.groups.find(g=>g.id===key);if(!g||values.some(v=>!g.options.includes(v))||new Set(values).size!==values.length)fail('materials','Revisa las opciones de insumos seleccionadas.');}
 const sweet=m.configuration.selections.sweetener??[];if(sweet.includes('Sin endulzante añadido')&&sweet.length>1)fail('materials','Revisa la selección de endulzantes.');}
 if(q.validUntil<q.issued)fail('validUntil','La validez debe ser igual o posterior a la emisión.');
 if(q.eventDate&&q.eventDate<q.issued)fail('eventDate','La fecha del evento debe ser igual o posterior a la emisión.');
 if(q.pricingVersion===2){
  if(q.taxPercent!==18)fail('taxPercent','La tasa configurada para esta propuesta es 18%.');
  if(q.validUntil>addDays(q.issued,21))fail('validUntil','La vigencia no puede superar 21 días calendario desde la emisión.');
  if(q.locationMode==='legacy')fail('locationMode','Selecciona la modalidad del servicio.');
  if(q.deliveryCents!==0)fail('deliveryCents','La movilidad se calcula automáticamente según la modalidad.');
 }
 const province=provinces.find(p=>p.id===q.provinceId);
 const district=districts.find(d=>d.id===q.districtId);
 if(q.provinceId&&!province)fail('provinceId','Selecciona una provincia del catálogo.');
 if(q.districtId&&(!district||district.provinceId!==q.provinceId))fail('districtId','El distrito debe pertenecer a la provincia seleccionada.');
 if(q.locationMode==='on_location'&&(!province||!district))fail('provinceId','Selecciona ciudad o provincia y distrito para el servicio en locación.');
 if(q.materials.some(m=>m.confirmed&&!m.detail.trim()))fail('materials','Detalla el respaldo antes de marcarlo como verificado.');
 if(q.allergenReviewed&&!q.allergenNotes.trim())fail('allergenNotes','Registra el resultado de la revisión alimentaria antes de marcarla como realizada.');
});
function normalizeStrings(value:unknown):unknown{if(typeof value==='string')return value.trim();if(Array.isArray(value))return value.map(normalizeStrings);if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,normalizeStrings(v)]));return value;}
export const createQuoteSchema=z.preprocess(normalizeStrings,quoteSchema.superRefine((q,ctx)=>{
 if(q.formVersion!==2||q.pricingVersion!==2)ctx.addIssue({code:'custom',path:['formVersion'],message:'Las nuevas cotizaciones requieren el formulario y los precios actuales. Actualiza las condiciones de la propuesta histórica.'});
 if(q.locationMode==='on_location'&&!q.address)ctx.addIssue({code:'custom',path:['address'],message:'Indica la dirección o referencia para entregar el pedido en locación.'});
 if(!/^(?:\+51 ?)?[0-9]{9}$/.test(q.contact))ctx.addIssue({code:'custom',path:['contact'],message:'Ingresa un teléfono de 9 dígitos, sin incluir el código +51.'});
}));
export type Quote=z.infer<typeof quoteSchema>;
export type QuoteItem=z.infer<typeof itemSchema>;
export type SavedQuote={id:string;createdAt:string;quote:Quote;totalCents:number};
export const catalog:QuoteItem[]=[
 {id:'breakfast',name:'Desayunos Premium',description:'Box individual con croissant artesanal, mini repostería, mermelada y bebida. Contenido final por confirmar.',image:'breakfast',priceCents:8500,quantity:1,category:'pack',unit:'box individual'},
 {id:'minibox',name:'Boxes de Mini Repostería',description:'Box de 24 piezas: mini tartaletas, petits fours y macarons. Sabores y selección por coordinar.',image:'minibox',priceCents:14400,quantity:1,category:'pack',unit:'box de 24 piezas'},
 {id:'sweet',name:'Combos Sweet',description:'Combo de 30 piezas para compartir: mini cakes, cupcakes, macarons y chocolates. Montaje por coordinar.',image:'sweet',priceCents:21000,quantity:1,category:'pack',unit:'combo de 30 piezas'},
];
export const addons:QuoteItem[]=[
 {id:'macarons',name:'Macarons extras',description:'Set de 6 macarons. Sabores y colores según la propuesta acordada.',image:'none',priceCents:3600,quantity:1,category:'addon',unit:'set de 6'},
 {id:'etiquetas',name:'Etiquetas con logotipo',description:'Personalización por etiqueta. Arte final y dimensiones sujetos a aprobación del cliente.',image:'none',priceCents:200,quantity:1,category:'addon',unit:'etiqueta'},
 {id:'empaque',name:'Empaque de lujo con lazo de satén',description:'Presentación de regalo por empaque. Tamaño y color de lazo por confirmar.',image:'none',priceCents:1800,quantity:1,category:'addon',unit:'empaque'},
];
export function newMaterials(){return [{name:'Chocolates finos',detail:'',confirmed:false,selected:false,configuration:emptyIngredientConfig()},{name:'Insumos orgánicos',detail:'',confirmed:false,selected:false,configuration:emptyIngredientConfig()},{name:'Producción artesanal',detail:'',confirmed:false,selected:false,configuration:emptyIngredientConfig()}];}
export function totals(q:Quote){
 const packs=q.items.filter(i=>i.category!=='addon').reduce((s,i)=>s+i.priceCents*i.quantity,0);
 const addons=q.items.filter(i=>i.category==='addon').reduce((s,i)=>s+i.priceCents*i.quantity,0);
 const subtotal=packs+addons,mobilityRate=q.pricingVersion===2&&q.locationMode==='on_location'?5:0;
 const mobility=q.pricingVersion===2?Math.round(subtotal*mobilityRate/100):q.deliveryCents;
 const base=subtotal+mobility,tax=q.pricingVersion===2?Math.round(base*18/100):0,total=base+tax,advance=Math.round(total*q.advancePercent/100);
 return{subtotal,total,advance,balance:total-advance,packs,addons,mobility,mobilityRate,base,tax};
}
export function addDays(iso:string,days:number){const d=new Date(iso+'T12:00:00Z');if(Number.isNaN(d.getTime()))return '';d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);}
export function materialSelected(m:Quote['materials'][number]){return m.selected??!!m.detail.trim();}
export function materialConditions(q:Quote){
 const selected=q.materials.filter(materialSelected),conditions:string[]=[];
 if(selected.some(m=>m.name==='Chocolates finos'))conditions.push('Chocolates finos: tipo, porcentaje de cacao y endulzante según las especificaciones del pedido. Marca y disponibilidad se confirman antes de producir.');
 if(selected.some(m=>m.name==='Insumos orgánicos'))conditions.push('Insumos orgánicos: el negocio confirmará disponibilidad y respaldo del proveedor para los ingredientes elegidos. Seleccionar esta opción no constituye una certificación.');
 if(selected.some(m=>m.name==='Producción artesanal'))conditions.push('Producción artesanal: elaboración, acabado y presentación según lo seleccionado. El trabajo manual puede dar lugar a pequeñas variaciones de acabado.');
 if(selected.length||q.projectType==='alergias'||q.projectType==='fitness')conditions.push('Los ingredientes elegidos no garantizan ausencia de alérgenos ni propiedades nutricionales. La viabilidad se confirma con el negocio, revisando ingredientes y contacto cruzado antes de aceptar el pedido.');
 if(selected.length)conditions.push('Las especificaciones no añaden cargos automáticamente. Toda sustitución o variación de precio requiere acuerdo previo con el cliente.');
 return conditions;
}
export function paymentConditions(q:Quote){const t=totals(q);if(!Number.isFinite(t.total)||!Number.isInteger(q.advancePercent)||q.advancePercent<0||q.advancePercent>100)return ['Completa los importes y un anticipo entero entre 0 y 100 para calcular las condiciones de pago.'];const delivery=q.locationMode==='pickup'?'al recoger el pedido en el negocio':'al recibir el pedido final';if(t.total===0)return ['Esta propuesta no tiene importe a pagar. No requiere anticipo ni deja saldo pendiente.'];if(q.advancePercent===0)return [`Sin anticipo. El pago total de ${money(t.total,q.currency)} se realiza ${delivery}.`];if(q.advancePercent===100)return [`Se requiere el pago anticipado del 100% (${money(t.total,q.currency)}) para confirmar la reserva e iniciar la producción. No queda saldo pendiente.`];return [`Se requiere un anticipo del ${q.advancePercent}% (${money(t.advance,q.currency)}) para confirmar la reserva e iniciar la producción.`,`El saldo de ${money(t.balance,q.currency)} se paga ${delivery}.`];}
export function locationLabel(q:Quote){return q.locationMode==='on_location'?'En locación':q.locationMode==='pickup'?'Recojo en el negocio':'Entrega según propuesta anterior';}
export function locationDetail(q:Quote){const p=provinces.find(p=>p.id===q.provinceId),d=districts.find(d=>d.id===q.districtId&&d.provinceId===q.provinceId);return [p?.department,p?.name,d?.name].filter(Boolean).join(' · ');}
export function money(cents:number,currency:Quote['currency']='PEN'){if(!Number.isFinite(cents))return 'Por completar';return new Intl.NumberFormat('es-PE',{style:'currency',currency}).formatToParts(cents/100).map(part=>part.type==='currency'?(currency==='USD'?'US$':'S/'):part.value).join('');}
export function displayDate(s:string){if(!s||Number.isNaN(Date.parse(s)))return 'Por coordinar';return new Intl.DateTimeFormat('es-PE',{day:'2-digit',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(s+'T12:00:00Z'));}
export function initialQuote():Quote{const issued=new Date().toLocaleDateString('en-CA',{timeZone:'America/Lima'});const v=new Date(issued+'T12:00:00Z');v.setUTCDate(v.getUTCDate()+21);return{currency:'PEN',documentType:'dni',formVersion:2,clientType:'persona_natural',clientDocument:'',clientEmail:'',packageId:'custom',packageName:'',clientBudgetCents:null,business:'',businessRuc:'',pricingVersion:2,taxPercent:18,locationMode:'pickup',provinceId:'',districtId:'',address:pickupAddress,materialNotes:'',contact:'',client:'',clientContact:'',event:'',eventDate:'',issued,validUntil:v.toISOString().slice(0,10),projectType:'bodas',projectBrief:'',items:[],materials:newMaterials(),dietaryRequirements:'',allergenNotes:'',allergenReviewed:false,deliveryCents:0,advancePercent:50,notes:'Contenido, diseño, disponibilidad y entrega sujetos a confirmación. Los cambios de alcance se cotizan por separado.'};}

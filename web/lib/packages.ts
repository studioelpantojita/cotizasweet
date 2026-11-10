import {catalog,addons,projectInfo,totals,type Quote,type QuoteItem,type ProjectType} from './quote';
export type PackageId='essential'|'signature'|'premium';
export type ServicePackage={id:PackageId;name:string;description:string;items:QuoteItem[];notes:string};
const line=(key:string,quantity:number):QuoteItem=>({...([...catalog,...addons].find(i=>i.id===key)!),quantity,id:key});
const recipes:Record<string,[string,number][][]>={
 celebraciones:[[['minibox',1]],[['minibox',2],['macarons',2],['empaque',2]],[['sweet',3],['macarons',3],['empaque',3]]],
 corporativo:[[['breakfast',5],['etiquetas',5]],[['breakfast',10],['etiquetas',10],['empaque',10]],[['minibox',10],['etiquetas',10],['empaque',10]]],
 amedida:[[['breakfast',1]],[['minibox',1],['empaque',1]],[['sweet',2],['empaque',2]]],
 experiencias:[[['minibox',2]],[['sweet',3],['etiquetas',3]],[['sweet',5],['macarons',5],['etiquetas',5],['empaque',5]]],
};
const descriptions:Record<string,string[]>={
 bodas:['Un detalle dulce para una celebración íntima.','Mini repostería y regalos para los invitados.','Una selección amplia para compartir en la celebración.'],
 cumpleanos:['Un box para una celebración cercana.','Mini repostería y detalles de regalo para el cumpleaños.','Combos y macarons para una celebración con más piezas.'],
 quinceaneras:['Una selección inicial para la mesa de celebración.','Cajas y detalles acordes con la temática de quince años.','Una selección de mayor alcance para la mesa dulce.'],
 'baby-shower':['Un box delicado para compartir.','Mini repostería y obsequios para los invitados.','Combos y detalles de regalo para el Baby Shower VIP.'],
 empresas:['Cinco desayunos con identificación de la empresa.','Diez desayunos con etiquetas y empaques de regalo.','Diez cajas de mini repostería con presentación corporativa.'],
 rrpp:['Cinco atenciones personalizadas para prensa.','Diez desayunos para una acción de relaciones públicas.','Diez boxes para una entrega de prensa con empaque de lujo.'],
 bancos:['Cinco detalles de cortesía institucional.','Diez desayunos personalizados para clientes.','Diez boxes con identidad y presentación institucional.'],
 fitness:['Porción individual; composición por revisar.','Mini repostería con ingredientes y porciones por definir.','Combos para compartir con especificaciones a medida.'],
 alergias:['Solicitud individual sujeta a revisión de ingredientes.','Box a medida sujeto a evaluación del negocio.','Selección para compartir; viabilidad por confirmar.'],
 cocteles:['Dos boxes para una recepción breve.','Tres combos para una experiencia de degustación.','Cinco combos con macarons y presentación personalizada.'],
 lanzamientos:['Dos boxes para presentar una nueva colección.','Tres combos identificados con la marca.','Cinco combos con macarons, logotipo y empaques de lujo.'],
 custom:['Una atención individual como punto de partida.','Un box con presentación de regalo.','Dos combos con presentación a medida.'],
};
export function packagesFor(project:ProjectType):ServicePackage[]{const info=projectInfo(project);return (['essential','signature','premium'] as const).map((id,i)=>({id,name:['Esencial','Signature','Alta Vitrina'][i],description:descriptions[project][i],items:recipes[info.group][i].map(([key,n])=>line(key,n)),notes:`Propuesta para ${info.label.toLowerCase()}. Contenido, sabores, diseño y disponibilidad sujetos a confirmación. ${info.group==='corporativo'||info.group==='experiencias'?'El cliente aprueba el logotipo y las etiquetas antes de producir.':'La temática y la presentación se acuerdan antes de producir.'} Los cambios de alcance se cotizan por separado.`}));}
export function packageEstimate(p:ServicePackage,q:Quote){return totals({...q,items:p.items});}
export function recommendPackage(q:Quote){const options=packagesFor(q.projectType);const preferred=['bodas','rrpp','cocteles','lanzamientos'].includes(q.projectType)?2:['fitness','alergias','custom'].includes(q.projectType)?0:1;const fits=q.clientBudgetCents===null?options[preferred]:options.slice(0,preferred+1).filter(p=>packageEstimate(p,q).total<=q.clientBudgetCents!).at(-1);return{id:fits?.id??'essential',withinBudget:q.clientBudgetCents===null||!!fits};}
export function packagePatch(q:Quote,id:PackageId,idFactory:()=>string):Partial<Quote>{const p=packagesFor(q.projectType).find(p=>p.id===id)!;return{packageId:id,packageName:`${p.name} · ${projectInfo(q.projectType).label}`,items:p.items.map(item=>({...item,id:idFactory()})),notes:p.notes,allergenReviewed:false};}

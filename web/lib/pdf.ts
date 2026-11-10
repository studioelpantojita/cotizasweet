import {clientDocumentType} from './identity';
import {jsPDF} from 'jspdf';
import {ingredientDetails} from './ingredients';
import {referenceBusiness} from './reference-business';
import {catalog,addons,money,quoteSchema,totals,projectInfo,materialConditions,locationLabel,locationDetail,paymentConditions,type Quote,type QuoteItem} from './quote';

export type PdfFonts={regular:string;bold:string};
const fontCache=new Map<string,Promise<string>>();
async function loadFont(path:string){
 let pending=fontCache.get(path);
 if(!pending){pending=fetch(path).then(async response=>{if(!response.ok)throw new Error('No se pudo cargar la tipografía del PDF. Vuelve a intentar la descarga.');const bytes=new Uint8Array(await response.arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(binary);}).catch(error=>{fontCache.delete(path);throw error;});fontCache.set(path,pending);}
 return pending;
}
const dateLabel=(value:string)=>value?value.split('-').reverse().join('/'):'Por coordinar';
function serviceCode(item:QuoteItem,index:number){const pack=catalog.findIndex(p=>p.name===item.name),addon=addons.findIndex(p=>p.name===item.name);return pack>=0?`PAS-${String(pack+1).padStart(3,'0')}`:addon>=0?`ADI-${String(addon+1).padStart(3,'0')}`:`PER-${String(index+1).padStart(3,'0')}`;}

export function createQuotePdf(input:Quote,id:string|undefined,fonts:PdfFonts){
 const q=quoteSchema.parse(input),t=totals(q),info=projectInfo(q.projectType);
 const doc=new jsPDF({unit:'mm',format:'a4',compress:true});
 for(const [style,data] of [['normal',fonts.regular],['bold',fonts.bold]] as const){doc.addFileToVFS(`quote-${style}.ttf`,data);doc.addFont(`quote-${style}.ttf`,'QuoteFont',style);}
 const c={ink:'#501b2f',body:'#493a40',muted:'#77686e',pale:'#f4edef',stripe:'#faf7f8',line:'#e2d5da',white:'#ffffff'};
 const left=16,right=194,width=178,bottom=275;
 const reference=id?`COT-${id.slice(0,8).toUpperCase()}`:'VISTA PREVIA';let y=39,section='COTIZACIÓN';
 const clean=(value:string)=>value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'').replace(/[\u2011\u2013\u2014]/g,'-');
 const single=(value:string)=>value.replace(/\s+/g,' ').trim();
 function style(size=9,bold=false,color=c.body){doc.setFont('QuoteFont',bold?'bold':'normal');doc.setFontSize(size);doc.setTextColor(color);}
 function wrap(value:string,w:number,size=9,bold=false):string[]{style(size,bold);return doc.splitTextToSize(clean(value),w) as string[];}
 function write(value:string,x:number,at:number,size=9,bold=false,color=c.body,align:'left'|'right'='left'){style(size,bold,color);doc.text(clean(value),x,at,{align});}
 function fit(value:string,x:number,at:number,w:number,size=9,bold=false,color=c.body){style(size,bold);write(value,x,at,Math.min(size,size*w/Math.max(.1,doc.getTextWidth(clean(value)))),bold,color,'right');}
 function rule(at:number){doc.setDrawColor(c.line);doc.setLineWidth(.25);doc.line(left,at,right,at);}
 function page(){doc.addPage();doc.setFillColor(c.ink);doc.rect(0,0,210,1.5,'F');write(reference,left,15,9,true,c.ink);write(section+' · CONTINUACIÓN',right,15,7.2,false,c.muted,'right');rule(21);y=30;}
 function need(h:number){if(y+h>bottom)page();}
 function heading(text:string,reserve=22){const lines=wrap(text.toUpperCase(),width,8.5,true);need(Math.min(reserve+lines.length*4.5,bottom-30));for(const line of lines){need(6);write(line,left,y,8.5,true,c.ink);y+=4.5;}y+=2.5;}
 function flow(text:string,size=8.6,leading=4.2,color=c.body){for(const line of wrap(text,width,size)){need(leading+1);write(line,left,y,size,false,color);y+=leading;}}
 function shadedText(text:string,size=10,bold=true){
  const lines=wrap(text,width-10,size,bold);let offset=0;
  while(offset<lines.length){need(16);const count=Math.min(lines.length-offset,Math.max(1,Math.floor((bottom-y-10)/4.6)));const height=count*4.6+8;
   doc.setFillColor(c.pale);doc.roundedRect(left,y,width,height,1.5,1.5,'F');doc.setFillColor(c.ink);doc.rect(left,y,1,height,'F');
   for(let i=0;i<count;i++)write(lines[offset+i],left+5,y+6+i*4.6,size,bold,c.body);
   offset+=count;y+=height+4;if(offset<lines.length)page();
  }
 }
 doc.setFillColor(c.ink);doc.rect(0,0,210,1.5,'F');write(referenceBusiness.label,left,10,6.8,true,c.muted);
 doc.setFillColor(c.pale);doc.roundedRect(left,14,19,19,3,3,'F');doc.setDrawColor(c.ink);doc.circle(left+9.5,23.5,7.1,'S');
 doc.setFont('times','italic');doc.setFontSize(20);doc.setTextColor(c.ink);doc.text(referenceBusiness.monogram,left+9.5,25.7,{align:'center'});
 write(referenceBusiness.name,39,16,11.5,true,c.ink);write(referenceBusiness.address,39,21,7.6);write(`Tel.: ${referenceBusiness.phone}`,39,24.9,7.6);
 write(referenceBusiness.email,39,28.8,7.6);write(referenceBusiness.website,39,32.7,7.6,false,c.muted);write('COTIZACIÓN',right,23,25,false,c.ink,'right');write(reference,right,31,9.3,true,c.ink,'right');
 const packageName=q.packageId==='custom'?(q.packageName||'A medida'):{essential:'Esencial',signature:'Signature',premium:'Alta Vitrina'}[q.packageId];
 const meta=[['FECHA DE EMISIÓN',dateLabel(q.issued)],['VÁLIDA HASTA',dateLabel(q.validUntil)],['PAQUETE',single(packageName)],['MONEDA',q.currency==='USD'?'USD · Dólares':'PEN · Soles']];
 const values=meta.map(([,value])=>wrap(value,width/4-8,9.3,true)),height=10+Math.max(...values.map(v=>v.length))*4.3;
 doc.setFillColor(c.pale);doc.roundedRect(left,y,width,height,1.5,1.5,'F');
 meta.forEach(([label],i)=>{const x=left+i*width/4;write(label,x+4,y+5,7,true,c.muted);values[i].forEach((v,j)=>write(v,x+4,y+11+j*4.3,9.3,true,c.ink));});y+=height+10;
 type Line={text:string;bold?:boolean;size?:number};
 function column(label:string,fields:string[]):Line[]{return [{text:label,bold:true,size:7.5},...fields.flatMap(v=>wrap(single(v),83,8.7).map(text=>({text,size:8.7})))];}
 const clientFields=[q.client,`${clientDocumentType(q).toUpperCase()}: ${q.clientDocument||'No registrado'}`,`Contacto del negocio: ${q.contact||'No registrado'}`];
 if(q.clientEmail)clientFields.push(`Correo: ${q.clientEmail}`);if(q.clientContact)clientFields.push(q.clientContact);
 const a=column('NOMBRE / RAZÓN SOCIAL',clientFields),b=column('MODALIDAD DEL SERVICIO',[locationLabel(q),locationDetail(q)||(q.locationMode==='pickup'&&q.address?'':'Ubicación por coordinar'),`${q.locationMode==='pickup'?'Dirección de recojo':'Dirección del servicio'}: ${q.address||'Por coordinar'}`].filter(Boolean));
 for(let i=0;i<Math.max(a.length,b.length);i++){need(6);for(const [line,x] of [[a[i],left],[b[i],110]] as const)if(line)write(line.text,x,y,line.size,line.bold,line.bold?c.ink:c.body);y+=4.7;}y+=4;
 if(q.clientLookup){flow(q.clientLookup.demo?'DATOS DE DEMOSTRACIÓN: el RUC y el nombre no fueron consultados en SUNAT.':`Identificación: ${q.clientLookup.source}${q.clientLookup.dataDate?' · Padrón al '+q.clientLookup.dataDate:''} · ${q.clientLookup.status} / ${q.clientLookup.condition}`,7.5,3.8,c.muted);y+=4;}
 heading('Nombre del proyecto');shadedText(q.event.trim()||info.label,11);
 flow(`Objetivo: ${info.label}${q.eventDate?' · Fecha del evento: '+dateLabel(q.eventDate):''}`,8,4,c.muted);y+=3;
 if(q.projectBrief.trim()){flow(q.projectBrief,8.6,4.2);y+=3;}y+=2;
 section='DETALLE DE SERVICIOS';
 function tableHeader(continued=false){need(24);write(continued?'DETALLE DE SERVICIOS · CONTINUACIÓN':'DETALLE DE SERVICIOS',left,y,8.3,true,c.ink);y+=4;doc.setFillColor(c.ink);doc.rect(left,y,width,9,'F');write('CÓDIGO',19,y+5.8,7.5,true,c.white);write('DETALLE DEL SERVICIO',42,y+5.8,7.5,true,c.white);write('CANT.',130,y+5.8,7.5,true,c.white,'right');write('P. UNITARIO',160,y+5.8,7.5,true,c.white,'right');write('IMPORTE',191,y+5.8,7.5,true,c.white,'right');y+=9;}
 const first=q.items[0];
 const firstHeight=Math.max(17,8+(wrap(first.name,75,9.1,true).length+(first.description?wrap(first.description,75,8.1).length:0)+wrap(`Unidad de venta: ${first.unit}`,75,7.7).length)*4.2);
 need(13+(firstHeight<=230?firstHeight:25));tableHeader();
 q.items.forEach((item,index)=>{
  const lines:Line[]=[...wrap(item.name,75,9.1,true).map(text=>({text,bold:true,size:9.1})),...(item.description?wrap(item.description,75,8.1):[]).map(text=>({text,size:8.1})),...wrap(`Unidad de venta: ${item.unit}`,75,7.7).map(text=>({text,size:7.7}))];
  const fullHeight=Math.max(17,8+lines.length*4.2);
  // Keep ordinary rows together; split over-height rows without dropping text.
  if(y+Math.min(fullHeight,25)>bottom || (fullHeight<=230&&y+fullHeight>bottom)){page();tableHeader(true);}
  let offset=0;
  while(offset<lines.length){
   let count=Math.floor((bottom-y-8)/4.2);
   if(count<1||y+17>bottom){page();tableHeader(true);count=Math.floor((bottom-y-8)/4.2);}
   count=Math.min(count,lines.length-offset);const rowHeight=Math.max(17,8+count*4.2),baseline=y+5;
   if(index%2===1){doc.setFillColor(c.stripe);doc.rect(left,y,width,rowHeight,'F');}
   write(serviceCode(item,index),19,baseline,7.5,true,c.muted);
   if(offset===0){fit(String(item.quantity),130,baseline,10);fit(money(item.priceCents,q.currency),160,baseline,25,8.8);fit(money(item.quantity*item.priceCents,q.currency),191,baseline,27,8.8,true,c.ink);}
   else write('CONT.',19,baseline+4,6.6,false,c.muted);
   for(let i=0;i<count;i++){const line=lines[offset+i];write(line.text,42,baseline+i*4.2,line.size,line.bold,line.bold?c.body:c.muted);}
   offset+=count;y+=rowHeight;rule(y);
   if(offset<lines.length){page();tableHeader(true);}
  }
 });
 section='RESUMEN Y CONDICIONES';y+=8;
 const payment=paymentConditions(q).flatMap(note=>wrap(note,82,8.3).concat(['']));
 const termsHeight=9+payment.length*4.1,summaryHeight=q.pricingVersion===2?69:57;need(Math.max(termsHeight,summaryHeight));const top=y;
 write('CONDICIONES DE PAGO',left,top,8.3,true,c.ink);payment.forEach((line,i)=>write(line,left,top+7+i*4.1,8.3));
 write('RESUMEN ECONÓMICO',110,top,8.3,true,c.ink);
 const amounts:[string,number][]=[['Subtotal de servicios',t.subtotal],[q.pricingVersion===2?`Movilidad (${t.mobilityRate}%)`:'Entrega / traslado',t.mobility]];
 if(q.pricingVersion===2)amounts.push(['Base imponible',t.base],['IGV (18%)',t.tax]);
 amounts.forEach(([label,value],i)=>{write(label,110,top+8+i*6,8.3);fit(money(value,q.currency),right,top+8+i*6,31,8.8);});
 const totalY=top+8+amounts.length*6;doc.setFillColor(c.ink);doc.roundedRect(106,totalY,88,16,2,2,'F');write('TOTAL',111,totalY+10,9,true,c.white);fit(money(t.total,q.currency),189,totalY+10,56,16,true,c.white);
 write(`Anticipo (${q.advancePercent}%)`,110,totalY+24,8.3);fit(money(t.advance,q.currency),right,totalY+24,31,8.8);
 write(t.balance===0?'Saldo pendiente':q.locationMode==='pickup'?'Saldo al recoger':'Saldo al entregar',110,totalY+31,8.3);fit(money(t.balance,q.currency),right,totalY+31,31,8.8,true,c.ink);
 // Reserve the heading and its first paragraph, without forcing a near-empty continuation page.
 y=top+Math.max(termsHeight,summaryHeight);heading('Condiciones y notas',10);
 flow(`Válida hasta ${dateLabel(q.validUntil)}. Moneda: ${q.currency==='USD'?'dólares estadounidenses (USD)':'soles (PEN)'}.${q.pricingVersion===2?' IGV sobre servicios más movilidad.':''}`);
 if(q.notes){y+=3;flow(q.notes);}y+=5;
 const details=ingredientDetails(q),terms=materialConditions(q);
 if(details.some(line=>line.trim())||terms.length){section='FICHA DE INSUMOS';page();write('Ficha de insumos',left,y,20,true,c.ink);y+=9;flow(`${single(q.client)} · ${single(q.event)||info.label}`,8.3);y+=6;
  const titles=new Set([...q.materials.map(m=>m.name.toUpperCase()),'NOTAS CONSERVADAS DEL PEDIDO','SOLICITUD REGISTRADA ANTERIORMENTE','REVISIÓN REGISTRADA ANTERIORMENTE']);
  for(const line of details){if(!line.trim())continue;if(titles.has(line)){y+=3;heading(single(line));}else{flow(line,8.7,4.3);y+=3;}}
  if(terms.length){y+=4;heading('Condiciones de insumos');terms.forEach((term,i)=>{flow(`${i+1}. ${term}`);y+=3;});}
 }
 const pages=doc.getNumberOfPages();for(let n=1;n<=pages;n++){doc.setPage(n);rule(283);write('E&A COTIZA · PASTELERÍA',left,289,7.1,true,c.muted);write('Propuesta comercial. No es un comprobante de pago.',80,289,6.8,false,c.muted);write(`${n} / ${pages}`,right,289,7.4,false,c.muted,'right');}
 doc.setProperties({title:`${reference} · ${single(q.event)||info.label}`,subject:`Cotización de pastelería · ${single(q.client)}`,author:'E&A Cotiza · Identidad referencial',creator:'E&A Cotiza · Plantilla 4'});return doc;
}
export async function quotePdfBlob(q:Quote,id?:string){const [regular,bold]=await Promise.all([loadFont('/fonts/quote-regular.ttf'),loadFont('/fonts/quote-bold.ttf')]);return createQuotePdf(q,id,{regular,bold}).output('blob');}
export async function downloadPdf(q:Quote,id?:string,share=false){
 const normalized=quoteSchema.parse(q);const [regular,bold]=await Promise.all([loadFont('/fonts/quote-regular.ttf'),loadFont('/fonts/quote-bold.ttf')]);const doc=createQuotePdf(normalized,id,{regular,bold});
 const filename=`Cotizacion-${q.client.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]+/g,'-').slice(0,60)}-${id?.slice(0,8)||q.issued}.pdf`;
 if(share&&navigator.share){const file=new File([doc.output('blob')],filename,{type:'application/pdf'});if(navigator.canShare?.({files:[file]})){try{await navigator.share({title:'Cotización de pastelería',files:[file]});return;}catch(e){if((e as Error).name==='AbortError')return;}}}doc.save(filename);
}

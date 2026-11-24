'use client';
import {useRef,useState} from 'react';
import {ArrowUpRight,Check,Package} from 'lucide-react';
import {ProjectSelect} from './commerce';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from './ui/dialog';
import {packagesFor,packageEstimate,recommendPackage,type PackageId} from '@/lib/packages';
import {collections,money,totals,projectInfo,type Quote,type QuoteItem} from '@/lib/quote';
import {projectBriefPatch} from '@/lib/project-details';
import {showcase} from '@/lib/sweet-showcase';
import {repriceItems} from '@/lib/product-pricing';
import {FieldError,useFieldValidation} from './quote-validation';

function packagePhoto(item:QuoteItem){
 if(item.image!=='none')return '/images/'+item.image+'.jpg';
 if(item.id==='macarons')return '/images/'+showcase.find(p=>p.category==='macarons')!.image;
 return null;
}

export function PackageChooser({q,onChange,onSelect,showBrief=true,showPackages=true}:{q:Quote;onChange:(patch:Partial<Quote>)=>void;onSelect:(id:PackageId)=>void;showBrief?:boolean;showPackages?:boolean}){
 const fieldState=useFieldValidation();
 const [reviewId,setReviewId]=useState<PackageId|null>(null);
 const trigger=useRef<HTMLButtonElement|null>(null);
 const options=packagesFor(q.projectType).map(p=>({...p,items:repriceItems(p.items,q.currency)})),recommendation=recommendPackage(q),t=totals(q),budget=q.clientBudgetCents;
 const collection=collections.find(c=>c.id===projectInfo(q.projectType).group)!;
 const review=options.find(p=>p.id===reviewId),estimate=review?packageEstimate(review,q):null;
 const headingId=showPackages?'package-heading':'project-heading';
 if(!showBrief&&!showPackages)return null;
 return <section className="package-chooser" aria-labelledby={headingId}>
  <div className="package-heading"><div><p className="eyebrow">EL PUNTO DE PARTIDA DE TU PROPUESTA</p><h2 id={headingId}>{showPackages?'Elige el paquete para tu evento.':'Define tu proyecto.'}</h2><p>{showPackages?'Selección opcional. Revisa el contenido y elige un paquete solo si se ajusta a tu evento.':'Cuéntanos qué necesitas y para quién estás preparando esta propuesta.'}</p></div>{showPackages&&<span className="beta-label">TARIFAS REFERENCIALES</span>}</div>
  {showBrief&&<div className="package-brief">
   <div className="field"><label className="field-label" htmlFor="client-objective">Objetivo del Proyecto</label><ProjectSelect id="client-objective" value={q.projectType} onChange={projectType=>{setReviewId(null);onChange({projectType,packageId:'custom',packageName:'',allergenReviewed:false});}}/><small>{projectInfo(q.projectType).focus}</small></div>
   <label className="field"><span>Presupuesto máximo ({q.currency})</span><input type="number" min={0} max={1000000} step="0.01" value={budget===null?'':budget/100} onChange={e=>onChange({clientBudgetCents:e.target.value===''?null:Math.round(Number(e.target.value)*100)})} placeholder="Opcional · importe total disponible"/><small>Compara el total con movilidad e IGV. No aplica descuentos.</small></label>
   <label className="field full-field" data-field="event"><span>Detalle del Proyecto *</span><textarea id="project-detail" name="projectBrief" data-field="projectBrief" rows={4} aria-required="true" {...fieldState('event')} {...fieldState('projectBrief')} maxLength={600} value={q.projectBrief} onChange={e=>onChange(projectBriefPatch(e.target.value))} placeholder="Ej. Cumpleaños para 30 invitados, temática floral y presentación en cajas de regalo."/><small className="character-counter">{q.projectBrief.length}/600 caracteres.</small><small>Este detalle aparecerá completo en tu propuesta PDF.</small><FieldError path="event"/><FieldError path="projectBrief"/></label>
  </div>}
  {showPackages&&<>
   <div className="package-context"><span>PAQUETES PARA TU OBJETIVO</span><h3>{collection.title}</h3><p>{projectInfo(q.projectType).label} · {collection.description}</p></div>
   <div className="package-grid" role="group" aria-label="Paquetes opcionales para tu evento">{options.map(p=>{
    const price=packageEstimate(p,q),selected=q.packageId===p.id,suggested=recommendation.id===p.id;
    return <article className={'package-card '+(selected?'is-selected':'')} key={p.id}>
     <div className="package-card-top"><h3>{p.name}</h3>{selected&&<Check size={19} aria-label="Seleccionado"/>}</div><p className="package-description">{p.description}</p><div className="package-price">{money(price.subtotal,q.currency)}<small>Base de servicios · sin IGV</small></div>
     <ul>{p.items.map(item=><li key={item.id}><Check size={15}/><span><b>{item.quantity}</b> × {item.name}<small>{item.unit}</small></span></li>)}</ul>
     <div className="package-estimate">Total estimado <strong>{money(price.total,q.currency)}</strong><small>Movilidad {price.mobilityRate}% · {q.pricingVersion===2?'IGV 18%':'precios de la versión anterior'}</small></div>
     <button type="button" className={'package-state package-review '+(suggested?'suggested':'')} onClick={e=>{trigger.current=e.currentTarget;setReviewId(p.id);}} aria-label={`${suggested?'Sugerido para revisar':'Revisar contenido'}: ${p.name}`}>{selected?'Revisar paquete seleccionado':suggested?'Sugerido para revisar':'Revisar contenido'}<ArrowUpRight size={15}/></button>
    </article>;
   })}</div>
   <p className="package-guidance" role="status"><Package size={17}/>{!recommendation.withinBudget?'El presupuesto no alcanza el paquete Esencial con los cargos actuales. Puedes preparar una selección a medida.':`Sugerencia para ${projectInfo(q.projectType).label}: ${options.find(p=>p.id===recommendation.id)?.name}. Revisa el alcance antes de seleccionar.`}</p>
   {q.packageId==='custom'?<p className="package-optional-note">No has seleccionado un paquete. Puedes continuar y añadir tus servicios en el siguiente paso.</p>:<button type="button" className="package-clear" onClick={()=>onChange({packageId:'custom',packageName:''})}>Continuar con una selección a medida · conservar servicios actuales</button>}
  </>}
  {budget!==null&&q.items.length>0&&<p className={'budget-comparison '+(t.total>budget?'over':'')} role="status">{t.total>budget?`La propuesta actual supera el presupuesto en ${money(t.total-budget,q.currency)}: total ${money(t.total,q.currency)} − presupuesto ${money(budget,q.currency)}.`:`La propuesta actual está dentro del presupuesto. Disponible: ${money(budget-t.total,q.currency)}.`}</p>}
  {showPackages&&<p className="field-help">Precios y cantidades de prueba en {q.currency}, pendientes de confirmar por el negocio. Seleccionar un paquete reemplaza los servicios y las condiciones comerciales actuales. Cambiar el objetivo actualiza las sugerencias y conserva los servicios ya añadidos.</p>}
  <Dialog open={!!review} onOpenChange={open=>{if(!open)setReviewId(null);}}><DialogContent className="package-detail-dialog" onCloseAutoFocus={e=>{e.preventDefault();trigger.current?.focus({preventScroll:true});}}>
   <DialogHeader><DialogTitle>{review?`${review.name} · ${collection.title}`:'Contenido del paquete'}</DialogTitle><DialogDescription>Productos e insumos de referencia para {projectInfo(q.projectType).label.toLowerCase()}. Revisa el detalle antes de elegir.</DialogDescription></DialogHeader>
   {review&&estimate&&<>
    <div className="package-detail-list">{review.items.map(item=>{const photo=packagePhoto(item);return <article key={item.id}>{photo?<img src={photo} alt={'Presentación referencial de '+item.name}/>:<span className="package-detail-icon"><Package size={26}/></span>}<div><h4>{item.name}</h4><p>{item.description}</p><small>{item.quantity} × {item.unit} · {money(item.priceCents,q.currency)} por {item.unit}</small></div><strong>{money(item.quantity*item.priceCents,q.currency)}</strong></article>;})}</div>
    <div className="package-detail-conditions"><h4>Insumos y personalización</h4><p>{review.notes}</p><p>Las piezas, los insumos incluidos en cada descripción y sus cantidades corresponden a esta selección. Las especificaciones adicionales se pueden detallar en la ficha de insumos del siguiente paso.</p></div>
    <div className="package-detail-total"><span>Total estimado <small>Servicios {money(estimate.subtotal,q.currency)} · movilidad {money(estimate.mobility,q.currency)} · IGV {money(estimate.tax,q.currency)}</small></span><strong>{money(estimate.total,q.currency)}</strong></div>
    <div className="package-detail-actions"><button type="button" className="btn secondary" onClick={()=>setReviewId(null)}>Seguir revisando</button><button type="button" className="btn" onClick={()=>{onSelect(review.id);setReviewId(null);}}><Check size={17}/>Elegir este paquete</button></div><p className="package-optional-note">La selección es opcional. Al elegirlo, sus servicios y condiciones reemplazan los actuales de tu propuesta.</p>
   </>}
  </DialogContent></Dialog>
 </section>;
}

'use client';
import {Trash2} from 'lucide-react';
import {CategorySelect} from './commerce';
import {FieldError,useFieldValidation,QuoteNumberInput} from './quote-validation';
import {quoteItemPhoto} from '@/lib/custom-service';
import {money,type Quote,type QuoteItem} from '@/lib/quote';
import {acceptedFlavors,serviceDescription} from '@/lib/product-pricing';

export function QuoteServiceEditor({item,index,currency,onChange,onRemove}:{item:QuoteItem;index:number;currency:Quote['currency'];onChange:(patch:Partial<QuoteItem>)=>void;onRemove:()=>void}){
 const state=useFieldValidation(),path=(key:string)=>`items.${index}.${key}`,photo=quoteItemPhoto(item),referenced=!!(item.portfolioId||item.catalogId);
 function detailChange(patch:Partial<QuoteItem>){const next={...item,...patch};onChange({...patch,description:serviceDescription(next.flavors??[],next.presentation??'',next.scope??'')});}
 return <article className="service-card" aria-label={`Servicio ${index+1}: ${item.name}`}>
  <div className="service-card-top"><span>SELECCIÓN {String(index+1).padStart(2,'0')}</span><button type="button" className="icon-button" aria-label={`Quitar ${item.name}`} onClick={onRemove}><Trash2 size={17}/></button></div>
  <div className="service-card-identity">{photo&&<img src={photo} alt={item.name}/>}<div>{referenced?<span className="service-kind">Servicio a medida · cartera</span>:<CategorySelect value={item.category} onChange={category=>onChange({category})}/>}<label className="field"><span>Nombre del servicio</span><input data-field={path('name')} {...state(path('name'))} value={item.name} readOnly={referenced} maxLength={120} onChange={e=>onChange({name:e.target.value})}/><FieldError path={path('name')}/></label></div></div>
  {item.portfolioId&&item.flavors?<>
   <fieldset className="portfolio-flavors" data-field={path('flavors')}><legend>Contenido · hasta 4 sabores</legend><div className="flavor-options">{acceptedFlavors.map(flavor=><label key={flavor}><input type="checkbox" checked={item.flavors!.includes(flavor)} disabled={!item.flavors!.includes(flavor)&&item.flavors!.length>=4} onChange={e=>detailChange({flavors:e.target.checked?[...item.flavors!,flavor]:item.flavors!.filter(f=>f!==flavor)})}/><span>{flavor}</span></label>)}</div><FieldError path={path('flavors')}/></fieldset>
   <label className="field"><span>Presentación *</span><textarea data-field={path('presentation')} {...state(path('presentation'))} required rows={2} maxLength={80} value={item.presentation??''} onChange={e=>detailChange({presentation:e.target.value})}/><small>{(item.presentation??'').length}/80 caracteres</small><FieldError path={path('presentation')}/></label>
   <label className="field"><span>Alcance (opcional)</span><textarea data-field={path('scope')} rows={2} maxLength={80} value={item.scope==='Unknown.'?'':item.scope??''} onChange={e=>detailChange({scope:e.target.value.trim()?e.target.value:'Unknown.'})}/><small>Sin completar se mostrará Unknown.</small><FieldError path={path('scope')}/></label>
  </>:<label className="field"><span>Contenido, presentación y alcance</span><textarea data-field={path('description')} {...state(path('description'))} rows={4} maxLength={300} readOnly={referenced} value={item.description} onChange={e=>onChange({description:e.target.value})}/><small>{item.description.length}/300 caracteres</small><FieldError path={path('description')}/></label>}
  <label className="field"><span>Unidad de venta</span><input data-field={path('unit')} {...state(path('unit'))} value={item.unit} readOnly maxLength={60} onChange={e=>onChange({unit:e.target.value})} placeholder="Ej. torta de 12 porciones, caja de 24 piezas"/><FieldError path={path('unit')}/></label>
  <div className="service-card-numbers">
   <label className="field"><span>Cantidad</span><QuoteNumberInput aria-label={`Cantidad del servicio ${index+1}`} data-field={path('quantity')} {...state(path('quantity'))} min={1} max={999} step={1} value={item.quantity} onValue={quantity=>onChange({quantity})}/><small>De 1 a 999 unidades.</small><FieldError path={path('quantity')}/></label>
   <label className="field"><span>Precio unitario ({currency})</span><input aria-label={`Precio unitario del servicio ${index+1}`} data-field={path('priceCents')} {...state(path('priceCents'))} readOnly value={money(item.priceCents,currency)}/><small>{referenced?'Tarifa referencial para pruebas · sin IGV.':'Precio pendiente de evaluación; no constituye un servicio gratuito.'}</small><FieldError path={path('priceCents')}/></label>
  </div>
  <div className="service-card-total"><span>Importe del servicio <small>Sin IGV</small></span><strong>{money(item.quantity*item.priceCents,currency)}</strong></div>
 </article>;
}

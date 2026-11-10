'use client';
import {Trash2} from 'lucide-react';
import {CategorySelect} from './commerce';
import {FieldError,useFieldValidation,QuoteNumberInput} from './quote-validation';
import {quoteItemPhoto} from '@/lib/custom-service';
import {money,type Quote,type QuoteItem} from '@/lib/quote';

export function QuoteServiceEditor({item,index,currency,onChange,onRemove}:{item:QuoteItem;index:number;currency:Quote['currency'];onChange:(patch:Partial<QuoteItem>)=>void;onRemove:()=>void}){
 const state=useFieldValidation(),path=(key:string)=>`items.${index}.${key}`,photo=quoteItemPhoto(item);
 return <article className="service-card" aria-label={`Servicio ${index+1}: ${item.name}`}>
  <div className="service-card-top"><span>SELECCIÓN {String(index+1).padStart(2,'0')}</span><button type="button" className="icon-button" aria-label={`Quitar ${item.name}`} onClick={onRemove}><Trash2 size={17}/></button></div>
  <div className="service-card-identity">{photo&&<img src={photo} alt={item.name}/>}<div>{item.portfolioId?<span className="service-kind">Servicio a medida · cartera</span>:<CategorySelect value={item.category} onChange={category=>onChange({category})}/>}<label className="field"><span>Nombre del servicio</span><input data-field={path('name')} {...state(path('name'))} value={item.name} maxLength={120} onChange={e=>onChange({name:e.target.value})}/><FieldError path={path('name')}/></label></div></div>
  <label className="field"><span>Contenido, presentación y alcance</span><textarea data-field={path('description')} {...state(path('description'))} rows={4} maxLength={300} value={item.description} onChange={e=>onChange({description:e.target.value})}/><small>{item.description.length}/300 caracteres</small><FieldError path={path('description')}/></label>
  <label className="field"><span>Unidad de venta</span><input data-field={path('unit')} {...state(path('unit'))} value={item.unit} maxLength={60} onChange={e=>onChange({unit:e.target.value})} placeholder="Ej. torta de 12 porciones, caja de 24 piezas"/><FieldError path={path('unit')}/></label>
  <div className="service-card-numbers">
   <label className="field"><span>Cantidad</span><QuoteNumberInput aria-label={`Cantidad del servicio ${index+1}`} data-field={path('quantity')} {...state(path('quantity'))} min={1} max={999} step={1} value={item.quantity} onValue={quantity=>onChange({quantity})}/><small>De 1 a 999 unidades.</small><FieldError path={path('quantity')}/></label>
   <label className="field"><span>Precio unitario ({currency})</span><QuoteNumberInput aria-label={`Precio unitario del servicio ${index+1}`} data-field={path('priceCents')} {...state(path('priceCents'))} min={0} max={1000000} step="0.01" scale={100} value={item.priceCents} onValue={priceCents=>onChange({priceCents})}/><small>Sin IGV · hasta dos decimales.</small><FieldError path={path('priceCents')}/></label>
  </div>
  <div className="service-card-total"><span>Importe del servicio <small>Sin IGV</small></span><strong>{money(item.quantity*item.priceCents,currency)}</strong></div>
 </article>;
}

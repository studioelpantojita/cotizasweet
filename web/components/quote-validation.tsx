'use client';
import {createContext,useContext,useEffect,useRef,useState,type InputHTMLAttributes,type ReactNode} from 'react';
import type {ZodIssue} from 'zod';

const ValidationContext=createContext<ZodIssue[]>([]);
export function ValidationProvider({issues,children}:{issues:ZodIssue[];children:ReactNode}){return <ValidationContext.Provider value={issues}>{children}</ValidationContext.Provider>;}
const pathOf=(issue:ZodIssue)=>issue.path.join('.');
const errorId=(path:string)=>'error-'+path.replaceAll('.','-');
export function useFieldValidation(){const issues=useContext(ValidationContext);return (path:string)=>issues.some(i=>pathOf(i)===path)?{'aria-invalid':true as const,'aria-describedby':errorId(path)}:{};}
export function FieldError({path}:{path:string}){const issue=useContext(ValidationContext).find(i=>pathOf(i)===path);return issue?<small className="field-error" id={errorId(path)}>{issue.message}</small>:null;}
const labels:Record<string,string>={client:'Nombre del cliente',clientDocument:'Documento del cliente',contact:'Contacto del negocio',event:'Nombre del proyecto',clientEmail:'Correo del cliente',eventDate:'Fecha del evento',issued:'Fecha de emisión',validUntil:'Vigencia',advancePercent:'Anticipo',items:'Servicios',name:'Nombre',description:'Descripción',quantity:'Cantidad',priceCents:'Precio unitario',unit:'Unidad de venta',provinceId:'Provincia',districtId:'Distrito',address:'Dirección',materials:'Insumos',notes:'Condiciones comerciales',formVersion:'Versión de la cotización'};
function issueLabel(issue:ZodIssue){const [field,index,child]=issue.path;return field==='items'&&typeof index==='number'?`Servicio ${index+1} · ${labels[String(child)]||'Detalle'}`:labels[String(field)]||'Cotización';}
export function focusQuoteField(path:string){
 const container=Array.from(document.querySelectorAll<HTMLElement>('[data-field]')).find(e=>e.dataset.field===path);
 // Optional sections may be collapsed; reveal an invalid field before focusing it.
 let ancestor:HTMLElement|null=container??null;
 while(ancestor){if(ancestor instanceof HTMLDetailsElement)ancestor.open=true;ancestor=ancestor.parentElement;}
 let target=container?.matches('input,textarea,button,[tabindex]')?container:container?.querySelector<HTMLElement>('input:not([readonly]),textarea:not([readonly]),button,[tabindex]');
 if(!target&&path==='client')target=document.getElementById('client-document');
 target??=document.getElementById('validation-summary');
 target?.focus({preventScroll:true});target?.scrollIntoView({behavior:'smooth',block:'center'});
}
export function ValidationSummary(){const issues=useContext(ValidationContext);if(!issues.length)return null;return <div className="validation-summary" id="validation-summary" tabIndex={-1} role="alert"><strong>Revisa estos datos antes de continuar</strong><ul>{issues.map((issue,i)=><li key={i}><button type="button" onClick={()=>focusQuoteField(pathOf(issue))}>{issueLabel(issue)}: {issue.message}</button></li>)}</ul></div>;}

/** Keeps unfinished/invalid numeric input visible instead of silently replacing it with zero. */
export function QuoteNumberInput({value,onValue,scale=1,...props}:Omit<InputHTMLAttributes<HTMLInputElement>,'value'|'onChange'|'type'> & {value:number;onValue:(value:number)=>void;scale?:1|100}){
 const [text,setText]=useState(Number.isFinite(value)?String(value/scale):'');const reported=useRef(value);
 useEffect(()=>{if(!Object.is(value,reported.current)){reported.current=value;setText(Number.isFinite(value)?String(value/scale):'');}},[value,scale]);
 return <input {...props} type="number" value={text} onChange={e=>{const raw=e.target.value;setText(raw);const valid=scale===100?/^-?\d+(?:\.\d{1,2})?$/.test(raw):/^-?\d+$/.test(raw);const next=valid?Math.round(Number(raw)*scale):Number.NaN;reported.current=next;onValue(next);}}/>;
}

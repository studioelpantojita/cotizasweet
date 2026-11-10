'use client';
import {useEffect,useRef,useState} from 'react';
import {FieldError,useFieldValidation} from './quote-validation';
import {clientDocumentType,isValidRuc} from '@/lib/identity';
import {rucIdentitySchema} from '@/lib/quote';
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from '@/components/ui/select';
import type {Quote} from '@/lib/quote';
export function ClientFields({q,onChange}:{q:Quote;onChange:(patch:Partial<Quote>)=>void}){
 const fieldState=useFieldValidation();
 const company=q.clientType==='empresa',required=q.formVersion===2,kind=clientDocumentType(q),ruc=kind==='ruc',hasName=!!q.client.trim();
 const [status,setStatus]=useState(''),[busy,setBusy]=useState(false),[retry,setRetry]=useState(0);
 const lastRetry=useRef(0);
 const change=useRef(onChange);change.current=onChange;
 const currentName=useRef(q.client);currentName.current=q.client;
 const current=useRef('');current.current=kind+':'+q.clientDocument;
 function documentChange(value:string){current.current=kind+':'+value;onChange({clientDocument:value,...(ruc?{client:'',clientLookup:undefined}:{})});}
 useEffect(()=>{
  const controller=new AbortController(),requested=kind+':'+q.clientDocument;
  const forceLookup=retry!==lastRetry.current;lastRetry.current=retry;
  setBusy(false);setStatus('');if(!ruc)return;
  // Opening a historical record or draft must not destroy its saved identity.
  // Document edits already clear the name; save/PDF still verify it on the server.
  if(!forceLookup&&q.client.trim()){
   setStatus(`${q.clientLookup?.demo?'Datos de demostración guardados: no consultados en SUNAT.':'Nombre conservado del presupuesto.'} Se volverá a verificar al guardar o generar un PDF nuevo.`);
   return;
  }
  change.current({client:'',clientLookup:undefined});
  if(!isValidRuc(q.clientDocument)){if(q.clientDocument.length===11)setStatus('El dígito verificador del RUC no es válido.');return;}
  const timer=setTimeout(async()=>{
   setBusy(true);setStatus('Consultando RUC…');
   try{
    const response=await fetch('/api/clients/ruc/'+q.clientDocument,{signal:controller.signal,cache:'no-store'});
    const data=await response.json();if(!response.ok)throw new Error(data.error||'No se pudo consultar el RUC.');
    const identity=rucIdentitySchema.parse(data);
    if(controller.signal.aborted||current.current!==requested||identity.ruc!==q.clientDocument||currentName.current.trim())return;
    change.current({client:identity.legalName,clientLookup:identity});
    setStatus(identity.demo?'Datos de demostración: no consultados en SUNAT.':`${identity.status} · ${identity.condition}${identity.dataDate?' · Padrón: '+identity.dataDate:''}`);
   }catch(error){if(!controller.signal.aborted&&current.current===requested)setStatus(error instanceof Error?error.message:'No se pudo consultar el RUC.');}
   finally{if(!controller.signal.aborted&&current.current===requested)setBusy(false);}
  },350);
  return()=>{clearTimeout(timer);controller.abort();};
 },[kind,ruc,q.clientDocument,retry,hasName]);
 const typeValue=company?'empresa':ruc?'persona_ruc':'persona_natural';
 const phone=q.contact.replace(/^\+51\s*/, '').replace(/\s/g,'');
 function changeType(value:string){current.current='';onChange({clientType:value==='empresa'?'empresa':'persona_natural',documentType:value==='persona_natural'?'dni':'ruc',clientDocument:'',client:'',clientLookup:undefined});}
 return <section className="form-section client-section" aria-labelledby="client-heading">
 <div className="form-title"><span>01</span><h3 id="client-heading">Tu negocio y tu cliente</h3></div>
 <div className="fields client-grid">
  <div className="field"><label className="field-label" htmlFor="client-type">Tipo de Cliente *</label><Select value={typeValue} onValueChange={changeType}><SelectTrigger id="client-type" className="commerce-select"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="persona_natural">Persona Natural</SelectItem><SelectItem value="persona_ruc">Persona Natural con RUC</SelectItem><SelectItem value="empresa">Empresa</SelectItem></SelectContent></Select><small>{ruc?'El nombre se completa automáticamente por RUC.':'Completa el nombre y el DNI del cliente manualmente.'}</small></div>
  <label className="field" data-field="clientDocument"><span>RUC/DNI del cliente *</span><input inputMode="numeric" autoComplete="off" maxLength={ruc?11:8} value={q.clientDocument} id="client-document" {...fieldState('clientDocument')} onChange={e=>documentChange(e.target.value.replace(/\D/g,'').slice(0,ruc?11:8))} placeholder={ruc?'Ingresa el RUC de 11 dígitos':'Ingresa el DNI de 8 dígitos'} aria-required={required}/><small>{ruc?'RUC obligatorio de 11 dígitos.':'DNI obligatorio de 8 dígitos.'}</small><FieldError path="clientDocument"/></label>
  <div className="field" data-field="client"><label className="field-label" htmlFor="client-name">{company?'Razón social':'Nombre del cliente'} *</label><textarea rows={1} className="expanding-field" id="client-name" {...fieldState('client')} readOnly={ruc} aria-busy={busy} aria-required="true" maxLength={300} value={q.client} onChange={e=>onChange({client:e.target.value.replace(/[\r\n]+/g,' ')})} placeholder={ruc?'Se completa al consultar el RUC':'Nombres y apellidos del cliente'}/><small>{ruc?'Nombre legal obtenido mediante la consulta RUC.':'Ingresa el nombre de la persona natural.'}</small><FieldError path="client"/>{ruc&&<div className="ruc-feedback"><p id="ruc-status" role="status" aria-live="polite">{status||'Completa un RUC válido para consultar el nombre.'}</p><button type="button" className="ruc-retry" disabled={busy||!isValidRuc(q.clientDocument)} onClick={()=>setRetry(v=>v+1)}>Consultar de nuevo</button></div>}</div>
  <div className="field" data-field="contact"><label className="field-label" htmlFor="business-phone">Contacto de tu negocio *</label><div className="phone-control"><span className="phone-prefix" aria-label="Perú, código de país +51"><span className="peru-flag" aria-hidden="true"/>+51</span><input id="business-phone" type="tel" inputMode="numeric" autoComplete="tel-national" {...fieldState('contact')} aria-required={required} maxLength={9} value={phone} onChange={e=>{const digits=e.target.value.replace(/\D/g,'').slice(0,9);onChange({contact:digits?'+51 '+digits:''});}} placeholder="900000000"/></div><small>9 dígitos, sin incluir el código de país.</small><FieldError path="contact"/></div>
  <label className="field full-field" data-field="clientEmail"><span>Correo del cliente <em>(opcional)</em></span><input {...fieldState('clientEmail')} type="email" autoComplete="email" maxLength={180} value={q.clientEmail} onChange={e=>onChange({clientEmail:e.target.value})} placeholder="cliente@ejemplo.com"/><FieldError path="clientEmail"/></label>
  <label className="field full-field" data-field="event"><span>Proyecto *</span><textarea className="expanding-field" rows={1} {...fieldState('event')} aria-required={required} maxLength={120} value={q.event} onChange={e=>onChange({event:e.target.value.replace(/[\r\n]+/g,' ')})} placeholder="Ej. Celebración de Valentina · mesa dulce"/><FieldError path="event"/></label>
  <label className="field full-field" data-field="eventDate"><span>Fecha del evento <em>(opcional)</em></span><input {...fieldState('eventDate')} type="date" min={q.issued} value={q.eventDate} onChange={e=>onChange({eventDate:e.target.value})}/><FieldError path="eventDate"/></label>
  {q.clientContact&&<label className="field full-field"><span>Contacto del cliente registrado anteriormente</span><input maxLength={180} value={q.clientContact} onChange={e=>onChange({clientContact:e.target.value})}/></label>}
 </div></section>;
}

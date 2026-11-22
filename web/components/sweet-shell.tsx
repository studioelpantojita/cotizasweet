'use client';
import {useRef,useState} from 'react';
import {Menu,UserRound,X} from 'lucide-react';
import type {ProjectType} from '@/lib/quote';
import {quoteCtaLabel,quoteHref} from '@/lib/project-presentations';
import {BrandMark} from './brand-mark';

export function SweetHeader({active='home',signedIn=false}:{active?:'home'|'catalog'|'quote';project?:ProjectType;signedIn?:boolean}){
 const [open,setOpen]=useState(false);
 const toggle=useRef<HTMLButtonElement>(null);
 return <><a className="sweet-skip" href={active==='quote'?'#cotizador':'#contenido'}>Ir al contenido</a><div className="sweet-topline">PASTELERÍA, PRESENTACIÓN Y PROPUESTAS A MEDIDA</div><header className="sweet-header" onKeyDown={event=>{if(event.key==='Escape'&&open){setOpen(false);toggle.current?.focus();}}}>
  <a href="/" className="sweet-wordmark" aria-label="E&A Cotiza · Inicio"><BrandMark /></a>
  <button ref={toggle} type="button" className="sweet-menu-toggle" aria-expanded={open} aria-controls="sweet-navigation" aria-label={open?'Cerrar menú':'Abrir menú'} onClick={()=>setOpen(!open)}>{open?<X/>:<Menu/>}</button>
  <nav id="sweet-navigation" className={'sweet-primary-nav '+(open?'is-open':'')} aria-label="Principal" onClick={()=>setOpen(false)}>
   <a href="/catalogo" aria-current={active==='catalog'?'page':undefined}>Catálogo</a>
   <a href="/#como-funciona">Cómo Funciona</a>
   <a href={signedIn?'/auth/logout':'/auth/login'} className="sweet-nav-access"><UserRound size={15} aria-hidden="true"/>{signedIn?'Cerrar sesión':'Accede'}</a>
  </nav>
 </header></>;
}
export function SweetFooter({project='custom'}:{project?:ProjectType}){return <footer className="sweet-footer"><div className="sweet-container sweet-footer-main"><div><a href="/" className="sweet-wordmark" aria-label="E&A Cotiza · Inicio"><BrandMark variant="compact" /></a><p>El cuidado de cada detalle,<br/>desde la idea hasta la propuesta.</p></div><div><span>DESCUBRIR</span><a href="/catalogo">Catálogo de presentaciones</a><a href="/#ocasiones">Colecciones por ocasión</a><a href="/#plan">Plan por negocio</a></div><div><span>CREAR</span><a href={quoteHref(project)}>{quoteCtaLabel}</a><a href="/catalogo?seleccion=packs#coleccion">Packs y cajas</a><a href="/catalogo?seleccion=insumos#coleccion">Ficha de insumos</a></div><div className="sweet-footer-note">Una herramienta para presentar<br/>el valor de tu trabajo.<p>Elige una ocasión, explora los detalles y continúa cuando estés listo.</p></div></div><div className="sweet-container sweet-footer-bottom"><span>E&A Cotiza · E&A Consultores</span><p>Fotografías de muestra facilitadas para este catálogo. Las marcas visibles corresponden a sus respectivos titulares.</p></div></footer>;}

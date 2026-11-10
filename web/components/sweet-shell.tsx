'use client';
import {useState} from 'react';
import {ArrowUpRight,Menu,X} from 'lucide-react';
import type {ProjectType} from '@/lib/quote';
import {quoteCtaLabel,quoteHref} from '@/lib/project-presentations';

export function SweetHeader({active='home',project='custom'}:{active?:'home'|'catalog';project?:ProjectType}){
 const [open,setOpen]=useState(false);
 return <><a className="sweet-skip" href="#contenido">Ir al contenido</a><div className="sweet-topline">PASTELERÍA, PRESENTACIÓN Y PROPUESTAS A MEDIDA</div><header className="sweet-header">
  <a href="/" className="sweet-wordmark" aria-label="CotizaSweet · Inicio">Cotiza<span>Sweet</span><small>POR E&A CONSULTORES</small></a>
  <button type="button" className="sweet-menu-toggle" aria-expanded={open} aria-controls="sweet-navigation" aria-label={open?'Cerrar menú':'Abrir menú'} onClick={()=>setOpen(!open)}>{open?<X/>:<Menu/>}</button>
  <nav id="sweet-navigation" className={open?'is-open':''} aria-label="Principal" onClick={()=>setOpen(false)}><a href="/" aria-current={active==='home'?'page':undefined}>Inicio</a><a href="/catalogo" aria-current={active==='catalog'?'page':undefined}>Catálogo</a><a href="/#ocasiones">Ocasiones</a><a href="/#atelier">Nuestro enfoque</a><a className="sweet-mobile-cta" href={quoteHref(project)}>{quoteCtaLabel} <ArrowUpRight size={15}/></a></nav>
  <a href={quoteHref(project)} className="sweet-nav-cta">{quoteCtaLabel} <ArrowUpRight size={16}/></a>
 </header></>;
}
export function SweetFooter({project='custom'}:{project?:ProjectType}){return <footer className="sweet-footer"><div className="sweet-container sweet-footer-main"><div><a href="/" className="sweet-wordmark">Cotiza<span>Sweet</span><small>POR E&A CONSULTORES</small></a><p>El cuidado de cada detalle,<br/>desde la idea hasta la propuesta.</p></div><div><span>DESCUBRIR</span><a href="/catalogo">Catálogo de presentaciones</a><a href="/#ocasiones">Colecciones por ocasión</a><a href="/#plan">Plan por negocio</a></div><div><span>CREAR</span><a href={quoteHref(project)}>{quoteCtaLabel}</a><a href="/catalogo?seleccion=packs#coleccion">Packs y cajas</a><a href="/catalogo?seleccion=insumos#coleccion">Ficha de insumos</a></div><div className="sweet-footer-note">Una herramienta para presentar<br/>el valor de tu trabajo.<p>Elige una ocasión, explora los detalles y continúa cuando estés listo.</p></div></div><div className="sweet-container sweet-footer-bottom"><span>CotizaSweet_micropp · E&A Consultores</span><p>Fotografías de muestra facilitadas para este catálogo. Las marcas visibles corresponden a sus respectivos titulares.</p></div></footer>;}

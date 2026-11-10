'use client';
import Image from 'next/image';
import {ArrowUpRight,X} from 'lucide-react';
import {Dialog,DialogClose,DialogContent,DialogDescription,DialogTitle,DialogTrigger} from '@/components/ui/dialog';
import {showcaseCategories,type ShowcasePiece} from '@/lib/sweet-showcase';
import type {ProjectType} from '@/lib/quote';
import {quoteCtaLabel,quoteHref} from '@/lib/project-presentations';

export function ShowcaseCard({piece:p,project='custom'}:{piece:ShowcasePiece;project?:ProjectType}){
 const category=showcaseCategories.find(c=>c.id===p.category)!.label;
 return <Dialog><article className="sweet-piece"><DialogTrigger asChild><button type="button" className="sweet-piece-open" aria-label={'Ver presentación de '+p.name}>
  <div className={'sweet-piece-image '+(p.category==='cakes'?'':'is-coffret')}><Image src={'/images/'+p.image} alt={p.name+' · fotografía de muestra'} fill sizes="(max-width: 600px) 90vw, (max-width: 1000px) 45vw, 30vw"/><span className="sweet-piece-arrow"><ArrowUpRight size={21}/></span></div>
  <div className="sweet-piece-copy"><span>{category}</span><h3>{p.name}</h3><p>{p.description}</p><small>Explorar presentación <span aria-hidden="true">↗</span></small></div>
 </button></DialogTrigger></article>
 <DialogContent className="sweet-piece-dialog" showCloseButton={false}><DialogClose asChild><button className="sweet-dialog-close" aria-label="Cerrar presentación"><X size={22}/></button></DialogClose><div className="sweet-piece-dialog-image"><Image src={'/images/'+p.image} alt={p.name+' · fotografía de muestra'} fill sizes="(max-width: 700px) 95vw, 55vw"/></div><div className="sweet-piece-dialog-copy"><p className="sweet-kicker">{category} / SELECCIÓN VISUAL</p><DialogTitle>{p.name}</DialogTitle><DialogDescription>{p.description}</DialogDescription><p className="sweet-piece-format">{p.format}</p><h3>Una referencia para tu próxima idea.</h3><p>Usa esta presentación para orientar el estilo de tu proyecto. La composición, el formato, el precio y la disponibilidad se acuerdan con el negocio.</p><a className="sweet-button" href={quoteHref(project)}>{quoteCtaLabel} <ArrowUpRight size={16}/></a><small>Imagen de muestra. Esta ficha no crea un pedido ni añade productos a la cotización.</small></div></DialogContent></Dialog>;
}

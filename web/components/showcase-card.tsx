'use client';
import Image from 'next/image';
import {ArrowUpRight} from 'lucide-react';
import {showcaseCategories,type ShowcasePiece} from '@/lib/sweet-showcase';
import type {ProjectType} from '@/lib/quote';
import {ImagePresentation} from './image-presentation';

export function ShowcaseCard({piece:p,project='custom'}:{piece:ShowcasePiece;project?:ProjectType}){
 const category=showcaseCategories.find(c=>c.id===p.category)!.label;
 return <article className="sweet-piece"><ImagePresentation className="sweet-piece-open" title={p.name} image={'/images/'+p.image} description={p.description} category={category+' / SELECCIÓN VISUAL'} format={p.format} project={project}>
  <div className={'sweet-piece-image '+(p.category==='cakes'?'':'is-coffret')}><Image src={'/images/'+p.image} alt={p.name+' · fotografía de muestra'} fill sizes="(max-width: 600px) 90vw, (max-width: 1000px) 45vw, 30vw"/><span className="sweet-piece-arrow" aria-hidden="true"><ArrowUpRight size={21}/></span></div>
  <div className="sweet-piece-copy"><span>{category}</span><h3>{p.name}</h3><p>{p.description}</p></div>
 </ImagePresentation></article>;
}

'use client';
import {useEffect, useRef, useState} from 'react';
import {ArrowLeft, ArrowRight} from 'lucide-react';
import {showcase, showcaseCategories, type ShowcaseCategory} from '@/lib/sweet-showcase';
import type {ProjectType} from '@/lib/quote';
import {ShowcaseCard} from './showcase-card';

export function ProductRunway({project}: {project: ProjectType}) {
  const [category, setCategory] = useState<'all' | ShowcaseCategory>('all');
  const [edges, setEdges] = useState({start:true, end:false});
  const rail = useRef<HTMLUListElement>(null);
  const pieces = showcase.filter(p => category === 'all' || p.category === category);

  useEffect(() => {
    const element = rail.current;
    if (!element) return;
    const update = () => setEdges({start:element.scrollLeft <= 2, end:element.scrollLeft + element.clientWidth >= element.scrollWidth - 2});
    element.scrollTo({left:0, behavior:'instant'});
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    element.addEventListener('scroll', update, {passive:true});
    return () => {observer.disconnect(); element.removeEventListener('scroll', update);};
  }, [category]);

  function move(direction: number) {
    const element = rail.current;
    if (!element) return;
    const step = (element.firstElementChild?.getBoundingClientRect().width ?? 300) + 24;
    const cards = Math.max(1, Math.floor(element.clientWidth / step));
    element.scrollBy({left:direction * step * cards, behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'});
  }

  return <div className="sweet-runway" role="region" aria-label="Pasarela de productos">
    <div className="sweet-runway-toolbar">
      <div className="sweet-runway-filters" role="group" aria-label="Filtrar pasarela">
        {[{id:'all',label:'Toda la selección'}, ...showcaseCategories].map(c => <button key={c.id} type="button" aria-pressed={category === c.id} onClick={() => setCategory(c.id as typeof category)}>{c.label}</button>)}
      </div>
      <div className="sweet-runway-controls"><span aria-live="polite">{pieces.length} presentaciones</span><button type="button" aria-label="Productos anteriores" aria-controls="pasarela-productos" disabled={edges.start} onClick={() => move(-1)}><ArrowLeft size={19}/></button><button type="button" aria-label="Productos siguientes" aria-controls="pasarela-productos" disabled={edges.end} onClick={() => move(1)}><ArrowRight size={19}/></button></div>
    </div>
    <ul id="pasarela-productos" ref={rail} className="sweet-runway-track" tabIndex={0} aria-label="Productos de la selección" onKeyDown={event => {
      if (event.target !== event.currentTarget || !['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
      event.preventDefault();
      if (event.key === 'Home' || event.key === 'End') event.currentTarget.scrollTo({left:event.key === 'Home' ? 0 : event.currentTarget.scrollWidth, behavior:'instant'});
      else move(event.key === 'ArrowRight' ? 1 : -1);
    }}>{pieces.map(p => <li key={p.id}><ShowcaseCard piece={p} project={project}/></li>)}</ul>
    <div className="sweet-runway-foot"><p>Fotografías de muestra · composición y disponibilidad por coordinar.</p><span>Desliza para descubrir <ArrowRight size={14}/></span></div>
  </div>;
}

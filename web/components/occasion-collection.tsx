'use client';
import Image from 'next/image';
import {ArrowUpRight, Check} from 'lucide-react';
import {collections, projectInfo, type ProjectType} from '@/lib/quote';
import {presentationFor, projectsInCollection, quoteCtaLabel, quoteHref} from '@/lib/project-presentations';
import {ShowcaseCard} from './showcase-card';

export function OccasionCollection({value, onChange}: {value:ProjectType; onChange:(value:ProjectType)=>void}) {
  const project = projectInfo(value);
  const collection = collections.find(c => c.id === project.group)!;
  const presentation = presentationFor(value);
  const options = projectsInCollection(project.group);
  return <section className="sweet-occasions" id="ocasiones" aria-labelledby="occasion-heading"><div className="sweet-container" id="proyectos">
    <div className="sweet-section-heading"><div><p className="sweet-kicker">ENCUENTRA TU OCASIÓN</p><h2 id="occasion-heading">Cada ocasión tiene<br/><em>su propia colección.</em></h2></div><p>Primero, elige el motivo. Después, descubre las presentaciones y los servicios que pueden darle forma.</p></div>
    <fieldset className="occasion-families"><legend className="sweet-step">01 <span>Elige una colección</span></legend><div className="occasion-family-grid">
      {collections.map(c => <label key={c.id} className={'occasion-family '+(project.group === c.id ? 'is-selected' : '')}><input type="radio" name="occasion-family" value={c.id} checked={project.group === c.id} onChange={() => onChange(c.id === 'amedida' ? 'custom' : c.defaultProject)}/><span className="occasion-family-top"><span>{c.number}</span><span className="occasion-choice-dot" aria-hidden="true"/></span><strong>{c.title}</strong><small>{c.id === 'amedida' ? 'Proyecto a medida · Preferencias alimentarias' : c.id === 'corporativo' ? 'Empresas · Agencias · Entidades' : c.subtitle}</small></label>)}
    </div></fieldset>
    <fieldset className="occasion-types"><legend className="sweet-step">02 <span>Selecciona tu tipo de proyecto</span></legend><div>{options.map(p => <label key={p.id} className={p.id === value ? 'is-selected' : ''}><input type="radio" name="occasion-type" checked={p.id === value} value={p.id} onChange={() => onChange(p.id)}/><span>{p.label}</span>{p.id === value && <Check size={14} aria-hidden="true"/>}</label>)}</div></fieldset>
    <p className="sr-only" role="status">Mostrando {project.label}: imagen de referencia, servicios y detalles del proyecto.</p>
    <article className={'occasion-story '+(presentation.contain ? 'has-coffret' : '')} aria-labelledby="occasion-story-heading">
      <figure className="occasion-story-image"><Image key={presentation.image} src={'/images/'+presentation.image} alt={presentation.imageAlt} fill sizes="(max-width: 800px) 90vw, 48vw"/><figcaption>INSPIRACIÓN PARA {project.label.toLocaleUpperCase('es')}</figcaption></figure>
      <div className="occasion-story-copy"><p className="sweet-kicker">{collection.title} / {project.label}</p><h3 id="occasion-story-heading">{presentation.headline}</h3><p>{presentation.description}</p><div className="occasion-story-detail"><span>A DEFINIR CONTIGO</span><p>{presentation.details}</p></div><span className="occasion-reference">Imagen referencial · selección y acabados sujetos a confirmación.</span></div>
    </article>
    <div className="occasion-offer"><div className="occasion-offer-intro"><p className="sweet-kicker">PARA COMPONER TU PROYECTO</p><h3>Elige el contenido.<br/><em>Hazlo tuyo.</em></h3><p>Estas opciones están disponibles en el cotizador. Tú defines cuáles incorporar y en qué cantidad.</p></div><div className="occasion-service-grid">{presentation.services.map(service => <article key={service.id}><span>{service.category === 'pack' ? 'PACK / '+service.unit : 'ADICIONAL / '+service.unit}</span><h4>{service.name}</h4><p>{service.description}</p></article>)}</div></div>
    <div className="occasion-inspiration"><div><h3>Una selección para inspirarte</h3><p>Referencias visuales para {project.label.toLocaleLowerCase('es')}. La composición final se acuerda con el negocio.</p></div><div className="occasion-inspiration-grid">{presentation.pieces.map(piece => <ShowcaseCard key={piece.id} piece={piece} project={value}/>)}</div></div>
    <div className="occasion-next"><div><span>TU SELECCIÓN</span><strong>{project.label}</strong><p>Continúa para elegir packs, cantidades y condiciones.</p></div><a className="sweet-button" href={quoteHref(value)}>{quoteCtaLabel}<ArrowUpRight size={18}/></a></div>
  </div></section>;
}

'use client';
import {useEffect,useState} from 'react';
import {ArrowUpRight,RefreshCw,Search,X} from 'lucide-react';
import {ProductCard} from './commercial-catalog';
import {ShowcaseCard} from './showcase-card';
import {showcase,showcaseCategories,filterShowcase} from '@/lib/sweet-showcase';
import {filterProducts,publicCatalog,type CommercialCatalog,type CatalogCurrency} from '@/lib/commercial-catalog';

const choices=[{id:'selection',label:'Toda la selección'},...showcaseCategories,{id:'packs',label:'Packs y cajas'},{id:'insumos',label:'Ficha de insumos'}];
export default function CatalogBrowser(){
 const [selection,setSelection]=useState('selection'),[query,setQuery]=useState(''),[currency,setCurrency]=useState<CatalogCurrency>('PEN');
 const [data,setData]=useState<CommercialCatalog|null>(null),[error,setError]=useState(false),[loading,setLoading]=useState(true),[attempt,setAttempt]=useState(0);
 useEffect(()=>{
  const restore=()=>{const value=new URLSearchParams(window.location.search).get('seleccion');setSelection(choices.some(c=>c.id===value)?value!:'selection');setQuery('');};
  restore();window.addEventListener('popstate',restore);return()=>window.removeEventListener('popstate',restore);
 },[]);
 useEffect(()=>{
  const controller=new AbortController();setLoading(true);setError(false);
  (async()=>{try{const response=await fetch('/api/catalog',{cache:'no-store',signal:controller.signal});if(!response.ok)throw new Error('catalog');const catalog=publicCatalog(await response.json());if(!controller.signal.aborted)setData(catalog);}catch{if(!controller.signal.aborted)setError(true);}finally{if(!controller.signal.aborted)setLoading(false);}})();
  return()=>controller.abort();
 },[attempt]);
 const services=selection==='packs'||selection==='insumos';
 const pieces=filterShowcase(selection,query);
 const products=data?filterProducts(data.products,selection,query):[];
 const title=choices.find(c=>c.id===selection)!.label;
 const count=services?products.length:pieces.length;
 function choose(value:string){setSelection(value);setQuery('');const url=new URL(window.location.href);if(value==='selection')url.searchParams.delete('seleccion');else url.searchParams.set('seleccion',value);window.history.pushState({},'',url.pathname+url.search+url.hash);}
 function categoryCount(value:string){if(value==='selection')return showcase.length;if(value==='packs'||value==='insumos')return data?.products.filter(p=>p.service===value).length??'—';return showcase.filter(p=>p.category===value).length;}
 const reset=()=>{setQuery('');choose('selection');};
 return <><section className="sweet-catalog-hero"><div className="sweet-container"><p className="sweet-breadcrumb"><a href="/">Inicio</a> / Catálogo</p><div className="sweet-catalog-heading"><div><p className="sweet-kicker">LA COLECCIÓN COTIZASWEET</p><h1>Un universo de detalles.<br/><em>Una elección muy tuya.</em></h1></div><p>Descubre presentaciones que inspiran y explora los packs e insumos para construir tu próxima propuesta.</p></div></div></section>
 <section className="sweet-catalog sweet-container" id="coleccion" aria-label="Catálogo de productos"><div className="sweet-catalog-layout">
  <aside className="sweet-categories" aria-label="Categorías del catálogo"><h2>Explora el catálogo</h2><div className="sweet-filter-group" role="group" aria-label="Presentaciones de muestra"><span>SELECCIÓN VISUAL</span>{choices.slice(0,4).map(c=><button key={c.id} type="button" aria-pressed={selection===c.id} onClick={()=>choose(c.id)}>{c.label}<span>{categoryCount(c.id)}</span></button>)}</div><div className="sweet-filter-group" role="group" aria-label="Servicios comerciales"><span>SERVICIOS DISPONIBLES</span>{choices.slice(4).map(c=><button key={c.id} type="button" aria-pressed={selection===c.id} onClick={()=>choose(c.id)}>{c.label}<span>{categoryCount(c.id)}</span></button>)}</div><div className="sweet-sidebar-note"><p>Cada ocasión tiene su propia combinación de sabores, formatos y detalles.</p><a href="/cotizar">Crear una propuesta <ArrowUpRight size={15}/></a></div></aside>
  <div className="sweet-results"><div className="sweet-catalog-toolbar"><label className="catalog-search"><Search size={18}/><span className="sr-only">Buscar en esta categoría</span><input type="search" maxLength={100} value={query} onChange={e=>setQuery(e.target.value)} placeholder={services?'Buscar packs, insumos u opciones…':'Buscar una presentación…'}/></label>{services&&<label className="catalog-currency"><span>Moneda</span><select value={currency} onChange={e=>setCurrency(e.target.value as CatalogCurrency)}><option value="PEN">PEN · Soles</option><option value="USD">USD · Dólares</option></select></label>}{query&&<button type="button" className="sweet-clear" onClick={()=>setQuery('')}><X size={14}/>Limpiar</button>}</div>
   <div className="sweet-results-heading"><h2>{title}</h2><p role="status" aria-live="polite">{services&&loading?'Cargando…':services&&error?'No disponible':`${count} ${services?(count===1?'servicio':'servicios'):(count===1?'presentación':'presentaciones')}`}</p></div>
   {services&&<div className="catalog-meta"><p>Precios {data?.referencePrices?'referenciales · ':''}sin IGV ni movilidad</p><p>Sin conversión automática de moneda</p></div>}
   {services&&error?<div className="catalog-state" role="alert"><h3>El catálogo necesita un momento.</h3><p>No pudimos cargar los servicios. Puedes volver a intentarlo.</p><button type="button" className="sweet-button" onClick={()=>setAttempt(n=>n+1)}><RefreshCw size={16}/>Recargar servicios</button></div>:services&&loading?<div className="commercial-grid" aria-label="Cargando servicios">{[0,1,2].map(i=><div key={i} className="catalog-skeleton"/>)}</div>:count===0?<div className="sweet-catalog-empty"><h3>Aún no encontramos ese detalle.</h3><p>Prueba con otro nombre o vuelve a explorar la selección.</p><button type="button" onClick={reset}>Ver toda la selección</button></div>:services?<div className="commercial-grid">{products.map(p=><ProductCard key={p.id} product={p} currency={currency} referencePrices={data!.referencePrices}/>)}</div>:<div className="sweet-catalog-grid">{pieces.map(p=><ShowcaseCard key={p.id} piece={p}/>)}</div>}
   {services&&data&&!error?<div className="catalog-footnote"><p><strong>{data.referencePrices?'Catálogo referencial.':'Información comercial.'}</strong> Composición, disponibilidad e insumos sujetos a confirmación del negocio. Las fotografías ilustran presentaciones de ejemplo.</p><p>Actualizado: {new Date(data.updatedAt).toLocaleDateString('es-PE',{timeZone:'America/Lima'})}</p></div>:!services&&<p className="sweet-catalog-reference-note">Selección de inspiración. Las imágenes muestran referencias de presentación; no constituyen una oferta de productos disponibles. Consulta <button type="button" className="sweet-clear" onClick={()=>choose('packs')}>Packs y cajas</button> para ver los servicios y precios referenciales del cotizador.</p>}
  </div>
 </div></section></>;
}

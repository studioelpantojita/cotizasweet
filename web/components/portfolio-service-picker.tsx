'use client';
import {useRef,useState} from 'react';
import {ArrowLeft,ArrowUpRight,Plus,Search} from 'lucide-react';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from './ui/dialog';
import {QuoteNumberInput} from './quote-validation';
import {showcase,showcaseCategories,filterShowcase,type ShowcasePiece} from '@/lib/sweet-showcase';
import {portfolioService,serviceDetailSchema,type ServiceDetail} from '@/lib/custom-service';
import {money,type Quote,type QuoteItem} from '@/lib/quote';
import {acceptedFlavors,productRate} from '@/lib/product-pricing';
const emptyDetail=():ServiceDetail=>({flavors:[],presentation:'',scope:'',quantity:1});
const entryCategories=[...showcaseCategories,{id:'cakes-chocolates',label:'Tortas y Chocolates'},{id:'macarons-cakes',label:'Macarons y postres'},{id:'chocolates-cakes',label:'Chocolates y postres'}];

export function PortfolioServicePicker({currency,disabled,onAdd}:{currency:Quote['currency'];disabled:boolean;onAdd:(item:QuoteItem)=>void}){
 const [open,setOpen]=useState(false),[category,setCategory]=useState('selection'),[query,setQuery]=useState(''),[product,setProduct]=useState<ShowcasePiece|null>(null),[detail,setDetail]=useState(emptyDetail),[error,setError]=useState('');
 const trigger=useRef<HTMLButtonElement|null>(null),form=useRef<HTMLFormElement|null>(null);
 const results=filterShowcase(category,query),rate=product?productRate('portfolio',product.id):undefined;
 function choose(p:ShowcasePiece){setProduct(p);setDetail(emptyDetail());setError('');}
 function show(category:string,button:HTMLButtonElement){trigger.current=button;setCategory(category);setQuery('');setProduct(null);setError('');setOpen(true);}
 function add(event:React.FormEvent){event.preventDefault();if(!product||disabled)return;const parsed=serviceDetailSchema.safeParse(detail);if(!parsed.success){const issue=parsed.error.issues[0];setError(issue.message);const target=form.current?.elements.namedItem(String(issue.path[0]));if(target instanceof HTMLElement)target.focus();return;}onAdd(portfolioService(product.id,parsed.data,currency));setOpen(false);}
 return <div className="portfolio-entry">
  <div className="portfolio-entry-heading"><div><span className="eyebrow">DE LA CARTERA A TU PROPUESTA</span><h4>Elige una pieza. Hazla tuya.</h4><p>Selecciona una referencia y define los detalles de tu servicio a medida.</p></div></div>
  <div className="portfolio-entry-categories">{entryCategories.map(c=>{const p=showcase.find(p=>p.category===c.id.split('-')[0])!;return <button type="button" key={c.id} disabled={disabled} onClick={e=>show(c.id,e.currentTarget)}><img src={'/images/'+p.image} alt=""/><span>{c.label}<ArrowUpRight size={16}/></span></button>;})}</div>
  <button type="button" className="portfolio-open" disabled={disabled} onClick={e=>show('selection',e.currentTarget)}>Explorar toda la cartera <ArrowUpRight size={16}/></button>
  <Dialog open={open} onOpenChange={setOpen}><DialogContent className="portfolio-dialog" onCloseAutoFocus={e=>{e.preventDefault();trigger.current?.focus({preventScroll:true});}}>
   <DialogHeader><DialogTitle>{product?'Tu servicio a medida':'La cartera, a tu medida'}</DialogTitle><DialogDescription>{product?'Elige hasta cuatro sabores y define la presentación. El precio y la unidad corresponden al producto.':'Tortas y postres, macarons y chocolates. Elige una referencia para personalizarla.'}</DialogDescription></DialogHeader>
   {product?<form ref={form} className="portfolio-configure" onSubmit={add} noValidate>
    <button type="button" className="portfolio-back" onClick={()=>{setProduct(null);setError('');}}><ArrowLeft size={16}/>Volver a los productos</button>
    <div className="portfolio-selected"><img src={'/images/'+product.image} alt={product.name}/><div><span>REFERENCIA SELECCIONADA</span><h3>{product.name}</h3><p>{product.format}</p><small>Imagen referencial. El detalle acordado define el servicio.</small></div></div>
    <fieldset className="portfolio-flavors"><legend>Contenido · sabores *</legend><p className="field-help">Selecciona de 1 a 4 sabores. {detail.flavors.length}/4 seleccionados.</p><div className="flavor-options">{acceptedFlavors.map(flavor=><label key={flavor}><input type="checkbox" name="flavors" value={flavor} checked={detail.flavors.includes(flavor)} disabled={!detail.flavors.includes(flavor)&&detail.flavors.length>=4} onChange={e=>setDetail({...detail,flavors:e.target.checked?[...detail.flavors,flavor]:detail.flavors.filter(f=>f!==flavor)})}/><span>{flavor}</span></label>)}</div></fieldset>
    <div className="portfolio-details">{(['presentation','scope'] as const).map((key,i)=><label className="field" key={key}><span>{['Presentación *','Alcance (opcional)'][i]}</span><textarea name={key} required={key==='presentation'} rows={2} maxLength={80} value={detail[key]} placeholder={['Ej. Caja de regalo, lazo marfil y tarjeta','Sin completar se mostrará Unknown.'][i]} onChange={e=>setDetail({...detail,[key]:e.target.value})}/><small>{detail[key].length}/80 caracteres</small></label>)}</div>
    <label className="field"><span>Unidad de venta</span><input name="unit" readOnly value={rate?.unit||''}/><small>Definida por el producto seleccionado.</small></label>
    <div className="service-card-numbers"><label className="field"><span>Cantidad *</span><QuoteNumberInput name="quantity" value={detail.quantity} min={1} max={999} step={1} onValue={quantity=>setDetail({...detail,quantity})}/><small>De 1 a 999 unidades de venta.</small></label><label className="field"><span>Precio unitario ({currency})</span><input name="priceCents" readOnly value={money(rate?.prices[currency]??0,currency)}/><small>Tarifa referencial para pruebas · sin IGV · no editable.</small></label></div>
    {error&&<p className="field-error" role="alert">{error}</p>}<div className="portfolio-confirm"><div><small>Importe sin IGV</small><strong>{money(detail.quantity*(rate?.prices[currency]??0),currency)}</strong></div><button type="submit" className="btn" disabled={disabled}><Plus size={17}/>Añadir a la propuesta</button></div>
   </form>:<>
    <div className="portfolio-tools"><label className="portfolio-search"><Search size={18}/><span className="sr-only">Buscar en la cartera</span><input type="search" value={query} placeholder="Buscar un producto…" onChange={e=>setQuery(e.target.value)}/></label><div className="portfolio-filters" aria-label="Categoría de la cartera">{[{id:'selection',label:'Todo'},...showcaseCategories].map(c=><button type="button" aria-pressed={category===c.id} key={c.id} onClick={()=>setCategory(c.id)}>{c.label}</button>)}</div></div>
    <p className="portfolio-count" role="status">{results.length} productos de referencia · precios referenciales para pruebas</p>
    <div className="portfolio-grid">{results.map(p=><button type="button" className="portfolio-product" key={p.id} onClick={()=>choose(p)} aria-label={`Personalizar ${p.name}`}><img src={'/images/'+p.image} alt="" loading="lazy"/><span>{p.name}</span><small>{p.format}</small><b>Personalizar <Plus size={15}/></b></button>)}</div>
    {!results.length&&<p className="portfolio-empty">No encontramos ese producto. Prueba otro nombre o categoría.</p>}
   </>}
  </DialogContent></Dialog>
 </div>;
}

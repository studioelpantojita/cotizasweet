'use client';
import {useEffect,useState} from 'react';
import {ArrowUpRight,Check,ChevronRight,ImageOff,ShieldCheck,X} from 'lucide-react';
import {Dialog,DialogClose,DialogContent,DialogDescription,DialogTitle,DialogTrigger} from '@/components/ui/dialog';
import {confirmationCurrent,priceLabel,type CatalogCurrency,type CatalogProduct} from '@/lib/commercial-catalog';

function ProductImage({src,alt}:{src:string;alt:string}){
 const [failed,setFailed]=useState(false);
 useEffect(()=>setFailed(false),[src]);
 return failed?<div className="catalog-image-fallback" role="img" aria-label={alt+' · imagen no disponible'}><ImageOff size={35}/><span>Imagen no disponible</span></div>:<img src={src} alt={alt} loading="lazy" onError={()=>setFailed(true)}/>;
}
export function ProductCard({product:p,currency,referencePrices}:{product:CatalogProduct;currency:CatalogCurrency;referencePrices:boolean}){
 const [variant,setVariant]=useState(0),[photo,setPhoto]=useState(0);
 const selected=p.variants[variant],amount=selected.prices[currency];
 const available=p.variants.flatMap(v=>v.prices[currency]===undefined?[]:[v.prices[currency]!]);
 const from=available.length?Math.min(...available):undefined;
 const fromVariant=from===undefined?undefined:p.variants.find(v=>v.prices[currency]===from);
 const confirmed=confirmationCurrent(p.confirmation);
 return <Dialog onOpenChange={open=>{if(open){setVariant(0);setPhoto(0);}}}>
  <article className="commercial-card">
   <DialogTrigger asChild><button type="button" className="catalog-open" aria-label={'Ver detalle de '+p.name}>
    <div className="commercial-photo"><ProductImage src={p.images[0].src} alt={p.images[0].alt}/><span className="catalog-service-tag">{p.service==='packs'?'PACKS Y CAJAS':'FICHA DE INSUMOS'}</span><span className="catalog-image-action"><ArrowUpRight size={21}/></span></div>
    <div className="commercial-card-copy"><span className="catalog-small-label">{p.variants.length} OPCIONES · {referencePrices?'PRECIO REFERENCIAL':'PRECIO DE CATÁLOGO'}</span><h3>{p.name}</h3><p>{p.summary}</p><div className="commercial-card-bottom"><span><small>{from!==undefined?'Desde':''}</small><strong>{priceLabel(from,currency)}</strong>{fromVariant&&<small>{fromVariant.unit}</small>}</span><span className="catalog-details-link">Ver detalle <ChevronRight size={16}/></span></div></div>
   </button></DialogTrigger>
  </article>
  <DialogContent className="catalog-dialog" showCloseButton={false}>
   <DialogClose asChild><button type="button" className="catalog-close" aria-label="Cerrar detalle del producto"><X size={22}/></button></DialogClose>
   <div className="catalog-detail-layout">
    <div className="catalog-gallery"><div className="catalog-main-photo"><ProductImage src={p.images[photo].src} alt={p.images[photo].alt}/></div><p className="catalog-photo-caption">{p.images[photo].caption}</p>
     {p.images.length>1&&<div className="catalog-thumbnails" aria-label="Imágenes del producto">{p.images.map((image,i)=><button type="button" key={image.src} aria-label={'Ver imagen '+(i+1)} aria-pressed={photo===i} onClick={()=>setPhoto(i)}><img src={image.src} alt={image.alt}/></button>)}</div>}
     <span className="catalog-gallery-signature">E&A ATELIER <i>el cuidado está en los detalles</i></span>
    </div>
    <div className="catalog-detail-copy">
     <p className="eyebrow">{p.service==='packs'?'PACKS Y CAJAS':'FICHA DE INSUMOS'}</p>
     <DialogTitle className="catalog-detail-title">{p.name}</DialogTitle>
     <DialogDescription className="catalog-detail-summary">{p.summary}</DialogDescription>
     <div className="catalog-price-block" aria-live="polite" aria-atomic="true"><strong>{priceLabel(amount,currency)}</strong><span>{selected.unit}{amount===0?' · sin cargo adicional':''}</span><small>{referencePrices?'Precio referencial de ejemplo':'Precio de catálogo'} · {currency} · sin IGV ni movilidad</small></div>
     <fieldset className="catalog-variants"><legend>Tipo y calidad del producto</legend>{p.variants.map((v,i)=><label key={v.id} className={variant===i?'is-selected':''}><input type="radio" name={'variant-'+p.id} checked={variant===i} onChange={()=>setVariant(i)}/><span><strong>{v.label}</strong><small>{v.quality}</small></span><b>{priceLabel(v.prices[currency],currency)}</b></label>)}</fieldset>
     <p className="catalog-variant-detail">{selected.detail}</p>
     <section className="catalog-description"><h3>Hecho para tu ocasión</h3><p>{p.description}</p><ul>{p.features.map(item=><li key={item}><Check size={16}/>{item}</li>)}</ul></section>
     <section className={'catalog-confirmation '+(confirmed?'is-confirmed':'')}><ShieldCheck size={21}/><div><h3>{confirmed?'Confirmado por el negocio':p.confirmation.status==='confirmed'?'Confirmación fuera de vigencia':'Pendiente de confirmación del negocio'}</h3><p>{p.confirmation.note}</p>{p.confirmation.status==='confirmed'&&<small>{p.confirmation.by} · {p.confirmation.date} · vigente hasta {p.confirmation.validUntil}</small>}</div></section>
     <details className="catalog-conditions"><summary>Condiciones del servicio</summary><ul>{p.conditions.map(condition=><li key={condition}>{condition}</li>)}</ul></details>
     <p className="catalog-readonly-note">Catálogo de consulta. La selección de opciones no crea pedidos ni modifica tu cotización.</p>
    </div>
   </div>
  </DialogContent>
 </Dialog>;
}

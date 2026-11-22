'use client';
import type {ReactNode} from 'react';
import Image from 'next/image';
import {ArrowUpRight,X} from 'lucide-react';
import {Dialog,DialogClose,DialogContent,DialogDescription,DialogTitle,DialogTrigger} from '@/components/ui/dialog';
import type {ProjectType} from '@/lib/quote';
import {quoteHref} from '@/lib/project-presentations';

type ImagePresentationProps={
 title:string;
 image:string;
 description:string;
 category?:string;
 format?:string;
 imageAlt?:string;
 project?:ProjectType;
 className?:string;
 children:ReactNode;
};

/** A photograph opens a local dialog. Navigation requires the separate, explicit action. */
export function ImagePresentation({title,image,description,category='SELECCIÓN VISUAL',format='Imagen referencial · presentación de muestra',imageAlt,project='custom',className='',children}:ImagePresentationProps){
 return <Dialog>
  <DialogTrigger asChild><button type="button" className={'image-presentation-trigger '+className} aria-label={'Ver presentación de '+title}>{children}</button></DialogTrigger>
  <DialogContent className="sweet-piece-dialog" showCloseButton={false}>
   <DialogClose asChild><button type="button" className="sweet-dialog-close" aria-label="Cerrar presentación"><X size={22}/></button></DialogClose>
   <div className="sweet-piece-dialog-image"><Image src={image} alt={imageAlt||title+' · fotografía de muestra'} fill sizes="(max-width: 700px) 95vw, 55vw"/></div>
   <div className="sweet-piece-dialog-copy">
    <p className="sweet-kicker">{category}</p><DialogTitle>{title}</DialogTitle><DialogDescription>{description}</DialogDescription>
    <p className="sweet-piece-format">{format}</p><h3>Una referencia para tu próxima idea.</h3>
    <p>Usa esta presentación para orientar el estilo de tu proyecto. La composición, el formato, el precio y la disponibilidad se acuerdan con el negocio.</p>
    <a className="sweet-button" href={quoteHref(project)}>Continuar al cotizador <ArrowUpRight size={16}/></a>
    <small>Imagen de muestra. Abrir esta ficha no crea un pedido ni añade productos a la cotización.</small>
   </div>
  </DialogContent>
 </Dialog>;
}

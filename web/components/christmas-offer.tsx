'use client';

import {ArrowUpRight,Check,Gift,History,X} from 'lucide-react';
import {BrandMark} from './brand-mark';
import {Dialog,DialogContent,DialogDescription,DialogTitle} from './ui/dialog';
import '../app/christmas-offer.css';

type ChristmasOfferProps={
 open:boolean;
 busy:boolean;
 error:string;
 onGuest:()=>void;
 onRegister:()=>void;
};

function ChristmasSprig({className=''}:{className?:string}){
 return <svg className={className} viewBox="0 0 180 180" fill="none" aria-hidden="true" focusable="false">
  <path d="M154 14C118 42 91 76 66 132L59 147L65 150C90 91 118 51 158 19Z" fill="currentColor"/>
  <path d="M139 31C122 28 104 30 95 36C110 41 122 42 131 40ZM122 49C102 44 86 47 76 55C92 59 105 60 115 59ZM107 69C86 61 69 65 58 74C74 80 89 82 100 81ZM91 92C70 82 51 86 39 98C54 105 72 106 84 105ZM77 117C55 107 37 112 23 124C40 132 58 132 71 130Z" fill="currentColor"/>
  <path d="M144 29C150 42 148 58 141 69C135 55 133 43 135 37ZM130 45C137 61 136 78 127 90C119 73 119 59 122 53ZM114 65C124 83 121 101 112 112C103 95 102 80 107 73ZM98 88C110 107 108 125 97 139C87 120 84 104 91 97ZM83 113C96 134 91 151 80 166C71 146 69 133 76 120Z" fill="currentColor"/>
  <circle cx="119" cy="40" r="7" fill="#ad4b54"/><circle cx="129" cy="33" r="6" fill="#c96a70"/><circle cx="130" cy="46" r="5.5" fill="#8d3345"/>
 </svg>;
}

export function ChristmasOffer({open,busy,error,onGuest,onRegister}:ChristmasOfferProps){
 const continueAsGuest=()=>{if(!busy)onGuest();};
 return <Dialog open={open} onOpenChange={next=>{if(!next)continueAsGuest();}}>
  <DialogContent className="christmas-offer" showCloseButton={false} aria-busy={busy}
   onEscapeKeyDown={event=>{if(busy)event.preventDefault();}}
   onInteractOutside={event=>{if(busy)event.preventDefault();}}>
   <button className="christmas-offer-close" type="button" onClick={continueAsGuest} disabled={busy} aria-label="Cerrar anuncio y continuar sin registro"><X size={19}/></button>
   <div className="christmas-offer-art" aria-hidden="true">
    <ChristmasSprig className="christmas-offer-sprig christmas-offer-sprig-top"/>
    <svg className="christmas-offer-star christmas-offer-star-one" viewBox="0 0 32 32" focusable="false"><path d="m16 0 3.6 12.4L32 16l-12.4 3.6L16 32l-3.6-12.4L0 16l12.4-3.6Z" fill="currentColor"/></svg>
    <svg className="christmas-offer-star christmas-offer-star-two" viewBox="0 0 32 32" focusable="false"><path d="m16 0 3.6 12.4L32 16l-12.4 3.6L16 32l-3.6-12.4L0 16l12.4-3.6Z" fill="currentColor"/></svg>
    <div className="christmas-offer-art-content"><Gift size={28} strokeWidth={1.3}/><span className="christmas-offer-art-kicker">UN DETALLE PARA CELEBRAR</span><span className="christmas-offer-percent">20<span>%</span></span><span className="christmas-offer-art-label">de descuento</span><span className="christmas-offer-art-note">El comienzo de una<br/>dulce celebración.</span></div>
    <ChristmasSprig className="christmas-offer-sprig christmas-offer-sprig-bottom"/>
   </div>
   <div className="christmas-offer-body">
    <div className="christmas-offer-brand"><BrandMark/></div>
    <p className="christmas-offer-eyebrow">UN REGALO DE BIENVENIDA · NAVIDAD 2026</p>
    <DialogTitle className="christmas-offer-title">Esta Navidad, celebra con un <em>20 % de descuento.</em></DialogTitle>
    <DialogDescription className="christmas-offer-description">Crea tu cuenta y aprovecha este beneficio en los servicios de tu próximo evento.</DialogDescription>
    <p className="christmas-offer-dates"><span>PARA EVENTOS DEL</span><strong>30 de noviembre de 2026<br className="christmas-offer-date-break"/> al 2 de enero de 2027</strong><small>Ambas fechas incluidas.</small></p>
    <div className="christmas-offer-account"><History size={20} strokeWidth={1.5} aria-hidden="true"/><p><strong>Tus propuestas, siempre a mano.</strong><span>Con tu cuenta podrás consultar el historial de tus cotizaciones y solicitudes.</span></p></div>
    <div className="christmas-offer-actions">
     <button type="button" className="christmas-offer-register" disabled={busy} onClick={onRegister}>Registrarme y aprovechar el 20 %<ArrowUpRight size={18} aria-hidden="true"/></button>
     <button type="button" className="christmas-offer-guest" disabled={busy} onClick={continueAsGuest}>Continuar sin registro</button>
    </div>
    {busy&&<p className="christmas-offer-status" role="status">Preparando tu acceso…</p>}
    {error&&<p className="christmas-offer-error" role="alert">{error}</p>}
    <p className="christmas-offer-reassurance"><Check size={15} aria-hidden="true"/>Puedes completar tu cotización como invitado.</p>
    <p className="christmas-offer-terms">Para cuentas nuevas que acepten la promoción. El 20 % se aplica a servicios; movilidad e IGV se calculan después.</p>
   </div>
  </DialogContent>
 </Dialog>;
}

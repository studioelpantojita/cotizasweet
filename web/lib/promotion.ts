import {z} from './zod';

export const christmasPromotion={
 id:'navidad-2026',percent:20,
 enrollmentStart:'2026-11-23',enrollmentEnd:'2027-01-02',
 eventStart:'2026-11-30',eventEnd:'2027-01-02',
 label:'Descuento navideño por registro',
} as const;
export const promotionCampaignId=christmasPromotion.id;
export const promotionSchema=z.object({campaignId:z.literal(christmasPromotion.id),percent:z.literal(christmasPromotion.percent)}).strict();
export type QuotePromotion=z.infer<typeof promotionSchema>;
export function peruDate(now:Date=new Date()){
 return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Lima',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
}
export function campaignIsOpen(now:Date=new Date()){
 if(!Number.isFinite(now.getTime()))return false;
 const today=peruDate(now);return today>=christmasPromotion.enrollmentStart&&today<=christmasPromotion.enrollmentEnd;
}
export function promotionEventEligible(eventDate:string){
 const timestamp=Date.parse(eventDate);
 return /^\d{4}-\d{2}-\d{2}$/.test(eventDate)&&Number.isFinite(timestamp)&&new Date(timestamp).toISOString().slice(0,10)===eventDate&&eventDate>=christmasPromotion.eventStart&&eventDate<=christmasPromotion.eventEnd;
}
export const promotionOfferActive=campaignIsOpen;
export function promotionForEvent(eventDate:string,entitled:boolean,now:Date=new Date()):QuotePromotion|undefined {
 return entitled&&campaignIsOpen(now)&&promotionEventEligible(eventDate)?{campaignId:christmasPromotion.id,percent:christmasPromotion.percent}:undefined;
}
export function applyCurrentPromotion<T extends {eventDate:string;promotion?:QuotePromotion}>(quote:T,entitled:boolean,now:Date=new Date()):T{
 return {...quote,promotion:promotionForEvent(quote.eventDate,entitled,now)};
}
export function promotionCreationAllowed(quote:{eventDate:string;promotion?:QuotePromotion},entitled:boolean,now:Date=new Date()){
 return !quote.promotion||!!promotionForEvent(quote.eventDate,entitled,now);
}

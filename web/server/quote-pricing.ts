import {applyCurrentPromotion,promotionForEvent} from '@/lib/promotion';
import type {Quote} from '@/lib/quote';
import type {QuoteActor} from './quote-actor';
import {hasPromotionEnrollment} from './promotions';
import {RucError} from './ruc';
export function priceForActor(quote:Quote,actor:QuoteActor):Quote{
 const entitled=actor.kind==='account'&&actor.session.role==='customer'&&!!actor.session.accountId&&hasPromotionEnrollment(actor.session.accountId);
 if(quote.promotion&&!promotionForEvent(quote.eventDate,entitled))throw new RucError('La promoción no corresponde a esta cuenta o fecha del evento.',400);
 return applyCurrentPromotion(quote,entitled);
}

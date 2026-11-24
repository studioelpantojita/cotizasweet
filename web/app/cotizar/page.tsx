import Studio from '@/components/studio';
import {getSession} from '@/server/session';
import {promotionOfferActive} from '@/lib/promotion';
import {hasPromotionEnrollment} from '@/server/promotions';
export const metadata={title:{absolute:'Cotizador | E&A Cotiza'}};
export const dynamic='force-dynamic';
export default async function Page(){const session=await getSession();return <Studio signedIn={!!session} isAdmin={session?.role==='admin'} offerAvailable={!session&&promotionOfferActive()} promotionEligible={!!session?.accountId&&session.role==='customer'&&hasPromotionEnrollment(session.accountId)}/>;}

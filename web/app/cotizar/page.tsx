import Studio from '@/components/studio';
import {getSession} from '@/server/session';
export const metadata={title:{absolute:'Cotizador | E&A Cotiza'}};
export const dynamic='force-dynamic';
export default async function Page(){return <Studio signedIn={!!await getSession()}/>;}

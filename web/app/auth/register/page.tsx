import {redirect} from 'next/navigation';
import {AccountForm} from '@/components/account-form';
import {BrandMark} from '@/components/brand-mark';
import {getSession} from '@/server/session';
import {accountsEnabled} from '@/server/accounts';
import {cookies} from 'next/headers';
import {cookieName} from '@/server/session';
import {readOfferIntent} from '@/server/promotions';
import '../accounts.css';
export const dynamic='force-dynamic';
export const metadata={title:'Crea tu cuenta'};
export default async function Register(){
 if(await getSession())redirect('/cotizar');
 const promotion=!!readOfferIntent((await cookies()).get(cookieName('promotion'))?.value);
 return <main className="account-page"><a className="account-brand" href="/" aria-label="E&A Cotiza · Inicio"><BrandMark/></a><section className="account-card"><p className="eyebrow">CADA IDEA EMPIEZA AQUÍ</p><h1>Crea tu cuenta.</h1><p>Conserva el historial de tus propuestas y envíalas al negocio cuando estén listas.</p>{accountsEnabled()?<AccountForm register promotion={promotion}/>:<p className="error">El registro aún no está configurado.</p>}<p className="account-switch">¿Ya tienes cuenta? <a href="/auth/login">Iniciar sesión</a></p><a className="account-home" href="/cotizar">Continuar sin registro</a></section></main>;
}

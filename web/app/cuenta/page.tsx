import {redirect} from 'next/navigation';
import {getSession} from '@/server/session';
import {PasswordForm} from '@/components/password-form';
import {BrandMark} from '@/components/brand-mark';
import '../auth/accounts.css';
export const dynamic='force-dynamic';
export const metadata={title:'Mi cuenta'};
export default async function Account(){const session=await getSession();if(!session)redirect('/auth/login');return <main className="account-page"><a className="account-brand" href="/" aria-label="E&A Cotiza · Inicio"><BrandMark/></a><section className="account-card"><p className="eyebrow">MI CUENTA</p><h1>{session.displayName}</h1>{session.accountId?<><p>Cambia la contraseña de tu cuenta de E&A Cotiza.</p><PasswordForm/></>:<p>Gestiona tu contraseña en el proveedor con el que iniciaste sesión.</p>}<p><a href={session.role==='admin'?'/admin':'/cotizar'}>Volver a mi espacio</a></p><p><a href="/auth/logout">Cerrar sesión</a></p></section></main>;}

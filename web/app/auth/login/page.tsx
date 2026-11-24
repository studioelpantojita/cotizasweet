import {redirect} from 'next/navigation';
import {AccountForm} from '@/components/account-form';
import {BrandMark} from '@/components/brand-mark';
import {getSession} from '@/server/session';
import {accountsEnabled} from '@/server/accounts';
import '../accounts.css';
export const dynamic='force-dynamic';
export const metadata={title:'Accede a tu cuenta'};
export default async function Login(){
 const session=await getSession();if(session)redirect(session.role==='admin'?'/admin':'/cotizar');
 return <main className="account-page"><a className="account-brand" href="/" aria-label="E&A Cotiza · Inicio"><BrandMark/></a><section className="account-card"><p className="eyebrow">TU ESPACIO DE PROPUESTAS</p><h1>Bienvenido de nuevo.</h1><p>Accede para guardar tus cotizaciones y enviarlas al negocio.</p>{accountsEnabled()?<><AccountForm/><p className="account-switch">¿Aún no tienes cuenta? <a href="/auth/register">Crear mi cuenta</a></p></>:<p className="error">El administrador debe configurar el acceso con usuario y contraseña.</p>}{process.env.OIDC_EXTERNAL_LOGIN_ENABLED==='true'&&<a className="btn secondary full" href="/auth/oidc">Continuar con Google o tu proveedor</a>}<a className="account-home" href="/">Volver al inicio</a></section></main>;
}

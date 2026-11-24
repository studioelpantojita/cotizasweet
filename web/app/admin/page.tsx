import {redirect} from 'next/navigation';
import {getSession} from '@/server/session';
import {listAccounts} from '@/server/accounts';
import {listSubmissions} from '@/server/submissions';
import {money} from '@/lib/quote';
import {projectDetails} from '@/lib/project-details';
import {BrandMark} from '@/components/brand-mark';
import {AdminAccountForm} from '@/components/admin-account-form';
import '../auth/accounts.css';
export const dynamic='force-dynamic';
export const metadata={title:'Administración'};
export default async function Admin({searchParams}:{searchParams:Promise<{cursor?:string}>}){
 const session=await getSession();if(!session)redirect('/auth/login');if(session.role!=='admin')redirect('/cotizar');
 const {cursor}=await searchParams;let page:ReturnType<typeof listSubmissions>;try{page=listSubmissions(cursor);}catch{page=listSubmissions();}
 const accounts=listAccounts();
 return <main className="admin-page"><header className="admin-heading"><a className="account-brand" style={{margin:0,width:180}} href="/" aria-label="E&A Cotiza · Inicio"><BrandMark/></a><nav aria-label="Administración"><a className="btn secondary" href="/cotizar">Crear cotización</a> <a className="btn secondary" href="/auth/logout">Cerrar sesión</a></nav></header><p className="eyebrow" style={{marginTop:40}}>ADMINISTRACIÓN DEL NEGOCIO</p><h1>Hola, {session.displayName}.</h1><p>Gestiona el acceso y consulta las solicitudes enviadas por tus clientes.</p>
 <section className="admin-section"><h2>Solicitudes de cotización</h2><p className="admin-notice">La recepción en esta bandeja confirma el envío al negocio dentro de la plataforma. El correo permanece pendiente de configuración.</p>{!page.entries.length?<p>Aún no hay solicitudes enviadas.</p>:<div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Solicitud / fecha</th><th>Cuenta / cliente</th><th>Proyecto</th><th>Total</th><th>Documento</th></tr></thead><tbody>{page.entries.map(entry=><tr key={entry.id}><td><b>{entry.id.slice(0,8).toUpperCase()}</b><p>{new Date(entry.submittedAt).toLocaleString('es-PE',{timeZone:'America/Lima'})}</p><span className="admin-status">Recibida en plataforma</span></td><td>{entry.displayName}<p>{entry.record.quote.client}</p></td><td>{projectDetails(entry.record.quote)}</td><td>{money(entry.record.totalCents,entry.record.quote.currency)}</td><td><a href={'/api/admin/submissions/'+entry.id+'/pdf'}>Descargar PDF</a><p>SHA-256: {entry.pdfSha256.slice(0,12)}…</p></td></tr>)}</tbody></table></div>}{page.nextCursor&&<a className="btn secondary" href={'/admin?cursor='+encodeURIComponent(page.nextCursor)}>Ver solicitudes anteriores</a>}</section>
 <section className="admin-section"><h2>Cuentas de la plataforma</h2><p className="admin-notice">Los clientes solo pueden consultar sus propias cotizaciones. La creación de administradores se realiza con la herramienta privada del propietario.</p><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>User</th><th>Nombre visible</th><th>Rol</th><th>Estado</th></tr></thead><tbody>{accounts.map(account=><tr key={account.id}><td>{account.username}</td><td>{account.displayName}</td><td>{account.role==='admin'?'Administrador':'Cliente'}</td><td>{account.active?'Activo':'Deshabilitado'}</td></tr>)}</tbody></table></div><AdminAccountForm/></section>
 <section className="admin-section"><h2>Precios del catálogo</h2><p className="admin-notice">Las tarifas iniciales son referenciales para pruebas y deben confirmarse antes de utilizarlas comercialmente. La unidad y el precio de un producto no pueden modificarse desde una cuenta de cliente.</p></section>
 </main>;
}

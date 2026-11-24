'use client';
import {useState} from 'react';
import {ArrowRight,LockKeyhole} from 'lucide-react';
export function AccountForm({register=false,promotion=false}:{register?:boolean;promotion?:boolean}){
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[created,setCreated]=useState(false);
 async function submit(event:React.FormEvent<HTMLFormElement>){
  event.preventDefault();if(busy)return;
  const values=new FormData(event.currentTarget),data=Object.fromEntries(values.entries());
  setBusy(true);setError('');
  try{
   const response=await fetch(register?'/api/auth/register':'/api/auth/credentials',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}),result=await response.json();
   if(!response.ok)throw new Error(result.error||'No se pudo completar el acceso.');
   if(register&&result.signedIn){window.location.assign('/cotizar');}
   else if(register){setCreated(true);event.currentTarget?.reset();}
   else window.location.assign(result.next==='/admin'?'/admin':'/cotizar');
  }catch(e){setError(e instanceof Error?e.message:'No se pudo conectar. Intenta nuevamente.');}finally{setBusy(false);}
 }
 if(created)return <div className="account-success" role="status"><h2>Tu cuenta está lista</h2><p>Accede con el User y Password que acabas de registrar para preparar tu primera propuesta.</p><a className="btn" href="/auth/login">Iniciar sesión <ArrowRight size={17}/></a></div>;
 return <form className="account-form" onSubmit={submit}>
  {register&&promotion&&<><input type="hidden" name="promotionCampaign" value="navidad-2026"/><p className="account-success">Tu cuenta nueva accederá al 20% de descuento en servicios para eventos del 30 de noviembre de 2026 al 2 de enero de 2027, ambos inclusive. La movilidad y el IGV se calculan después del descuento.</p></>}
  {register&&<label className="field"><span>Nombre visible *</span><input name="displayName" autoComplete="name" required maxLength={100}/></label>}
  <label className="field"><span>User *</span><input name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} required minLength={3} maxLength={80} pattern="[a-zA-Z0-9][a-zA-Z0-9_.@\-]{2,79}" aria-describedby="username-help"/><small id="username-help">Tu usuario de E&A Cotiza. Letras, números, punto, guion o @.</small></label>
  <label className="field"><span>Password *</span><input name="password" type="password" autoComplete={register?'new-password':'current-password'} required minLength={register?15:1} maxLength={128} aria-describedby={register?'password-help':undefined}/>{register&&<small id="password-help">Entre 15 y 128 caracteres. Puedes usar una frase larga y única.</small>}</label>
  {register&&<label className="field"><span>Confirmar Password *</span><input name="confirmation" type="password" autoComplete="new-password" required minLength={15} maxLength={128}/></label>}
  {error&&<p className="error" role="alert">{error}</p>}
  <button className="btn full" type="submit" disabled={busy}><LockKeyhole size={17}/>{busy?'Verificando…':register?'Crear cuenta':'Acceder'}</button>
  <p className="account-privacy">Esta contraseña pertenece a E&A Cotiza. Utiliza una distinta a la de tu correo.</p>
 </form>;
}

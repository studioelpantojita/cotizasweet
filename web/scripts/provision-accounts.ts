/** Owner-operated CLI. Credentials are only written to an ignored private artifact. */
import {resolve,join} from 'node:path';
import {mkdirSync,writeFileSync,existsSync,readFileSync,chmodSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {createAccount,getAccountByUsername,accountConfig} from '../server/accounts';
import {closeDatabase} from '../server/store';
async function main(){
 const root=resolve(fileURLToPath(new URL('../..',import.meta.url))),privateDir=join(root,'.local');
 mkdirSync(privateDir,{recursive:true,mode:0o700});
 const settings=JSON.parse(readFileSync(join(root,'local.settings.json'),'utf8').replace(/^\uFEFF/,''));
 const origin=`http://127.0.0.1:${settings.ports.web}`;
 process.env.DATABASE_PATH=join(root,'data','sessions.sqlite');
 Object.assign(process.env,{APP_ORIGIN:origin,NODE_ENV:'development',ACCOUNT_AUTH_ENABLED:'true',ACCOUNT_ISSUER:origin+'/accounts'});
 const configurationPath=join(privateDir,'accounts-settings.json');
 if(!existsSync(configurationPath))writeFileSync(configurationPath,JSON.stringify({jwtSecret:randomBytes(32).toString('hex')},null,2),{mode:0o600});
 const config=JSON.parse(readFileSync(configurationPath,'utf8'));process.env.ACCOUNT_JWT_SECRET=config.jwtSecret;accountConfig();
 const credentialPath=join(privateDir,'review-accounts.json');
 let accounts:Array<{username:string;password:string;role:string}>=[];
 if(existsSync(credentialPath))accounts=JSON.parse(readFileSync(credentialPath,'utf8')).accounts;
 for(const [username,displayName,role] of [['administrador','Administrador E&A Cotiza','admin'],['cliente_revision','Cliente de revisión','customer']] as const){
  const existing=getAccountByUsername(username);
  if(existing){if(existing.role!==role||!existing.active)throw new Error('La cuenta existente requiere revisión privada del propietario.');continue;}
  const password=randomBytes(24).toString('base64url');
  await createAccount(username,password,displayName,role);accounts.push({username,password,role});
 }
 writeFileSync(credentialPath,JSON.stringify({version:'2.3.0',origin,accounts},null,2),{mode:0o600});chmodSync(credentialPath,0o600);
 const escape=(value:string)=>value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
 const rows=accounts.map(account=>`<tr><td>${escape(account.role==='admin'?'Administrador':'Cliente')}</td><td><code>${escape(account.username)}</code></td><td><code>${escape(account.password)}</code></td></tr>`).join('');
 const html=`<!doctype html><html lang="es"><meta charset="utf-8"><title>Accesos privados · E&A Cotiza 2.3.0</title><style>body{font:16px system-ui;max-width:960px;margin:60px auto;padding:20px;color:#382533}h1{color:#62213f}table{border-collapse:collapse;width:100%}td,th{border:1px solid #d9c6cf;padding:16px;text-align:left}code{font-size:15px;overflow-wrap:anywhere}p{line-height:1.6}</style><h1>E&A Cotiza 2.3.0 · Accesos privados</h1><p>Documento privado generado para esta instalación. No lo subas a GitHub ni lo compartas junto al código.</p><p>Acceso: <a href="${origin}/auth/login">${origin}/auth/login</a>. Introduce User y Password; no se inicia sesión automáticamente.</p><table><thead><tr><th>Perfil</th><th>User</th><th>Password</th></tr></thead><tbody>${rows}</tbody></table><p>El administrador recibe las solicitudes en <a href="${origin}/admin">su bandeja</a>; el cliente guarda sus documentos en su propio historial. El correo externo no está configurado.</p><p>Puedes crear una cuenta propia desde «Crear mi cuenta». Para cambiar tu contraseña usa «Mi contraseña» en la plataforma. Estas claves de revisión son exclusivamente locales.</p></html>`;
 writeFileSync(join(privateDir,'ACCESOS-REVISION.html'),html,{mode:0o600});
 console.log('Cuentas locales verificadas. Accesos disponibles en .local/ACCESOS-REVISION.html; no se imprimieron contraseñas.');
 closeDatabase();
}
void main().catch(()=>{console.error('No se pudieron preparar las cuentas locales. Revisa la configuración privada.');process.exitCode=1;});

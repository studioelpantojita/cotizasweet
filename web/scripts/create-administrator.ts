/** Private owner operation on the production web database, never an HTTP endpoint. */
import {readFileSync} from 'node:fs';
import {isAbsolute} from 'node:path';
import {accountConfig,createAccount,getAccountByUsername} from '../server/accounts';
import {closeDatabase} from '../server/store';
async function main(){
 accountConfig();
 if(!process.env.DATABASE_PATH||!isAbsolute(process.env.DATABASE_PATH))throw new Error('Selecciona la base web mediante una ruta absoluta.');
 const username=process.env.ADMIN_USER,passwordFile=process.env.ADMIN_PASSWORD_FILE;
 if(!username||!passwordFile||!isAbsolute(passwordFile))throw new Error('Configura el usuario y la ruta privada de su contraseña.');
 if(getAccountByUsername(username))throw new Error('El usuario ya existe; no se modifica su rol ni contraseña.');
 const password=readFileSync(passwordFile,'utf8').replace(/\r?\n$/,'');
 await createAccount(username,password,process.env.ADMIN_DISPLAY_NAME||'Administrador E&A Cotiza','admin');
 console.log('Cuenta administrativa creada en la base web seleccionada. No se imprimieron credenciales.');
}
void main().catch(()=>{console.error('No se pudo crear el administrador. Revisa las variables privadas y la existencia de la cuenta.');process.exitCode=1;}).finally(()=>closeDatabase());

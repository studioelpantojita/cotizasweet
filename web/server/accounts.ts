import {randomBytes,randomUUID,scrypt,timingSafeEqual} from 'node:crypto';
import {SignJWT} from 'jose';
import {db,ownerKey} from './store';
import {appOrigin} from './config';
import {hasPromotionEnrollment} from './promotions';
import {promotionCampaignId} from '@/lib/promotion';

let activeDerivations=0;
const derive=(password:string,salt:Buffer,keyLength:number,options:{N:number;r:number;p:number;maxmem:number})=>new Promise<Buffer>((resolve,reject)=>{
 if(activeDerivations>=2){reject(new AccountError('Intenta nuevamente en unos instantes.',429));return;}
 activeDerivations++;
 scrypt(password,salt,keyLength,options,(error,key)=>{activeDerivations--;if(error)reject(error);else resolve(key);});
});
const N=65536,r=8,p=2,bytes=64;
export type AccountRole='admin'|'customer';
export type Account={id:string;username:string;displayName:string;role:AccountRole;active:boolean;authVersion:number;createdAt:string};
export class AccountError extends Error {constructor(message:string,readonly status=400){super(message);}}
export function accountsEnabled(){return process.env.ACCOUNT_AUTH_ENABLED==='true';}
export function accountConfig(){
 if(!accountsEnabled())throw new AccountError('El acceso con usuario y contraseña no está configurado.',503);
 const secret=process.env.ACCOUNT_JWT_SECRET||'',issuer=process.env.ACCOUNT_ISSUER||'';
 if(!/^[a-fA-F0-9]{64}$/.test(secret)||issuer!==appOrigin()+'/accounts')throw new AccountError('La configuración de cuentas debe ser revisada por el administrador.',503);
 return {key:Buffer.from(secret,'hex'),issuer,audience:'ea-cotiza-api'};
}
function schema(){
 db().exec(`CREATE TABLE IF NOT EXISTS accounts (
 id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, display_name TEXT NOT NULL,
 password_hash TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('admin','customer')),
 active INTEGER NOT NULL DEFAULT 1, auth_version INTEGER NOT NULL DEFAULT 1,
 failed_attempts INTEGER NOT NULL DEFAULT 0, locked_until INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL);`);
 return db();
}
export function normalizeUsername(value:unknown){
 if(typeof value!=='string')throw new AccountError('Completa User con 3 a 80 letras, números, puntos, guiones o @.');
 const username=value.trim().toLowerCase();
 if(!/^[a-z0-9][a-z0-9_.@-]{2,79}$/.test(username))throw new AccountError('User admite de 3 a 80 letras, números, puntos, guiones o @.');
 return username;
}
export function validatePassword(value:unknown):asserts value is string {
 if(typeof value!=='string'||[...value].length<15||[...value].length>128||Buffer.byteLength(value)>512)throw new AccountError('Password debe contener entre 15 y 128 caracteres.');
 if(/^(.)\1+$/.test(value)||['passwordpassword','123456789012345','contraseñacontraseña'].includes(value.toLowerCase()))throw new AccountError('Elige una contraseña menos predecible.');
}
export async function hashPassword(password:string){
 validatePassword(password);const salt=randomBytes(32);
 const hash=await derive(password,salt,bytes,{N,r,p,maxmem:128*1024*1024}) as Buffer;
 return `scrypt$${N}$${r}$${p}$${salt.toString('hex')}$${hash.toString('hex')}`;
}
export async function checkPassword(password:string,encoded:string){
 const parts=encoded.split('$');
 if(parts.length!==6||parts[0]!=='scrypt'||Number(parts[1])!==N||Number(parts[2])!==r||Number(parts[3])!==p||!/^[a-f0-9]{64}$/.test(parts[4])||!/^[a-f0-9]{128}$/.test(parts[5]))return false;
 const actual=await derive(password,Buffer.from(parts[4],'hex'),bytes,{N,r,p,maxmem:128*1024*1024}) as Buffer;
 return timingSafeEqual(actual,Buffer.from(parts[5],'hex'));
}
function publicAccount(row:Record<string,unknown>):Account {return {id:String(row.id),username:String(row.username),displayName:String(row.display_name),role:row.role==='admin'?'admin':'customer',active:row.active===1,authVersion:Number(row.auth_version),createdAt:String(row.created_at)};}
export function getAccount(id:string):Account|null {const row=schema().prepare('SELECT id,username,display_name,role,active,auth_version,created_at FROM accounts WHERE id=?').get(id);return row?publicAccount(row):null;}
export function accountExists(username:string){return !!schema().prepare('SELECT id FROM accounts WHERE username=?').get(normalizeUsername(username));}
export function getAccountByUsername(username:string):Account|null {const row=schema().prepare('SELECT id,username,display_name,role,active,auth_version,created_at FROM accounts WHERE username=?').get(normalizeUsername(username));return row?publicAccount(row):null;}
export function listAccounts():Account[]{return schema().prepare('SELECT id,username,display_name,role,active,auth_version,created_at FROM accounts ORDER BY created_at DESC LIMIT 200').all().map(publicAccount);}
export async function createAccount(username:unknown,password:unknown,displayName:unknown,role:AccountRole='customer',onCreated?:(id:string)=>void){
 const name=normalizeUsername(username);validatePassword(password);
 if(role!=='admin'&&role!=='customer')throw new AccountError('Rol inválido.');
 const display=typeof displayName==='string'?displayName.trim():'';
 if(!display||[...display].length>100||/[\u0000-\u001f\u007f]/.test(display))throw new AccountError('El nombre visible es obligatorio y admite hasta 100 caracteres.');
 const encoded=await hashPassword(password),id=randomUUID(),createdAt=new Date().toISOString();
 const connection=schema();connection.exec('BEGIN IMMEDIATE');
 try{connection.prepare('INSERT INTO accounts(id,username,display_name,password_hash,role,created_at) VALUES (?,?,?,?,?,?)').run(id,name,display,encoded,role,createdAt);onCreated?.(id);connection.exec('COMMIT');}catch(e){connection.exec('ROLLBACK');if(String(e).includes('UNIQUE'))throw new AccountError('No se pudo registrar ese usuario. Elige otro User.',409);throw e;}
 return getAccount(id)!;
}
let concurrentChecks=0;
const dummy=`scrypt$${N}$${r}$${p}$${'a'.repeat(64)}$${'b'.repeat(128)}`;
export async function authenticateAccount(username:unknown,password:unknown):Promise<Account|null>{
 let name='';try{name=normalizeUsername(username);}catch{}
 if(typeof password!=='string'||Buffer.byteLength(password)>512||concurrentChecks>=2)throw new AccountError('Intenta nuevamente en unos instantes.',429);
 concurrentChecks++;
 try{
  const row=schema().prepare('SELECT * FROM accounts WHERE username=?').get(name);
  const locked=!!row&&(Number(row.locked_until)>Date.now()||row.active!==1);
  const valid=await checkPassword(password,row?String(row.password_hash):dummy);
  if(!row||locked||!valid){
   if(row&&!locked)schema().prepare('UPDATE accounts SET failed_attempts=failed_attempts+1,locked_until=CASE WHEN failed_attempts+1>=10 THEN ? ELSE 0 END WHERE id=?').run(Date.now()+15*60*1000,String(row.id));
   return null;
  }
  schema().prepare('UPDATE accounts SET failed_attempts=0,locked_until=0 WHERE id=?').run(String(row.id));
  return publicAccount(row);
 }finally{concurrentChecks--;}
}
export function disableAccount(id:string){schema().prepare('UPDATE accounts SET active=0,auth_version=auth_version+1 WHERE id=?').run(id);}
export async function changePassword(id:string,password:unknown){validatePassword(password);const encoded=await hashPassword(password);schema().prepare('UPDATE accounts SET password_hash=?,auth_version=auth_version+1,failed_attempts=0,locked_until=0 WHERE id=?').run(encoded,id);}
export async function accountSession(account:Account){
 const config=accountConfig(),ttl=3600,scopes=['quotes:read','quotes:write'];
 const token=await new SignJWT({scope:scopes.join(' '),role:account.role,...(account.role==='customer'&&hasPromotionEnrollment(account.id)?{promotion:promotionCampaignId}:{})})
  .setProtectedHeader({alg:'HS256',typ:'JWT'}).setIssuer(config.issuer).setAudience(config.audience)
  .setSubject(account.id).setIssuedAt().setExpirationTime(`${ttl}s`).setJti(randomUUID()).sign(config.key);
 return {ttl,session:{owner:ownerKey(config.issuer,account.id),displayName:account.displayName,accessToken:token,scopes,role:account.role,accountId:account.id,authVersion:account.authVersion}};
}

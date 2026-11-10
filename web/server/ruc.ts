import {isValidRuc,clientDocumentType} from '@/lib/identity';
import {rucIdentitySchema,type Quote} from '@/lib/quote';
import {serviceBaseUrl} from './config';
export class RucError extends Error {constructor(message:string,public status=503){super(message);}}
export async function lookupRuc(ruc:string){
 if(!isValidRuc(ruc))throw new RucError('Ingresa un RUC válido, incluido su dígito verificador.',400);
 const secret=process.env.INTEGRATION_SERVICE_KEY||'';
 if(secret.length<32)throw new RucError('La consulta RUC no está configurada en el servidor.');
 const base=process.env.API_BACKEND==='dotnet'?process.env.API_BASE_URL:process.env.RUC_SERVICE_URL;
 let url:URL;
 try{url=new URL('/api/clients/ruc/'+ruc,serviceBaseUrl(base||'http://127.0.0.1:8001'));}catch{throw new RucError('La URL del servicio RUC no es válida o requiere HTTPS.');}
 try{
  const response=await fetch(url,{headers:{'X-Service-Key':secret},cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000)});
  const data=await response.json();
  if(!response.ok)throw new RucError(typeof data.error==='string'?data.error:'No se pudo consultar el RUC.',[400,404,429].includes(response.status)?response.status:503);
  const parsed=rucIdentitySchema.safeParse(data);
  if(!parsed.success||parsed.data.ruc!==ruc)throw new RucError('La fuente devolvió una respuesta RUC incongruente.');
  return parsed.data;
 }catch(e){if(e instanceof RucError)throw e;throw new RucError('La consulta RUC no está disponible. Vuelve a intentarlo.');}
}
export async function verifyIdentity(quote:Quote):Promise<Quote>{
 const documentType=clientDocumentType(quote);
 if(documentType!=='ruc')return {...quote,documentType,clientLookup:undefined};
 const clientLookup=await lookupRuc(quote.clientDocument);
 if(quote.client.trim()!==clientLookup.legalName)throw new RucError('El nombre no coincide con el RUC. Vuelve a consultar el documento.',400);
 return {...quote,documentType,client:clientLookup.legalName,clientLookup};
}

import {apiUrl,backend} from '@/server/config';
import {localCatalog} from '@/server/catalog-store';
import {publicCatalog} from '@/lib/commercial-catalog';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(){
 try{
  if(backend()==='next')return Response.json(localCatalog(),{headers:{'Cache-Control':'no-store'}});
  const response=await fetch(new URL('/api/catalog',apiUrl()),{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(8000)});
  if(!response.ok)throw new Error('Catálogo no disponible');
  // Reject oversized upstream responses before parsing or forwarding data.
  const reader=response.body?.getReader();if(!reader)throw new Error('Respuesta vacía');
  const chunks:Uint8Array[]=[];let size=0;
  for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>300000){await reader.cancel();throw new Error('Límite excedido');}chunks.push(value);}
  return Response.json(publicCatalog(JSON.parse(Buffer.concat(chunks).toString('utf8'))),{headers:{'Cache-Control':'no-store'}});
 }catch{return Response.json({error:'No pudimos cargar el catálogo. Inténtalo nuevamente.'},{status:503,headers:{'Cache-Control':'no-store'}});}
}

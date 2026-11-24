import {getSession} from '@/server/session';
import {getSubmission,archivedDocument,documentResponse} from '@/server/submissions';
import {takeRateLimit} from '@/server/rate-limit';
export const runtime='nodejs';
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
 try{
  const session=await getSession();if(!session)return Response.json({error:'Inicia sesión.'},{status:401});
  if(session.role!=='admin')return Response.json({error:'Acceso reservado al administrador.'},{status:403,headers:{'Cache-Control':'no-store'}});
  const limit=takeRateLimit('admin:documents:'+session.owner,60,60);
  if(!limit.allowed)return Response.json({error:'Intenta más tarde.'},{status:429,headers:{'Retry-After':String(limit.retryAfter)}});
  const submission=getSubmission((await params).id),document=submission?archivedDocument(submission.owner,submission.quoteId):null;
  return document?documentResponse(document):Response.json({error:'Documento no encontrado.'},{status:404,headers:{'Cache-Control':'no-store'}});
 }catch{return Response.json({error:'No se pudo recuperar el documento.'},{status:503,headers:{'Cache-Control':'no-store'}});}
}

import {cookies} from 'next/headers';
import {NextResponse} from 'next/server';
import {appOrigin,sameOrigin} from '@/server/config';
import {cookieName,cookieOptions} from '@/server/session';
import {deleteState} from '@/server/store';
export async function POST(request:Request){
  if(!sameOrigin(request))return NextResponse.json({error:'Origen no permitido.'},{status:403});
  const jar=await cookies(),id=jar.get(cookieName())?.value;if(id)deleteState(id);
  const response=new NextResponse('<!doctype html><html lang="es"><meta charset="utf-8"><title>Sesión cerrada</title><script>sessionStorage.removeItem("ea-pastry-draft");location.replace("/")</script><p>Sesión cerrada. <a href="/">Volver al inicio</a></p></html>',{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}});
  response.cookies.set(cookieName(),'',cookieOptions(0));return response;
}

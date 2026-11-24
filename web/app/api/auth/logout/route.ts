import {cookies} from 'next/headers';
import {NextResponse} from 'next/server';
import {sameOrigin} from '@/server/config';
import {cookieName,cookieOptions} from '@/server/session';
import {deleteState} from '@/server/store';
import {logoutScript} from '@/server/security-headers';
export async function POST(request:Request){
  if(!sameOrigin(request))return NextResponse.json({error:'Origen no permitido.'},{status:403});
  const jar=await cookies(),id=jar.get(cookieName())?.value;if(id)deleteState(id);
  for(const kind of ['guest','promotion']){const old=jar.get(cookieName(kind))?.value;if(old)deleteState(old);}
  const response=new NextResponse(`<!doctype html><html lang="es"><meta charset="utf-8"><title>Sesión cerrada</title><script>${logoutScript}</script><p>Sesión cerrada. <a href="/">Volver al inicio</a></p></html>`,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}});
  for(const kind of ['session','guest','promotion'])response.cookies.set(cookieName(kind),'',cookieOptions(0));return response;
}

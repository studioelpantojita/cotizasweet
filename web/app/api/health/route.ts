export const dynamic='force-dynamic';
export function GET(){return Response.json({status:'ok',version:'2.2.0'},{headers:{'Cache-Control':'no-store'}});}

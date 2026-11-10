export function appOrigin() {
  const url = new URL(process.env.APP_ORIGIN || 'http://localhost:3000');
  if (url.pathname !== '/' || url.search || url.hash || url.username || url.password) throw new Error('APP_ORIGIN debe ser un origen.');
  if (url.protocol !== 'https:' && !(process.env.NODE_ENV !== 'production' && ['localhost','127.0.0.1'].includes(url.hostname))) throw new Error('Se requiere HTTPS.');
  return url.origin;
}
export function backend() {
  const value = process.env.API_BACKEND || 'next';
  if (!['next','dotnet','python'].includes(value)) throw new Error('API_BACKEND inválido.');
  return value;
}
export function apiUrl() {
  const url = serviceBaseUrl(process.env.API_BASE_URL || 'http://127.0.0.1:8000');
  return new URL('/api/quotes', url);
}
export function serviceBaseUrl(value:string) {
  const url=new URL(value);
  const internal=['localhost','127.0.0.1','api-python','api-dotnet','api-python.railway.internal','api-dotnet.railway.internal'];
  if(url.username||url.password||url.search||url.hash||url.pathname!=='/'||url.port==='0')throw new Error('La URL del servicio debe ser un origen sin credenciales.');
  if(url.protocol!=='https:'&&!(url.protocol==='http:'&&internal.includes(url.hostname)))throw new Error('El servicio remoto requiere HTTPS.');
  return url;
}
export function sameOrigin(request: Request) {
  return request.headers.get('origin') === appOrigin() && request.headers.get('sec-fetch-site') !== 'cross-site';
}

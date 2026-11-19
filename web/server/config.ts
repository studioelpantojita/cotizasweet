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
export function oidcProvider() {
  const provider=process.env.OIDC_PROVIDER||'standard';
  if(provider!=='standard'&&provider!=='google')throw new Error('OIDC_PROVIDER inválido.');
  if(provider==='google'){
    const issuer=new URL(process.env.OIDC_ISSUER||'');
    const local=process.env.NODE_ENV!=='production'&&process.env.OIDC_ALLOW_LOCAL_HTTP==='true'&&
      issuer.protocol==='http:'&&['localhost','127.0.0.1'].includes(issuer.hostname);
    if(!local&&process.env.OIDC_ISSUER!=='https://accounts.google.com')throw new Error('El perfil Google requiere su emisor oficial.');
    if(!local&&!/^[A-Za-z0-9_-]+\.apps\.googleusercontent\.com$/.test(process.env.OIDC_CLIENT_ID||''))
      throw new Error('Configura el cliente OAuth web de Google.');
    if(!process.env.OIDC_CLIENT_ID||process.env.OIDC_AUDIENCE!==process.env.OIDC_CLIENT_ID)
      throw new Error('La audiencia de Google debe coincidir con el cliente OAuth.');
  }
  return provider;
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

export function sameOriginRucRequest(request: Request) {
  const origin = appOrigin();
  const claimedOrigin = request.headers.get('origin');
  const site = request.headers.get('sec-fetch-site');
  // A cross-origin browser cannot set the custom header without CORS permission.
  return request.headers.get('x-cotiza-request') === 'ruc' &&
    (claimedOrigin === null || claimedOrigin === origin) &&
    (site === null || site === 'same-origin');
}

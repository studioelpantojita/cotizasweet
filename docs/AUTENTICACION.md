# OAuth2 y OpenID Connect

OIDC identifica a la persona que inicia sesión. OAuth2 proporciona los permisos para llamar al API. Se usa el flujo **Authorization Code con PKCE S256** desde un cliente web confidencial en Next.js.

La configuración de despliegue de E&A Cotiza **2.2.0** usa **Google** como proveedor principal. Sigue [GOOGLE.md](GOOGLE.md) para registrar el cliente web, elegir la audiencia, configurar las variables y aceptar la integración con cuentas reales. El perfil `OIDC_PROVIDER=google` solicita únicamente `openid profile email`; su audiencia debe ser el mismo `OIDC_CLIENT_ID` terminado en `.apps.googleusercontent.com` y su emisor de producción es `https://accounts.google.com`.

## Registro en otro proveedor OIDC (`standard`)

1. Configura `OIDC_PROVIDER=standard` y crea una aplicación web confidencial con Authorization Code. Desactiva implicit grant y password grant para este cliente.
2. Registra la URL de retorno exacta: el `APP_ORIGIN` efectivo seguido de `/auth/callback`. Por ejemplo, `http://127.0.0.1:3350/auth/callback` para la instancia local actual y `https://TU-DOMINIO/auth/callback` en producción.
3. Habilita PKCE S256 y los scopes `openid profile email quotes:read quotes:write`.
4. Para las APIs .NET/Python, define un recurso API con audiencia `ea-cotiza-api`. El access token debe ser JWT firmado con **RS256** y tener `iss`, `aud`, `sub`, `iat`, `exp` y scopes en `scope` o `scp`.
5. Autoriza al cliente web a pedir esos scopes. Conforme a RFC 6749 §5.1, el token endpoint puede omitir `scope` cuando coincide con lo solicitado; si difiere, debe informarlo. La aplicación intersecta los permisos solicitados con los concedidos y solo admite `quotes:read` y `quotes:write`. Un `scope` explícitamente vacío no concede permisos.
6. Copia emisor, client ID y client secret a `.env`. Usa un secreto de sesión propio de 32 bytes aleatorios, codificado como 64 caracteres hexadecimales.

`OIDC_ISSUER` debe coincidir exactamente con `issuer` del documento de descubrimiento. En el perfil estándar, las variantes externas usan `OIDC_AUDIENCE` como audiencia esperada del access token. Next.js también lo envía como parámetro `audience` en la autorización: si tu proveedor no utiliza ese parámetro, configura el recurso/audience mapper del lado del proveedor. Por ejemplo, un realm de Keycloak debe emitir la audiencia del API mediante su configuración de cliente/scopes. El perfil Google utiliza la audiencia del cliente OAuth y omite ese parámetro de autorización adicional.

Cuando el perfil estándar omite `scope`, se conserva el conjunto solicitado de la transacción como referencia del fallback RFC. Con `API_BACKEND=next`, la sesión además exige un access token JWT **RS256** verificable por JWKS, con emisor, audiencia, `sub`, `iat` y `exp` válidos, y sujeto igual al del ID token. Los permisos efectivos quedan limitados también por `scope` o `scp` de ese JWT; un token sin permisos verificables no obtiene permisos de cotización. Con .NET o Python, el backend valida la firma, identidad y permisos del JWT en cada petición y conserva la autoridad de autorización, aunque la sesión haya aplicado el fallback.

El cliente utiliza el método de autenticación por secreto soportado por `openid-client` para la configuración usada. Valida con tu proveedor antes de pasar a producción; los tokens opacos, algoritmos distintos de RS256 en las APIs externas o proveedores con parámetros especiales requieren adaptar la integración.

## Variables

| Variable | Uso |
|---|---|
| `APP_ORIGIN` | Origen público exacto de la web; HTTPS en producción |
| `API_BACKEND` | `next`, `dotnet` o `python` |
| `API_BASE_URL` | Base de la API elegida, solo accesible desde el servidor |
| `OIDC_PROVIDER` | `google` en el despliegue preparado; `standard` para otro proveedor o el emisor local de pruebas |
| `OIDC_ISSUER` | Emisor OIDC con descubrimiento y JWKS |
| `OIDC_CLIENT_ID` | Identificador del cliente confidencial web |
| `OIDC_CLIENT_SECRET` | Secreto del cliente, solo en servidor |
| `OIDC_AUDIENCE` | Google: mismo client ID web; estándar: audiencia del recurso API |
| `OIDC_SCOPE` | Google: `openid profile email`; estándar: incluir `openid quotes:read quotes:write` |
| `SESSION_SECRET` | Clave AES-256 para sesiones y transacciones almacenadas |
| `DATABASE_PATH` | Archivo SQLite del proceso; el lanzador asigna uno por servicio |
| `OIDC_ALLOW_LOCAL_HTTP` | Solo `true` para un emisor local en desarrollo |

Nunca uses variables `NEXT_PUBLIC_*` para secretos o tokens. El paquete no confía en cabeceras `oai-authenticated-*`, `X-User-Id` ni identificadores enviados en el formulario.

## Sesión y permisos

- `state`, `nonce` y verificador PKCE son diferentes en cada inicio; la transacción se conserva diez minutos y solo puede consumirse una vez.
- Se comprueba el ID token usando `openid-client`, incluyendo su firma mediante las comprobaciones de no repudio.
- En Google se comprueban emisor, audiencia, caducidad, sujeto y `email_verified=true`; si aparece `azp`, debe identificar al cliente web, y una audiencia múltiple exige ese cliente autorizado. Los backends .NET/Python repiten las comprobaciones de identidad al recibir el token.
- La cookie contiene un identificador aleatorio; `HttpOnly`, `SameSite=Lax` y `Secure` con prefijo `__Host-` al usar HTTPS.
- La credencial para la API se guarda cifrada con AES-256-GCM en SQLite. En el perfil estándar es el access token; en Google es el ID token firmado, usado como Bearer en las llamadas internas al backend seleccionado. El ID de sesión se almacena como hash.
- Google acredita la identidad; E&A Cotiza asigna a esa identidad `quotes:read` y `quotes:write` exclusivamente para su historial propio. Estos son permisos internos de la plataforma. El propietario deriva del par emisor/sujeto verificado y no del correo ni de un identificador del formulario.
- La sesión dura como máximo una hora, limitada también por la duración informada del token y por la caducidad del ID token. No se solicitan refresh tokens; al vencer se inicia sesión de nuevo.
- El guardado y el cierre de sesión exigen el origen configurado, además de la sesión. Las APIs externas usan Bearer y no habilitan CORS para acceso directo desde el navegador.
- Cerrar sesión elimina la sesión local y el borrador de esa pestaña. No cierra la sesión general del proveedor de identidad.
- El borrador del formulario permanece en `sessionStorage` de la pestaña mientras se trabaja, como en la versión original; no contiene tokens de autenticación.

## Pruebas

`tests/integration.py` inicia un emisor OIDC local de prueba con una clave RSA efímera. Prueba la redirección real, el intercambio de código con PKCE, las cookies, el guardado y la consulta a los tres backends. El emisor de prueba se apaga al terminar y no persiste claves ni cuentas.

`tests/integration.py --provider google --backend all` utiliza un emisor local sintético con las condiciones del perfil Google; no realiza un inicio de sesión contra Google. El acta de la versión debe identificar las pruebas efectivamente ejecutadas y sus resultados.

La aceptación final con el proveedor elegido requiere el cliente registrado, callback exacto, permisos, audiencia, certificados, política de sesiones y recorridos con cuentas reales. La instancia local actual utiliza el proveedor RUC de demostración; la consulta real a Decolecta requiere configurar y validar una credencial vigente por separado. El éxito con emisores o datos sintéticos no acredita estas integraciones externas.

La entrega 2.2.0 permanece local. Su publicación en GitHub y la ejecución de su CI remota quedan pendientes de aprobación expresa del propietario.

## Referencias técnicas

- Next.js: https://nextjs.org/docs/app/guides/authentication
- Patrón Backend for Frontend: https://nextjs.org/docs/app/guides/backend-for-frontend
- Cliente OIDC y ejemplo: https://github.com/panva/openid-client/blob/main/examples/oidc.ts
- ASP.NET Core JWT Bearer: https://learn.microsoft.com/en-us/aspnet/core/security/authentication/configure-jwt-bearer-authentication?view=aspnetcore-10.0
- PyJWT y claves JWKS: https://pyjwt.readthedocs.io/en/latest/usage.html

La guía [GOOGLE.md](GOOGLE.md) reúne las referencias específicas de Google. Las versiones exactas instaladas se conservan en los archivos de bloqueo.

## Arranque desde Visual Studio

El lanzador usa un emisor efímero y una URL de retorno en 127.0.0.1. Por defecto utiliza los puertos **9340 para identidad y 3340 para web**; ambos se adaptan a `ports.identity` y `ports.web` de `local.settings.json`. En esta copia se usan **9350 y 3350**, respectivamente, para evitar conflictos con otras instancias. «Iniciar sesión» entra automáticamente en una cuenta local compartida para las pruebas; no abre Google ni pide una contraseña real. El lanzador selecciona `OIDC_PROVIDER=standard` para este emisor. Al reiniciar cambia la clave de sesión, por lo que se debe volver a iniciar sesión. Este emisor solo se ejecuta en desarrollo y no sustituye la aceptación del proveedor real para producción.

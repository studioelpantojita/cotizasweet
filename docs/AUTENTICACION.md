# OAuth2 y OpenID Connect

OIDC identifica a la persona que inicia sesión. OAuth2 proporciona los permisos para llamar al API. Se usa el flujo **Authorization Code con PKCE S256** desde un cliente web confidencial en Next.js.

## Registro en el proveedor

1. Crea una aplicación web confidencial con Authorization Code. Desactiva implicit grant y password grant para este cliente.
2. Registra la URL de retorno exacta: `http://localhost:3000/auth/callback` en desarrollo y `https://TU-DOMINIO/auth/callback` en producción.
3. Habilita PKCE S256 y los scopes `openid profile email quotes:read quotes:write`.
4. Para las APIs .NET/Python, define un recurso API con audiencia `ea-cotiza-api`. El access token debe ser JWT firmado con **RS256** y tener `iss`, `aud`, `sub`, `iat`, `exp` y scopes en `scope` o `scp`.
5. Autoriza al cliente web a pedir esos scopes. El token endpoint debe informar los scopes concedidos en el campo `scope`; la aplicación no los presume si faltan.
6. Copia emisor, client ID y client secret a `.env`. Usa un secreto de sesión propio de 32 bytes aleatorios, codificado como 64 caracteres hexadecimales.

`OIDC_ISSUER` debe coincidir exactamente con `issuer` del documento de descubrimiento. Las variantes externas usan `OIDC_AUDIENCE` como audiencia esperada. Next.js también lo envía como parámetro `audience` en la autorización: si tu proveedor no utiliza ese parámetro, configura el recurso/audience mapper del lado del proveedor. Por ejemplo, un realm de Keycloak debe emitir la audiencia del API mediante su configuración de cliente/scopes.

El cliente utiliza el método de autenticación por secreto soportado por `openid-client` para la configuración usada. Valida con tu proveedor antes de pasar a producción; los tokens opacos, algoritmos distintos de RS256 en las APIs externas o proveedores con parámetros especiales requieren adaptar la integración.

## Variables

| Variable | Uso |
|---|---|
| `APP_ORIGIN` | Origen público exacto de la web; HTTPS en producción |
| `API_BACKEND` | `next`, `dotnet` o `python` |
| `API_BASE_URL` | Base de la API elegida, solo accesible desde el servidor |
| `OIDC_ISSUER` | Emisor OIDC con descubrimiento y JWKS |
| `OIDC_CLIENT_ID` | Identificador del cliente confidencial web |
| `OIDC_CLIENT_SECRET` | Secreto del cliente, solo en servidor |
| `OIDC_AUDIENCE` | Audiencia del recurso API |
| `OIDC_SCOPE` | Scopes solicitados, incluyendo los dos permisos de cotización |
| `SESSION_SECRET` | Clave AES-256 para sesiones y transacciones almacenadas |
| `DATABASE_PATH` | Archivo SQLite del proceso; el lanzador asigna uno por servicio |
| `OIDC_ALLOW_LOCAL_HTTP` | Solo `true` para un emisor local en desarrollo |

Nunca uses variables `NEXT_PUBLIC_*` para secretos o tokens. El paquete no confía en cabeceras `oai-authenticated-*`, `X-User-Id` ni identificadores enviados en el formulario.

## Sesión y permisos

- `state`, `nonce` y verificador PKCE son diferentes en cada inicio; la transacción se conserva diez minutos y solo puede consumirse una vez.
- Se comprueba el ID token usando `openid-client`, incluyendo su firma mediante las comprobaciones de no repudio.
- La cookie contiene un identificador aleatorio; `HttpOnly`, `SameSite=Lax` y `Secure` con prefijo `__Host-` al usar HTTPS.
- El access token se guarda cifrado con AES-256-GCM en SQLite. El ID de sesión se almacena como hash.
- La sesión dura como máximo una hora, limitada también por la duración del access token. No se solicitan refresh tokens; al vencer se inicia sesión de nuevo.
- El guardado y el cierre de sesión exigen el origen configurado, además de la sesión. Las APIs externas usan Bearer y no habilitan CORS para acceso directo desde el navegador.
- Cerrar sesión elimina la sesión local y el borrador de esa pestaña. No cierra la sesión general del proveedor de identidad.
- El borrador del formulario permanece en `sessionStorage` de la pestaña mientras se trabaja, como en la versión original; no contiene tokens de autenticación.

## Pruebas

`tests/integration.py` inicia un emisor OIDC local de prueba con una clave RSA efímera. Prueba la redirección real, el intercambio de código con PKCE, las cookies, el guardado y la consulta a los tres backends. El emisor de prueba se apaga al terminar y no persiste claves ni cuentas.

La aceptación final con el proveedor contratado requiere tus valores reales: URL de callback registrada, scopes concedidos, audiencia, certificados y política de sesiones. Esta observación se refiere al proveedor de identidad OIDC. La consulta RUC sí utiliza la credencial Decolecta configurada localmente.

## Referencias técnicas

- Next.js: https://nextjs.org/docs/app/guides/authentication
- Patrón Backend for Frontend: https://nextjs.org/docs/app/guides/backend-for-frontend
- Cliente OIDC y ejemplo: https://github.com/panva/openid-client/blob/main/examples/oidc.ts
- ASP.NET Core JWT Bearer: https://learn.microsoft.com/en-us/aspnet/core/security/authentication/configure-jwt-bearer-authentication?view=aspnetcore-10.0
- PyJWT y claves JWKS: https://pyjwt.readthedocs.io/en/latest/usage.html

Referencias consultadas el 10 de octubre de 2026 (UTC). Las versiones exactas instaladas se conservan en los archivos de bloqueo.

## Arranque desde Visual Studio

El lanzador usa un emisor efímero y una URL de retorno en 127.0.0.1. Por defecto utiliza los puertos 9000 para identidad y 3000 para web; ambos se adaptan a `ports.identity` y `ports.web` de `local.settings.json`. En este ordenador se usan 9100 y 3100 para evitar conflictos con otra copia. «Iniciar sesión» entra en una cuenta local compartida para las pruebas. Al reiniciar cambia la clave de sesión, por lo que se debe volver a iniciar sesión. Este emisor solo se ejecuta en desarrollo y no sustituye al proveedor OIDC real para producción.

# Inicio de sesión con Google

Guía de configuración de E&A Cotiza 2.2.0, revisada el 18 de noviembre de 2026. El perfil `OIDC_PROVIDER=google` usa el flujo de código de autorización con PKCE S256 y un cliente OAuth de tipo **Web application**. La web valida la identidad, crea la sesión cifrada y asigna acceso al historial propio de esa persona. [OpenID Connect de Google](https://developers.google.com/identity/openid-connect/openid-connect).

## Elegir la cuenta y la audiencia

El propietario puede administrar el proyecto desde su cuenta personal de Google. Para permitir que otras personas prueben o utilicen E&A Cotiza, selecciona **External** en Google Auth Platform. Si la consola ofrece **Personal**, esa modalidad permite el acceso exclusivamente a la cuenta creadora y es una elección permanente para ese proyecto. Un proyecto asociado a una organización de Google Cloud puede elegir **Internal** para sus integrantes. [Audiencia de aplicaciones](https://support.google.com/cloud/answer/15549945?hl=en).

Una cuenta de Google Workspace puede administrar una aplicación External y recibir restricciones del administrador de su organización. Verifica la política de acceso de esa cuenta cuando aparezca un bloqueo de autorización. La configuración Internal requiere que los usuarios pertenezcan a la organización correspondiente. [Estados de OAuth y controles de Workspace](https://developers.google.com/identity/protocols/oauth2/production-readiness/overview).

## Registrar el cliente web

1. Abre Google Cloud Console con la cuenta propietaria y crea o selecciona el proyecto del entorno que vas a configurar. Mantén proyectos distintos para pruebas y para el servicio público cuando corresponda a las políticas de Google.
2. En **Google Auth Platform → Branding**, registra el nombre **E&A Cotiza**, el correo de soporte y los datos de contacto del responsable. Completa las páginas y los dominios que solicite la consola con información publicada y controlada por el propietario.
3. En **Audience**, configura la audiencia elegida. Para la fase de pruebas External, utiliza **Testing** y registra las cuentas de ensayo que vaya a mostrar la consola. Google aplica una excepción de lista de usuarios y caducidad de siete días cuando se solicitan únicamente `openid`, `profile` y `email`.
4. En **Data Access**, selecciona los permisos de identidad que equivalen a `openid profile email`. Estos permiten identificar la cuenta y obtener el correo y el perfil básico que Google entregue.
5. En **Clients**, crea un cliente con tipo **Web application**. Registra en **Authorized redirect URIs** el origen de la web seguido de `/auth/callback`. La coincidencia debe ser exacta, incluidos esquema, dominio, puerto y ruta.
6. Copia el **Client ID** terminado en `.apps.googleusercontent.com` y guarda el **Client secret** directamente en el gestor de secretos del alojamiento. Conserva la copia privada del secreto al crearlo, conforme a la pantalla de Google.

Las opciones de audiencia y sus excepciones se consultan en la ayuda de Google. Los campos de creación del cliente y la protección del secreto se describen en la guía del flujo web. [Audiencia](https://support.google.com/cloud/answer/15549945?hl=en), [cliente web y redirecciones](https://developers.google.com/identity/protocols/oauth2/web-server).

Para un origen de ejemplo `https://cotiza.tu-dominio.example`, registra `https://cotiza.tu-dominio.example/auth/callback`. Sustituye ambos valores por el origen efectivo del entorno. El cliente servidor de esta aplicación usa la URL de retorno. Si configuras también **Authorized JavaScript origins**, escribe el origen exacto de la web, sin la ruta del callback. En pruebas locales, Google admite direcciones loopback y el puerto debe coincidir con la instancia que se ejecute. [Validación de redirecciones OAuth web](https://developers.google.com/identity/protocols/oauth2/web-server#uri-validation).

## Configurar los servicios

Introduce los siguientes valores reales en la configuración privada del entorno. El bloque ilustra los nombres esperados y utiliza marcadores que el operador debe sustituir.

```dotenv
APP_ORIGIN=https://cotiza.tu-dominio.example
OIDC_PROVIDER=google
OIDC_ISSUER=https://accounts.google.com
OIDC_CLIENT_ID=REEMPLAZAR-POR-EL-CLIENT-ID.apps.googleusercontent.com
OIDC_CLIENT_SECRET=REEMPLAZAR-EN-EL-GESTOR-DE-SECRETOS
OIDC_AUDIENCE=REEMPLAZAR-POR-EL-MISMO-CLIENT-ID.apps.googleusercontent.com
OIDC_SCOPE=openid profile email
OIDC_ALLOW_LOCAL_HTTP=false
```

`OIDC_AUDIENCE` debe ser idéntico al `OIDC_CLIENT_ID` completo. La web y el backend de cotizaciones seleccionado deben compartir `OIDC_PROVIDER`, `OIDC_ISSUER` y `OIDC_AUDIENCE`. El secreto del cliente se configura en el servidor web que realiza el intercambio de código. El servicio Python dedicado exclusivamente a RUC utiliza su clave de integración entre servicios.

El perfil Google solicita los tres permisos básicos y valida el ID token firmado de Google, su emisor, audiencia, expiración, sujeto y correo verificado. La web conserva ese token cifrado en la sesión para las llamadas internas al backend seleccionado. La aplicación concede `quotes:read` y `quotes:write` a esa identidad validada para operar sus propias cotizaciones. La clave de propietario deriva del emisor y del sujeto del token.

`SESSION_SECRET` e `INTEGRATION_SERVICE_KEY` se generan por separado según `.env.example`. Introduce credenciales y claves en los campos privados del proveedor o en archivos locales excluidos del control de versiones. El cliente web conserva el secreto en el servidor. [Protección de credenciales y tokens](https://developers.google.com/identity/protocols/oauth2/policies#secure-response-handling).

## Preparar el despliegue

1. Confirma el origen HTTPS que servirá E&A Cotiza y su callback registrado en el cliente web del mismo entorno.
2. Completa el aviso de privacidad con la identidad del responsable, finalidades, datos conservados, contacto y política de retención que corresponda al servicio. Incluye los datos de las cotizaciones, como documento, correo y teléfono, que la aplicación permite guardar.
3. Publica las páginas solicitadas por Google bajo dominios que el propietario pueda verificar. Configura la marca aprobada y atiende las comprobaciones de **Verification Center** aplicables a esa cuenta y al estado de la aplicación.
4. Reinicia los servicios tras guardar las variables y ejecuta el preflight operativo con la configuración privada del despliegue.

Los permisos de este perfil se limitan a la identidad y el perfil básico de Google. El gestor debe mantener alineados los permisos declarados y el uso que la aplicación hace de esos datos. Google publica sus requisitos de dominio, privacidad, marca y mínimos permisos en las políticas OAuth y en la guía de preparación del servicio público. [Políticas OAuth](https://developers.google.com/identity/protocols/oauth2/policies), [preparación y cumplimiento](https://developers.google.com/identity/protocols/oauth2/production-readiness/policy-compliance).

## Verificar el acceso real

La aceptación de la integración Google requiere ejecutar estos recorridos con el cliente registrado y las cuentas elegidas.

| Recorrido | Resultado esperado |
|---|---|
| Abrir **Iniciar sesión** | Google presenta el cliente y permite elegir una cuenta autorizada por su configuración |
| Aceptar el acceso y regresar | El callback devuelve al cotizador con la sesión iniciada |
| Guardar y reabrir una cotización de prueba | El historial conserva sus datos e importes |
| Repetir con una segunda cuenta, cuando la audiencia la admita | Cada persona consulta su propio historial |
| Cerrar sesión y volver al historial | La aplicación solicita iniciar sesión nuevamente |
| Repetir después de vencer la sesión | La aplicación permite iniciar una transacción nueva |

Efectúa el acceso real en el navegador externo habitual del usuario. Registra fecha, origen, versión, audiencia y resultados con datos ficticios. Los informes y capturas deben conservar únicamente la evidencia funcional necesaria. Google establece requisitos específicos para los navegadores usados en el flujo OAuth. [Políticas de navegador seguro](https://developers.google.com/identity/protocols/oauth2/policies#secure-browsers).

## Evidencia automatizada y estado pendiente

`tests/integration.py --provider google --backend all` inicia un emisor local efímero que reproduce las condiciones del perfil Google para los tres backends. Sus pruebas cubren el código y PKCE, la sesión, la validación de identidad, los permisos y la separación de cuentas con datos sintéticos. Las pruebas de configuración y de backend añaden casos de emisor, audiencia y correo verificado.

El acta de la entrega identifica las ejecuciones efectivamente realizadas y sus resultados. La prueba con `https://accounts.google.com`, el cliente web del propietario y cuentas reales permanece pendiente hasta completar el registro y los recorridos anteriores en el entorno elegido.

## Resolver errores de configuración

| Mensaje o síntoma | Revisión del operador |
|---|---|
| `redirect_uri_mismatch` | Comparar la redirección registrada con `APP_ORIGIN` más `/auth/callback`, incluidos esquema y puerto |
| `org_internal` | Confirmar que la cuenta pertenece a la organización de la aplicación Internal |
| `client_user_mismatch` | Confirmar la cuenta creadora cuando se haya elegido Personal |
| El proveedor bloquea una cuenta Workspace | Revisar con su administrador la política de acceso OAuth |
| La aplicación responde que el inicio de sesión carece de configuración | Comprobar proveedor, emisor, cliente, secreto y conectividad del servidor con Google |
| La aplicación rechaza el callback | Comprobar vigencia de la transacción, cookie, ID token, audiencia y correo verificado, y empezar un acceso nuevo |

La ayuda de Google describe los errores asociados a la audiencia y sus controles. [Gestionar la audiencia](https://support.google.com/cloud/answer/15549945?hl=en).

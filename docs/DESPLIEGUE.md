# Despliegue de CotizaSweet 2.0.0

Documento actualizado el 10 de noviembre de 2026 para esta copia independiente. El paquete contiene código, pruebas y configuración de ejemplo. No contiene la base, las sesiones ni las credenciales de la instalación anterior. Los resultados comprobados en esta revisión y sus límites se consignan en [VALIDACION-V2.md](VALIDACION-V2.md).

La aplicación no se publica mediante este documento. La creación del repositorio personal y su guía paso a paso se realizarán cuando el usuario solicite esa fase. La primera ejecución remota de Actions, el alojamiento, DNS, HTTPS, proveedor OIDC real y RUC real continúan pendientes.

## GitHub y alojamiento funcional

GitHub permite conservar versiones del código, revisar cambios y ejecutar el workflow preparado en `.github/workflows/ci.yml`. La configuración de CI y Dependabot se describe en [CI.md](CI.md); incluir esos archivos no demuestra que Actions ya haya pasado en la cuenta personal.

Esta aplicación necesita ejecutar procesos Next.js, ASP.NET Core y Python y conservar volúmenes SQLite. [GitHub Pages es un servicio de alojamiento estático](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages), por lo que no ejecuta las API, las sesiones ni la persistencia de este sistema. El repositorio de GitHub es una parte del versionado y la verificación; el servicio funcional necesita un alojamiento que admita este stack.

Una topología inicial adecuada para evaluar es un servidor con Docker Compose, una instancia de cada servicio, almacenamiento persistente y un proxy con TLS. La elección del proveedor, recursos, dominio, costes y política de operación debe resolverse antes de publicar. No se atribuye capacidad de carga pública a las mediciones locales.

## Topología descrita por Compose

`compose.yaml` describe el circuito **navegador → proxy HTTPS → Next.js → .NET → Python RUC → proveedor externo**. El emisor de identidad de desarrollo no forma parte del despliegue de producción.

| Servicio | Función | Persistencia |
|---|---|---|
| `web` | Interfaz, BFF, transacción OIDC, sesiones y límites públicos | Volumen `web-data` |
| `api-dotnet` | Validación, cálculo e historial por propietario | Volumen `dotnet-data` |
| `api-python` | Consulta RUC autenticada entre servicios | Volumen `python-data` |

El puerto web de Compose está ligado a `127.0.0.1:3000` en el servidor para el proxy local. Los servicios internos no publican puertos hacia Internet. Estos puertos de contenedor/servidor son diferentes de los predeterminados del lanzador local v2: **3340, 8340, 8341 y 9340**.

La revisión de Compose se limita a su configuración con `docker compose --env-file .env.example config --quiet`; el resultado concreto consta en el acta. El daemon Docker no estaba activo durante la revisión, por lo que no se construyeron ni levantaron los contenedores. Los Dockerfiles y el arranque real deben verificarse en el destino antes de una publicación.

## Configuración requerida

Prepara una configuración privada de producción a partir de `.env.example`. Los ejemplos son marcadores y no acreditan un servicio externo. Usa el gestor de secretos del alojamiento o un archivo de permisos restringidos; no incluyas secretos en el repositorio, imágenes, informes, capturas o paquetes de entrega.

| Variable o requisito | Comprobación del operador |
|---|---|
| `APP_ORIGIN` | Origen público HTTPS exacto, sin ruta, usuario ni parámetros. El proxy debe conservar ese origen. |
| `OIDC_ISSUER` | Emisor HTTPS real del proveedor elegido, con su ruta/realm exacta si corresponde. |
| `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`, `OIDC_AUDIENCE` | Cliente confidencial y audiencia registrados para esta aplicación. No reutilizar la identidad de desarrollo. |
| `OIDC_SCOPE` | Debe incluir `openid`, `quotes:read` y `quotes:write`, concedidos efectivamente por el proveedor. |
| URL de retorno OIDC | Registrar el origen real seguido de `/auth/callback`, conforme al proveedor. |
| `OIDC_ALLOW_LOCAL_HTTP` | `false`. Producción exige HTTPS para la identidad. |
| `SESSION_SECRET` | 32 bytes generados criptográficamente y codificados en 64 caracteres hexadecimales. Conservar de forma segura si se requiere recuperar estado de sesión cifrado. |
| `INTEGRATION_SERVICE_KEY` | Clave aleatoria independiente, entre 32 y 256 caracteres ASCII sin espacios, compartida solo entre los servidores que la necesitan. |
| `RUC_PROVIDER`, `RUC_API_TOKEN` | Para verificación RUC real, Decolecta y una credencial nueva, válida y privada, sin prefijo `Bearer`. |
| `API_BACKEND`, URLs internas | Compose selecciona .NET y los nombres de servicio internos. No enviar esas credenciales al navegador ni publicar las API internas. |
| Datos y condiciones del negocio | Identidad legal, contactos, precios, impuestos, disponibilidad, políticas y derechos de imágenes confirmados por su responsable. |

La credencial RUC anterior no se importa ni se considera vigente. Si se compartió en chat o con terceros, debe revocarse o rotarse. La consulta real de esta versión sigue pendiente de una credencial nueva y una prueba autorizada del proveedor. Las pruebas demo no verifican datos en SUNAT. El recorrido con DNI permite comprobar el cotizador sin token RUC.

El registro OIDC debe emitir los scopes necesarios en el token de acceso. Confirma emisor, audiencia, expiración y separación de sujetos usando dos cuentas reales de prueba antes de habilitar acceso al público. No concedas permisos basándote únicamente en la apariencia del inicio de sesión.

## Proxy y límites

Configura TLS válido, renovación del certificado, cabeceras de seguridad y límites de petición/tiempo en el proxy. Debe poder servir el bundle Next.js y su flujo OIDC manteniendo el origen público configurado. Las cookies de sesión con origen HTTPS usan `Secure`, `HttpOnly`, `SameSite=Lax` y prefijo `__Host-`.

`TRUSTED_CLIENT_IP_HEADER` está vacío por defecto. Solo debe configurarse a una opción admitida cuando el proxy elimine y reemplace las copias que envía el cliente. El servicio web no debe tener una vía pública que evite ese proxy. Los controles y umbrales concretos están en [MEJORAS-WEB.md](MEJORAS-WEB.md) y [SEGURIDAD-V2.md](SEGURIDAD-V2.md).

Los topes globales pueden ser consumidos por un atacante y afectar temporalmente a otros usuarios. Los contadores en memoria y la caché RUC son por instancia; no constituyen un límite distribuido. El paquete no define por sí solo la capacidad de memoria/CPU que necesita el alojamiento. Dimensiona y configura recursos del contenedor/proxy según mediciones del destino. Para varias réplicas se requieren un almacén compartido, otra estrategia de persistencia y nuevas pruebas de carga y aislamiento.

## Secuencia de verificación antes de publicar

1. Conservar una versión identificable del código y sus archivos de bloqueo. Ejecutar las comprobaciones descritas en el README y confirmar la primera ejecución limpia de Actions cuando exista el repositorio remoto.
2. Revisar la identidad, precios y condiciones comerciales referenciales; completar únicamente los datos confirmados por el negocio.
3. Preparar secretos nuevos, OIDC real, origen HTTPS, dominio, proxy, volúmenes y permisos. No llevar el emisor de desarrollo al servidor público.
4. Ejecutar el preflight y validar la estructura efectiva de Compose, sin imprimir la configuración con secretos:

   ```powershell
   python scripts/preflight.py --env-file .env
   docker compose --env-file .env config --quiet
   ```

5. En un entorno de prueba del destino, construir y arrancar las imágenes mediante el procedimiento operativo elegido. Confirmar estado de servicios, `/api/health`, catálogo, formulario y cabeceras. Una validación de configuración no sustituye este arranque.
6. Con dos usuarios de prueba diferentes, verificar inicio/cierre de sesión, scopes, rechazo de solicitudes sin autorización, escritura, lectura y ausencia de presupuestos ajenos en cada historial. Revisar también CSRF y expiración de sesión.
7. Ejecutar el recorrido DNI, RUC autorizado con credencial nueva, moneda PEN/USD, recojo/entrega, importes, anticipo/saldo, guardado y reapertura. Descargar y revisar un PDF normal y otro con textos largos; conservar evidencias sintéticas.
8. Medir latencia y errores con la carga esperada del alojamiento, ajustar recursos y límites y comprobar el comportamiento de HTTP 429. Las pruebas locales no determinan la capacidad del servidor.
9. Crear un respaldo, verificarlo y restaurarlo a una ruta nueva; comprobar datos y permisos con la aplicación antes de aceptar la política de recuperación.
10. Publicar únicamente después de resolver los fallos y registrar versión, responsable, configuración operativa y procedimiento de reversión.

El preflight es estático y no usa la red. Un resultado aprobado no acredita la resolución DNS, el certificado, credenciales válidas, disponibilidad ni los permisos externos. Los resultados reales de los pasos pendientes deben añadirse al registro del despliegue, sin secretos.

## Respaldo, recuperación y reversión

Cada base requiere una copia consistente con la API de respaldo SQLite. No copies únicamente el archivo principal de una base activa mientras pueda haber cambios en WAL. [OPERACIONES.md](OPERACIONES.md) contiene los comandos de respaldo, verificación SHA-256/integridad y restauración que solo crea rutas nuevas.

Protege los volúmenes y respaldos mediante controles del alojamiento y una política de retención. Las cotizaciones no tienen cifrado de aplicación. SHA-256 detecta cambios respecto al metadato conservado, pero no es una firma si un tercero puede cambiar ambos. Los respaldos se realizan por base; no constituyen una transacción coordinada entre los servicios ni incluyen borradores que permanecen solo en el navegador.

Antes de cambiar versión, identifica el artefacto anterior y conserva respaldos verificados. Para revertir, detén las escrituras y recupera el artefacto previo con una base compatible. Si se necesita recuperar datos, restaura a una ruta nueva, verifica su contenido y selecciona explícitamente esa ruta al reiniciar. Conserva el archivo anterior para poder regresar a él. No sobrescribas la base activa ni supongas que una versión anterior admite cualquier cambio de esquema.

La recuperación de estado cifrado de sesión requiere el mismo `SESSION_SECRET`; las sesiones ya caducadas siguen caducadas. Rotar esa clave invalida las sesiones anteriores y obliga a iniciar sesión nuevamente. La política de rotación y retención debe preverlo.

## Límites conocidos que debe revisar el operador

El historial devuelve las últimas 200 cotizaciones y puede generar respuestas grandes. Una fila histórica corrupta puede impedir cargarlo; paginación y recuperación por registro continúan pendientes. Los límites por instancia y los topes globales requieren dimensionamiento. No se incluyen pagos, facturación electrónica, automatización de respaldos ni una migración de los datos anteriores.

Esta documentación prepara un despliegue revisable. La certificación externa, disponibilidad, conformidad comercial y aceptación operativa del entorno necesitan sus comprobaciones propias; no se deducen del éxito de los tests locales.

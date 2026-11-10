# Alojamiento de CotizaSweet en Railway

Railway se eligió como destino administrado para el piloto: ejecuta Node.js/Next.js, ASP.NET Core y Python como servicios Docker independientes dentro del mismo proyecto. Los servicios `web` y `api-dotnet` conservan SQLite en volúmenes separados; `api-python` ejecuta RUC con caché en memoria y no requiere volumen. La contratación, la cuenta conectada y el límite mensual deben confirmarse antes de aplicar recursos. Esta documentación no acredita un despliegue público.

## Estado y coste

Railway Hobby tiene un mínimo de US$5/mes con US$5 de consumo incluidos. El consumo adicional depende de RAM, CPU, almacenamiento y tráfico. US$15–25/mes es una estimación orientativa para un piloto pequeño, no una cotización ni un tope aprobado. Consultar [precios oficiales](https://docs.railway.com/pricing) y configurar avisos/límite de gasto en la cuenta; el límite puede detener los servicios al alcanzarse.

El repositorio será público por decisión del propietario. Las credenciales, cotizaciones, sesiones, respaldos, logs y archivos privados no se publican. Mantener los derechos reservados existentes; visibilidad pública no agrega una licencia de código abierto.

## Infraestructura versionada

`.railway/railway.ts` usa el SDK oficial `railway/iac` y referencia el repositorio verificado `studioelpantojita/cotizasweet`. `COTIZA_GITHUB_REPOSITORY` permite sustituir ese metadato público para otra instalación. `COTIZA_RAILWAY_REGION` debe indicar una región disponible de la cuenta. No contiene un propietario ficticio ni credenciales de despliegue.

Se utiliza Infrastructure as Code actual. La configuración anterior `railway.json` está deprecada según la documentación consultada; no se crea una integración nueva sobre ese formato. Referencias: [IaC](https://docs.railway.com/infrastructure-as-code), [API del SDK](https://docs.railway.com/infrastructure-as-code/reference).

Para comprobar el código de infraestructura sin cuenta ni recursos:

```powershell
Push-Location .railway
npm ci
npm run check
node check-graph.mjs
Pop-Location
```

La comprobación offline usa metadatos sintéticos solo dentro de la prueba. Valida tipos y el grafo de tres servicios/dos volúmenes, no la aceptación del plan por una cuenta real. El CLI Railway debe ser compatible con el SDK instalado; usar la versión oficial actual.

## Servicios

| Servicio | Dockerfile desde raíz del repositorio | Puerto | Salud | Volumen |
|---|---|---:|---|---|
| `web` | `web/Dockerfile` | 3000 | `/api/health` | `/app/data`, 1 GB inicial |
| `api-dotnet` | `api-dotnet/Dockerfile` | 8000 | `/health` | `/app/data`, 1 GB inicial |
| `api-python` | `api-python/Dockerfile` | 8000 | `/health` | No necesario para RUC |

Los tres servicios usan la raíz completa del monorepo como contexto porque comparten `contracts/`. Cada uno tiene una réplica. Solo `web` debe recibir un dominio público HTTPS; las dos APIs usan la red privada, sin dominio ni proxy TCP público. La aplicación permite HTTP interno únicamente para nombres concretos de Compose y `api-dotnet.railway.internal`/`api-python.railway.internal`; otros destinos remotos requieren HTTPS.

La configuración inicial limita memoria a 1 GB en web y 512 MB en cada API y CPU a 1/0,5/0,5. Son límites de partida que requieren medir uso real. No garantizan un gasto total ni capacidad de producción. Los servicios con volúmenes pueden tener una interrupción al redesplegar y no deben escalarse a varias réplicas con esta arquitectura SQLite.

## Datos y usuarios de contenedores

Railway monta volúmenes como root. El entrypoint prepara exclusivamente `/app/data`, rechaza que sea un enlace simbólico y después ejecuta la aplicación con `gosu` bajo `node`, `app` o `cotiza`. La aplicación no continúa como root. `RAILWAY_RUN_UID=0` permite el arranque de preparación; el entrypoint baja los privilegios antes de ejecutar el proceso principal. Referencia: [permisos de volúmenes](https://docs.railway.com/volumes).

Las pruebas Docker de CI comprueban el UID del proceso principal, comunicación interna, protección del historial y persistencia tras reinicio. No se declara que hayan pasado hasta observar su ejecución real. En esta sesión se detectó Docker Desktop 29.8.1 ejecutándose, pero el acceso de la consola al motor local está denegado; esa limitación no significa que Docker falte en el equipo.

## Configuración privada requerida

Crear variables compartidas reales en el entorno Railway: `APP_ORIGIN`, `OIDC_ISSUER`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`, `OIDC_AUDIENCE`, `SESSION_SECRET`, `INTEGRATION_SERVICE_KEY` y `RUC_API_TOKEN`. El archivo IaC referencia cada valor solo desde el servicio que lo necesita; RUC_API_TOKEN solo llega a Python. Se debe definir el proveedor OIDC y registrar `https://dominio-real/auth/callback`; el emisor local compartido no se publica.

`SESSION_SECRET` exige 32 bytes aleatorios en hexadecimal. `INTEGRATION_SERVICE_KEY` debe ser una clave diferente de 32–256 caracteres ASCII sin espacios. La credencial RUC anterior expuesta debe revocarse y sustituirse. Introducir estos valores directamente en el almacén de secretos de Railway, no en GitHub, `.railway/railway.ts`, capturas o el chat.

Para emitir un plan: conectar el CLI a un proyecto nuevo de la cuenta, preparar las variables, definir los dos metadatos públicos y ejecutar `railway config plan`. Revisar el plan concreto, costes, volúmenes y permisos antes de `railway config apply`. No aplicar esta definición sobre un proyecto ajeno o con datos sin revisar el diff; un plan puede contener eliminaciones.

## Secuencia de publicación

1. Publicar el código limpio en el repositorio personal `cotizasweet` y verificar sus workflows de calidad, infraestructura y contenedores.
2. Conectar Railway con autorización de la cuenta, confirmar presupuesto y proyecto/región. La contratación no se autoriza por preparar este archivo.
3. Configurar OIDC real y secretos; revisar y aplicar el plan. Mantener ambas APIs privadas.
4. Generar el dominio HTTPS de `web`, actualizar `APP_ORIGIN` exacto y el callback OIDC y verificar la configuración efectiva.
5. Probar inicio, catálogo, dos usuarios reales, aislamiento, cotización, PDF, RUC y cierre de sesión. Reiniciar y comprobar persistencia de sesiones/cotizaciones.
6. Activar copias de volúmenes y ensayar restauración SQLite a una ruta nueva. Registrar la etiqueta/commit desplegado y el punto de reversión.

Para construir/verificar localmente desde una terminal con acceso al motor Docker:

```powershell
docker build -f web/Dockerfile -t cotizasweet-web:ci .
docker build -f api-dotnet/Dockerfile -t cotizasweet-api:ci .
docker build -f api-python/Dockerfile -t cotizasweet-ruc:ci .
python tests/container_smoke.py
```

La prueba crea y elimina solamente sus propios contenedores, red y volúmenes sintéticos con nombres únicos. No necesita claves de producción ni prueba el proveedor externo. Los límites y la reversión se detallan en `DESPLIEGUE.md` y `OPERACIONES.md`.

# E&A Cotiza 2.2.0 en Railway

La definición del piloto contempla tres servicios Docker de este repositorio y tres volúmenes persistentes. Next.js atiende la web, .NET valida y conserva las cotizaciones y Python consulta RUC. El tercer volumen guarda la cuota diaria de consultas para conservarla al reiniciar Python. La entrega 2.2.0 permanece local y su publicación en GitHub queda pendiente de la aprobación expresa del propietario.

El registro de preparación del proyecto acredita la autorización Railway y la creación de `cotizasweet` con un servicio inicial vacío. La activación de Hobby y los controles de gasto efectivos continúan pendientes de comprobar en la cuenta. La puesta en servicio de esta versión requiere revisar el plan del entorno y verificar el despliegue real.

## Presupuesto del piloto

El propietario fijó un máximo de **US$30 mensuales**. Comprueba el plan Hobby, impuestos, almacenamiento y tráfico en la facturación efectiva antes de crear servicios activos. Consulta los importes vigentes en las páginas oficiales de [planes](https://docs.railway.com/pricing/plans) y [facturación](https://docs.railway.com/pricing/understanding-your-bill).

La propuesta presupuestal inicial es una alerta de US$15 y un límite de cómputo de US$20, con margen para los demás conceptos y el gasto de Railway Agent ajustado por separado. Esos controles están pendientes de aplicar. Confirma qué incluye cada ajuste del workspace y recuerda que alcanzar el límite puede detener los servicios. [Control de costes](https://docs.railway.com/pricing/cost-control).

## Definición versionada

`.railway/railway.ts` usa `railway/iac`. El repositorio predeterminado es `studioelpantojita/cotizasweet` y la fuente GitHub usa `main` con comprobaciones de commit habilitadas. Después de recibir aprobación para publicar esta versión, se deberán revisar sus resultados en [Actions](https://github.com/studioelpantojita/cotizasweet/actions). La CI remota de 2.2.0 está pendiente. Las ejecuciones registradas en los documentos de 2.1.0 se conservan como antecedentes de aquella versión.

| Metadato del operador | Uso |
|---|---|
| `COTIZA_GITHUB_REPOSITORY` | `propietario/repositorio`, si se necesita sustituir el repositorio predeterminado |
| `COTIZA_RAILWAY_REGION` | Identificador de una región disponible en la cuenta |
| `COTIZA_OIDC_PROVIDER` | `google` por defecto y `standard` para otro proveedor OIDC compatible |

La infraestructura se evalúa con el CLI enlazado al proyecto y entorno elegidos. La revisión del plan debe mostrar los servicios, variables y montajes que correspondan a esta instalación. [Infrastructure as Code](https://docs.railway.com/infrastructure-as-code).

Para validar tipos y el grafo offline desde la raíz ejecuta lo siguiente.

```powershell
Push-Location .railway
npm ci
npm run check
node check-graph.mjs
Pop-Location
```

El comprobador usa metadatos sintéticos y exige tres servicios, tres volúmenes y una réplica por servicio. La cuenta y su plan efectivo se verifican al conectar el CLI y emitir el plan del destino.

## Servicios y volúmenes

| Servicio | Dockerfile desde la raíz | Puerto | Salud | Volumen y contenido |
|---|---|---:|---|---|
| `web` | `web/Dockerfile` | 3000 | `/api/health` | `web-data`, `/app/data`, sesiones y límites web |
| `api-dotnet` | `api-dotnet/Dockerfile` | 8000 | `/health` | `quotes-data`, `/app/data`, cotizaciones y `backups/` |
| `api-python` | `api-python/Dockerfile` | 8000 | `/health` | `ruc-data`, `/app/data`, contador `ruc-quota.sqlite` |

Cada volumen parte de 1024 MB. La web tiene un límite inicial de 1 CPU y 1 GB de RAM y cada API tiene 0,5 CPU y 512 MB. Mide consumo y rendimiento con el entorno real para ajustar estos límites dentro del presupuesto.

Los builds usan la raíz completa del monorepo porque comparten `contracts/`. Expón el servicio `web` por su dominio HTTPS y conserva las APIs en la red privada. Las URL preparadas son `http://api-dotnet.railway.internal:8000` y `http://api-python.railway.internal:8000`. Comprueba su resolución y la comunicación entre servicios desde el entorno elegido.

El entrypoint prepara `/app/data` y luego ejecuta la aplicación con el usuario correspondiente del contenedor. `RAILWAY_RUN_UID=0` se usa en esa preparación y el proceso de aplicación desciende de privilegios. La validación de contenedores debe comprobar el UID final, salud, protección de endpoints, cuota y persistencia de esta versión. Los permisos y la persistencia se revisan también al montar los volúmenes efectivos. [Volúmenes de Railway](https://docs.railway.com/volumes).

## Variables privadas

Configura las variables compartidas que el archivo IaC referencia.

| Variable compartida | Destino y comprobación |
|---|---|
| `APP_ORIGIN` | Origen HTTPS exacto de la web, sin ruta ni parámetros |
| `OIDC_ISSUER` | `https://accounts.google.com` en el perfil Google |
| `OIDC_CLIENT_ID` | Identificador del cliente OAuth web de Google, terminado en `.apps.googleusercontent.com` |
| `OIDC_CLIENT_SECRET` | Secreto del cliente web, conservado en el gestor de secretos |
| `OIDC_AUDIENCE` | Se usa en el perfil `standard`; para Google la definición referencia el mismo `OIDC_CLIENT_ID` |
| `SESSION_SECRET` | 32 bytes aleatorios codificados como 64 caracteres hexadecimales |
| `INTEGRATION_SERVICE_KEY` | Clave independiente de 32 a 256 caracteres ASCII sin espacios para las llamadas entre servicios |
| `RUC_API_TOKEN` | Credencial nueva y vigente de Decolecta, con su valor directo y privado |

En el perfil Google, la definición aplica `OIDC_PROVIDER=google`, establece la audiencia a partir del client ID compartido y fija `OIDC_SCOPE=openid profile email`. Registra el callback exacto `APP_ORIGIN` seguido de `/auth/callback`. Sigue los pasos de [GOOGLE.md](GOOGLE.md) para el cliente, la audiencia, la privacidad y la prueba con cuentas reales.

Para un proveedor estándar, elige `COTIZA_OIDC_PROVIDER=standard`, configura emisor y audiencia del API y concede `openid profile email quotes:read quotes:write` al cliente web. La configuración y la validación de tokens deben corresponder al perfil elegido.

Python recibe `RUC_PROVIDER=decolecta`, `RUC_DAILY_LIMIT=500` y `RUC_QUOTA_PATH=/app/data/ruc-quota.sqlite`. Su arranque de producción exige la credencial RUC. Cada intento hacia Decolecta reserva cuota antes del envío porque el proveedor podría contabilizar una respuesta fallida. Las respuestas servidas desde caché conservan la reserva existente.

La web y .NET reciben únicamente la clave interna para su relación con RUC. Guarda el token de Decolecta en Python y el secreto OAuth en la web mediante las referencias del archivo IaC. Completa también la identidad comercial, los contactos, los precios y las condiciones que continúan siendo referenciales en la aplicación.

## Aplicar y aceptar el despliegue

Los siguientes pasos quedan pendientes de aprobación para publicar y continuar con el despliegue. La preparación local y sus comprobaciones pueden completarse durante la revisión.

1. Tras recibir la aprobación expresa del propietario, publica el commit de 2.2.0 y revisa las comprobaciones correspondientes a ese commit.
2. Completa la activación de Hobby y los controles de consumo en la cuenta, verificando el presupuesto máximo total de US$30.
3. Conecta el CLI al proyecto y entorno seleccionados y define la región. Si existe el servicio vacío creado durante la preparación, comprueba su nombre y cómo lo tratará el plan.
4. Reserva el dominio HTTPS de `web` y registra el origen y el callback exactos en Google. Introduce las variables compartidas y las claves privadas.
5. Ejecuta `railway config plan`. Revisa que el plan conserva el servicio y dominio reservados, y que asigna tres servicios y tres volúmenes con sus rutas. Resuelve cualquier diferencia con los datos o servicios existentes antes de aplicar.
6. Ejecuta `railway config apply` sobre ese proyecto y entorno. Comprueba estado de despliegues, salud, DNS privado y HTTPS público.
7. Con cuentas reales de prueba, recorre inicio y cierre de sesión, guardado, paginación, reapertura, aislamiento de cotizaciones, PDF y RUC. Usa datos ficticios y registra el commit y los resultados.
8. Reinicia los servicios y comprueba los datos persistidos, incluida la cuota RUC. Ensaya el respaldo y la restauración a una ruta nueva antes de aceptar la recuperación operativa.

Para construir y verificar las imágenes desde una terminal con acceso al motor Docker ejecuta los mismos comandos que usa la comprobación de contenedores.

```powershell
docker build -f web/Dockerfile -t cotizasweet-web:ci .
docker build -f api-dotnet/Dockerfile -t cotizasweet-api:ci .
docker build -f api-python/Dockerfile -t cotizasweet-ruc:ci .
python tests/container_smoke.py
```

La prueba utiliza servicios, red y volúmenes sintéticos. Su resultado debe conservarse junto a la copia o commit ejecutado para comprobar las imágenes de esta entrega. El acta identificará el resultado local y cualquier limitación del motor Docker. Esta comprobación local y la futura CI remota deben registrar sus propios resultados.

## Respaldo y recuperación

El trabajador .NET comprueba el calendario al arrancar y cada hora. Cuando han transcurrido al menos 24 horas desde la última copia completa, usa la API SQLite, valida integridad y publica el archivo con sus metadatos de tamaño y SHA-256. Conserva las siete copias completas más recientes en `/app/data/backups` dentro de `quotes-data`.

La retención se cuenta por copias completas. Las interrupciones del servicio pueden ampliar el intervalo entre ellas. Configura en el alojamiento la copia externa del volumen y su retención, que siguen pendientes, para recuperar la información ante pérdida del almacenamiento. Incluye `web-data` y `ruc-data` en el plan de recuperación de sesiones, límites y cuota.

[OPERACIONES.md](OPERACIONES.md) describe el respaldo consistente, la comprobación y la restauración a una ruta nueva. Para una reversión, conserva el commit o etiqueta anterior y un respaldo verificado con esquema compatible, detén escrituras y selecciona explícitamente la ruta restaurada al reiniciar.

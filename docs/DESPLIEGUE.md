# Despliegue de E&A Cotiza 2.3.0

La actualización de interfaz 2.3.0 conserva la arquitectura y los ajustes operativos de esta guía. Su validación actual está en [UPGRADE-2.3.md](UPGRADE-2.3.md), y el recorrido local en [REVISION-MANUAL-2.3.md](REVISION-MANUAL-2.3.md). Las imágenes Docker 2.3.0 requieren reconstrucción y smoke con el motor disponible. La evidencia Docker 2.2.1 que se describe abajo pertenece a esa entrega anterior. El build final de producción y los servicios nativos de 2.3.0 se verificaron localmente. La publicación continúa pendiente de aprobación expresa.

Guía revisada el 20 de noviembre de 2026 para la copia local 2.2.1. La publicación en GitHub y la continuación del despliegue quedan pendientes de la aprobación expresa del propietario. Los resultados de versiones anteriores se conservan en [UPGRADE-2.1.md](UPGRADE-2.1.md) y [VALIDACION-V2.md](VALIDACION-V2.md). [RAILWAY.md](RAILWAY.md) contiene la receta del alojamiento elegido y [REVISION-MANUAL-2.2.1.md](REVISION-MANUAL-2.2.1.md) permite revisar la entrega desde Visual Studio.

Railway es el destino preparado para el piloto, con un presupuesto máximo de **US$30 mensuales**. La activación del plan, los controles de gasto efectivos, la región, el dominio, los secretos y la aceptación del servicio público requieren comprobarse en la cuenta. El repositorio existente es [studioelpantojita/cotizasweet](https://github.com/studioelpantojita/cotizasweet). La CI remota de esta versión se ejecutará después de recibir aprobación para publicar su código.

La aplicación requiere procesos Next.js, ASP.NET Core .NET 10 y Python 3.12 y almacenamiento SQLite persistente. La definición de Railway y `compose.yaml` usan **tres servicios y tres volúmenes**. El volumen Python conserva la cuota diaria de RUC.

| Servicio | Función | Volumen Compose | Volumen Railway |
|---|---|---|---|
| `web` | Interfaz, sesión, BFF y límites públicos | `web-data` | `web-data` |
| `api-dotnet` | Validación, cálculo, historial y copias automáticas | `dotnet-data` | `quotes-data` |
| `api-python` | Servicio RUC y contador diario persistente | `python-data` | `ruc-data` |

Cada volumen se monta en `/app/data`. Los builds usan la raíz completa del monorepo porque comparten `contracts/`. En el destino se expone `web` por HTTPS y las API se comunican por la red privada. Compose liga la web a `127.0.0.1:3000` para un proxy del servidor. Los puertos de cada copia de revisión se consultan en su archivo privado `local.settings.json`.

Las tres imágenes de producción de 2.2.1 se construyeron y aprobaron el smoke local ejecutado por el propietario desde PowerShell con acceso a Docker Desktop. Se revisó `tests/artifacts/container-smoke.json`, cuyo resultado registra tres servicios y tres volúmenes, UID finales de aplicación 1000 para web, 1654 para .NET y 10001 para RUC, persistencia de cuota web y RUC, respaldo automático en un directorio personalizado y persistencia al reiniciar la API. El recibo externo de entrega identifica el commit local y sus evidencias. El recorrido usa configuración e identidades sintéticas. La comprobación de la infraestructura en Railway se completa en el destino efectivo.

La configuración privada parte de `.env.example` y del gestor de secretos del alojamiento. Registra los siguientes valores para el entorno.

| Requisito | Comprobación del operador |
|---|---|
| `APP_ORIGIN` | Origen HTTPS exacto, sin ruta, usuario ni parámetros |
| `OIDC_PROVIDER` | `google`, perfil predeterminado de la definición IaC |
| `OIDC_ISSUER` | `https://accounts.google.com` para Google |
| `OIDC_CLIENT_ID`, `OIDC_AUDIENCE` | Mismo identificador completo del cliente OAuth web de Google |
| `OIDC_CLIENT_SECRET` | Secreto del cliente confidencial, conservado en la web |
| `OIDC_SCOPE` | `openid profile email` para Google |
| Callback | Origen efectivo seguido exactamente de `/auth/callback` |
| `OIDC_ALLOW_LOCAL_HTTP` | `false` en producción |
| `SESSION_SECRET` | 32 bytes aleatorios codificados como 64 caracteres hexadecimales |
| `INTEGRATION_SERVICE_KEY` | Clave aleatoria independiente de 32 a 256 caracteres ASCII sin espacios |
| `RUC_PROVIDER`, `RUC_API_TOKEN` | Decolecta y una credencial nueva y vigente, conservada exclusivamente en Python |
| `RUC_DAILY_LIMIT` | Entero de 1 a 100000, predeterminado 500 |
| `RUC_QUOTA_PATH` | Ruta absoluta `/app/data/ruc-quota.sqlite` dentro del volumen Python |
| `BACKUP_INTERVAL_HOURS` | Opcional, predeterminado `24`, entero de 0 a 168. `0` desactiva el respaldo automático .NET |
| `BACKUP_KEEP` | Opcional, predeterminado `7`, entero de 1 a 365 para las copias completas válidas |
| `BACKUP_DIR` | Opcional, predeterminado `backups/` junto a la base .NET. Admite ruta absoluta o relativa canonicalizada por el servicio |
| Identidad comercial y condiciones | Datos, precios, disponibilidad, políticas y derechos confirmados por el responsable |

[GOOGLE.md](GOOGLE.md) explica el registro del cliente web y sus pruebas de aceptación. Google valida la identidad y E&A Cotiza asigna los permisos internos para el historial propio. Para otro proveedor, `OIDC_PROVIDER=standard` requiere los scopes `openid profile email quotes:read quotes:write` y un access token RS256 con la audiencia del API. [AUTENTICACION.md](AUTENTICACION.md) describe ambos perfiles.

La definición IaC fija `RUC_PROVIDER=decolecta` y el servicio exige una credencial vigente al arrancar. El contador reserva cada intento antes del envío, incluidos los que terminan con error. La caché y las solicitudes concurrentes agrupadas evitan llamadas adicionales durante su vigencia. El modo local de demostración permite verificar el recorrido con datos ficticios y la aceptación del proveedor real queda pendiente.

El proxy del destino debe conservar el origen público y servir TLS válido. Las respuestas de página incluyen CSP con nonce por petición y las respuestas de producción cubiertas por el proxy de Next incluyen HSTS de 63072000 segundos al usar origen HTTPS. Comprueba también las cabeceras efectivas del CDN o proxy y los recursos estáticos. Las cookies de sesión HTTPS usan `Secure`, `HttpOnly`, `SameSite=Lax` y prefijo `__Host-`.

`TRUSTED_CLIENT_IP_HEADER` parte vacío. Se configura cuando se compruebe que el proxy elimina y reemplaza la cabecera que puede suministrar un cliente y que el servicio carece de una vía pública alternativa hacia la web. El ajuste y su prueba con distintas direcciones siguen pendientes en Railway. Los límites por instancia y el uso de SQLite corresponden a una réplica por servicio y requieren revisar la arquitectura antes de aumentar réplicas.

La puesta en servicio se acepta con esta secuencia.

1. Obtener la aprobación del propietario para publicar esta versión, identificar su commit y revisar las ejecuciones de calidad, contenedores e infraestructura de ese commit.
2. Confirmar los datos del negocio, privacidad, términos, presupuesto efectivo, cuenta, región y entorno de destino.
3. Reservar el origen HTTPS y registrar el callback de Google. Introducir las claves privadas en el gestor del alojamiento.
4. Ejecutar `python scripts/preflight.py --env-file .env` y, para Compose, `docker compose --env-file .env config --quiet`. Revisar después el plan IaC del entorno con los tres servicios y tres volúmenes antes de aplicarlo.
5. Construir y arrancar los servicios en el entorno elegido. Comprobar salud, DNS privado, comunicación interna, cabeceras, cookies y HTTPS público.
6. Con dos cuentas reales de prueba, verificar inicio y cierre de sesión, caducidad, permisos, guardado, paginación, reapertura y aislamiento del historial.
7. Recorrer DNI y RUC con credencial vigente, PEN/USD, recojo o locación, importes, IGV, anticipo, saldo y PDF normal y extenso usando datos ficticios.
8. Medir latencia, errores y consumo en el destino dentro del presupuesto y comprobar los rechazos HTTP 429.
9. Activar la copia fuera del volumen y ensayar la restauración a una ruta nueva con datos sintéticos. Reiniciar los servicios y comprobar persistencia, incluida la cuota RUC.
10. Registrar versión, responsable, resultados de aceptación, recuperación y procedimiento de reversión.

El preflight comprueba la configuración de forma estática. DNS, certificados, credenciales, políticas del proveedor y comportamiento del alojamiento se verifican durante los recorridos del destino.

El trabajador .NET comprueba al arrancar y cada hora si corresponde crear una copia de la base de cotizaciones, consultando las copias válidas existentes tras un reinicio. Usa la API online SQLite, comprueba integridad, genera metadatos y aplica el intervalo y la retención configurados. Los valores predeterminados son 24 horas y siete copias completas válidas. `BACKUP_DIR` selecciona la ubicación y debe apuntar al almacenamiento preparado por el operador. En Railway, las tres opciones pueden definirse como variables de `api-dotnet`; omitirlas conserva los valores predeterminados de la aplicación. Los errores de una operación se registran por su tipo y el trabajador reintenta en el ciclo siguiente. [OPERACIONES.md](OPERACIONES.md) documenta SHA-256, bloqueo entre procesos, recuperación mediante Python y las bases adicionales que el operador debe respaldar.

La web 2.2.1 acepta temporalmente la respuesta de historial de la API 2.1 que contiene `quotes` y carece de `nextCursor`, hasta el límite anterior de 200 registros. En ese caso muestra el historial recibido sin una página siguiente. Las respuestas del contrato actual mantienen páginas de 20 y cursor `v1`. Tras actualizar los servicios, verifica la paginación completa y el aislamiento con dos cuentas.

Antes de cambiar versión, conserva un artefacto identificable y respaldos verificados. Para revertir, detén las escrituras y selecciona el artefacto previo con una base compatible. Restaura los datos a una ruta nueva, comprueba contenido e integridad y configura explícitamente `DATABASE_PATH` al reiniciar. La recuperación del estado cifrado de sesión requiere el mismo `SESSION_SECRET`. Las sesiones caducadas conservan esa caducidad y una rotación de clave obliga a iniciar sesión de nuevo.

Los textos comerciales de Dulce Atelier y los precios de muestra requieren confirmación del responsable. La copia externa, Google y Decolecta reales, las condiciones legales, el control de IP del proxy y la recuperación en Railway conservan sus pruebas de aceptación pendientes. El acta local registra el estado de cada punto de auditoría y sus evidencias.

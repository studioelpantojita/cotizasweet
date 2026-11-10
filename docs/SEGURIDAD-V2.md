# Revisión de seguridad de CotizaSweet 2.0.0

Fecha de revisión local: 10 de noviembre de 2026. Esta revisión corresponde a la copia independiente 2.0.0. Las comprobaciones usan identidades, secretos efímeros, respuestas RUC ficticias y bases temporales. No importan el historial ni la configuración privada de la instalación anterior.

## Identidad, permisos y separación de datos

La aplicación conserva el flujo OIDC de código de autorización con PKCE S256, `state` y `nonce`. La sesión del navegador usa una cookie opaca `HttpOnly` y `SameSite=Lax`; con un origen HTTPS se activa `Secure` y el prefijo `__Host-`. El token de acceso se conserva en el servidor dentro del estado cifrado con AES-256-GCM. Cerrar sesión elimina ese estado.

Las API .NET y Python validan firma RS256, emisor, audiencia, expiración y las reclamaciones de identidad requeridas. Lectura y escritura requieren respectivamente `quotes:read` y `quotes:write`. El propietario se deriva de emisor y sujeto mediante SHA-256; las consultas SQLite filtran por ese propietario y utilizan parámetros SQL. El emisor de identidad incluido con el lanzador funciona exclusivamente en desarrollo y comparte una cuenta de prueba. Antes de publicar deben configurarse identidades reales y verificarse los permisos en el proveedor elegido.

Las operaciones de escritura del intermediario web exigen el origen exacto configurado. Las credenciales del proveedor RUC permanecen en el servicio Python. La clave de integración autentica las solicitudes entre servicios, y las respuestas de error no reproducen la respuesta privada del proveedor.

## Validación de solicitudes y contrato compartido

Los tres backends exigen el tipo de medio `application/json`; aceptan parámetros y diferencias de mayúsculas, y rechazan un `charset` declarado distinto de `UTF-8` con HTTP 415. El lector web y el Python limitan el cuerpo a 70.000 bytes reales, rechazan JSON inválido, UTF-8 malformado, sustitutos Unicode sin pareja y estructuras con profundidad superior a 64. .NET establece el mismo tamaño máximo en Kestrel y utiliza el lector JSON del runtime.

La migración a Zod 4 usa el exportador nativo de JSON Schema. Se conservaron los objetos cerrados de cotización, servicio, material, configuración e identidad RUC: los campos desconocidos se rechazan en lugar de almacenarse como información adicional. Las pruebas directas Python y .NET cubren cada uno de esos niveles. Los esquemas y reglas de negocio siguen validándose en el servidor; las cotizaciones nuevas requieren las versiones actuales de formulario y precios. No cambian las monedas ni las condiciones comerciales existentes.

## Límites y consultas RUC

La lectura y escritura de los tres backends tienen un límite de 120 solicitudes por minuto, propietario y operación. Los contadores de .NET y Python son de memoria; Python limita además el número de grupos de contadores a 10.000. El backend Next conserva los contadores en SQLite, por lo que sobreviven a sus reinicios y se comparten entre procesos que usan la misma base. Los rechazos devuelven HTTP 429 con `Retry-After`. El intermediario web conserva ese estado y solo propaga esperas numéricas de 1 a 3.600 segundos; ante una cabecera ausente o inválida utiliza 60 segundos. La respuesta no incluye el cuerpo privado del servicio de origen.

Los límites públicos web para inicio de sesión, validación y RUC se describen en `MEJORAS-WEB.md`. Sus contadores se guardan en SQLite. Por defecto se usa el tope global; la variable `TRUSTED_CLIENT_IP_HEADER` solo debe habilitarse detrás de un proxy que elimine y reemplace la cabecera recibida. Compose transmite esa variable al servicio web, con valor vacío predeterminado.

La caché RUC conserva resultados durante cinco minutos y hasta 500 entradas. Las consultas concurrentes del mismo RUC y proveedor comparten una sola llamada externa. Hasta cuatro RUC distintos pueden consultarse simultáneamente; un quinto recibe HTTP 429 sin crear una cola ilimitada. La espera de red ocurre fuera del bloqueo de caché, por lo que una fuente lenta no bloquea resultados ya almacenados. La desconexión de un consumidor no cancela la consulta compartida con otros consumidores. El presupuesto de consultas nuevas se mantiene en 30 por minuto para cada proceso Python.

Python limita la respuesta del proveedor a 16 KB y diez segundos totales. El cliente .NET aplica 16 KB y doce segundos para comunicarse con el servicio RUC. Se rechazan redirecciones y respuestas incongruentes. Los errores son genéricos. Una consulta correcta de demostración se identifica expresamente como ficticia y no equivale a una consulta real en SUNAT.

## Configuración y operación

El arranque .NET rechaza un emisor OIDC con credenciales, consulta o fragmento, una audiencia vacía, claves internas fuera del formato requerido y HTTP local habilitado fuera de desarrollo. El servicio RUC Python comprueba proveedor y clave interna al arrancar; rechaza el proveedor de demostración y la excepción HTTP local fuera de desarrollo. Si se selecciona Decolecta en producción, exige su credencial. El proveedor `disabled` permite una instalación explícitamente sin consultas RUC; el preflight comercial permanece más estricto y exige un proveedor real.

El script de preflight es una comprobación estática, sin red. Los procedimientos de respaldo y restauración verificada se describen en `OPERACIONES.md`. SQLite guarda el contenido de las cotizaciones sin cifrado de aplicación: los volúmenes y respaldos requieren controles de acceso y la protección correspondiente al alojamiento. El cifrado del estado de sesión no cifra las cotizaciones.

## Evidencia local focalizada

| Comando desde la raíz | Resultado de esta revisión |
|---|---|
| `python -m pytest tests/security_backend -q` | 44 pruebas aprobadas. |
| `dotnet run --project tests/security_backend/DotnetSecurityChecks.csproj -c Release` | 36 aserciones aprobadas, compilación Release. |
| Desde `web`: `node scripts/run-ts.cjs tests/http-security.test.ts` | 10 pruebas aprobadas, incluida la propagación segura de HTTP 429 y las cuotas persistentes de lectura/escritura Next por propietario. |

La ejecución local utilizó los paquetes instalados y un feed NuGet local, sin añadir credenciales. La suite Python emitió un aviso de deprecación de FastAPI/Starlette sobre el uso de TestClient con HTTPX; no produjo fallos. El harness .NET mantiene su archivo de bloqueo para la restauración en un entorno limpio.

Las pruebas de integración, navegador, finanzas, mutación y operación tienen sus propios resultados y alcances en el acta general de la entrega. La tabla anterior identifica únicamente las comprobaciones focalizadas de esta revisión; no afirma que un servicio externo se haya verificado.

## Alcance y comprobaciones pendientes de publicación

Esta revisión proporciona evidencia reproducible local; no es una certificación externa ni una garantía de ausencia de vulnerabilidades. No confirma el destino de alojamiento, DNS, HTTPS, ejecución de contenedores, registro OIDC comercial ni credenciales RUC reales. La integración continua está preparada y su primera ejecución en la cuenta personal de GitHub debe confirmarse después de publicar el repositorio.

El historial devuelve las últimas 200 cotizaciones y puede producir respuestas grandes. Una fila histórica corrupta puede impedir cargar ese historial; la paginación y recuperación por registro quedan pendientes. Los límites de memoria y la caché RUC se dimensionan por instancia; varias réplicas requieren un almacén compartido y nuevas pruebas de carga. Los topes globales web reducen consumo, pero un atacante puede agotarlos temporalmente: el proxy debe añadir controles y dimensionarse según el tráfico previsto.

Antes del uso comercial se requieren las comprobaciones del despliegue y una restauración ensayada, datos comerciales confirmados, credenciales vigentes y una política de respaldo y conservación. La publicación y la creación de un repositorio remoto no se realizan mediante estas pruebas.

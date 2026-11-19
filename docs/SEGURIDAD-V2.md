# Revisión de seguridad de E&A Cotiza 2.2.0

Documento revisado el 19 de noviembre de 2026 para la entrega local 2.2.0. Las comprobaciones de aplicación usan cuentas sintéticas, claves efímeras, RUC de demostración y bases temporales. La publicación en GitHub y la CI remota de esta versión quedan pendientes de aprobación expresa del propietario.

El acceso conserva Authorization Code con PKCE S256, `state` y `nonce`. La transacción dura diez minutos y se consume una vez. El cliente `openid-client` verifica el ID token y su firma. La cookie lleva un identificador opaco, `HttpOnly` y `SameSite=Lax`; con HTTPS usa `Secure` y prefijo `__Host-`. El estado se cifra con AES-256-GCM y el identificador de sesión se almacena como hash. El cierre de sesión revoca ese estado.

El perfil preparado para el despliegue es Google. Solicita `openid profile email` y verifica emisor, audiencia del cliente web, expiración, sujeto y correo verificado. Si aparece `azp`, debe identificar al cliente autorizado, y los tokens con varias audiencias requieren esa comprobación. La web conserva el ID token cifrado para las llamadas internas a la API. La identidad verificada recibe los permisos propios `quotes:read` y `quotes:write` para sus cotizaciones. El propietario deriva del emisor y `sub`, con filtro de propietario aplicado en cada consulta. [GOOGLE.md](GOOGLE.md) y [AUTENTICACION.md](AUTENTICACION.md) detallan la configuración y la aceptación con cuentas reales.

En el perfil OIDC estándar, el fallback de `scope` omitido usa los permisos solicitados conforme a RFC 6749 §5.1 y conserva la intersección de permisos de cotización. Un alcance explícitamente vacío conserva cero permisos. Con el motor Next y alcance omitido, el access token debe ser un JWT RS256 verificable por JWKS con emisor, audiencia, sujeto, emisión y expiración válidos y el mismo sujeto que el ID token. Los permisos efectivos también quedan acotados por los del JWT. Los motores .NET y Python verifican los tokens y permisos al recibir cada petición.

La sesión dura como máximo una hora y queda limitada también por la caducidad del ID token y la duración informada por el proveedor. El guardado y el cierre de sesión exigen el origen configurado. Las API verifican autorización Bearer y las llamadas RUC entre servicios utilizan una clave interna independiente. Los valores de identidad enviados en formularios o cabeceras de usuario carecen de autoridad para seleccionar el propietario.

La web aplica CSP con nonce aleatorio por petición y `strict-dynamic` para scripts. La política de producción permite los recursos locales y blob necesarios para el PDF y limita objetos y enmarcado. Zod se configura sin JIT para conservar esa política durante las validaciones. Las respuestas de producción cubiertas por el proxy de Next agregan HSTS de **63072000 segundos** cuando `APP_ORIGIN` es HTTPS. El despliegue debe revisar también los recursos estáticos y la política efectiva del proxy o CDN. El navegador de producción local aprobó la hidratación, PDF.js y descarga con cero infracciones CSP.

Las entradas de cotización exigen `application/json` con UTF-8. Los lectores web y Python limitan el cuerpo a 70000 bytes reales y rechazan UTF-8 inválido, JSON malformado, sustitutos Unicode aislados y profundidad excesiva. .NET aplica el límite de cuerpo en Kestrel y el lector JSON del runtime. Los objetos cerrados del contrato rechazan campos desconocidos en cotización, servicio, material e identidad tributaria. El servidor valida versiones y recalcula importes en céntimos enteros.

El historial devuelve páginas de **20 filas** mediante cursor por fecha e ID, con consulta parametrizada y propietario verificado. El cliente valida cada fila de forma independiente. Un payload JSON defectuoso o una propuesta de versión anterior conserva las propuestas compatibles de la página. Las entradas anteriores se muestran como «Versión anterior» y el control de reapertura se ofrece a las compatibles. La paginación controla fechas empatadas, inserciones nuevas, cursores inválidos y duplicados y conserva las entradas ya cargadas ante un fallo de la siguiente página. La tolerancia a payloads defectuosos presupone metadatos de ID y fecha generados por los escritores de la aplicación.

La lectura y escritura tienen límites por propietario y operación de 120 solicitudes por minuto. Next conserva sus contadores en SQLite y .NET y Python usan memoria por proceso. Los límites públicos de login, validación y RUC también persisten en SQLite web. `TRUSTED_CLIENT_IP_HEADER` parte vacío y se habilita cuando se verifique que el proxy reemplaza la cabecera recibida del cliente. Los rechazos HTTP 429 propagan una espera numérica acotada y errores saneados.

La ruta web RUC exige `X-Cotiza-Request: ruc`, comprueba el origen cuando está presente y admite `Sec-Fetch-Site` ausente o `same-origin`. La protección del navegador precede al consumo de cuota. La cuota diaria persistente se conserva en `RUC_QUOTA_PATH` dentro del tercer volumen y parte de 500 intentos por día civil de Perú. La reserva es atómica y ocurre antes de contactar a Decolecta, incluidos los intentos que terminan con error. Ante agotamiento devuelve HTTP 429 y espera hasta la siguiente medianoche de Perú. Un fallo al comprobar el contador impide la consulta y devuelve HTTP 503.

La caché RUC dura cinco minutos y admite 500 entradas. Las solicitudes concurrentes del mismo RUC y proveedor comparten la llamada. Se permiten hasta cuatro consultas externas distintas simultáneas y 30 consultas nuevas por minuto por proceso. El servicio limita tamaños, tiempos y redirecciones y verifica que la respuesta corresponda al RUC solicitado. La razón social se vuelve a verificar al guardar o generar el PDF. Las pruebas de demostración identifican su origen ficticio en pantalla y documento.

El arranque valida la configuración y restringe HTTP local al entorno de desarrollo. El perfil Google de producción exige su emisor oficial y audiencia de cliente web. El servicio Python rechaza el modo demo fuera de desarrollo y requiere la credencial cuando se selecciona Decolecta. El preflight es estático y comprueba por separado el perfil Google y el estándar, HTTPS, claves, URLs internas, cuota y proveedor real.

El trabajador .NET crea un snapshot consistente mediante la API SQLite cuando han transcurrido al menos 24 horas desde la última copia completa válida, con comprobación al arrancar y cada hora. Verifica integridad, publica metadatos de tamaño y SHA-256 y conserva las siete copias válidas más recientes. Recalcula el hash para reconocer una copia completa, con una regresión que altera un byte conservando el tamaño. La restauración mediante Python verifica ese formato y crea un destino nuevo. La copia externa, retención fuera del volumen y restauración real del alojamiento siguen pendientes. [OPERACIONES.md](OPERACIONES.md) contiene el procedimiento.

| Evidencia local | Resultado registrado |
|---|---|
| TypeScript | 42 pruebas de siete suites |
| Python | 91 pruebas y 51 subpruebas |
| .NET | 96 aserciones de seguridad, identidad, historial y copias |
| Integración | 852 aserciones en seis combinaciones de motor y perfil |
| Navegador integrado | 22 comprobaciones por perfil, sin excepciones ni infracciones CSP |
| Producción local | 11 comprobaciones de navegador y cinco rutas públicas |
| PDF | 12 archivos y 35 páginas con firma vectorial y texto dentro de página |
| Dependencias | Auditorías npm, Python y NuGet sin vulnerabilidades conocidas en la ejecución registrada |
| Docker local | Tres servicios y tres volúmenes, UID de aplicación 1000, 1654 y 10001, cuotas persistentes, respaldo y reinicio aprobados |

Los informes de `tests/artifacts` conservan el resultado y alcance de sus suites. Las nueve mutaciones dirigidas de Python y los 1565 casos financieros amplían la comprobación de reglas concretas. La carga pública local de 80 solicitudes con concurrencia 8 obtuvo p95 de 66,54 ms en el informe registrado. Esa medición corresponde al equipo y ejecución indicados y requiere repetirse con la carga esperada del destino.

La restauración local .NET utilizó dependencias disponibles en un feed local y la auditoría complementaria consultó el servicio oficial NuGet. El workflow conserva la restauración limpia con NuGet Audit como requisito para su futura aprobación remota. El propietario ejecutó el smoke Docker desde su terminal con acceso al motor y el informe final quedó aprobado. La incidencia de decodificación de salida Windows se sigue en el cierre técnico de esta entrega.

El contenido de cotizaciones permanece en SQLite y requiere control de acceso a volúmenes y respaldos. El cifrado de la sesión protege su estado del servidor. Los metadatos SHA-256 permiten verificar integridad respecto a la copia conservada y su protección depende también de los permisos del almacenamiento.

La aceptación de producción requiere configurar y probar Google real, una credencial nueva de Decolecta, dominio HTTPS, cabecera IP del proxy, controles de presupuesto de hasta US$30 mensuales, copia externa y recuperación del alojamiento. Los datos comerciales, privacidad y términos requieren confirmación del responsable conforme a la operación efectiva. Esta revisión local permite comprobar cada control implementado y deja registradas esas verificaciones externas pendientes.

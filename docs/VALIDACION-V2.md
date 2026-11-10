# Acta de validación técnica · CotizaSweet 2.0.0

**Fecha de cierre:** 10/11/2026 13:13 UTC-05:00 · Colombia/Perú. **Ámbito:** copia independiente local en Windows.

**Dictamen: validación funcional y técnica local aprobada para revisión. La publicación comercial permanece pendiente de configuración y pruebas en el alojamiento elegido.** Esta acta documenta la revisión realizada y sus evidencias; no es una certificación de un tercero, un pentest externo ni una garantía de ausencia de defectos.

## Procedencia y alcance

Se revisó el chat CotizaSweet_micropp y el código existente de la aplicación integrada. Se creó una distribución nueva 2.0.0, conservando la copia anterior. No se importaron clientes, cotizaciones, bases, sesiones, logs, tokens ni configuración privada anteriores. Las pruebas utilizaron exclusivamente identidades, documentos y bases sintéticas.

Se conservaron Home, catálogo, 17 referencias visuales, servicios personalizados, precios y datos referenciales señalados como muestra, monedas PEN/USD sin conversión, recojo/entrega, movilidad, IGV, anticipo, PDF e historial. No se inventaron disponibilidad, identidad legal, tarifas comerciales ni integraciones externas. La versión de distribución 2.0.0 no modifica los identificadores históricos de formulario/precios 1 y 2.

La arquitectura mantiene Next.js/TypeScript como interfaz y BFF, ASP.NET Core .NET 10 para el API integrado y Python para RUC; los backends alternativos también se verificaron. Mantener tres implementaciones exige preservar contratos y paridad, por lo que se añadieron comprobaciones cruzadas.

## Evaluación y mejoras priorizadas

| Prioridad | Hallazgo del código anterior | Mejora entregada y evidencia |
|---|---|---|
| P0 | Dependencias señaladas por avisos posteriores a la versión anterior | Next.js 16.4.6, Zod 4.6.7, DOMPurify 3.4.17 mediante override y Certifi 2026.10.23. Archivos de bloqueo actualizados. Auditorías actuales sin coincidencias conocidas en el ámbito revisado. |
| P1 | Rutas públicas podían agotar solicitudes o crear transacciones de login sin cuota de entrada | Límites persistentes SQLite para login, validación, RUC y cotizaciones locales por propietario; límites por propietario en APIs .NET/Python. HTTP 429 y Retry-After se conservan en el BFF. La IP reenviada solo se usa si se configura un proxy confiable. |
| P1 | Lectores JSON duplicados y tipo MIME por prefijo | Lector Next unificado, application/json exacto, UTF-8, 70.000 bytes reales, profundidad acotada y rechazo de contenido inválido; comportamiento alineado en backends. Contrato cerrado a campos desconocidos. |
| P1 | Un lock global RUC abarcaba la espera de red | Hasta cuatro consultas distintas simultáneas, deduplicación por RUC, caché y presupuestos acotados, plazos/tamaños máximos y aislamiento de cancelaciones. Verificado con proveedor simulado; no acredita una consulta real. |
| P1 | Abrir una propuesta RUC podía borrar el nombre guardado o provocar una consulta automática nueva | Se conserva la identidad histórica y se bloquean respuestas tardías. Guardar o emitir un PDF nuevo sigue verificándola. Navegador comprobó conservación y reintento explícito fallido. |
| P2 | Faltaban herramientas de recuperación y una puerta de configuración verificable | Respaldo online SQLite con WAL, integridad/SHA-256 y restauración únicamente a archivo nuevo. Preflight estático que rechaza la configuración de ejemplo. Pruebas operativas sintéticas. |
| P2 | Faltaban controles reproducibles para la siguiente fase en GitHub | Workflow de calidad, Dependabot, scripts, guías de operación/despliegue y manifiesto SHA-256. La primera ejecución remota de Actions queda pendiente. |

La revisión cruzada detectó y corrigió dos regresiones durante la implementación: pérdida de additionalProperties:false al migrar el esquema y transformación de 429 en 503 en el intermediario. Las pruebas finales corresponden a los archivos entregados.

## Matriz de pruebas ejecutadas

| Categoría solicitada | Comprobación y resultado final |
|---|---|
| Unit Tests | 32 pruebas TypeScript en cinco suites. 70 pruebas Python y 40 subpruebas, que incluyen seguridad, catálogo, operaciones y rangos NuGet. 36 aserciones de seguridad .NET. Aprobadas. |
| Integrated Tests | 307 aserciones HTTP con procesos reales, ejecutadas sobre Next, Python y .NET: OIDC/PKCE, issuer/audience/expiración, scopes, CSRF, aislamiento de cuentas, persistencia, RUC demo y contratos. Aprobadas. |
| End-to-End | 18 comprobaciones con Microsoft Edge/Chromium mediante Playwright: Home, búsqueda sin tildes, formulario inválido, cartera/precio explícito, USD, recojo, vista PDF.js, descarga, login, borrador, guardado/historial/reapertura, recarga, viewport móvil y RUC histórico. Sin errores de navegador no capturados. |
| Performance Test | Bundle de producción local: 80 solicitudes HTTP, concurrencia 8, p50 39.35 ms, p95 77.23 ms, máximo 151.26 ms; lote 0.473 s. Umbrales previos: p95 inferior a 2.000 ms y lote inferior a 30 s. Componente SQLite: 64 escrituras/8 trabajadores, p95 206,33 ms y lote 0,476 s; umbrales 2.500 ms/30 s. Aprobados. |
| Smoke Test | Inicio, catálogo, cotizador y salud sobre bundle de producción; API privada rechaza anónimos. Lanzador local independiente comprobado: web, .NET, servicio RUC e identidad dev responden 200. |
| Mutations Test | Nueve mutantes reales dirigidos sobre finanzas y validación Python, ejecutados en memoria aislada: nueve detectados, cero supervivientes. El 100% aplica a ese conjunto, no a todo el repositorio. |
| Security Test | Identidades inválidas, permisos, aislamiento, CSRF, cuotas, formato/tamaño/codificación, campos desconocidos, SQL parametrizado, respuestas RUC saneadas y configuración insegura. Auditorías npm y Python sin avisos conocidos; 19 paquetes NuGet resueltos sin coincidencias en el feed oficial. |
| Regression Test | Oráculo Decimal independiente: 1.565 escenarios válidos y 33 inválidos en cada uno de los tres motores. 12 PDF/35 páginas, sin caracteres fuera de los límites; revisión visual representativa y descarga real del navegador. |

Los presupuestos de rendimiento se fijaron antes de ejecutar. Son mediciones locales con datos sintéticos y no establecen capacidad pública, SLA ni resistencia a ataques distribuidos. El viewport móvil es emulado; no se probaron todos los dispositivos ni navegadores.

## Código, datos y compilación

Next.js compiló el bundle de producción y TypeScript pasó sin errores. La solución .NET y sus sondas compilaron en Release sin advertencias ni errores en las ejecuciones finales. Se verificó instalación limpia npm ci en un directorio independiente, instalación nueva de las dependencias Python y pip check. NuGet se restauró desde un feed/caché local verificados por lock ante una limitación TLS del cliente .NET; su auditoría complementaria descargó el índice/base/update oficiales con verificación TLS activa. La auditoría NuGet estándar permanece como requisito de CI remoto.

Los cálculos mantienen centavos enteros, redondeo y máximos dentro de rangos seguros. Se verificaron escrituras concurrentes, IDs únicos, separación de propietarios, reapertura, quick_check=ok, respaldo y restauración equivalente. Estas comprobaciones se aplican a las bases sintéticas; no se auditó ni migró la base privada anterior. Las cotizaciones permanecen en SQLite; el cifrado de sesiones no equivale a cifrado de toda la base de cotizaciones.

La suite Python emite un aviso de deprecación de Starlette/TestClient por HTTPX; no produjo fallos. Debe revisarse al actualizar ese entorno de pruebas.

## Despliegue: comprobado y pendiente

La configuración Compose pasó config --quiet. El daemon Docker no estaba activo: no se construyeron/ejecutaron imágenes ni se escanearon sus capas/sistema operativo. El preflight de ejemplo se rechazó correctamente y sus pruebas incluyen configuración sintética válida; no se aprobó una configuración real de producción.

Antes de publicar: proveedor OIDC real con dos usuarios independientes, origen y proxy HTTPS, token RUC nuevo y válido, secretos propios, identidad/contactos/precios/políticas comerciales confirmados, volúmenes y respaldo restaurable, construcción/escaneo de imágenes y smoke en el host elegido. La credencial RUC histórica expuesta debe revocarse y reemplazarse; no se reutilizó ni se incluyó en esta entrega.

GitHub alojará el repositorio y ejecutará CI. GitHub Pages es estático y no ejecuta las APIs, sesiones y SQLite de esta arquitectura. El repositorio, su visibilidad, la primera ejecución de Actions y el alojamiento funcional se tratarán en la guía que el usuario solicitará después. No se crearon ni publicaron recursos externos.

Límites pendientes para una escala mayor: paginación del historial (actualmente hasta 200 propuestas), coordinación de límites/cachés entre réplicas, política operativa de retención y copias, observabilidad y evaluación externa de seguridad. Los límites globales actuales pueden agotarse; requieren dimensionamiento y protección del proxy según tráfico real. Los respaldos son por base y no coordinan transacciones entre servicios.

## Ejecución y entrega

La copia local se preparó y se inició en http://127.0.0.1:3340/; cotizador en /cotizar y catálogo en /catalogo. Usa puertos 3340/8340/8341/9340 y una identidad compartida exclusivamente de desarrollo. El token RUC real permanece pendiente. Al cerrar servicios o reiniciar Windows, abrir INICIAR-EN-VISUAL-STUDIO.slnx y pulsar F5, o seguir README.md. La dirección está disponible solo mientras el lanzador siga activo.

El ZIP de fuentes excluye dependencias instaladas, binarios, compilaciones, bases, backups, logs y configuración privada. SHA256SUMS.txt permite verificar sus archivos. El ZIP de evidencias contiene exclusivamente resultados, PDF y capturas sintéticos seleccionados, con un manifiesto propio. Las instrucciones reproducibles están en README.md, docs/CI.md, docs/OPERACIONES.md y docs/DESPLIEGUE.md.

## Fuentes de seguridad y plataforma

- [Aviso oficial de Next.js sobre optimización de imágenes y versión corregida](https://github.com/vercel/next.js/security/advisories/GHSA-2464-fhr4-w9xw).
- [Aviso oficial DOMPurify y parche 3.4.17](https://github.com/cure53/DOMPurify/security/advisories/GHSA-cg2g-xh64-v4q7).
- [Aviso oficial Certifi y retirada de raíces comprometidas](https://github.com/certifi/python-certifi/security/advisories/GHSA-6q48-6c7w-9gw2).
- [Servicio oficial de vulnerabilidades NuGet](https://learn.microsoft.com/en-us/nuget/api/vulnerability-info).
- [Alcance de alojamiento de GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages).

Las auditorías describen avisos conocidos disponibles en la fecha de ejecución. Deben repetirse al desplegar y actualizar dependencias.

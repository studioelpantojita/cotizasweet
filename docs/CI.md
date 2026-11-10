# Integración continua en GitHub

El archivo `.github/workflows/ci.yml` define una comprobación de calidad para un checkout limpio de la raíz de esta aplicación. Se activa en propuestas de cambio, al actualizar `main`/`master` y mediante ejecución manual. El repositorio público personal [studioelpantojita/cotizasweet](https://github.com/studioelpantojita/cotizasweet) está publicado. Su [primera ejecución completa de calidad](https://github.com/studioelpantojita/cotizasweet/actions/runs/42917172073) aprobó el commit `7bc13f2537078729a5a558985f51979d5d8ef661` el 10 de noviembre de 2026. [UPGRADE-2.1.md](UPGRADE-2.1.md) distingue sus resultados de los antecedentes locales.

El job `quality-windows` usa una máquina de GitHub `windows-2025`, Node.js 24, Python 3.12, .NET SDK 10 y Chromium de Playwright. Las dependencias JavaScript se instalan con `npm ci`; .NET restaura con sus archivos de bloqueo y `--locked-mode`; Python utiliza las versiones indicadas en `api-python/requirements.lock.txt` y `requirements-qa.txt`. Las versiones de parche del runtime y la imagen hospedada pueden actualizarse: las versiones efectivas se registran en las salidas de las acciones de instalación y el informe financiero incluye Python/SQLite/SO. Las dependencias tienen caché por archivo de bloqueo, sin rutas de esta computadora. Estas opciones siguen las interfaces documentadas de [setup-node](https://github.com/actions/setup-node), [setup-python](https://github.com/actions/setup-python) y [setup-dotnet](https://github.com/actions/setup-dotnet).

## Comprobaciones obligatorias

| Etapa | Resultado exigido |
|---|---|
| Instalación y compatibilidad | Instalación reproducible desde manifiestos y `pip check` sin incompatibilidades. |
| Dependencias JavaScript | `npm audit --audit-level=moderate` aprobado. Las vulnerabilidades de severidad moderada, alta o crítica hacen fallar el job. |
| Dependencias Python | `python -m pip_audit -r api-python/requirements.lock.txt --disable-pip --no-deps` aprobado. Las vulnerabilidades notificadas hacen fallar el job. |
| Dependencias .NET | Restauración bloqueada, auditoría NuGet de dependencias directas y transitivas; advertencias de restauración se consideran errores. La configuración de [NuGet Audit](https://learn.microsoft.com/en-us/nuget/concepts/auditing-packages) permite auditar el árbol y tratar los avisos como errores. |
| Contratos y TypeScript | Generación previa de tipos de rutas con `next typegen` para un checkout limpio; comprobación de tipos y regeneración de contratos sin diferencias respecto al commit. `npm test` es el agregador de las seis suites de dominio, catálogo, presentaciones, servicios, seguridad HTTP y URL de servicios; produce `tests/artifacts/unit-results.json`. |
| Compilación | Bundle de producción Next.js, aplicación y lanzador .NET, programa de comprobaciones de seguridad y sonda de paridad compilados en Release. |
| PDF | Generación de muestras sintéticas; presencia de al menos once PDF y comprobación de texto, importes y límites de página. |
| Python y operaciones | Catálogo y pruebas pytest de seguridad, entradas, operación y evaluación de rangos del auditor NuGet. |
| Seguridad .NET | Ejecución de las aserciones del programa `DotnetSecurityChecks`. |
| Finanzas, datos y rendimiento | Oráculo independiente, paridad TS/Python/.NET, mutaciones dirigidas, concurrencia, durabilidad y recuperación SQLite según `tests/v2/README.md`. |
| Servicios y navegador | `RUN_BROWSER_E2E=1 python tests/integration.py --backend all`: los tres backends en procesos reales, identidad OIDC efímera, scopes, CSRF, separación de cuentas, smoke y regresión. Chromium ejecuta el recorrido del formulario, guardado/historial, PDF y vista móvil sobre la variante .NET integrada. |

Los pasos no usan `continue-on-error`. Las secuencias PowerShell verifican los códigos de salida de cada programa; un fallo o la indisponibilidad del servicio de auditoría deja la ejecución sin aprobar. Si una actualización cambia los contratos, se regeneran y revisan localmente antes de confirmar los archivos en Git. El job no actualiza dependencias ni confirma cambios por su cuenta.

## Auditoría complementaria de NuGet

`python scripts/audit_nuget.py` lee las versiones resueltas directas y transitivas de `api-dotnet/packages.lock.json` y descarga el índice y todas sus páginas del [servicio oficial de vulnerabilidades NuGet](https://learn.microsoft.com/en-us/nuget/api/vulnerability-info). Mantiene la verificación TLS, deshabilita el uso de proxies del entorno, rechaza redirecciones y limita las respuestas a endpoints oficiales HTTPS. `tests/artifacts/nuget-audit.json` conserva únicamente versiones, avisos y metadatos de origen con SHA-256; no contiene credenciales.

El comparador exige versiones instaladas estables, con uno a cuatro segmentos numéricos. Admite extremos estables o de prelanzamiento SemVer en los [rangos NuGet](https://learn.microsoft.com/en-us/nuget/concepts/package-versioning#version-ranges): una versión estable supera a su prelanzamiento con el mismo núcleo numérico; los identificadores numéricos de prelanzamiento se comparan como números y los demás sin distinguir mayúsculas, según NuGet. Una versión instalada o un rango relevante no soportado produce resultado **indeterminado**, nunca una aprobación. Los códigos de salida son 0 sin coincidencias conocidas, 1 si alguna coincide y 2 si la auditoría no pudo completarse. Es complementaria: NuGet Audit de restauración sigue siendo obligatorio en CI. No cubre el runtime compartido, el sistema operativo ni las imágenes de contenedor.

## Datos, permisos y evidencias

El workflow usa `permissions: contents: read` y checkout sin credenciales Git persistentes. No contiene secretos de despliegue ni requiere el token real de RUC: las pruebas generan claves efímeras, usuarios sintéticos, bases temporales y respuestas RUC marcadas como demostración. No utiliza el emisor local como autenticación de producción. El comportamiento de permisos Git del checkout está documentado en [actions/checkout](https://github.com/actions/checkout).

Tras pasar todas las comprobaciones, se guardan durante catorce días exclusivamente los informes, PDF y capturas sintéticos enumerados en `tests/artifacts`. No se suben registros de servicios, trazas, bases de sesión, configuración privada ni URLs de retorno OIDC. El paso de subida usa una lista de rutas y `if: success()`; sus controles de rutas y retención están documentados en [upload-artifact](https://github.com/actions/upload-artifact). Un job fallido conserva su estado y su salida de consola, pero no publica un paquete de evidencias.

`.github/dependabot.yml` prepara propuestas semanales de actualización para acciones, npm, Python y los proyectos NuGet. No activa fusión automática. Toda actualización debe pasar esta misma batería y ser revisada antes de incorporarse.

## Contenedores e infraestructura

`.github/workflows/containers.yml` construye las tres imágenes en Ubuntu 24.04 y ejecuta `tests/container_smoke.py` con red, contenedores y volúmenes desechables. Su [primera ejecución](https://github.com/studioelpantojita/cotizasweet/actions/runs/42917172101) aprobó arranque, protección de endpoints, UID no root y persistencia después de reiniciar. Publica exclusivamente el informe sintético saneado `container-smoke.json`, incluso si falla el job; no sube logs ni variables.

`.github/workflows/infrastructure.yml` instala el SDK Railway bloqueado, verifica tipos y el grafo offline de tres servicios/dos volúmenes, audita dependencias y revisa la sintaxis del entrypoint. Su [primera ejecución](https://github.com/studioelpantojita/cotizasweet/actions/runs/42917172546) está aprobada. No conecta una cuenta Railway ni crea recursos.

## Alcance pendiente

Los tres workflows iniciales están aprobados; cada cambio posterior debe consultar su propia ejecución. El job de calidad no publica una web. La construcción y el arranque Docker tienen su workflow separado; HTTPS y DNS públicos, identidad OIDC comercial, proveedor RUC real, alojamiento, política operativa de respaldo y condiciones del negocio requieren comprobación en el destino. Estos elementos pertenecen a la fase de despliegue con Railway.

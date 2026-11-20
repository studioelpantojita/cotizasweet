# E&A Cotiza 2.2.1 · Aportes incorporados y validación local

Fecha de ejecución y revisión: 20 de noviembre de 2026. Esta actualización parte del commit local `a3e5f4c55062fc776a1523a14ab187a05b532a02` de 2.2.0 y se prepara en una carpeta independiente. La publicación en GitHub requiere la aprobación expresa del propietario.

## Procedencia y selección

Se revisó la propuesta de [luis-the-goat, PR 20](https://github.com/studioelpantojita/cotizasweet/pull/20), referencia `mejoras/historial-respaldos-seguridad`, commit `fc1dfb0c289a5470df4dc4062eeb0ce91792e68b`. La comparación con 2.2.0 permitió seleccionar tres aportes necesarios y adaptarlos al código local. La referencia identifica la versión examinada, aunque la propuesta remota cambie posteriormente.

| Aporte | Resultado en 2.2.1 | Verificación principal |
|---|---|---|
| Opciones operativas de respaldo .NET | `BACKUP_DIR`, `BACKUP_INTERVAL_HOURS` y `BACKUP_KEEP`, validadas antes de crear la base. Defaults de 24 horas y siete copias válidas. Intervalo `0` desactiva la operación | Aserciones .NET de configuración, límites, desactivación, calendario y retención. Integración HTTP con destino personalizado y verificación interoperable |
| Recuperación del trabajador de respaldos | Un fallo de la operación registra únicamente el tipo de excepción y permite el siguiente intento horario. La cancelación solicitada cierra correctamente el trabajador | Prueba con reloj y temporizador controlados, fallo inesperado inicial, comprobación del aviso y siguiente copia correcta |
| Historial compatible con la API 2.1 | La web acepta hasta 200 filas si falta `nextCursor`. El contrato actual mantiene páginas de 20 y cursor canónico `v1` | Pruebas de 0, 1, 41 y 200 filas antiguas, rechazo de 201 y formatos actuales inválidos. Navegador con 41 filas de una respuesta antigua |

Se mantienen el aislamiento por propietario, la clasificación de filas antiguas, los controles de Google, la CSP con nonce, la cuota RUC persistente y la marca vectorial. Los respaldos continúan comprobando contenido, SHA-256, metadatos, integridad y pertenencia al patrón del planificador antes de contar o eliminar copias. Los archivos ajenos quedan fuera de la poda. El directorio de respaldos debe dedicarse a una sola base.

No se añadieron dependencias. Los cambios de los archivos de bloqueo npm corresponden al número de versión del proyecto.

## Resultado de las comprobaciones ejecutadas

Las cifras corresponden a suites con alcances diferentes y no deben sumarse como cobertura única. Los resultados de 2.2.0 se conservan como antecedentes en su entrega.

| Familia | Resultado de esta copia 2.2.1 | Alcance |
|---|---|---|
| Compilación y tipos | Build Next.js de producción, TypeScript y soluciones .NET Release y Debug aprobados | Preparación del código y del proyecto `EA.Cotiza.Local` para Visual Studio |
| Unitarias y seguridad web | 45 pruebas aprobadas, incluidas 11 de historial | Dominio, catálogo, presentaciones, servicios, validación HTTP y URL, contrato de historial |
| Backend y operaciones Python | 94 pruebas y 123 subtests aprobados | Seguridad RUC, datos de entrada, historial, respaldos, restauración, preflight y tratamiento de avisos de dependencias |
| Backend y respaldos .NET | 123 aserciones aprobadas | Autorización, validación, historial, respaldo consistente, opciones del planificador y recuperación tras fallos |
| Integración HTTP | 856 comprobaciones aprobadas | Tres backends con perfiles sintéticos `standard` y `google`, sesiones, permisos, aislamiento, paginación, importes y respaldo configurado |
| End-to-end | 24 verificaciones aprobadas por perfil, `standard` y `google` | Navegador Edge sobre los servicios de prueba, recorrido completo, PDF, historial y respuesta de API antigua |
| Smoke de producción | Cinco rutas y 11 verificaciones de navegador aprobadas | Build de producción con TLS efímero local, cabeceras, CSP, navegación, diseño y vista previa |
| Carga HTTP local | 80 solicitudes, concurrencia 8, p95 de 137,98 ms | Rutas públicas locales del build de producción. Umbral previo de 2000 ms y lote menor de 30 segundos |
| Concurrencia SQLite | 64 escrituras confirmadas y recuperables, ocho trabajadores, p95 de 224,15 ms | Componente Python local con identidad sustituida y base SQLite real. Umbral previo de 2500 ms |
| Regresión financiera | 1565 casos y 33 entradas inválidas por motor | Paridad de importes enteros entre Python, TypeScript y .NET |
| Mutación dirigida | Nueve mutantes generados y nueve detectados | Fuente Python de finanzas y validación. No mide todo el repositorio ni el trabajador de respaldos |
| PDF | 12 documentos, 35 páginas, sin caracteres fuera de los límites comprobados | Importes, textos extensos, firma vectorial, moneda y servicios personalizados |
| Instancia para revisión manual | 11 verificaciones aprobadas en el puerto 3360 | Cuatro servicios disponibles, versión 2.2.1, acceso local, historial nuevo, RUC demo y diseño móvil sin desbordamiento horizontal |
| Configuración Compose | Aprobada | Validación de la definición con el ejemplo sintético. No ejecuta contenedores |
| Imágenes Docker de 2.2.1 | Tres servicios y tres volúmenes aprobados | Construcción y smoke ejecutados desde PowerShell del propietario, con informe local `status: passed` revisado. Usuarios finales sin root, cuotas persistentes, reinicios, controles HTTP y respaldo configurado |

La prueba Docker construyó tres imágenes de estas fuentes y verificó tres volúmenes, usuarios finales sin privilegios de root, controles de acceso, persistencia de cuotas, reinicio del volumen de cotizaciones y respaldo en un directorio personalizado. Los UID de aplicación fueron 1000 para web, 1654 para .NET y 10001 para RUC. El canal del motor Linux no estaba disponible para la sesión de Codex, por lo que el propietario ejecutó el comando preparado en su PowerShell habitual. Se revisó el informe local completo `container-smoke.json`, incluido `configured_api_backup: true`. El recorrido usó servicios y datos sintéticos, sin consultas facturables. La aceptación Docker de 2.2.0 se conserva como antecedente independiente.

Los artefactos JSON, XML, capturas y PDF de esta ejecución se entregan fuera del repositorio. `SHA256SUMS.txt` identifica las fuentes archivadas. El recibo externo vincula el commit local, el ZIP de fuentes y las evidencias mediante SHA-256. Los controles sobre avisos de dependencias incluidos en las pruebas son verificaciones del código de auditoría; no representan una consulta nueva a todos los proveedores de avisos.

## Separación de la revisión y acceso

La carpeta de esta entrega es `outputs/CotizaSweet_v2.2.1`. Tiene sus propias bases, archivos de compilación, sesiones y respaldos. No se migraron propuestas desde 2.2.0. La copia anterior conserva su carpeta y sus datos.

| Servicio de esta revisión | Puerto |
|---|---:|
| Web Next.js | 3360 |
| API .NET | 8360 |
| Servicio Python/RUC | 8361 |
| Emisor de identidad local | 9360 |

Abre [INICIAR-EN-VISUAL-STUDIO.slnx](../INICIAR-EN-VISUAL-STUDIO.slnx) para revisar el código. La cuenta sintética **Desarrollo local**, correo **local@example.test**, permite entrar desde **Iniciar sesión** sin contraseña. La consulta RUC está en modo de demostración. Las instrucciones para detener la instancia preparada, ejecutar con F5 y registrar observaciones están en [REVISION-MANUAL-2.2.1.md](REVISION-MANUAL-2.2.1.md).

Los archivos privados de acceso, las bases, los logs, los entornos virtuales y las dependencias instaladas quedan excluidos del paquete de fuentes. Una extracción nueva necesita ejecutar `scripts/setup-local.ps1` con los runtimes y puertos indicados en README antes de usar F5.

## Límites y aceptación externa pendiente

La validación local acredita los recorridos y condiciones enumerados. El reloj controlado comprueba intervalos y reintentos sin esperar días. El intervalo configurado es un mínimo y la revisión horaria puede retrasar la siguiente copia hasta casi una hora. Desactivar el respaldo no elimina las copias existentes. Cambiar su directorio requiere definir la conservación de las copias anteriores.

Antes de operar públicamente quedan pendientes el cliente Google y el inicio de sesión con cuentas reales, una credencial vigente y una consulta real de Decolecta, el alojamiento Railway con HTTPS y controles efectivos del presupuesto máximo autorizado, la copia externa y recuperación ante pérdida del volumen, y la confirmación de datos comerciales y condiciones legales. El despliegue y las pruebas remotas sobre el commit final deben realizarse después de la aprobación del propietario. El respaldo automático de .NET cubre su base de cotizaciones. Las demás bases necesitan su propia política operativa.

No se emitió una certificación externa ni una garantía de ausencia de vulnerabilidades. El resultado se entrega como evidencia técnica local para revisión del propietario. Las instrucciones operativas están en [OPERACIONES.md](OPERACIONES.md), [DESPLIEGUE.md](DESPLIEGUE.md) y [GOOGLE.md](GOOGLE.md).

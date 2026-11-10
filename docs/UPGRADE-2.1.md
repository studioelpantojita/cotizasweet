# CotizaSweet 2.1.0: publicación y validación

El código está publicado en el repositorio personal público [studioelpantojita/cotizasweet](https://github.com/studioelpantojita/cotizasweet), rama `main`. La cuenta se verificó como `User`; no es una organización. La autorización de GitHub CLI se completó y la subida inicial terminó correctamente. Archivos privados, credenciales, bases, sesiones, logs y respaldos no forman parte del repositorio.

La copia 2.0.0 y sus datos se conservan. La versión 2.1.0 agrega allowlist exacta de hosts privados Railway, validación de URL internas, preparación de volúmenes con descenso de privilegios, infraestructura IaC y workflows Linux de construcción/smoke e infraestructura. Se conservan los avisos y derechos existentes; no se asignó una licencia de código abierto nueva.

## Primera verificación remota aprobada

Las siguientes ejecuciones verificaron el commit inicial `7bc13f2537078729a5a558985f51979d5d8ef661` el 10 de noviembre de 2026. Los cambios posteriores de documentación registran esta evidencia; cada commit posterior tiene sus propios resultados en Actions.

| Workflow | Resultado | Evidencia |
|---|---|---|
| Calidad: Windows, Node 24, Python 3.12 y .NET 10 | Aprobado | [Ejecución 42917172073](https://github.com/studioelpantojita/cotizasweet/actions/runs/42917172073) |
| Construcción y smoke de tres imágenes Docker en Linux | Aprobado | [Ejecución 42917172101](https://github.com/studioelpantojita/cotizasweet/actions/runs/42917172101) |
| Tipos, grafo offline y dependencias de infraestructura Railway | Aprobado | [Ejecución 42917172546](https://github.com/studioelpantojita/cotizasweet/actions/runs/42917172546) |

Resultados de los artefactos y la consola de esa ejecución:

- 34 pruebas TypeScript en seis suites; contratos regenerados sin diferencias y bundle de producción compilado.
- 70 pruebas Python y 40 subpruebas aprobadas, sin omisiones; 41 aserciones .NET de entradas y seguridad aprobadas.
- 307 aserciones HTTP con los tres backends y servicios reales de prueba; 18 comprobaciones de navegador Chromium, incluidas cotización, historial, PDF, inicio de sesión y móvil.
- 1.565 casos financieros por motor Python/TypeScript/.NET y 33 casos inválidos por motor; nueve mutantes dirigidos de finanzas/validación Python detectados, ninguno sobrevivió.
- Persistencia SQLite: 64 escrituras concurrentes con ocho trabajadores, aislamiento de propietarios, reapertura, integridad y equivalencia de respaldo/restauración comprobadas.
- Regresión de doce PDF, 35 páginas, sin contenido fuera de página según el verificador.
- Rendimiento acotado en el runner: 80 solicitudes HTTP con concurrencia ocho, p95 de 59,58 ms; escrituras SQLite p95 de 685,05 ms. Los umbrales se definieron antes de ejecutar. Estas cifras describen esa máquina de CI y no la capacidad de Railway.
- Auditorías npm, Python y NuGet aprobadas en esa ejecución; el auditor complementario NuGet revisó 19 paquetes sin avisos conocidos coincidentes. No es una auditoría de imágenes base, runtime o sistema operativo.
- Las tres imágenes Linux arrancaron con configuración sintética, procesos principales no root (UID 1000/1654/10001), APIs protegidas y persistencia después de reiniciar.

Los resultados son evidencia técnica con el alcance descrito. La mutación cubre nueve cambios dirigidos, no todo el código. OIDC es un emisor efímero de prueba y RUC usa datos demo o el proveedor deshabilitado. No se certifica una integración externa real ni seguridad absoluta. [CI.md](CI.md) y [tests/v2/README.md](../tests/v2/README.md) describen los comandos y límites.

## Comprobaciones locales y antecedente

Antes de publicar, esta copia aprobó 34 pruebas TypeScript, 57 pruebas Python de seguridad/operaciones y 40 subpruebas, 41 aserciones .NET, compilación web, tipos del SDK, grafo offline y sintaxis del entrypoint. La integración local .NET aprobó 125 aserciones HTTP y 18 comprobaciones de navegador. La validación local de 2.0.0 se conserva en [VALIDACION-V2.md](VALIDACION-V2.md) y no se atribuye automáticamente a 2.1.0.

Docker Desktop y su cliente 29.8.1 están presentes y ejecutándose. La consola de esta sesión recibe acceso denegado al motor/configuración local; la construcción Linux se verificó en GitHub Actions. No se desactivaron protecciones ni se cambiaron permisos del equipo para sortear esa limitación.

## Despliegue funcional pendiente

Railway es el destino elegido para preparar el sistema completo: tres servicios y dos volúmenes. No se conectó la cuenta, aprobó un presupuesto mensual, contrató recursos ni desplegó la aplicación. Faltan proyecto/región, dominio HTTPS, proveedor OIDC real compatible, secretos nuevos, token RUC vigente y comprobaciones operativas en el destino. La definición actual exige un token Decolecta para arrancar Python; no se debe omitir silenciosamente.

Consultar [RAILWAY.md](RAILWAY.md) para topología, costes orientativos, dominio, variables, plan/aplicación y operación. [DESPLIEGUE.md](DESPLIEGUE.md) conserva los requisitos comunes y Compose como alternativa. Publicar código en GitHub y aprobar Actions no pone la aplicación en Internet.

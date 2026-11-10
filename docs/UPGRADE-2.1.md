# Upgrade CotizaSweet 2.1.0

El propietario solicitó publicar el repositorio **cotizasweet** como **público** y preparar el alojamiento del sistema completo. Se eligió Railway para la configuración administrada de tres servicios; todavía no se aprobó un presupuesto mensual ni se contrataron recursos.

La copia 2.0.0 y sus datos se conservan. La nueva 2.1.0 agrega allowlist exacta de hosts privados Railway, validación de sus URL, preparación de volúmenes con descenso de privilegios, configuración IaC actual y workflows Linux de construcción/smoke de contenedores e infraestructura. No contiene credenciales de GitHub, Railway, OIDC o RUC.

Comprobaciones locales nuevas: **34 pruebas TypeScript**, **57 pruebas Python de seguridad/operaciones y 40 subpruebas**, **41 aserciones .NET**, compilación del bundle de producción, tipos del SDK Railway, grafo offline de tres servicios/dos volúmenes y sintaxis del entrypoint, aprobadas. La integración HTTP del backend .NET integrado y las 18 comprobaciones de navegador también finalizaron aprobadas en esta copia. Las variantes alternativas y las demás categorías mantienen la cobertura preparada en CI; el acta base no se presenta como una ejecución nueva.

La validación de 2.0.0 se conserva como antecedente en VALIDACION-V2.md. Las mediciones y conteos de aquella acta corresponden a la base y no deben atribuirse automáticamente a la versión 2.1.0.

Docker Desktop y su cliente 29.8.1 están presentes y ejecutándose. La consola de esta sesión recibe acceso denegado al motor/configuración; la construcción Linux y su smoke permanecen pendientes hasta observar el resultado del workflow de contenedores o ejecutarlos desde una terminal del propietario con acceso al motor. No se desactivaron protecciones ni se cambiaron permisos del sistema para evitar ese bloqueo.

La cuenta personal `studioelpantojita` se verificó en GitHub y el repositorio público `https://github.com/studioelpantojita/cotizasweet` se creó con autorización del propietario. Esta nota registra la preparación de la subida inicial; el estado posterior de los workflows se consulta en la pestaña Actions del repositorio. La cuenta de Git no se dedujo del nombre/correo configurado localmente. La contratación y publicación funcional necesitan después autorización de Railway, presupuesto y OIDC/RUC reales; preparar archivos de infraestructura no crea esos servicios.

Consultar RAILWAY.md para topología, costes orientativos, variables, plan/aplicación y operación. El repositorio público conserva los avisos y derechos existentes; no se asignó una licencia de código abierto nueva.

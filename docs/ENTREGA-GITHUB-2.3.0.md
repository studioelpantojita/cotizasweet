# Entrega GitHub · E&A Cotiza v2.3.0

El propietario autorizó el 24 de noviembre de 2026 publicar la actualización local existente como **v2.3.0**. Las funcionalidades permanecen en esta versión; no se crea una aplicación 2.3.1 ni se modifica la copia local 2.2.1.

## Destino y conservación

- Repositorio público: [studioelpantojita/cotizasweet](https://github.com/studioelpantojita/cotizasweet).
- Rama independiente de entrega: `release/v2.3.0`.
- Etiqueta y publicación previstas: `v2.3.0` / **E&A Cotiza v2.3.0**. Se fijan al commit que supere las comprobaciones remotas.
- `main` se conserva en `f574d0deffa92272b502a43032f161b0658679b8`.
- La rama de Luis, `mejoras/historial-respaldos-seguridad`, se conserva en `fc1dfb0c289a5470df4dc4062eeb0ce91792e68b`, verificado directamente en GitHub el 24 de noviembre de 2026. No se fusiona, reescribe, elimina ni fuerza esa rama.

El commit de entrega y los identificadores de las ejecuciones quedan en la publicación GitHub y en el recibo local de la operación. El texto de este documento describe el procedimiento; por sí solo no declara aprobadas ejecuciones que todavía no hayan finalizado.

## Contenido

Incluye marca E&A Cotiza, cotizador en cuatro pasos, tarifas referenciales protegidas, cuentas propias de cliente y administrador, PDF archivado y bandeja del administrador, acceso opcional como invitado y promoción navideña por registro. La promoción corresponde a eventos del **30/11/2026 al 02/01/2027**, ambos inclusive. Se conservan los aportes de Luis seleccionados en 2.2.1: respaldos configurables, recuperación del trabajador y compatibilidad del historial con la API anterior; véase [UPGRADE-2.2.1.md](UPGRADE-2.2.1.md).

Las reglas y evidencias locales del 23 de noviembre permanecen en [NAVIDAD-INVITADOS-2026-11-23.md](NAVIDAD-INVITADOS-2026-11-23.md). Las tarifas, identidad del negocio, contactos e imágenes siguen siendo referenciales para pruebas.

## Validación de la entrega

GitHub Actions comprueba sobre la rama de entrega:

1. Calidad Windows: dependencias bloqueadas y auditorías, tipos y contratos, unidades, compilación, PDF, reglas financieras y mutaciones dirigidas, integración y navegador, y prueba acotada del bundle de producción.
2. Contenedores Linux: construcción de las imágenes finales de web, API .NET y RUC Python; arranque, rutas públicas y privadas, permisos de ejecución, persistencia de cuotas, reinicio y respaldo automático con recursos sintéticos temporales.
3. Infraestructura: validación estática del SDK Railway, grafo y sintaxis del arranque. **No ejecuta despliegues ni contrata recursos.**

Las nuevas comprobaciones de cuentas, invitado y promoción deben usar bases, credenciales y procesos efímeros del CI. Nunca se transporta la instalación personal ni sus accesos. La aceptación de una campaña limitada en el tiempo distingue las pruebas unitarias de reloj controlado de los recorridos HTTP durante su vigencia real.

`SHA256SUMS.txt` identifica los archivos de fuentes de la entrega; excluye su propia suma y el archivo de tipos generado `web/next-env.d.ts`. El empaquetado para GitHub utiliza los bytes del índice Git, con la normalización LF definida en `.gitattributes`, para que el manifiesto corresponda a una descarga limpia y no dependa de los finales de línea de Windows.

## Límites

Esta publicación **no habilita un sitio público ni acredita aceptación de producción**. El correo SMTP de Hosting Perú sigue sin transporte configurado; Enviar Cotización entrega a la bandeja administrativa. Google tiene adaptador OIDC y pruebas sintéticas, con acceso externo deshabilitado en la revisión local. Microsoft no tiene configuración aceptada. RUC dispone de adaptador Decolecta, pero la revisión usa demostración y requiere una credencial nueva para consulta real.

La aceptación del alojamiento exige configuración privada, administrador del destino, HTTPS/proxy, persistencia, copia externa y restauración, y datos y documentos comerciales definitivos. Véase [CUENTAS-Y-DESPLIEGUE-V230.md](CUENTAS-Y-DESPLIEGUE-V230.md). La publicación de esta rama no modifica `main`, no activa Railway y no incluye credenciales, bases personales ni archivos `.local`.

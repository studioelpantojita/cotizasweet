# E&A Cotiza 2.3.0 · Actualización funcional local

Actualización vigente del 23 de noviembre: el registro es opcional para cotizar y enviar; la campaña navideña y su validación se describen en [NAVIDAD-INVITADOS-2026-11-23.md](NAVIDAD-INVITADOS-2026-11-23.md). Las notas del 22 de noviembre que siguen documentan el antecedente de esta misma versión.

Documento actualizado el **22 de noviembre de 2026**. Las observaciones visuales del 21 de noviembre y las mejoras funcionales del 22 de noviembre se aplican sobre la misma carpeta `outputs/CotizaSweet_v2.3.0`, sin crear una versión adicional por cada punto. La copia 2.2.1 conserva sus fuentes y datos como referencia; esta actualización no la modifica ni migra automáticamente sus cotizaciones.

La entrega permanece local. Publicar en GitHub o continuar el despliegue requiere la aprobación expresa del propietario. El acta de esta actualización y los resultados finales se documentan en [NUEVAS-OBSERVACIONES-2026-11-22.md](NUEVAS-OBSERVACIONES-2026-11-22.md). Las evidencias de entregas anteriores constituyen antecedentes y no validan por sí mismas estas fuentes modificadas.

## Mejoras incorporadas

| Solicitud | Comportamiento actual | Aceptación principal |
|---|---|---|
| Administrador de la plataforma | Cuentas locales con roles administrador y cliente. Bandeja administrativa de solicitudes y creación de cuentas de cliente | Un cliente no obtiene acceso a la administración ni a documentos de otras cuentas |
| Acceso obligatorio con User y Password | El cotizador exige una sesión. El registro público crea clientes. Contraseñas derivadas con scrypt, sales aleatorias, límites de intentos y sesiones revocables al cambiar la contraseña | El acceso vacío o incorrecto falla; cambiar el rol en una solicitud no concede privilegios |
| Contador debajo del recuadro | El contador de Detalle del Proyecto aparece debajo, alineado a la izquierda, con el límite de 600 | Comprobado en escritorio y móvil; el texto completo se utiliza en el PDF |
| Tipo de cliente y fecha del evento | Solo Persona Natural y Empresa para propuestas nuevas; DNI para persona natural, RUC para empresa y fecha del evento obligatoria | Validación en interfaz y servidor, conservando la lectura de registros históricos |
| Paquetes en el primer paso | Elige el paquete para tu evento. permanece junto al proyecto y cliente, con selección opcional y sugerencias de la colección correspondiente | Las cuatro colecciones muestran sus propuestas y permiten continuar sin paquete |
| Revisión representativa antes de seleccionar | Sugerido para revisar abre un diálogo con imágenes, productos, cantidades, insumos y precios de referencia. Elegir este paquete es una acción independiente | Abrir o cerrar el diálogo no modifica servicios; confirmar carga el paquete explícitamente |
| Segundo paso simplificado | Las secciones principales son Servicios de la propuesta y Ficha de insumos, esta última opcional. La cartera tiene seis accesos representativos | Se conservan moneda, líneas de servicios, personalización e insumos sin duplicar el apartado de paquetes |
| Producto personalizado | De uno a cuatro sabores de la lista aprobada; presentación obligatoria; alcance opcional con Unknown. cuando está vacío; cantidad editable | Sabores, presentación, alcance y cantidad se conservan en la propuesta y el documento |
| Precio y unidad definidos por producto | Tarifa referencial compartida en `contracts/product-pricing.json`, importes independientes PEN/USD y unidad fijada por producto | El cliente no los edita. Los tres backends rechazan la manipulación del precio y la unidad al crear una propuesta nueva |
| Servicio sin referencia | Precio 0 y unidad servicio como solicitud pendiente de evaluación; se identifica el total provisional | No permite introducir una tarifa arbitraria ni presentar el importe pendiente como definitivo |
| Entrega y condiciones según la referencia | Modalidad, dirección y movilidad; fechas de emisión y validez en una fila; información de IGV; condiciones y notas; anticipo del 50% sin control editable | Recojo 0%, locación 5% antes de IGV del 18%; anticipo informado en el resumen y en el documento |
| Guardar y enviar | Guardar y descargar PDF conserva una copia en el historial y descarga el documento; Enviar Cotización entrega esa copia al administrador | Documento generado en servidor, archivo PDF con SHA-256 y aislamiento por cuenta; envío repetido sin duplicación |
| Correo cuando esté configurado | La bandeja administrativa es el canal operativo de esta entrega; el correo externo aparece pendiente | No se declara enviado ni recibido un correo sin proveedor y configuración verificados |

Los sabores admitidos son **vainilla, chocolate, café, frambuesa, lucuma, naranjo, cherry, crema pastelera, pistacho y almendras**. Las unidades del catálogo pertenecen al conjunto **unidad, gramos, kilogramos, litros, box y paquete**, según la referencia de producto. Las tarifas iniciales fueron autorizadas como valores de prueba; necesitan confirmación del negocio antes del uso comercial. Su revisión se realiza en la configuración del catálogo; la cuenta de cliente no modifica las tarifas.

Se mantienen las mejoras de navegación anteriores: fotografías de inicio que abren fichas sin redirección, navegación Catálogo / Cómo Funciona / Accede o Mi cuenta, reducción de botones repetidos y buscador del catálogo con un indicador de foco claro. La marca vectorial E&A Cotiza y la tipografía local permanecen integradas.

## Cuentas, documentos y datos

El documento privado `.local/ACCESOS-REVISION.html` reúne los accesos de administrador y cliente de esta instalación. No forma parte del repositorio ni del paquete de fuentes. El formulario exige User y Password; la antigua entrada automática con Desarrollo local ya no corresponde al recorrido actual. La contraseña de E&A Cotiza es independiente de la de Gmail. `/cuenta` permite cambiarla y cerrar sesión.

Los roles se comprueban en el servidor. Los tokens de las cuentas de aplicación usan un emisor explícito y un algoritmo permitido, separados del perfil OIDC externo. Las sesiones locales distinguen el puerto de esta instalación para evitar interferencias con 2.2.1. Google real conserva su aceptación externa separada; el acceso local comprobado no constituye evidencia de acceso real con Google.

El guardado crea un documento PDF en el servidor y conserva una copia inmutable con su huella SHA-256. El historial pertenece a la cuenta autenticada. El envío utiliza esa copia ya guardada y produce un recibo; una repetición del envío de la misma copia no crea otra solicitud. El administrador solo recibe propuestas que el cliente haya enviado expresamente. Modificar la propuesta requiere volver a guardar antes de enviar los cambios; el archivo ya remitido conserva sus datos originales.

El historial de cotizaciones y los documentos archivados utilizan almacenamiento persistente propio. Los respaldos de la API no sustituyen el respaldo de las cuentas, sesiones y documentos web: deben incluirse los volúmenes y bases correspondientes en la operación del alojamiento. Las configuraciones privadas, claves, accesos, bases y logs se excluyen de las fuentes públicas.

## Compatibilidad y estado del formulario

El contrato conserva `event` y `projectBrief`. Detalle del Proyecto mantiene íntegro el contenido en `projectBrief` y calcula un resumen compatible en `event`. El resumen normaliza espacios y evita cortar una pareja UTF-16 al límite. La vista previa y el PDF prefieren el detalle completo; los registros anteriores sin detalle conservan el título antiguo como contenido inicial.

Los cuatro paneles permanecen montados y los inactivos se ocultan y quedan fuera del recorrido con teclado. Esto conserva el estado al volver entre pasos. El borrador admite una propuesta incompleta, incluso sin servicios, y se conserva únicamente en esta pestaña. Guardar borrador no crea una copia en el historial del servidor. La validación final exige una propuesta completa y lleva el foco al campo que necesita corregirse.

Las cotizaciones históricas conservan sus datos para lectura. Las reglas nuevas de fecha, tipo de documento, precio de catálogo y anticipo se exigen al crear o volver a guardar una propuesta nueva; no se reescriben las propuestas anteriores de forma silenciosa.

## Evidencias y límites

Las suites tienen alcances diferentes y no deben sumarse como cobertura única. Las cifras finales y sus artefactos corresponden al acta del [22 de noviembre](NUEVAS-OBSERVACIONES-2026-11-22.md). Durante esta actualización se ejecutaron pruebas web de dominio y tarifas, backend Python y .NET, validaciones de cuentas y documentos y recorridos de navegador. El recorrido específico de interfaz aprobó **34 comprobaciones**, y el flujo de cuentas, archivo PDF y envío administrativo aprobó **39 comprobaciones** con datos sintéticos.

| Área | Evidencia de la actualización |
|---|---|
| Dominio web y tarifas | `tests/artifacts/unit-results.json` y pruebas específicas de reglas de producto |
| Backend y seguridad Python | Resultados de las suites de backend de esta actualización, incluidos los casos de precios, unidades, fecha y JWT |
| API .NET | Compilación Debug y Release y pruebas de validación de backend |
| Interfaz de las nuevas observaciones | `tests/artifacts/improvements-ux/report.json` y capturas de escritorio y móvil |
| Cuentas y recepción en bandeja | `tests/artifacts/account-workflow.json`, con aislamiento entre cuentas y envío idempotente |
| Producción local | Smoke y navegador adaptados a acceso obligatorio con cuentas y base temporal; resultados finales en el acta |
| Docker final 2.3.0 | Reconstrucción y ejecución final pendientes de verificar; no se extrapola el resultado de 2.2.1 |

Los resultados antiguos de 856 comprobaciones HTTP, los conteos previos de PDF, el p95 anterior y los informes de mutación pertenecen a sus fuentes y ejecuciones originales. No se presentan como repetidos sobre esta actualización. Una compilación local o una prueba sintética tampoco acredita la operación en Railway, un envío externo de correo ni una certificación externa de seguridad.

## Revisión local y publicación

La web usa el puerto **3370**, la API .NET **8370**, RUC Python **8371** y el emisor sintético de compatibilidad **9370**. [REVISION-MANUAL-2.3.md](REVISION-MANUAL-2.3.md) describe las cuentas, los recorridos y los criterios del propietario. Abre [INICIAR-EN-VISUAL-STUDIO.slnx](../INICIAR-EN-VISUAL-STUDIO.slnx) y selecciona EA.Cotiza.Local para revisar o ejecutar el código.

El RUC `20999999990` identifica una demostración ficticia; no representa una consulta real a SUNAT o Decolecta. Los datos comerciales de Dulce Atelier, las fotografías, los precios y la disponibilidad conservan su condición referencial.

El correo externo, Google y Decolecta reales, el dominio público HTTPS, el alojamiento Railway y sus controles efectivos del máximo de **US$30 mensuales**, los respaldos fuera del volumen y su restauración requieren configuración y pruebas propias. No se activa un plan de pago ni se publica código por esta entrega. El propietario revisará manualmente v2.3.0 y dará su aprobación expresa antes de cargarla en GitHub.

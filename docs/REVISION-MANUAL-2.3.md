# Revisión manual local de E&A Cotiza 2.3.0

Guía actualizada el **23 de noviembre de 2026** para `outputs/CotizaSweet_v2.3.0`. Las observaciones nuevas se aplican sobre esta misma versión, sin crear otra versión por cada cambio. La copia 2.2.1 y sus datos se conservan como referencia independiente. No se migran automáticamente sus cotizaciones. La publicación en GitHub requiere la aprobación expresa del propietario.

Usa datos ficticios durante la revisión. Los precios iniciales están autorizados únicamente como referencias para pruebas; no constituyen una tarifa comercial confirmada. El acta de esta actualización y sus evidencias se reúnen en [NUEVAS-OBSERVACIONES-2026-11-22.md](NUEVAS-OBSERVACIONES-2026-11-22.md).

## Acceder con una cuenta

Abre [Inicio](http://127.0.0.1:3370) o [Accede](http://127.0.0.1:3370/auth/login) cuando el lanzador esté activo. El cotizador permite continuar sin registro. El anuncio navideño ofrece crear una cuenta con beneficio para eventos del 30/11/2026 al 02/01/2027 o continuar como invitado. User y Password sólo son obligatorios al acceder a una cuenta. Consulta [NAVIDAD-INVITADOS-2026-11-23.md](NAVIDAD-INVITADOS-2026-11-23.md) para probar ambos recorridos.

Los accesos de revisión de esta instalación están en el documento privado [ACCESOS-REVISION.html](../.local/ACCESOS-REVISION.html). Ábrelo localmente y utiliza el perfil correspondiente. No compartas su contenido ni lo incluyas en GitHub o en el paquete de fuentes. Las contraseñas pertenecen a E&A Cotiza; utiliza contraseñas diferentes a las de Gmail u otros servicios.

- **Cliente:** abre el cotizador, conserva su propio historial y puede enviar solicitudes al negocio.
- **Administrador:** abre [Administración](http://127.0.0.1:3370/admin), consulta las solicitudes enviadas y sus PDF, y crea cuentas de cliente. Una cuenta de cliente no obtiene este permiso cambiando un dato del formulario.
- **Cuenta propia:** usa **Crear mi cuenta** en el acceso. El registro público crea una cuenta de cliente. El rol de administrador se prepara mediante la herramienta privada del propietario.
- **Contraseña y salida:** desde **Mi cuenta**, en [cuenta](http://127.0.0.1:3370/cuenta), puedes cambiar tu contraseña. Usa **Cerrar sesión** al terminar. Un cambio de contraseña invalida las sesiones anteriores y exige un acceso nuevo.

La sesión puede requerir un acceso nuevo al reiniciar el lanzador; las cuentas y las cotizaciones guardadas se conservan en las bases de esta copia. Google real mantiene su configuración y aceptación separadas; este formulario no solicita la contraseña de Google.

| Componente de esta copia | Dirección |
|---|---|
| Web | `http://127.0.0.1:3370` |
| API de cotizaciones .NET | `http://127.0.0.1:8370` |
| Servicio RUC Python | `http://127.0.0.1:8371` |
| Emisor sintético de compatibilidad de las pruebas OIDC | `http://127.0.0.1:9370` |

Estos puertos pertenecen a la configuración privada `local.settings.json`. Conserva `127.0.0.1` para mantener el mismo origen de la sesión y del borrador. La identidad sintética del puerto 9370 no sustituye el formulario de User y Password. Las bases, los accesos y la configuración privada se excluyen del repositorio y del ZIP de fuentes.

## Abrir y ejecutar desde Visual Studio

Abre [INICIAR-EN-VISUAL-STUDIO.slnx](../INICIAR-EN-VISUAL-STUDIO.slnx), en la raíz de esta copia, y selecciona **EA.Cotiza.Local** como proyecto de inicio. Puedes navegar por el código sin iniciar otra instancia.

Antes de F5, detén la instancia que ya utilice los puertos de esta revisión. Si la iniciaste desde una terminal, usa Ctrl+C; si la iniciaste desde Visual Studio, usa Mayús+F5. Si existe `.local/DETENER-REVISION.ps1`, úsalo únicamente para el lanzador preparado al que corresponde. Evita cerrar en conjunto los procesos de Node, Python o .NET del equipo.

Pulsa F5 y espera el inicio del puerto 3370. La solución compila el lanzador y la API .NET. Ante errores de compilación o un archivo bloqueado por .NET Host, detén la instancia correspondiente y recompila antes de ejecutar. Ejecutar la última compilación correcta puede abrir código anterior al que deseas revisar.

Una extracción nueva del ZIP requiere los runtimes y la preparación descritos en [README](../README.md). Desde la raíz de la extracción:

```powershell
.\scripts\setup-local.ps1 -NodePath node -PythonPath python -DotnetPath dotnet -WebPort 3370 -ApiPort 8370 -RucPort 8371 -IdentityPort 9370
Push-Location web
node scripts/run-ts.cjs scripts/provision-accounts.ts
Pop-Location
```

La preparación de cuentas genera el documento privado de accesos de esa instalación. No copies contraseñas, claves de firma ni bases de otra copia para reconstruirla. Después puedes abrir la solución e iniciar F5.

## Datos ficticios recomendados

| Campo | Valor de prueba |
|---|---|
| Tipo de cliente | Persona Natural |
| DNI | `12345678` |
| Nombre | `Cliente de prueba manual` |
| Contacto del negocio | `900000000`, sin escribir el prefijo `+51` |
| Correo opcional | `cliente@example.test` |
| Objetivo del Proyecto | Cumpleaños |
| Detalle del Proyecto | `Celebración para 30 invitados. Mesa dulce en tonos marfil y borgoña, con cajas de regalo personalizadas.` |
| Fecha del evento | Una fecha posterior o igual a la fecha de emisión |
| RUC de demostración para Empresa | `20999999990` |

El RUC de demostración debe identificar expresamente los datos ficticios y que no se consultó SUNAT. No acredita una empresa real ni genera una consulta facturable. **E&A Cotiza** identifica la plataforma. Los datos de **Dulce Atelier**, las presentaciones y los precios de muestra necesitan confirmación comercial del negocio.

## Recorrer los cuatro pasos

La barra lateral permite elegir cualquier paso. **Continuar** y **Anterior** conservan la propuesta. **Guardar borrador** conserva el estado en esta pestaña; no crea una cotización en el servidor. Cerrar la pestaña puede eliminar ese borrador. El último paso **Guardar y descargar PDF** guarda una copia en el historial de tu cuenta y descarga su documento.

| Paso | Contenido actual |
|---|---|
| 1 · Proyecto y cliente | Objetivo del Proyecto, presupuesto máximo opcional, Detalle del Proyecto, Tipo de Cliente con únicamente Persona Natural o Empresa, DNI o RUC, nombre o razón social, contacto del negocio, correo opcional y fecha del evento obligatoria. **Elige el paquete para tu evento.** aparece aquí y su selección es opcional |
| 2 · Servicios e insumos | Únicamente las secciones **Servicios de la propuesta** y **Ficha de insumos**, esta última opcional. Dentro de los servicios están la moneda, la cartera, sus seis accesos representativos, las líneas de la propuesta y el servicio sin referencia |
| 3 · Entrega y condiciones | Locación y movilidad; vigencia e impuestos; condiciones y notas. Recojo o locación con sus datos, movilidad calculada, emisión y validez en una fila de escritorio, IGV informado y anticipo del 50% sin control editable |
| 4 · Revisar propuesta | Vista de la propuesta y sus importes, Ver PDF, **Guardar y descargar PDF**, y después **Enviar Cotización** a la bandeja del administrador |

Los cuatro grupos del objetivo son **Celebraciones privadas**, **Regalos corporativos**, **Selección a medida** y **Experiencias de marca**. Los paquetes sugeridos cambian según el objetivo elegido. Abrir **Sugerido para revisar** o **Revisar contenido** muestra un diálogo; solo **Elegir este paquete** carga sus servicios y condiciones, reemplazando los actuales. Puedes cerrar el diálogo y continuar sin seleccionar un paquete.

Para personalizar una pieza de la cartera, selecciona de uno a cuatro sabores entre **vainilla, chocolate, café, frambuesa, lucuma, naranjo, cherry, crema pastelera, pistacho y almendras**. La presentación es obligatoria. El alcance es opcional: vacío se registra como **Unknown.** La cantidad la introduces tú; la unidad y el precio unitario provienen de la tarifa referencial del producto y no son editables por el cliente. La tarifa declara importes separados para PEN y USD, sin conversión automática.

Un **servicio sin referencia** queda con precio **0** y unidad **servicio**, pendiente de evaluación del negocio. No representa gratuidad confirmada; la propuesta informa que su total es provisional. No debes introducir una tarifa arbitraria en ese caso.

## Criterios de aceptación

Marca cada criterio como **Conforme**, **Observación** o **Pendiente**. Conserva una captura o el PDF cuando registres una incidencia.

| N.º | Recorrido | Resultado esperado |
|---|---|---|
| 1 | Abre el cotizador sin sesión y elige Continuar sin registro; prueba también Accede con campos vacíos y con las credenciales privadas | El invitado puede cotizar, descargar y enviar. Para consultar el historial de una cuenta se exigen User y Password. Un error no concede acceso ni muestra secretos |
| 2 | Entra con cliente e intenta abrir `/admin`; después entra en otro contexto de navegador con administrador | El cliente vuelve a su cotizador y no obtiene cuentas ni documentos ajenos. El administrador ve su bandeja y la lista de cuentas |
| 3 | Registra una cuenta propia, entra y abre Mi cuenta | La cuenta tiene rol de cliente. Puedes cambiar su contraseña y volver a entrar con la nueva; la contraseña anterior deja de funcionar |
| 4 | En el primer paso abre Tipo de Cliente | Solo aparecen Persona Natural y Empresa. Una propuesta nueva solicita DNI para persona natural y RUC para empresa |
| 5 | Deja vacía la fecha del evento e intenta guardar desde el último paso | La validación abre el primer paso e identifica el campo obligatorio. Con una fecha válida puedes continuar |
| 6 | Escribe varias líneas en Detalle del Proyecto y llega a su límite de 600 | El contador aparece debajo, alineado a la izquierda. El contenido se conserva al navegar y aparece íntegro una sola vez en el PDF |
| 7 | Cambia el objetivo entre las cuatro colecciones y revisa los paquetes | El apartado se mantiene en el primer paso y muestra sugerencias de la colección elegida. Cambiar el objetivo conserva los servicios ya añadidos, sin cargar otro paquete automáticamente |
| 8 | Pulsa Sugerido para revisar y cierra con Escape | El diálogo muestra productos, cantidades, presentaciones e insumos de referencia. Cerrar no cambia la propuesta y devuelve el foco al botón |
| 9 | Abre el diálogo y pulsa Elegir este paquete; vuelve a revisar otro sin confirmarlo | La selección confirmada carga sus líneas y condiciones. Revisar el otro no las reemplaza. También puedes continuar con selección a medida conservando los servicios |
| 10 | Continúa al segundo paso sin seleccionar un paquete | El paquete no es obligatorio. Solo aparecen Servicios de la propuesta y Ficha de insumos como secciones principales |
| 11 | Abre una de las seis categorías de cartera y elige una pieza | El diálogo permite personalizar el producto. Puedes seleccionar hasta cuatro sabores; el quinto queda impedido mientras los cuatro sigan marcados |
| 12 | Intenta añadir la pieza sin presentación, luego complétala dejando alcance vacío | La presentación es obligatoria. El servicio añadido conserva sus sabores, cantidad y presentación; el alcance aparece como Unknown. |
| 13 | Revisa precio, unidad y cantidad; cambia de moneda | Precio y unidad no se pueden editar por el cliente; la cantidad sí. La tarifa de cada moneda se aplica sin conversión. Los precios se identifican como referenciales para pruebas |
| 14 | Añade un servicio sin referencia | Su precio queda en 0 y su unidad en servicio; la interfaz y el documento indican que falta evaluar ese precio. El total provisional no se presenta como tarifa definitiva |
| 15 | Despliega Ficha de insumos, elige categorías y opciones, cambia de paso y vuelve | Las elecciones y notas automáticas se conservan. La ficha es opcional y no promete certificación orgánica ni ausencia de alérgenos |
| 16 | En Entrega y condiciones alterna recojo y locación, completando datos ficticios | Recojo no añade movilidad; locación añade 5% antes del IGV. El total incluye IGV del 18%. Las fechas comparten fila en escritorio y el anticipo es 50% sin control editable |
| 17 | En el último paso pulsa Ver PDF, revisa todas las páginas y luego Guardar y descargar PDF | El PDF se lee sin solapamientos, conserva proyecto, fecha del evento, cliente, sabores, alcance, importes e insumos. El guardado crea una copia en el historial de esa cuenta y descarga el documento |
| 18 | Tras guardar pulsa Enviar Cotización; repite el envío de esa misma copia | La copia llega a la bandeja del administrador y el recibo confirma la recepción en plataforma. Repetir el envío no duplica la solicitud. El correo se identifica como pendiente de configuración |
| 19 | Con administrador abre la solicitud y descarga su PDF | La cuenta administradora obtiene la misma copia archivada. Con otra cuenta de cliente no se puede recuperar ese documento ni su solicitud |
| 20 | Después de guardar cambia un dato de la propuesta | Se requiere guardar y descargar la copia actualizada antes de enviarla. El documento ya enviado conserva sus datos originales |
| 21 | Abre Presupuestos guardados, actualiza, reabre una cotización y descarga desde su fila; con más de 20 usa Cargar más propuestas | El historial está aislado por cuenta, conserva los datos de cada guardado y pagina sin duplicar filas. Los registros anteriores compatibles se pueden revisar sin reescribir su contenido |
| 22 | Revisa teclado, foco, mensajes de error, ventana de unos 390 px y cierre de sesión | Los errores llevan al campo correspondiente. Los pasos ocultos no participan con Tab. La página y los diálogos no desbordan horizontalmente. Tras salir se vuelve a exigir acceso |
| 23 | Abre `/catalogo?seleccion=packs`, busca y limpia; pulsa fotografías del inicio y recorre su cabecera | Se conserva el buscador con un indicador claro de foco, los diálogos de fotografías sin redirección y la navegación Catálogo / Cómo Funciona / Accede o Mi cuenta |
| 24 | Cambia a Empresa e introduce el RUC de demostración | La interfaz y el PDF identifican los datos ficticios y la ausencia de consulta real de SUNAT. No se confunde esa prueba con una integración externa validada |

## Registrar observaciones

Anota **versión 2.3.0**, carpeta, fecha, URL, navegador y tamaño aproximado de ventana. Para cada incidencia usa este formato:

```text
Estado: Conforme / Observación / Pendiente
Criterio y título
Pasos para reproducir
Datos ficticios utilizados
Resultado esperado
Resultado observado
Frecuencia de reproducción
Captura o PDF de evidencia
Impacto en el uso
```

Indica los recorridos conformes y los que no ejecutaste. Oculta datos personales y valores privados en las evidencias. Las correcciones posteriores se aplicarán sobre v2.3.0. El correo externo, Google y Decolecta reales, HTTPS público, Railway y la reconstrucción Docker final tienen aceptaciones separadas; la recepción en bandeja no acredita entrega por correo. La publicación en GitHub continúa pendiente de tu aprobación expresa.

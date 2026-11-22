# Revisión manual local de E&A Cotiza 2.3.0

Esta guía corresponde exclusivamente a `outputs/CotizaSweet_v2.3.0`. Permite revisar las observaciones de interfaz del 21 de noviembre de 2026, navegar por los cuatro pasos del cotizador y registrar resultados antes de aprobar la publicación en GitHub.

La copia 2.2.1 conserva su carpeta y sus datos. La revisión 2.3.0 tiene nuevas bases y archivos de ejecución propios. Sus cotizaciones anteriores no se migraron automáticamente. Usa datos ficticios durante la revisión.

## Acceso a la plataforma

Abre [Inicio](http://127.0.0.1:3370) o [el cotizador](http://127.0.0.1:3370/cotizar) cuando su lanzador esté en ejecución. La aplicación permanece disponible mientras ese proceso esté activo. Una dirección local que no responda requiere iniciar la copia correspondiente antes de continuar.

| Componente de esta copia | Dirección |
|---|---|
| Web | `http://127.0.0.1:3370` |
| API de cotizaciones .NET | `http://127.0.0.1:8370` |
| Servicio RUC Python | `http://127.0.0.1:8371` |
| Emisor de identidad de desarrollo | `http://127.0.0.1:9370` |

Estos puertos se guardan en el archivo privado `local.settings.json`. Conserva la dirección con `127.0.0.1` para mantener el mismo origen del borrador. La ficha [ACCESO_LOCAL_PRIVADO.html](../.local/ACCESO_LOCAL_PRIVADO.html), si está incluida en la copia preparada, reúne el acceso de este equipo. La configuración privada y las bases no forman parte del ZIP de fuentes ni del repositorio.

Pulsa **Accede** en la cabecera para entrar. El emisor local completa el acceso con **Desarrollo local**, correo **local@example.test**, sin pedir contraseña ni enviar correo. En el cotizador, **Cerrar sesión** indica que el acceso está activo. Esta identidad sintética sirve para la revisión local; la aceptación con una cuenta real de Google conserva su configuración y prueba pendientes según [GOOGLE.md](GOOGLE.md).

Si se reinicia el lanzador, puede ser necesario volver a entrar porque se renuevan las claves de sesión. Las cotizaciones guardadas permanecen en las bases de esta copia.

## Abrir y ejecutar desde Visual Studio

Abre [INICIAR-EN-VISUAL-STUDIO.slnx](../INICIAR-EN-VISUAL-STUDIO.slnx), situado en la raíz de `CotizaSweet_v2.3.0`, y selecciona **EA.Cotiza.Local** como proyecto de inicio. Puedes navegar por el código sin iniciar otra instancia.

Antes de F5, detén la instancia que ya esté utilizando los puertos de esta revisión. Si la iniciaste desde una terminal, usa Ctrl+C; si la iniciaste desde Visual Studio, usa Mayús+F5. Si la entrega incluye un control privado `.local/DETENER-REVISION.ps1`, úsalo únicamente para el lanzador preparado al que corresponde. Evita cerrar en conjunto los procesos de Node, Python o .NET del equipo.

Pulsa F5 y espera a que el lanzador indique el puerto 3370. La solución compila el lanzador y la API .NET. Ante un error de compilación, revisa la salida y recompila antes de ejecutar; utilizar la última compilación correcta puede abrir código anterior al que estás revisando. Al terminar las pruebas de una sesión iniciada con F5, usa Mayús+F5.

Una extracción nueva del ZIP requiere los runtimes y la preparación indicados en README. Desde la raíz de la extracción, el comando siguiente asigna los puertos de esta revisión.

```powershell
.\scripts\setup-local.ps1 -NodePath node -PythonPath python -DotnetPath dotnet -WebPort 3370 -ApiPort 8370 -RucPort 8371 -IdentityPort 9370
```

## Datos ficticios recomendados

| Campo | Valor de prueba |
|---|---|
| Tipo de cliente inicial | Persona Natural |
| DNI | `12345678` |
| Nombre | `Cliente de prueba manual` |
| Contacto del negocio | `900000000`, sin escribir el prefijo `+51` |
| Correo opcional | `cliente@example.test` |
| Objetivo del Proyecto | Cumpleaños |
| Detalle del Proyecto | `Celebración para 30 invitados. Mesa dulce en tonos marfil y borgoña, con cajas de regalo personalizadas.` |
| RUC de demostración para Empresa | `20999999990` |

El RUC de demostración debe devolver **PASTELERÍA DE DEMOSTRACIÓN S.A.C.**, estado **DEMO** y la indicación de que no se consultó SUNAT. No acredita un proveedor real ni genera una consulta facturable. Los datos comerciales de **Dulce Atelier**, incluidos contactos, dirección, precios e imágenes, siguen siendo referenciales. **E&A Cotiza** identifica la plataforma.

## Recorrer los cuatro pasos

La barra lateral permite elegir cualquier paso. **Continuar** y **Anterior** cambian el panel sin descartar la propuesta. El estado del borrador y el paso se conservan en esta pestaña; **Guardar borrador** guarda ese estado local. Para conservar una versión en el historial del servidor, utiliza **Guardar** con sesión iniciada en el último paso. Cerrar la pestaña puede eliminar su borrador local.

| Paso | Campos y funciones que debes encontrar |
|---|---|
| 1 · Proyecto y cliente | Objetivo del Proyecto, presupuesto máximo, Detalle del Proyecto, tipo de cliente, DNI/RUC, nombre o razón social, consulta RUC y reintento, contacto del negocio con prefijo Perú, correo opcional y fecha opcional del evento. Si reabres un registro que tenía contacto del cliente, también debe conservar ese campo |
| 2 · Servicios e insumos | Paquetes Esencial, Signature y Alta Vitrina, sugerencia y presupuesto; moneda; cartera y personalización; packs y adicionales; servicio sin referencia; nombre, categoría, contenido y alcance, unidad, cantidad, precio y eliminación de cada servicio; ficha opcional de insumos con sus opciones, cacao y especificaciones; notas generadas y notas históricas cuando existan |
| 3 · Entrega y condiciones | Recojo o locación, provincia, distrito, dirección o referencia y movilidad; fecha de emisión, validez, IGV, anticipo; condiciones de alcance, entrega, revisiones y pago |
| 4 · Revisar propuesta | Propuesta completa y sus importes, detalle del proyecto, insumos y condiciones; Ver PDF, Descargar cotización PDF, Guardar y Compartir PDF |

El antiguo control **Proyecto** ya no debe aparecer en **Tu negocio y tu cliente**. Su reemplazo visible es **Detalle del Proyecto** en el primer paso. La validación al guardar o exportar identifica los campos pendientes y abre el paso que los contiene.

## Criterios de aceptación

Marca cada criterio como **Conforme**, **Observación** o **Pendiente**. Conserva una captura o el PDF cuando registres una incidencia.

| N.º | Recorrido | Resultado esperado |
|---|---|---|
| 1 | Abre `/catalogo?seleccion=packs`, enfoca el buscador con ratón y con Tab, escribe una palabra y pulsa Limpiar | Se muestra un único indicador claro de foco. El icono y el texto quedan alineados; no aparecen los dos marcos superpuestos de la captura original. El filtro devuelve resultados o un estado vacío coherente y Limpiar restaura la lista |
| 2 | Recorre Inicio y pulsa la fotografía principal, una tarjeta de la selección, una fotografía de ocasión, la imagen de Cómo Funciona y la de Packs y cajas | Cada fotografía abre su ficha emergente con imagen y descripción sin cambiar la URL. El control Cerrar y Escape permiten volver. El foco regresa al elemento inicial. Solo una acción independiente de la ficha puede llevarte al cotizador |
| 3 | Revisa la cabecera en Inicio, Catálogo y Cotizar. Usa Catálogo, Cómo Funciona y Accede. Repite con una ventana de unos 390 px | La marca queda a la izquierda y los tres accesos a la derecha en escritorio. En móvil se abren desde el menú. Cómo Funciona lleva a su sección de inicio, Catálogo abre la selección y Accede completa el acceso local sin contraseña |
| 4 | Recorre Inicio antes de abrir fichas | No se repite Explorar presentación en cada imagen. Los accesos visibles al cotizador se concentran en la ocasión seleccionada y el pie. El hero invita a descubrir el catálogo y elegir ocasión |
| 5 | En Proyecto y cliente completa los datos de prueba, escribe dos líneas en Detalle del Proyecto y avanza. Vuelve con Anterior o la barra lateral y pulsa Guardar borrador | Los valores se conservan. Objetivo del Proyecto y Detalle del Proyecto usan los nombres acordados. No existe otro campo Proyecto en Tu negocio y tu cliente. Al recargar esta misma pestaña se recuperan el borrador válido y el paso |
| 6 | En Servicios e insumos añade un servicio sin referencia llamado Servicio de prueba, unidad servicio, cantidad 2 y precio 50.00 PEN. Cambia sus campos, añade y retira un adicional. Revisa los paquetes sin seleccionarlos si deseas mantener ese servicio | Todos los controles de servicios siguen disponibles. Seleccionar un paquete reemplaza la selección y sus condiciones de forma explícita; cambiar solo el objetivo actualiza sus sugerencias. El servicio de prueba termina con subtotal S/ 100.00 |
| 7 | Despliega Ficha de insumos, elige una categoría y opciones y revisa sus notas automáticas. Cambia entre pasos y vuelve | Las opciones y las notas se conservan. La ficha sigue siendo opcional y las elecciones no se presentan como certificaciones orgánicas o garantías de ausencia de alérgenos |
| 8 | En Entrega y condiciones usa recojo y anticipo del 50% con el servicio de prueba. Después cambia a locación con provincia, distrito y dirección ficticia. Prueba también USD | En recojo, IGV S/ 18.00, total S/ 118.00, anticipo y saldo S/ 59.00. En locación, movilidad 5.00, base 105.00, IGV 18.90, total 123.90 y anticipo y saldo 61.95. USD cambia la moneda declarada sin convertir importes |
| 9 | En Revisar propuesta pulsa Ver PDF y Descargar cotización PDF. Usa un detalle largo y varias líneas, hasta el límite del control. Comprueba todas sus páginas | El contenido completo de Detalle del Proyecto aparece una sola vez como descripción del proyecto, con Objetivo del Proyecto actualizado. No se usa un título independiente que sustituya ese contenido. Se conservan firma vectorial, cliente, fecha, moneda, servicios, importes, insumos y condiciones, sin textos cortados ni solapamientos |
| 10 | Con sesión iniciada guarda, abre Presupuestos guardados, actualiza y reabre la propuesta. Descarga su PDF desde la fila. Si tienes más de 20, usa Cargar más propuestas | Se conservan detalle, cliente, moneda, importes y selección. El historial está aislado por cuenta y no duplica filas. Un registro antiguo sin detalle conserva su título como contenido inicial al reabrirlo |
| 11 | Vuelve al primer paso, cambia a Empresa e introduce el RUC demo. Revisa la razón social, su estado y el PDF | La interfaz y el documento identifican expresamente los datos ficticios y la ausencia de consulta real de SUNAT. Reabrir una cotización conserva su identificación guardada antes de una consulta nueva |
| 12 | Deja un campo requerido vacío o un número inválido y, desde el último paso, intenta guardar o exportar. Usa los enlaces del resumen de errores. Repite con Tab, ventana estrecha y cierre de sesión | Se abre el paso correspondiente y el foco llega al control que requiere corrección. Los pasos ocultos no participan en el recorrido con Tab. No existe desplazamiento horizontal de la página. Tras cerrar sesión el historial vuelve a exigir acceso |

## Registrar observaciones

Anota versión, carpeta, fecha, URL, navegador y tamaño aproximado de la ventana. Para cada incidencia indica el número del criterio y utiliza el siguiente formato.

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

Indica también los recorridos conformes y los que no ejecutaste. Oculta datos personales reales y valores privados antes de compartir evidencias. Google y Decolecta reales, HTTPS público, controles de Railway y recuperación externa conservan sus propias pruebas pendientes. La publicación en GitHub requiere tu aprobación expresa después de esta revisión.

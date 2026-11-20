# Revisión manual local de E&A Cotiza 2.2.1

Esta guía corresponde a la carpeta `outputs/CotizaSweet_v2.2.1` de esta entrega. Permite probar la aplicación y registrar observaciones antes de aprobar cambios adicionales. La versión permanece local y su publicación en GitHub queda pendiente de la aprobación expresa del propietario.

La revisión 2.2.1 es una copia independiente, con nuevas bases, sesiones y puertos. La carpeta 2.2.0 conserva sus datos. Las propuestas anteriores no se migraron a esta copia. El proveedor RUC está en modo de demostración y el emisor de identidad es local.

## Abrir la aplicación que ya está activa

Abre [E&A Cotiza local](http://127.0.0.1:3360) en el navegador. Para entrar directamente al formulario usa [el cotizador](http://127.0.0.1:3360/cotizar). Esta instancia ya está iniciada, por lo que puedes comenzar las pruebas sin pulsar F5.

Al preparar esta guía se comprobó que la web y las dos APIs respondían con HTTP 200 en sus rutas de salud. La aplicación seguirá disponible mientras su lanzador permanezca activo.

| Componente de esta copia | Dirección |
|---|---|
| Web | `http://127.0.0.1:3360` |
| API de cotizaciones .NET | `http://127.0.0.1:8360` |
| Servicio RUC Python | `http://127.0.0.1:8361` |
| Emisor de identidad local | `http://127.0.0.1:9360` |

Estos puertos están guardados en `local.settings.json` de esta copia. El preparador general usa como valores predeterminados 3340, 8340, 8341 y 9340. Para esta revisión conserva los valores 3360, 8360, 8361 y 9360. Abre siempre la misma dirección con `127.0.0.1` para mantener el origen de la sesión.

La ficha [ACCESO_LOCAL_PRIVADO.html](../.local/ACCESO_LOCAL_PRIVADO.html) se encuentra en `.local/` y reúne los datos de acceso de este ordenador. Es un archivo privado, excluido del repositorio. Conserva también `local.settings.json`, `.env.ruc.local`, las bases y los registros dentro del entorno local.

## Iniciar sesión para guardar propuestas

Pulsa **Iniciar sesión** en la cabecera. El emisor local completa el acceso con la identidad sintética **Desarrollo local**, cuyo correo es **local@example.test**. Este recorrido no presenta un formulario de usuario y contraseña. Si se muestra **Cerrar sesión**, ya existe una sesión activa.

Esta cuenta compartida sirve para las pruebas de desarrollo de esta copia. No requiere una contraseña ni envía correo. El perfil Google está preparado en el código y en la infraestructura, pero su aceptación con OAuth y cuentas reales sigue pendiente de la configuración descrita en [GOOGLE.md](GOOGLE.md). El acceso local de esta guía utiliza el emisor de desarrollo.

Si el lanzador se reinicia, vuelve a pulsar **Iniciar sesión**. Las claves de sesión locales cambian al arrancar. Las propuestas guardadas permanecen en la base de datos de esta copia.

## Detener esta revisión antes de F5

Si la instancia preparada sigue activa, ejecuta desde la raíz de esta copia el control privado que corresponde a su lanzador.

```powershell
& '.\.local\DETENER-REVISION.ps1'
```

Ese control verifica el identificador y la hora de inicio del lanzador preparado antes de detenerlo. Sus procesos hijos pertenecen al mismo grupo de ejecución. La próxima ejecución con F5 debe detenerse desde Visual Studio con Mayús+F5. El control privado anterior solo corresponde al lanzador que se dejó activo en esta entrega.

## Abrir el proyecto y ejecutar con Visual Studio

Para revisar el proyecto abre [INICIAR-EN-VISUAL-STUDIO.slnx](../INICIAR-EN-VISUAL-STUDIO.slnx), situado en la raíz de `CotizaSweet_v2.2.1`. Elige **EA.Cotiza.Local** como proyecto de inicio.

Antes de pulsar F5, detén la instancia que actualmente usa estos puertos. Si se inició desde una terminal, usa Ctrl+C en esa terminal. Si se inició con Visual Studio, usa Mayús+F5 en esa sesión. Si no tienes acceso al control que la inició, solicita detener esa instancia concreta de CotizaSweet 2.2.1 antes de continuar. Evita cerrar todos los procesos de Node, Python o .NET del equipo.

Pulsa F5 y espera a que el lanzador indique la dirección de la web. La solución incluye el lanzador y la API .NET para que ambos se compilen. Si aparece un error de compilación, revisa la salida y recompila la solución antes de ejecutar. El diálogo que ofrece usar la última compilación correcta puede abrir una versión anterior al cambio que deseas revisar.

Mantén el lanzador activo durante las pruebas. Al terminar una sesión iniciada con F5, usa Mayús+F5 para detener sus servicios. Si se informa que un puerto está ocupado, comprueba primero la instancia anterior y los puertos de esta copia.

## Datos ficticios para la revisión

| Campo | Valor de prueba |
|---|---|
| Tipo de cliente inicial | Persona Natural |
| Documento inicial | DNI |
| DNI | `12345678` |
| Nombre del cliente | `Cliente de prueba manual` |
| Contacto de tu negocio | `900000000`, sin escribir el prefijo `+51` |
| Proyecto | `Auditoría manual E&A Cotiza 2.2.1` |
| Correo opcional | `cliente@example.test` |
| RUC de demostración para la prueba de Empresa | `20999999990` |

Esta copia está configurada con el proveedor de demostración. El RUC `20999999990` pertenece a su conjunto ficticio y debe devolver **PASTELERÍA DE DEMOSTRACIÓN S.A.C.**, estado **DEMO** y la indicación de que no se consultó SUNAT. Comprueba que la interfaz y el PDF identifiquen esos datos como ficticios. Si la consulta informa que el proveedor está deshabilitado o requiere configuración, registra ese resultado y comprueba el modo local configurado antes de continuar. La aceptación de un proveedor real requiere su credencial vigente y una prueba independiente.

Los datos comerciales de **Dulce Atelier**, incluidos contactos, dirección, precios, disponibilidad e imágenes, siguen siendo referenciales. La marca **E&A Cotiza** identifica la plataforma. Usa datos ficticios durante esta auditoría.

## Diez criterios de aceptación manual

Realiza los criterios en orden y marca cada uno como **Conforme**, **Observación** o **Pendiente**. Conserva los PDF descargados y una captura cuando encuentres una diferencia.

| N.º | Recorrido | Resultado que debes comprobar |
|---|---|---|
| 1 | Abre Inicio, Catálogo y Cotizar. Revisa cabeceras, pies y la pestaña del navegador. | La marca E&A Cotiza se reconoce, el símbolo y el nombre forman una unidad legible, las imágenes cargan y los enlaces permiten volver al inicio. El favicon se distingue en la pestaña. |
| 2 | Pulsa Iniciar sesión y vuelve al cotizador. | El acceso local se completa sin solicitar una contraseña. La cabecera permite Cerrar sesión y puedes acceder al historial de esta cuenta sintética. |
| 3 | Intenta guardar con campos obligatorios vacíos. Después completa Persona Natural, DNI, nombre, contacto y proyecto con los datos de prueba. Introduce también un DNI corto o un correo mal formado y luego corrígelos. | La aplicación informa los campos que requieren corrección y dirige el foco al primero. Después de corregirlos, conserva los valores válidos y permite continuar cuando la propuesta esté completa. |
| 4 | Añade un servicio sin referencia. Llámalo Servicio de prueba, con unidad servicio, cantidad 2 y precio unitario 50.00 PEN. Usa Recojo en el negocio y anticipo del 50%. | El subtotal es S/ 100.00, la movilidad S/ 0.00, el IGV S/ 18.00 y el total S/ 118.00. Anticipo y saldo son S/ 59.00 cada uno. Puedes editar el nombre, alcance, cantidad y precio. |
| 5 | Cambia a En locación, selecciona una provincia y su distrito e indica una dirección ficticia. Conserva el subtotal anterior. Después prueba USD. | La movilidad del 5% es 5.00, la base 105.00, el IGV 18.90 y el total 123.90. Anticipo y saldo al 50% son 61.95 cada uno. USD cambia la moneda declarada sin conversión automática. Al volver a recojo desaparece el recargo. |
| 6 | Cambia el cliente a Empresa e introduce el RUC demo `20999999990`. Espera la respuesta y revisa razón social, estado y aviso de fuente. | Se identifica claramente la demostración, sin presentar el resultado como una verificación real de SUNAT. El PDF conserva esa identificación. Para continuar la prueba general puedes volver a Persona Natural y DNI. |
| 7 | Con una propuesta válida, pulsa Ver PDF y Descargar cotización PDF. Abre el archivo descargado. Añade varios servicios si deseas comprobar más de una página. | Vista previa y descarga muestran los datos y totales acordados. El logo vectorial E&A Cotiza se ve completo, legible y con espacio libre en el pie de cada página. Dulce Atelier mantiene su indicación referencial. No hay texto cortado, solapamientos ni páginas vacías inesperadas. |
| 8 | Guarda la propuesta. Abre Historial, pulsa Actualizar, abre el registro y descarga su PDF desde esa fila. | El registro conserva cliente, proyecto, moneda, importes y servicios. Al abrirlo se recupera su contenido. Los registros más recientes aparecen primero. Si hay más de 20, Cargar más propuestas permite continuar sin duplicados. Si aparecen registros de Versión anterior, su identificación queda clara. |
| 9 | Explora las colecciones y los paquetes. Añade un servicio del catálogo, modifica su alcance y prueba opciones de Ficha de insumos. | El servicio seleccionado llega a la propuesta y puede ajustarse. Las opciones de insumos generan notas coherentes en pantalla y PDF. Los paquetes y sus precios continúan identificados como referenciales y las selecciones alimentarias no se presentan como garantías de ausencia de alérgenos. |
| 10 | Repite el recorrido en una ventana estrecha de unos 375 px. Usa Tab para recorrer controles y abre y cierra la vista previa. Por último, cierra sesión y prueba consultar el historial antes de entrar de nuevo. | Los formularios, importes, acciones y marca se pueden usar sin recortes ni desplazamiento horizontal de la página. El foco es visible y los controles tienen nombres comprensibles. La vista previa se puede cerrar. El historial exige sesión y vuelve a estar disponible al iniciar sesión de nuevo. |

La revisión manual complementa la evidencia automatizada. El inicio de sesión real de Google, las consultas RUC reales, los controles efectivos de Railway y la recuperación en el alojamiento conservan sus respectivas pruebas pendientes. Esta guía permite emitir observaciones sobre la copia local y no acredita por sí sola una operación pública en producción.

## Comprobar los aportes de 2.2.1

La carpeta `data/backups` de esta copia debe contener un archivo `cotiza-*.sqlite` y su `.metadata.json` después del arranque. Puedes verificarlo con la herramienta de operaciones, indicando el nombre real del archivo.

```powershell
.\.venv\Scripts\python.exe scripts/backup_sqlite.py verify data/backups/<archivo-cotiza>.sqlite
```

Por defecto el siguiente respaldo corresponde después de 24 horas, con comprobación horaria y retención de siete copias válidas. La recuperación ante un fallo inesperado, la cancelación y los intervalos y retenciones personalizados se comprueban de forma automatizada con reloj controlado y bases temporales. La configuración de producción está en [OPERACIONES.md](OPERACIONES.md).

La respuesta antigua de historial, sin `nextCursor`, puede mostrar hasta 200 registros sin botón para cargar otra página. El contrato actual continúa paginado en grupos de 20. Las pruebas automatizadas comprueban ambos formatos, el aislamiento de propietarios y los cursores inválidos.

## Registrar y entregar observaciones

Anota la fecha, la carpeta y versión revisadas, la URL utilizada, el navegador, el tamaño aproximado de la ventana y los criterios que completaste. Para cada incidencia copia el siguiente formato.

```text
Criterio de la guía
Estado de la revisión
Título breve
Pasos exactos para reproducir
Datos ficticios utilizados
Resultado esperado
Resultado observado
Frecuencia de reproducción
Captura o nombre del PDF de evidencia
Impacto en el uso
```

Indica también los criterios conformes y los que dejaste pendientes para distinguir un problema observado de un recorrido todavía sin ejecutar. Antes de compartir evidencias, oculta datos personales reales y valores privados de configuración. La publicación en GitHub continuará únicamente después de tu aprobación expresa de la entrega.

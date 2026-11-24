# E&A Cotiza 2.3.0 · Levantamiento de observaciones del 22 de noviembre

Registro de validación del 22 de noviembre. La política de acceso fue actualizada el 23 de noviembre para permitir invitados; consulta [NAVIDAD-INVITADOS-2026-11-23.md](NAVIDAD-INVITADOS-2026-11-23.md).

La actualización se aplica a la carpeta y versión existentes **2.3.0**. No crea otra versión, etiqueta ni publicación. La referencia 2.2.1 y sus datos quedan fuera de estas modificaciones. El propietario debe revisar manualmente esta entrega antes de autorizar GitHub o un despliegue público.

## Resultado funcional

| Solicitud | Implementación y criterio de aceptación |
|---|---|
| Usuario administrador | Cuenta administrativa persistente y bandeja `/admin`, protegidas por rol en el servidor. El registro público sólo crea clientes. El administrador puede crear cuentas de cliente y consultar las solicitudes recibidas. |
| User y Password obligatorios | Formulario `/auth/login`, registro de clientes y cambio de contraseña en `/cuenta`. `/cotizar`, el historial, el PDF guardado y las operaciones de cotización requieren sesión. La consulta RUC también requiere sesión y permiso. Las contraseñas de E&A Cotiza son propias de la aplicación. |
| Contador de caracteres | El contador del detalle se muestra debajo del recuadro, alineado a la izquierda, y conserva el límite de 600 unidades UTF-16. |
| Tipo de cliente | Sólo Persona Natural y Empresa. Las nuevas propuestas solicitan DNI para persona natural y RUC para empresa. Los datos históricos siguen siendo legibles. |
| Fecha del evento | Obligatoria en nuevas cotizaciones, validada en interfaz y servidores; no puede preceder a la emisión. Los borradores incompletos se pueden conservar. |
| Paquetes en el paso 1 | «Elige el paquete para tu evento.» pertenece a Proyecto y cliente y su elección es opcional. |
| Contexto de paquetes | La selección responde al objetivo y a su colección: Celebraciones privadas, Regalos corporativos, Selección a medida o Experiencias de marca. |
| Revisar antes de elegir | «Sugerido para revisar» abre un diálogo con productos, cantidades, imágenes disponibles, contenido descrito, condiciones y precio referencial. Revisar o cerrar no selecciona el paquete; «Elegir este paquete» confirma la decisión. Los detalles aún no acordados se identifican como sujetos a confirmación. |
| Paso 2 | Contiene Servicios de la propuesta y Ficha de insumos opcional. La cartera ofrece seis accesos, incluidas las combinaciones de familias del ejemplo. |
| Personalización | De uno a cuatro sabores distintos de la lista solicitada; presentación obligatoria; alcance opcional, vacío como `Unknown.`; cantidad editable; unidad y precio definidos por producto. |
| Precios protegidos | Precios referenciales autorizados para pruebas, con fuente común `contracts/product-pricing.json`. El cliente no puede editarlos y Next, .NET y Python rechazan una petición manipulada. Cambiar la tarifa exige revisar y reconstruir los servicios conjuntamente. Los servicios sin referencia quedan por cotizar: 0 no significa gratuidad y el total se identifica como provisional. |
| Entrega y condiciones | Locación y movilidad, fechas de vigencia en paralelo y condiciones. IGV del 18%, movilidad calculada y anticipo del 50% en propuestas nuevas. Los porcentajes históricos se conservan al leer sus documentos. |
| Guardar | «Guardar y descargar PDF» registra la cotización en la cuenta y descarga el PDF archivado por el servidor. El historial vuelve a descargar esa misma copia; los documentos anteriores sin archivo conservan su generación histórica. |
| Enviar | «Enviar Cotización» requiere guardar los cambios primero y registra una solicitud en la bandeja del administrador. Un segundo clic devuelve el mismo recibo. El cliente y el administrador descargan los mismos bytes, comprobados mediante SHA-256. |
| Correo | Pendiente de configuración, por decisión del propietario. La recepción interna no se presenta como un correo enviado o recibido. |
| Marca | Se conserva E&A Cotiza, su firma vectorial, sus colores y tipografía local. La identidad comercial de muestra y las tarifas referenciales se indican en la plataforma y en el PDF. |

## Controles de seguridad y datos

Las contraseñas se almacenan mediante scrypt con sal aleatoria individual: N=65.536, r=8 y p=2. La concurrencia de derivaciones queda limitada para acotar el uso de memoria. Esta combinación está contemplada entre las configuraciones de referencia de la [guía OWASP de almacenamiento de contraseñas](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html). Los mensajes de acceso fallido no confirman si existe una cuenta. Hay límites persistentes de intentos y bloqueo temporal.

Las cookies de sesión son HttpOnly y SameSite; Secure se aplica al origen HTTPS. La revisión local HTTP utiliza un nombre de cookie propio del puerto para evitar colisiones con la referencia 2.2.1. El servidor revalida la activación y versión de seguridad de la cuenta. El cambio de contraseña invalida sus sesiones anteriores. Los tokens de acceso a las API permanecen en el servidor y usan emisor, audiencia y algoritmo explícitos; las identidades externas no obtienen el rol administrativo por sus datos de perfil.

Los documentos se generan en el servidor a partir del registro guardado. El cliente no proporciona un PDF ni un propietario arbitrarios. El archivo y el envío son inmutables para esa referencia; la consulta de documentos e historial está acotada a la cuenta. Las API administrativas vuelven a comprobar el rol. Los controles de origen protegen las mutaciones y la consulta RUC mantiene además su guardia de navegador y sus cuotas.

Las bases web y API se respaldaron con los escritores detenidos y se restauraron en archivos privados nuevos. Se verificaron integridad SQLite, SHA-256 y equivalencia de tablas y cantidades de filas. La base web ahora contiene cuentas, PDFs y solicitudes: debe incluirse en el respaldo junto a la base de la API. Las copias locales de revisión no sustituyen un respaldo cifrado fuera del equipo o volumen.

No se reasignan automáticamente a cuentas nuevas las cotizaciones pertenecientes a una identidad OIDC anterior. Los registros originales permanecen en su base; cualquier migración de propiedad requiere una decisión explícita y verificable.

## Evidencia de validación

Los resultados finales se reúnen en `tests/artifacts/acceptance-20261122.json`; los scripts son parte del proyecto. Las suites cubren recorridos que se solapan: sus cantidades no se suman como cobertura única. El manifiesto `SHA256SUMS.txt` y el informe privado `.local/package-current.json` identifican la copia de fuentes y el ZIP entregados, incluidos los cambios aún no publicados.

Se ejecutan pruebas unitarias TypeScript y Python, validaciones .NET, integración HTTP sobre los tres backends y dos perfiles externos sintéticos, navegación de escritorio y móvil, el flujo de cuenta/archivo/envío, regresión PDF, mutaciones dirigidas, carga local acotada y respaldo/restauración. El PDF se verifica mediante extracción, límites de página y renderizado visual; la muestra breve conserva una página y el detalle de 600 caracteres permanece íntegro.

**Alcance de conformidad:** validación técnica local para la revisión manual del propietario. No constituye una certificación independiente ni acredita ausencia de vulnerabilidades. Google real, RUC real, envío de correo, HTTPS público, recursos Docker finales y operación pública requieren sus comprobaciones específicas. Docker no pudo reconstruirse en esta sesión: el canal del motor no estaba disponible para la cuenta ejecutora. No se atribuyen a estas fuentes los resultados Docker de versiones anteriores.

## Revisión del propietario

1. Abre `.local/ACCESOS-REVISION.html` para consultar los accesos privados de administrador y cliente; no se incluyen en el ZIP de fuentes.
2. Inicia sesión en `http://127.0.0.1:3370/auth/login` y recorre los cuatro pasos siguiendo `REVISION-MANUAL-2.3.md`.
3. Guarda, descarga y envía una cotización con datos ficticios. Entra después como administrador y compara el PDF recibido con el descargado. Las solicitudes marcadas «QA SINTÉTICA» son demostraciones de las pruebas.
4. Para revisar o ejecutar el código abre `INICIAR-EN-VISUAL-STUDIO.slnx` y selecciona EA.Cotiza.Local. Detén antes la instancia de esta copia; no ejecutes una compilación anterior si Visual Studio informa un error.
5. Registra tus observaciones para corregirlas sobre esta misma v2.3.0. La publicación en GitHub permanece a la espera de tu aprobación.

## Resultados ejecutados de esta entrega

| Comprobación | Resultado local |
|---|---|
| Unitarias TypeScript | 68 aprobadas |
| Python | 164 pruebas y 129 subpruebas aprobadas |
| .NET | 136 aserciones aprobadas; compilaciones Debug y Release sin errores ni advertencias |
| Integración HTTP | 860 comprobaciones; Next, Python y .NET con perfiles estándar y Google sintéticos |
| Navegador | 34 comprobaciones de UX; 20 desde formulario vacío; 39 de cuenta y documentos; 31 por perfil OIDC de regresión; 14 del bundle de producción |
| PDF | 14 documentos, 38 páginas, cero caracteres fuera de margen; muestras breve, cartera y detalle máximo renderizadas e inspeccionadas |
| Mutaciones dirigidas | 15 de 15 detectadas en validación y finanzas Python; no representa cobertura de mutación de todo el sistema |
| Paridad financiera | 1.565 casos por implementación y 41 entradas inválidas |
| Rendimiento HTTP de producción local | 80 peticiones, concurrencia 8, p95 111.76 ms; umbral 2.000 ms |
| Persistencia y respaldo | 64 escrituras con ocho trabajadores; integridad SQLite y copia equivalente. Bases web y API respaldadas y restauradas por separado en destinos nuevos |
| Infraestructura | TypeScript de la definición Railway comprobado; ningún recurso remoto creado o modificado |

Los 39 controles de cuenta verifican también que administrador y cliente descarguen exactamente el mismo PDF, que el envío sea idempotente, que otra cuenta no pueda consultar ni enviar la cotización y que una cookie revocada no pueda reutilizarse. El recorrido desde formulario vacío verifica que los cambios posteriores exijan guardar otra copia y no alteren la solicitud anterior.

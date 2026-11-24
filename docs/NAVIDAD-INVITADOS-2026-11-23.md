# E&A Cotiza 2.3.0 · Invitados y promoción navideña

Actualización del 23 de noviembre de 2026 sobre la misma **v2.3.0**. Sustituye la exigencia anterior de iniciar sesión para cotizar. No se modifica la referencia 2.2.1 ni se publica en GitHub.

## Recorrido del cliente

Al abrir `/cotizar` sin una cuenta iniciada, aparece el anuncio navideño mientras la campaña esté vigente. Presenta dos decisiones:

- **Continuar sin registro:** permite completar los cuatro pasos, descargar el PDF y enviar la solicitud al negocio. Cerrar el anuncio mediante X, Escape o clic fuera tiene este mismo efecto. El anuncio no vuelve a interrumpir ese navegador para esta campaña una vez elegida una opción.
- **Registrarme y aprovechar el 20 %:** prepara una invitación protegida del servidor y abre el formulario de registro. Al terminar, la cuenta queda iniciada automáticamente, conserva el borrador del cotizador y dispone de su historial personal.

El diseño utiliza la marca vectorial existente, DM Sans, verde pino, crema y granate, con ramas y estrellas vectoriales. No descarga imágenes ni tipografías externas. Escritorio y móvil mantienen accesibles las dos alternativas.

## Condiciones configuradas

El beneficio es **20 % sobre los servicios** para cuentas nuevas que acepten la oferta al registrarse y cuyos eventos se realicen **del 30 de noviembre de 2026 al 2 de enero de 2027**, ambos inclusive. La movilidad, el IGV y el anticipo se calculan después del descuento. La aceptación de la campaña se habilita desde esta actualización hasta el 2 de enero de 2027, usando el día de Perú y el reloj del servidor.

La fecha que determina el beneficio es la **fecha del evento**. Una cotización con evento fuera del período continúa siendo válida y se calcula sin descuento. Un visitante o una cuenta no adherida no puede obtenerlo modificando el JSON, un campo oculto o el almacenamiento del navegador.

Ejemplo de recojo: servicios S/ 288,00; descuento S/ 57,60; servicios netos S/ 230,40; IGV S/ 41,47; total **S/ 271,87**. El PDF, el historial y la copia recibida por el administrador conservan los mismos importes.

Las tarifas y la identidad comercial siguen siendo referenciales para pruebas. La promoción no convierte la solicitud en una reserva confirmada ni en un pago. El envío actual se registra en la bandeja del administrador; el correo externo permanece pendiente de configuración.

## Protección y conservación

El visitante utiliza un contexto temporal propio del navegador, sin crear una cuenta ni iniciar sesión con credenciales. Su cookie es opaca y HttpOnly, con vigencia fija máxima de cuatro horas. Otro visitante o una cuenta no puede consultar sus documentos. No se le habilita el historial privado ni la administración.

Los borradores de invitado no enviados y con más de 24 horas pueden eliminarse al preparar nuevas visitas, en lotes de hasta 100. Esta limpieza conserva las solicitudes enviadas y los registros de cuentas. La expiración del acceso del invitado no elimina el documento que recibió el administrador. Hay límites persistentes de creación, validación, consultas y guardados para acotar el uso anónimo.

La adhesión a la promoción se registra junto con la creación de la cuenta en una transacción: no se concede a una cuenta ya existente ni por repetir una invitación consumida. El descuento guardado permanece en los documentos históricos después de finalizar la campaña. Las solicitudes anteriores de un invitado no se reasignan automáticamente a cuentas usando DNI, correo o nombre.

## Validación y revisión manual

Los resultados se registran en `tests/artifacts/navidad-acceptance.json`. Se ejecutaron pruebas unitarias, integración de los tres backends, manipulación de descuentos y permisos, límites temporales, navegación real de invitado, registro con conservación del borrador, historial, PDF y bandeja administrativa. Las suites se solapan y no se suman como cobertura única.

Scripts específicos: `tests/christmas-offer.e2e.mjs`, `tests/guest-quote.e2e.mjs`, `tests/guest_workflow.py`, `tests/promotion-register.e2e.mjs` y `tests/promotion_workflow.py`. Usan datos sintéticos y no envían correo externo.

1. Abre `http://127.0.0.1:3370/cotizar` en una ventana privada para representar a un cliente nuevo y observar el anuncio.
2. Continúa sin registro, completa la propuesta, descarga el PDF y pulsa Enviar Cotización. Debe permanecer en el cotizador sin pedir User o Password.
3. En otro contexto privado, acepta la oferta y crea una cuenta propia. Confirma que la propuesta se conserva y que aparece el historial.
4. Prueba eventos del 30/11/2026 y del 02/01/2027 con beneficio, y del 29/11/2026 o del 03/01/2027 sin beneficio.
5. Entra como administrador con los accesos privados de esta instalación y compara el PDF recibido con el descargado.

Google real, RUC real, correo, Docker y despliegue público conservan sus verificaciones específicas pendientes. Esta entrega acredita comprobaciones locales y requiere la revisión manual del propietario antes de publicar.

## Resultados de cierre

| Comprobación | Resultado |
|---|---|
| Unitarias TypeScript | 83 aprobadas |
| Python | 182 pruebas y 129 subpruebas aprobadas |
| .NET | 153 aserciones aprobadas; Debug y Release compilados sin errores ni advertencias |
| Integración HTTP | 860 comprobaciones en tres backends y dos perfiles OIDC sintéticos |
| Anuncio navideño | 33 comprobaciones en escritorio y móvil; cierre libre y recuerdo de la elección |
| Invitado completo | 21 comprobaciones de navegador y 38 HTTP, con PDF y envío sin credenciales |
| Registro promocional | 14 comprobaciones de navegador y 40 HTTP; fecha, permiso, cálculo, historial y documento |
| Paridad financiera | 1.581 casos por implementación TS/Python/.NET, más 41 inválidos |
| Mutaciones dirigidas | 18 de 18 detectadas |
| Bundle de producción | Compilación aprobada, 17 comprobaciones de navegador y 80 solicitudes a concurrencia 8 |
| PDF con promoción | Una página, montos coherentes y cero caracteres fuera de margen; renderizado inspeccionado |

El p95 local de las 80 solicitudes fue 81.9 ms, con umbral previo de 2.000 ms. La plataforma nativa devuelve HTTP 200 en web, cotizador público, API .NET y RUC Python. La aceptación es local y las pruebas de los proveedores externos siguen separadas.

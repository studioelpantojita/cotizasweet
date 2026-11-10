# Verificación de servicios a medida — 14 de octubre de 2026

- TypeScript sin errores. Compilación Next.js y .NET Debug/Release correctas.
- 4 pruebas nuevas de referencias, límites, ausencia de precio, compatibilidad, insumos opcionales e importes; 9 pruebas de dominio aprobadas.
- Integración completa aprobada con backends Next, Python y .NET: guardado, recuperación, referencia visual, detalle, dirección, importes, rechazo de referencias inexistentes y controles de autenticación existentes. Bases de datos de prueba temporales.
- Navegador: cartera con 17 fotografías, filtros 8/4/5, precio vacío rechazado y servicio añadido conservando la posición. Se retiró el scrollIntoView que llevaba a la cabecera.
- Cantidad/precio alineados en escritorio y móvil de 390 px; sin desbordamiento horizontal. Fotografías verificadas en ambos tamaños.
- Recojo fijo confirmado: Tiendita “LosPantojados” · Santiago de Surco. Campo de solo lectura, movilidad cero y dirección de entrega conservada al alternar.
- Cotización de prueba desde el formulario, sin llenar la ficha opcional: 2 tortas × S/ 150.00, subtotal S/ 300.00, IGV S/ 54.00, total S/ 354.00, anticipo/saldo S/ 177.00.
- PDF de servicio a medida: una página, inspección visual con Poppler y sin textos fuera de página. 12 documentos de regresión, incluidos textos largos y máximos, pasan la comprobación de límites. Las notas cortas aprovechan el espacio disponible antes de crear otra página.

Archivos de evidencia en outputs: CotizaSweet-Cartera-Servicios.png, CotizaSweet-Servicio-A-Medida.png, CotizaSweet-Formulario-Movil.png, CotizaSweet-Cartera-Movil.png y CotizaSweet-Cotizacion-Prueba.pdf.

---

# Verificación del recorrido por ocasiones — 14 de octubre de 2026

- Una sola etiqueta de cotización en Home, menú móvil, pie y fichas: «Cotizar mi proyecto». Dos botones principales y un enlace de pie; las fichas muestran su acceso solo al abrirlas.
- Pasarela de 17 fotografías: filtros verificados con 8 tortas/postres, 4 macarons y 5 chocolates. Las flechas desplazan la lista; Home/End funcionan por teclado y el botón siguiente se deshabilita al llegar al final. Cambiar de filtro vuelve al comienzo.
- Las cuatro familias filtran correctamente sus opciones. Los 12 proyectos cambian la ficha, referencias visuales, servicios y enlace contextual.
- Recorrido real Home → Lanzamientos de marca → cotizador: objetivo correcto, conservado al recargar. Recorrido móvil Home → Entidades y bancos → cotizador: objetivo correcto.
- Corregida una regresión preexistente de inicialización: la repetición de efectos de React en desarrollo consumía dos veces el enlace, perdiendo el proyecto seleccionado. Una referencia de inicialización evita repetir la aplicación del parámetro.
- Vista de escritorio (1280 px), móvil (390 px) y teléfono pequeño (320 px): sin desbordamiento horizontal del documento. Se corrigieron los nombres de colección que excedían el ancho de su tarjeta. El viewport temporal se restauró.
- Menú móvil, cierre tras elegir enlace, apertura/cierre de ficha fotográfica y conservación de la ocasión en la ficha comprobados.
- TypeScript y compilación Next.js de producción: correctos. 18 pruebas TypeScript aprobadas: 9 de dominio, 6 de catálogo y 3 de presentaciones.
- Home, catálogo y API de catálogo local: HTTP 200. Sin errores de consola durante la comprobación.
- Las referencias fotográficas no crean productos comerciales ni paquetes. Se usan los packs y adicionales existentes; las características alimentarias requieren la revisión indicada en cada ficha.
- Este seguimiento no modifica el cálculo de importes, el servicio RUC ni el diseño PDF; las pruebas de PDF/.NET/Python detalladas más abajo pertenecen a verificaciones previas y no se repitieron en esta intervención visual.

Capturas: `CotizaSweet-Pasarela.png`, `CotizaSweet-Pasarela-movil.png`, `CotizaSweet-Ocasiones.png`, `CotizaSweet-Ocasiones-movil.png`. Registro de comprobaciones: `CotizaSweet-Ocasiones-Pruebas.json`, en la carpeta de entrega `outputs`.

---

# Verificación del Home y catálogo — 14 de octubre de 2026

- Compilación Next.js 16.3.4 de producción y TypeScript: correctas.
- .NET 10, Debug y Release: compilación correcta sin advertencias.
- 9 pruebas de dominio y 6 de catálogo TypeScript: correctas.
- 2 pruebas de catálogo Python: correctas; contrato y archivos comerciales válidos.
- 17 fotografías únicas, locales, vinculadas a 8 tortas/postres, 4 macarons y 5 chocolates.
- Home, catálogo, API de catálogo, .NET, Python e identidad local: HTTP 200 en 3200/8200/8201/9200.
- Navegador: filtros 17/8/4/5, búsqueda «napoleon» y «organicos», estado vacío, limpieza, apertura/cierre de fichas y menú móvil comprobados.
- Variante comercial: box de mini repostería pasa de S/ 144 a S/ 192; sin moneda USD definida muestra «Precio por confirmar».
- Selección de Regalos corporativos en el Home enlaza al cotizador con `proyecto=empresas`.
- Escritorio y viewport móvil de 390 px: sin desbordamiento horizontal del documento; diálogo móvil sin desbordamiento horizontal. El viewport se restauró al finalizar.
- Corregida la codificación de stdout/stderr del lanzador para que los mensajes Unicode no cierren los servicios cuando la salida se redirige en Windows.
- Cotizador, validación RUC, importes y PDF sin cambios de lógica en este rediseño. No se añade compra, cobro, pedido ni producto con precio a partir de las fotografías de referencia.

Capturas entregadas en `outputs`: CotizaSweet-Home.png, CotizaSweet-Catalogo.png, CotizaSweet-Home-movil.png y CotizaSweet-Detalle-movil.png.

---

# Verificación de las correcciones

Ejecución real en Windows, 11 de octubre de 2026. Node.js 24.19.0, Python 3.12 y SDK .NET 10.0.400. Las afirmaciones de la documentación original se sustituyen por estos resultados observados.

| Comprobación | Resultado |
|---|---|
| TypeScript y compilación Next.js 16.3.4 de producción | Correctos, incluido PDF.js |
| Compilación solución .NET, Debug y Release | Correcta, sin errores ni advertencias |
| Pruebas unitarias TypeScript | 7 correctas; precios, versiones, RUC, condiciones de pago, almacenamiento y sesiones |
| Integración HTTP backend Next.js | Correcta |
| Integración HTTP backend Python | Correcta |
| Integración HTTP backend .NET | Correcta |
| Consulta real Decolecta | Correcta; RUC público SUNAT 20131312955, razón social, ACTIVO / HABIDO |
| UI integrada Next.js → .NET → Python | Consulta real, nombre bloqueado, borrado ante RUC inválido y bloqueo del PDF comprobados |
| Guardado desde navegador | Correcto; registro de prueba visible en historial .NET, S/ 169.92 |
| PDF de prueba normal | 1 página, S/ 339.84, con anticipo y saldo |
| PDF de descripción con 149 saltos de línea | 4 páginas; se conservan las 149 líneas X y el último carácter Z |
| PDF de 30 productos con campos largos e importes máximos | 12 páginas |
| PDF de insumos Unicode | 2 páginas |
| PDF con anticipo 0%, 30%, 100% y total cero | 1 página cada uno; condiciones e importes coherentes con recojo o entrega |
| Títulos y condiciones con saltos de línea | 9 páginas; 120 caracteres de título, 120 letras del producto, 310 líneas de notas y encabezado de insumos conservados |
| Prueba descargada desde navegador | 6939D77F, 1 página; proyecto completo, total S/ 339.84, anticipo 30% S/ 101.95, saldo S/ 237.89 |
| Validación visual | Campos obligatorios, foco, RUC inválido, anticipo 101% e importe con tres decimales bloquean PDF |
| Visor PDF | Página completa sin desbordamiento; ampliación al ancho con desplazamiento vertical |
| Límites geométricos del PDF | 32 páginas analizadas, sin caracteres fuera de página |
| Cierre del lanzador | Confirmado: quedaron libres 3000, 8000, 8001 y 9000 al detenerlo |
| Visual Studio | INICIAR-EN-VISUAL-STUDIO en ejecución con F5; EA.Cotiza.Local bajo depuración y los cuatro servicios con HTTP 200 |
| Descarga desde navegador tras F5 | PDF del historial descargado, abierto y comprobado: 1 página, RUC 20131312955 y S/ 169.92 |

Las pruebas de integración verifican OIDC real local con claves RSA efímeras, PKCE, state, nonce, callbacks no reutilizables, sesiones, permisos, firma, audiencia, emisor, expiración, CSRF y aislamiento entre usuarios. También rechazan RUC inválido, nombre distinto al consultado, versiones antiguas al crear, nombres vacíos, correo, vigencia, IGV, movilidad, distrito, insumos y solicitudes de más de 70.000 bytes. La persona natural con RUC se acepta.

Los RUC ficticios se usan únicamente en las pruebas automáticas con proveedor `demo`. La prueba visual usó Decolecta real; el registro se identificó expresamente como PRUEBA LOCAL. Los artefactos distribuidos usan datos de ejemplo y no incluyen bases ni credenciales.

Se inspeccionaron los PDF renderizados con Poppler, incluyendo el caso extenso y todos los finales de página. La vista previa del navegador dibuja el PDF mediante PDF.js; se comprobó visualmente en el navegador integrado, que carece de visor nativo.

## Límites

- No se ejecutaron contenedores ni se realizó despliegue público.
- El emisor OIDC local tiene una cuenta compartida de desarrollo. No se verificó un proveedor de identidad comercial.
- No se realizó prueba de carga ni migración de historiales existentes.
- La cabecera y las tarifas continúan siendo referenciales, claramente identificadas.
- Se incluye una solución simplificada, `INICIAR-EN-VISUAL-STUDIO.slnx`, que inicia directamente `EA.Cotiza.Local`. Se comprobó la ejecución desde Visual Studio mediante F5. Se preparó un entorno Python `.venv` dentro del proyecto para que Visual Studio pueda leer sus dependencias; las dependencias temporales del análisis tenían permisos incompatibles con la sesión del usuario.

El ZIP excluye `.env.ruc.local`, `local.settings.json`, `Local.Build.props`, dependencias instaladas, compilados, `.vs`, bases y registros. Conserva ejemplos de configuración, archivos de bloqueo, contratos, pruebas y código fuente.

## Revisión de proyecto, pagos y presentación

El nombre introducido en `event` es el título principal del proyecto en el PDF y sus metadatos. El objetivo y su descripción son información complementaria. La plantilla 3 envuelve encabezados largos y conserva los saltos de línea de las condiciones. El formulario permite editar el anticipo, muestra los importes de anticipo/saldo y conserva el último borrador válido mientras se corrigen números incompletos. Los errores se presentan en español con enlaces a los campos y atributos de accesibilidad. Se exige dirección en nuevas propuestas en locación en TypeScript, .NET y Python; la lectura histórica conserva los datos originales.

Se recompilaron Debug/Release y Next.js, se repitieron las tres suites HTTP y se verificó el navegador con el lanzador local integrado. En esta revisión Visual Studio estaba cerrado; se ejecutó el mismo lanzador .NET desde la línea de comandos. La ejecución previa con F5 consta en las comprobaciones anteriores.
# Verificación adicional del rediseño — 12/10/2026

- TypeScript: 9 pruebas aprobadas; compilación de producción Next.js aprobada. .NET: compilaciones Debug y Release sin errores ni advertencias, después de detener la versión anterior con Visual Studio.
- Suites HTTP Next, Python y .NET aprobadas. Incluyen rechazo de EUR, moneda nula, teléfonos de 8/10 dígitos, letras, prefijo no admitido y longitudes excesivas. USD se guarda y recupera sin conversión de importes. Se conserva la validación de identidad por RUC.
- 11 PDF / 34 páginas de regresión: comprobación de bordes, conservación de textos largos y condiciones de pago. Dos muestras nuevas de una página, PEN y USD, revisadas visualmente.
- Navegador: DNI limitado a 8 dígitos, teléfono a 9; un teléfono incompleto y anticipo 101% bloquean el PDF. RUC real 20131312955 devuelve razón social, ACTIVO y HABIDO; al cambiar el número la razón social se vacía.
- Cotización real de prueba guardada: **5BBBF7AC**, moneda USD, proyecto «Celebración de Valentina · colección de mini repostería», evento 30/10/2026, total US$ 339.84, anticipo 50% US$ 169.92 y saldo US$ 169.92. PDF descargado desde el navegador y reabierto: una página, moneda, fechas y condiciones correctas, sin texto fuera de los márgenes. Los datos personales de esta prueba son ficticios.
- Diseño comprobado a 1280 y 390 píxeles de ancho: sin desbordamiento horizontal; campos en dos columnas y una columna, respectivamente. La vista normal del navegador se restauró al finalizar.
- Aplicación reiniciada mediante F5 en Visual Studio; web 3100, API .NET 8100, Python 8101 e identidad 9100 responden HTTP 200. La consulta RUC continúa usando la configuración privada existente.

---


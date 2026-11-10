# Revisión multirrol del catálogo — 12/10/2026

Revisión realizada sobre el código y los servicios locales de CotizaSweet, desde las perspectivas red team, blue team, QA, ciberseguridad y desarrollo sénior. Es una revisión técnica con pruebas locales; no equivale a una auditoría independiente o certificación de seguridad.

## Resultado ejecutivo

El módulo de consulta está implementado, compilado e integrado. Hay seis productos/fichas y doce variantes de ejemplo. Se conserva la identidad visual y el flujo previo de cotización. El acceso principal de esta revisión es http://127.0.0.1:3200/catalogo.

El uso comercial requiere que el negocio apruebe precios, fotografías, composición y afirmaciones de insumos. No se inventó una confirmación: todas las fichas entregadas están pendientes. El cambio incorpora controles de validación y de exposición de datos; no habilita una administración pública.

## Red team: escenarios intentados

| Escenario | Control y evidencia | Resultado |
|---|---|---|
| Publicar o borrar un catálogo sin sesión | POST y DELETE contra el endpoint, en tres backends y BFF | HTTP 405 |
| Consultar cotizaciones privadas anónimamente | Suite HTTP preexistente ampliada | HTTP 401 |
| Falsificar identidad por cabeceras o token alterado | Pruebas OIDC, audiencia, emisor, caducidad, firma y scopes | Rechazado; 401/403 según caso |
| Leer cotizaciones de otra cuenta | Dos identidades de prueba separadas | Historial aislado |
| Filtrar costos o propiedades no declaradas | Propiedad costCents en fixture + esquema estricto | Rechazo antes de importación |
| Publicar un producto oculto | published=false + lectura de instantánea | Excluido de respuesta |
| Imagen externa o recorrido de directorios | URL HTTPS ajena y /images/../../private.jpg | Validación rechazada |
| Precio negativo, decimal o fuera de límite | Pruebas del contrato de variantes | Validación rechazada |
| Identificadores duplicados | Pruebas de productos y variantes | Validación rechazada |
| Confirmación falsa incompleta | Estado confirmed sin responsable/fechas; fecha imposible | Validación rechazada |
| Reutilizar callback o atacar CSRF | Suites existentes en los tres modos | Callback consumido y origen comprobado |
| Sobrescribir datos buenos con importación inválida | Base temporal e importación negativa | Instantánea previa y cotización conservadas |

La interfaz imprime textos con React, sin HTML crudo. El servidor no toma URL de imágenes ni de upstream desde parámetros del visitante. No existe campo público de carga de archivos. El examen está limitado a estos flujos; no se simuló un atacante con acceso al sistema operativo o a secretos.

## Blue team: cambios defensivos

- DTO/contrato estricto compartido: rechaza propiedades ajenas al catálogo en cualquier nivel. La API valida la instantánea antes de devolverla y filtra productos no publicados.
- Precios como centavos enteros; USD ausente no se calcula a partir de PEN.
- Confirmación separada de la selección del visitante; fechas reales y ventana de vigencia. Los valores son administrados mediante el artefacto de despliegue.
- SQL parametrizado y una sola sentencia atómica para reemplazar la instantánea, con hash y fecha de importación.
- BFF con timeout de ocho segundos, redirecciones bloqueadas y lectura máxima de 300.000 bytes desde la API. Errores públicos sin detalles de infraestructura.
- Cache-Control: no-store para impedir que el catálogo quede retenido por la caché HTTP del cliente; no garantiza actualización instantánea de una pestaña ya abierta.
- Cabeceras globales verificadas: X-Content-Type-Options=nosniff, X-Frame-Options=DENY, Referrer-Policy=strict-origin-when-cross-origin y Permissions-Policy para cámara, micrófono y geolocalización.
- Compose dejó de compartir todo el archivo .env entre servicios. El token RUC va a Python; los secretos de sesión y cliente OIDC quedan en Next.js. La clave de integración sí es compartida porque autentica llamadas internas.
- El paquete de entrega excluye credenciales, bases, registros, entornos virtuales, node_modules, binarios y compilaciones locales.

## QA: ejecución y experiencia de uso

| Verificación | Estado |
|---|---|
| TypeScript y producción Next.js | Compilación satisfactoria |
| .NET Release | Compilación satisfactoria, cero advertencias/errores en esa compilación |
| Catálogo TypeScript | 6 pruebas aprobadas |
| Dominio, moneda y sesión anteriores | 9 pruebas aprobadas |
| Persistencia/validación Python | 2 pruebas aprobadas, con múltiples casos |
| Integración HTTP Next.js, Python y .NET | 3 suites completas aprobadas |
| Docker Compose | Configuración validada con .env.example |
| Escritorio 1365×900 | Tarjetas, detalle y variantes comprobados |
| Móvil 390×844 | Una columna y diálogo desplazable; sin desborde horizontal observado |
| Teclado | Escape, foco dentro del modal y retorno a la tarjeta comprobados |
| Búsqueda y filtros | Packs/insumos, búsqueda sin tildes, sin resultados y limpieza comprobados |
| Moneda y valor cero | USD sin tarifa muestra precio por confirmar; cero conserva unidad de inclusión |
| Fallo de API | Mensaje de error y recarga visibles; no se sustituyen datos por una oferta ficticia |
| PDF | Código de generación sin cambios; suite visual no repetida en esta entrega |

La galería admite hasta cinco fotos por contrato, pero esta entrega contiene una foto por producto/ficha. No se afirma haber validado visualmente un caso con múltiples fotografías. La confirmación vigente y vencida se probaron en reglas unitarias; el catálogo real entregado permanece pendiente.

Se corrigió una falla de la prueba Python: el contexto de transacción SQLite no cerraba por sí solo la conexión en Windows. El test ahora usa cierre explícito y puede limpiar su base temporal.

## Desarrollo sénior: estructura y datos

El componente del catálogo está separado del formulario y de las reglas de cotización. La misma vista sirve al inicio y a /catalogo. Se retiró el componente anterior de vitrina que quedó sin uso. Los endpoints privados de cotizaciones no se convirtieron en públicos.

SQLite conserva el esquema previo y añade catalog_snapshot. El modelo de instantánea es apropiado para esta lectura pequeña, pero no implementa relaciones de inventario, órdenes, edición concurrente ni multiempresa. El JSON de despliegue es la fuente de verdad; los cambios directos a la instantánea pueden ser reemplazados al iniciar.

El cotizador anterior conserva plantillas y precios editables independientes. Un cambio en el catálogo no recalcula una propuesta ni actualiza esas plantillas. Esta separación corresponde al alcance de solo consulta; si se incorpora compra o traslado a cotización, se necesitará una resolución de variante y precio en el servidor con historial de vigencia.

La API integrada usa .NET. Python añade validación/importación y conserva su responsabilidad RUC; la alternativa de backend Python se probó por compatibilidad, pero no se ejecuta al mismo tiempo como dueño de las cotizaciones en Compose.

## Hallazgos corregidos y pendientes

| Prioridad | Hallazgo | Disposición |
|---|---|---|
| Media | Sobreexposición de secretos en Compose por env_file compartido | Corregido mediante variables explícitas por servicio |
| Media | Posible confusión entre precios PEN y USD del catálogo | Corregido: tarifa por moneda y ausencia explícita |
| Media | Riesgo de presentar insumos como confirmados sin evidencia | Estado pendiente por defecto; confirmación con responsable/fechas y nota pública |
| Media | Posible exposición de propiedades internas en JSON público | Contrato estricto y rechazo, sin volcado libre de entidades |
| Baja | Vitrina anterior duplicada y sin uso | Retirada |
| Operativa | Instancia Debug anterior bloquea binarios y puerto | Versión Release en puertos independientes; detener la instancia vieja antes de reconstruir Debug |
| Antes de publicar | Datos comerciales aún referenciales y fichas sin aprobación | Sustituir/aprobar con el negocio |
| Antes de publicar | OIDC local de prueba | Configurar proveedor OIDC real y HTTPS |
| Antes de publicar | Motor Docker no disponible en la revisión | Ejecutar build, arranque y smoke test de contenedores en staging |
| Antes de publicar | Sin auditoría CVE actualizada, prueba de carga ni recuperación | Ejecutar escáneres de dependencias, carga y restauración en el pipeline |
| Evolución | Sin rate limit por cliente para catálogo, métricas ni alertas específicas | Definir protección de borde y observabilidad según tráfico |
| Evolución | Un catálogo global, sin aislamiento multiempresa | Añadir tenant y permisos si se vende como servicio multiempresa |

No se declara ausencia total de vulnerabilidades. Los resultados anteriores solo cubren el código examinado y las pruebas ejecutadas. Los archivos de bloqueo no se actualizaron a versiones nuevas ni se añadieron dependencias.

## Operación y referencias

El procedimiento detallado está en CATALOGO.md: instalación, contratos, publicación de datos, migración, respaldo, rollback, secretos y comandos de pruebas. Mantener un nodo por servicio mientras se use esta arquitectura SQLite local.

El diálogo utiliza Radix, que proporciona gestión de foco y cierre con Escape: [documentación oficial](https://www.radix-ui.com/primitives/docs/components/dialog). La atomicidad de una sentencia de escritura se apoya en las transacciones SQLite: [documentación oficial](https://www.sqlite.org/lang_transaction.html). La lectura HTTP se implementa con Route Handlers de Next.js: [documentación oficial](https://nextjs.org/docs/app/api-reference/file-conventions/route). Esos comportamientos se contrastaron además con la documentación instalada de Next.js.

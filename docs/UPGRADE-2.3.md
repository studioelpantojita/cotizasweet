# E&A Cotiza 2.3.0 · Experiencia de navegación y cotización

Fecha de preparación: 21 de noviembre de 2026. Esta versión parte de la entrega local 2.2.1, commit `faba33f1738377063f13e92dab31c57ccde8fdd5`, y atiende las seis observaciones visuales del propietario. Se prepara en `outputs/CotizaSweet_v2.3.0`. La carpeta 2.2.1 conserva sus fuentes y datos. Esta revisión utiliza nuevas bases, puertos y archivos de compilación; no migra automáticamente sus cotizaciones.

La publicación en GitHub y la continuación del despliegue requieren aprobación expresa del propietario. Los resultados anteriores se conservan como antecedentes de sus respectivas versiones en [UPGRADE-2.2.1.md](UPGRADE-2.2.1.md) y [AUDITORIA-2.2.md](AUDITORIA-2.2.md).

## Observaciones atendidas

| Solicitud del propietario | Cambio de esta versión | Criterio de aceptación |
|---|---|---|
| Corregir el aspecto del buscador en `/catalogo?seleccion=packs` | Se corrige la superposición visual de los estados de foco del contenedor y del campo. El buscador conserva un indicador visible de foco, su icono, la búsqueda y la acción Limpiar | Al enfocar y escribir no aparecen dos marcos superpuestos ni se desplaza el icono. Filtrar y limpiar actualizan los resultados y funcionan con teclado |
| Retirar Proyecto y utilizar Detalle del Proyecto en el PDF | Se retira el control Proyecto de Tu negocio y tu cliente. Objetivo del cliente pasa a Objetivo del Proyecto y Detalle del objetivo pasa a Detalle del Proyecto | El detalle completo, hasta el límite de 600 unidades del formulario, aparece en la vista previa y el PDF. Si un registro antiguo no tenía detalle, conserva su título como contenido inicial |
| Abrir una ficha al pulsar fotografías de inicio | Las fotografías de la portada, las selecciones, las colecciones, Cómo Funciona y Packs y cajas abren un diálogo con imagen, nombre, descripción y datos de referencia | Pulsar la fotografía mantiene la dirección de la página. Se puede cerrar con el control visible o Escape y volver al elemento que la abrió. Ir al cotizador requiere la acción independiente de la ficha |
| Reducir la fatiga del formulario conservando sus campos y secciones | El cotizador se organiza en cuatro pasos con barra lateral numerada, progreso y botones Anterior y Continuar. El contenido permanece en el estado de la propuesta al cambiar de paso | Se puede recorrer, volver atrás, guardar un borrador, reabrir registros y completar los mismos campos. Los errores de exportación o guardado llevan al paso y control correspondientes |
| Corregir la navegación y su posición | La cabecera comparte Catálogo, Cómo Funciona y Accede a la derecha de la marca. En móvil se despliegan desde el menú | Los tres destinos funcionan, la marca permite regresar a Inicio y el acceso identifica una sesión iniciada con Cerrar sesión en el cotizador |
| Reducir botones repetidos | La portada dirige primero al catálogo y a la elección de ocasión. Se mantienen dos accesos visibles al cotizador, en la selección de ocasión y en el pie. Las fotografías abren fichas mediante un único control por imagen | No se repite Explorar presentación en cada tarjeta ni Cotizar mi proyecto en la cabecera, el hero y las secciones promocionales. Los accesos que quedan conservan el contexto del proyecto |

La corrección del buscador atiende su presentación y foco. Los filtros por categoría, el tratamiento de tildes y las opciones comerciales siguen disponibles. Las monedas PEN y USD mantienen sus importes declarados sin conversión automática.

## Campos y funciones conservados

| Paso nuevo | Contenido existente que permanece disponible |
|---|---|
| 1 · Proyecto y cliente | Objetivo del Proyecto, presupuesto máximo, Detalle del Proyecto, tipo de cliente, DNI/RUC, nombre o razón social, consulta y reintento RUC, contacto del negocio con prefijo Perú, correo opcional, fecha opcional del evento y contacto del cliente de registros anteriores cuando exista |
| 2 · Servicios e insumos | Paquetes Esencial, Signature y Alta Vitrina; sugerencia y comparación de presupuesto; moneda; cartera de referencias; personalización de contenido, presentación y alcance; packs y adicionales; servicio sin referencia; categoría, nombre, descripción, unidad, cantidad y precio de cada servicio; eliminación de servicios; ficha opcional de insumos, sus categorías y opciones, porcentaje de cacao, especificaciones adicionales, notas automáticas y notas históricas |
| 3 · Entrega y condiciones | Recojo o servicio en locación, ciudad o provincia, distrito, dirección o referencia, movilidad calculada, fecha de emisión, validez, IGV, anticipo y condiciones de alcance, entrega, revisiones y pago |
| 4 · Revisar propuesta | Vista de cliente y detalle, servicios, insumos y condiciones; moneda, subtotales, movilidad, IGV, total, anticipo y saldo; vista previa PDF, descarga, guardado y compartición; identificación de datos comerciales referenciales y de RUC de demostración |

Se corrigió además la conservación de borradores incompletos sin servicios. El esquema de borrador admite de cero a 30 líneas, mientras la validación final continúa exigiendo una propuesta completa. Las comprobaciones de cantidad, tipos y precios por línea permanecen vigentes.

Se mantienen el historial por cuenta, su paginación, el tratamiento de registros anteriores, las sesiones, los controles de origen, la cuota RUC persistente y las opciones de respaldos de 2.2.1. El borrador se conserva en la pestaña del navegador. Guardar borrador no crea una versión del historial del servidor y no acredita una copia recuperable fuera de esa pestaña.

Durante la prueba del nuevo recorrido se corrigió el esquema de borrador para aceptar una propuesta que todavía no contiene servicios. La validación final conserva su exigencia de al menos un servicio y los límites de cantidad, precio y longitud. La prueba de navegador confirma que un borrador sin servicios conserva sus datos y su paso al recargar.

El informe `tests/artifacts/preservation-check.json` comprueba que diez archivos de implementación coinciden con 2.2.1, incluidos logística, insumos, editor de servicios, moneda, personalización de referencias, paquetes, dominio financiero Python/.NET, respaldos y contrato compartido.

## Compatibilidad del detalle del proyecto

El contrato de las API conserva `event` y `projectBrief`. Al editar Detalle del Proyecto, el contenido íntegro queda en `projectBrief` y se calcula un resumen de hasta 120 unidades UTF-16 para `event`. El resumen limpia las separaciones de línea y evita dejar media pareja surrogate en su límite. Esta adaptación no cambia fórmulas ni importes.

La vista previa y el PDF toman primero el detalle completo. Los registros anteriores que solo contenían el antiguo título lo usan como fallback. Los que ya tenían un detalle conservan ese contenido. Borrar el nuevo campo también borra su resumen compatible para que la validación requerida continúe funcionando. El PDF incluye el detalle una sola vez, permite su continuación entre páginas y mantiene la firma vectorial y el texto referencial del negocio.

## Evidencia y estado de validación

Las suites tienen alcances diferentes y no deben sumarse como cobertura única. La evidencia se registra en los artefactos de esta carpeta y debe vincularse al commit o paquete final de 2.3.0. Los resultados y capturas contienen datos sintéticos y se entregan fuera del repositorio. Los scripts de las pruebas forman parte de las fuentes para poder repetirlas.

| Comprobación de 2.3.0 | Estado durante la preparación de esta guía | Evidencia o alcance |
|---|---|---|
| Unitarias web | 53 pruebas aprobadas | `tests/artifacts/unit-results.json`, incluidas siete pruebas de detalle, compatibilidad y límite Unicode, y una regresión de borrador sin servicios |
| Backend y operaciones Python | 94 pruebas y 123 subtests aprobados | `tests/artifacts/python-tests.xml` |
| Backend y respaldos .NET | 123 aserciones aprobadas | `tests/artifacts/dotnet-backend.txt` |
| Regresión PDF | 14 documentos y 38 páginas comprobados | `tests/artifacts/pdf-results.json`, `pdf-layout.json` y el caso de servicio a medida. Incluye 600 unidades, múltiples líneas, marcador final y fallback histórico |
| Build web de producción | Aprobado | Compilación local del código de esta copia |
| Integración HTTP | 856 comprobaciones aprobadas | Tres backends con perfiles sintéticos estándar y Google. Resultado en `tests/artifacts/integration-results.json` |
| End-to-end de los perfiles estándar y Google sintético | 24 comprobaciones aprobadas por perfil | Navegador real sobre los servicios de prueba. `tests/artifacts/browser/results.json` y `browser-google/results.json` |
| Smoke y navegador del build de producción | Cinco rutas y 11 comprobaciones de navegador aprobadas | Build final con TLS efímero local, CSP, PDF y diseño móvil. 80 solicitudes a concurrencia 8, p95 73,09 ms, umbral previo de 2000 ms |
| Revisión de las seis observaciones de UX | 12 comprobaciones de inicio/catálogo y 14 del cotizador aprobadas | 24 fotografías con modal, seis familias de fichas, búsqueda y limpieza, menú móvil, estado de los pasos, borrador sin servicios y foco de campos inválidos |
| Imágenes Docker 2.3.0 | Reconstrucción pendiente | El motor Linux no estaba disponible en esta sesión. La aceptación de las tres imágenes de 2.2.1 pertenece a aquella entrega. El build de producción y los tres servicios nativos de 2.3.0 se comprobaron localmente |

El detalle de 600 unidades se comprobó íntegro en la extracción del PDF, incluso entre páginas, y sin duplicación. Las pruebas conservan los casos financieros y la validación del contrato. También se renderizaron e inspeccionaron las dos páginas de `detail_maximum.pdf` y la muestra `test_project.pdf`: el contenido, el resumen económico y los pies de marca se leen sin solapamientos. La comprobación de caracteres y firma se complementa así con inspección visual.

## Revisión local y límites

La web de esta revisión usa `http://127.0.0.1:3370`, la API .NET el puerto 8370, RUC Python el 8371 y la identidad local el 9370. El acceso de desarrollo se completa desde Accede con **Desarrollo local**, correo **local@example.test**, sin contraseña. El RUC `20999999990` es una demostración ficticia y no representa una consulta real de SUNAT o Decolecta.

[REVISION-MANUAL-2.3.md](REVISION-MANUAL-2.3.md) contiene los recorridos para el propietario. Abre [INICIAR-EN-VISUAL-STUDIO.slnx](../INICIAR-EN-VISUAL-STUDIO.slnx) y selecciona `EA.Cotiza.Local` para revisar o ejecutar el proyecto. La configuración privada, las bases, los logs y las dependencias instaladas permanecen fuera del paquete de fuentes.

El inicio de sesión con Google real, Decolecta con credencial vigente, el alojamiento Railway con HTTPS y controles efectivos del máximo de US$30 mensuales, las copias fuera del volumen y su recuperación, y la confirmación de información comercial y condiciones legales conservan sus aceptaciones externas pendientes. Esta entrega documenta comprobaciones locales y no constituye una certificación externa ni una garantía de ausencia de vulnerabilidades. La publicación y las pruebas remotas sobre el commit final se realizarán después de la aprobación del propietario. No se añadieron dependencias; los cambios de los archivos de bloqueo npm corresponden al número de versión del proyecto. Los resultados antiguos de mutación y capacidad corresponden a sus suites y versiones originales, sin sumarse a estas pruebas de interfaz.

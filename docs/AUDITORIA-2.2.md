# Acta de validación local de E&A Cotiza 2.2.0

Revisión del 18 y 19 de noviembre de 2026 sobre la copia independiente `CotizaSweet_v2.2.0`, rama local `upgrade/auditoria-marca-2.2`, derivada de `f574d0deffa92272b502a43032f161b0658679b8`. El documento de referencia es `Informe-CotizaSweet-2026-11-13.pdf`, de ocho páginas. Los resultados siguientes corresponden a ejecuciones sobre esta copia y sus datos sintéticos.

La publicación de 2.2.0 en GitHub y la continuación del despliegue quedan pendientes de la aprobación expresa del propietario. La aplicación local de revisión utiliza los puertos 3350, 8350, 8351 y 9350. La guía de acceso está en [REVISION-MANUAL-2.2.md](REVISION-MANUAL-2.2.md).

## Las siete mejoras del informe

| Punto y referencia | Implementación y evidencia | Estado |
|---|---|---|
| Consulta RUC protegida, página 3 | La web exige la cabecera del cliente y comprueba origen y Fetch Metadata. Python reserva atómicamente cada intento externo en SQLite, con un máximo predeterminado de 500 por día de Perú. Caché y agrupación de consultas evitan reservas adicionales. Se verifican concurrencia, cambio de día, rechazo al agotar cuota y persistencia tras reinicio Docker. | Cerrado en código y QA local |
| CSP y HSTS, página 3 | Nonce aleatorio por respuesta, scripts con `strict-dynamic`, bloqueo de objetos y marcos y HSTS de 63.072.000 segundos en producción HTTPS. Zod usa validación sin JIT para evitar sondeos de `eval`. El navegador del bundle de producción aprueba formulario y PDF con cero infracciones CSP. | Cerrado en código y QA local |
| Permisos OIDC cuando falta `scope`, página 3 | La transacción conserva los scopes solicitados y aplica el fallback de RFC 6749 §5.1. Un alcance explícitamente vacío conserva cero permisos. El backend Next comprueba los permisos del JWT firmado cuando utiliza ese fallback. Los perfiles estándar y Google tienen recorridos y comprobaciones propios. | Cerrado en código y QA local |
| Historial tolerante por registro, páginas 3 a 5 | Cada fila se interpreta por separado. JSON defectuoso, payload excesivo y versión antigua conservan el resto del historial. Una propuesta incompatible muestra «Versión anterior» y carece de acción Abrir. Se prueba en API, dominio y navegador. | Cerrado en código y QA local |
| Paginación del historial, página 4 | Los tres motores usan páginas de 20, un cursor canónico y orden estable por fecha e ID, con el propietario como filtro independiente. Pruebas con 45 filas, fechas empatadas, inserción nueva y tres páginas comprueban continuidad y separación de cuentas. | Cerrado en código y QA local |
| Respaldo automático .NET, página 4 | Al iniciar y cada hora comprueba un intervalo mínimo de 24 horas. Genera snapshot consistente, integridad SQLite y metadato SHA-256. Revalida el hash al reconocer copias, conserva siete copias completas válidas y excluye archivos ajenos. Python verifica y restaura un snapshot .NET de cuatro cotizaciones. | Cerrado en código y QA local |
| Scripts y herramientas, página 4 | HTTPX2 en QA, PowerShell en UTF-8 con BOM, preparador con `-InstallBrowsers` y ejecutor de pruebas de backend. La solución de inicio incluye la API para compilar sus dependencias. La captura de Docker declara UTF-8 y tolera bytes inválidos conservando los fallos de proceso. | Cerrado en código y QA local |

La tolerancia del historial se verifica sobre el payload y los valores comerciales del registro. Los escritores de las versiones 2.1 y 2.2 generan IDs y fechas canónicos. Una alteración de esos metadatos de ordenación requiere revisar o recuperar la base con los procedimientos operativos.

## Resultados ejecutados

Los recuentos se presentan por suite. Las pruebas comparten recorridos y datos de prueba, por lo que su suma no representa cobertura única.

| Comprobación | Resultado y alcance |
|---|---|
| Compilación | TypeScript y bundle Next.js de producción aprobados. Aplicación .NET, lanzador y sondas de pruebas compilados en Release. Solución de inicio compilada en Debug con cero errores y cero advertencias. |
| Unitarias y seguridad TypeScript | 42 pruebas en siete suites aprobadas. Dominio, catálogo, servicios, límites HTTP, sesiones, historial y cursores. |
| Python | 91 pruebas y 51 subpruebas aprobadas el 19 de noviembre. Incluyen las dos regresiones añadidas para la salida de Docker. Catálogo tiene además su ejecutor independiente de dos pruebas aprobado. |
| Comprobaciones .NET | 96 aserciones aprobadas de entrada, Google, historial y respaldo. |
| Integración HTTP | 852 aserciones aprobadas. Seis combinaciones de perfil de identidad y backend, con servicios en procesos reales, emisor OIDC efímero y proveedor RUC de demostración. |
| End-to-end | 22 comprobaciones aprobadas por perfil de identidad en Microsoft Edge/Chromium sobre la integración .NET. Formulario, precio explícito, moneda, PDF, acceso, guardado, historial antiguo, cargar más, reapertura, móvil y reintento RUC. |
| Bundle de producción | Once comprobaciones de navegador aprobadas a través de un proxy TLS local efímero. Formulario hidratado, PDF.js, descarga, móvil, HSTS y cero errores e infracciones CSP. El navegador de QA acepta el certificado local de ensayo. |
| Cálculos y regresión | 1.565 casos comparados entre TypeScript, Python y .NET, más 33 entradas inválidas por motor. Importes en céntimos enteros, PEN y USD, IGV, movilidad, anticipo y saldo. |
| Mutación | Nueve mutaciones dirigidas de cálculo y validación Python detectadas. El alcance cubre esas nueve modificaciones seleccionadas. |
| Datos y concurrencia | 64 escrituras con ocho trabajadores, 64 registros durables, comprobación de integridad y equivalencia al restaurar. p95 local de escritura de 292,58 ms en esa ejecución. |
| Performance HTTP | 80 solicitudes públicas, concurrencia ocho. p50 de 38,88 ms y p95 de 79,77 ms, con lote de 0,479 s. Umbrales previos de p95 inferior a 2.000 ms y lote inferior a 30 s aprobados. |
| PDF | Doce PDF y 35 páginas con texto, importes, casos largos y cero textos fuera de página. Firma E&A Cotiza vectorial en el pie. |
| Marca adaptable | Nueve vistas en 1440, 768 y 390 px. SVG y DM Sans cargados, tamaños mínimos y ausencia de desbordamiento comprobados. La corrección de etiquetas iniciales de selectores tiene su verificación dirigida. |
| Docker | El propietario ejecutó la construcción y smoke local el 18 de noviembre y los repitió sobre las fuentes finales el 19 de noviembre. El informe guardado aprueba tres servicios y tres volúmenes. UID de aplicación web 1000, API 1654 y RUC 10001, cuotas web/RUC persistentes, reinicio de API y respaldo automático. |
| Dependencias | Auditorías npm, Python y feed oficial NuGet aprobadas en los informes conservados. Se actualizó `opentelemetry-api` de 1.45.1 a 1.45.2 al detectar CVE-2026-126360. La restauración local .NET utilizó el feed preparado y la auditoría complementaria consultó el servicio oficial de vulnerabilidades. |
| Infraestructura | Tipos y grafo offline del SDK Railway aprobados con tres servicios, tres volúmenes y una réplica por servicio. |

Las mediciones de rendimiento corresponden al equipo local y a datos sintéticos. Los perfiles Google de las pruebas usan claims compatibles de un emisor de ensayo. La aceptación con Google, Decolecta y Railway reales tiene los criterios siguientes.

## Pendientes técnicos y de producción del informe

| Punto de la página 7 | Estado actual | Evidencia para cerrarlo |
|---|---|---|
| Repetir integración y navegador con paginación y copias | Cerrado localmente | Informe HTTP de 852 aserciones, dos recorridos de navegador de 22 comprobaciones y restauración entre .NET y Python. |
| Probar imágenes en GitHub Actions | Construcción y smoke Docker aprobados localmente. Ejecución remota pendiente de aprobación para publicar. | Tres workflows aprobados sobre el commit definitivo después de la autorización del propietario. |
| Copia externa de respaldos | Procedimientos preparados. Configuración externa pendiente. | Activar y registrar destino, frecuencia, retención y cifrado fuera del volumen activo, recuperar una copia en un entorno de ensayo y verificar integridad e historial. |
| Git e integridad | Rama local de la actualización y manifiesto de entrega. Publicación pendiente de aprobación. | Commit local y `SHA256SUMS.txt` del paquete. El recibo de entrega identifica el commit y el hash del ZIP. |
| Identidad real | Google elegido, perfil implementado y guía preparada. Registro y aceptación reales pendientes. | Cliente OAuth web, callback exacto y recorridos de guardar, reabrir, dos cuentas y cerrar sesión con Google. [GOOGLE.md](GOOGLE.md) |
| Decolecta | Aceptación real pendiente de credencial nueva. Copia manual configurada en demostración. | Confirmar revocación de la credencial anterior y probar en privado una consulta real con el token nuevo y un límite diario elegido. |
| Railway, HTTPS e IP | Definición preparada. Configuración y aceptación en la cuenta pendientes. | Plan y presupuesto efectivos dentro del máximo de US$30, origen HTTPS, red privada, proxy que reemplace la cabecera IP, cookies seguras y persistencia tras despliegue. [RAILWAY.md](RAILWAY.md) |
| Datos reales del negocio | Pendientes de confirmación del responsable. | Identidad legal, RUC, contactos, catálogo, precios, disponibilidad, condiciones y derechos de imágenes aprobados. Dulce Atelier conserva su indicación referencial. |
| Privacidad y términos | Documento de trabajo y datos del responsable pendientes. | Completar el aviso y las condiciones con la identidad, finalidades, conservación, encargados, transferencias y canal de derechos que correspondan al servicio. Revisión y aprobación del responsable antes de publicarlos. |

## Decisiones de esta entrega

La nueva copia tiene sus propias bases, sesiones y puertos. La marca E&A Cotiza identifica la plataforma y la identidad comercial de la muestra continúa declarada como referencial. El perfil Google concede a cada identidad verificada acceso a sus propias propuestas, mediante el sujeto estable de la cuenta. La cuota RUC incorpora un tercer volumen persistente al despliegue preparado.

La ficha privada `.local/ACCESO_LOCAL_PRIVADO.html` reúne el acceso automático de desarrollo y los datos ficticios. Los comandos de reconstrucción, pruebas, respaldo, restauración y despliegue están en README y en los documentos enlazados. El ZIP de código se reconstruye instalando los runtimes y dependencias fijadas. La carpeta de este ordenador ya tiene sus rutas locales preparadas.

El resultado de aceptación de esta entrega es **validación técnica local aprobada y revisión manual del propietario pendiente**. La aceptación de producción depende de las verificaciones externas identificadas en la tabla.

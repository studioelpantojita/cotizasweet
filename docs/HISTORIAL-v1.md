# Registro histórico de la copia anterior

Este documento conserva afirmaciones de octubre de 2026. No describe la configuración, credenciales, puertos ni resultados de esta versión 2.0.0. Consulta README.md y VALIDACION-V2.md para el estado actual.

# E&A Cotiza · aplicación integrada

## Servicios a medida y recojo — 14/10/2026

En **02 Servicios de la propuesta**, la cartera muestra las 17 referencias visuales existentes (8 tortas/postres, 4 macarons y 5 chocolates). Cada producto puede incorporarse como servicio a medida indicando contenido, presentación y alcance (80 caracteres por campo), unidad de venta, cantidad entera de 1 a 999 y precio explícito sin IGV. No se asignan precios ficticios a las fotografías. El detalle combinado permanece editable hasta 300 caracteres.

El campo opcional `portfolioId` conserva la referencia visual en el borrador y en el historial de Next.js, .NET y Python. Las cotizaciones anteriores siguen siendo compatibles. Cantidad y precio se alinean en dos columnas; el importe tiene su propia fila. Añadir servicios ya no ejecuta un desplazamiento a la cabecera.

La ficha de insumos se presenta como requerimiento adicional opcional, plegado inicialmente. Sus selecciones se conservan al plegarla. Las condiciones propias de proyectos alimentarios siguen vigentes.

El punto fijo de recojo es **Tiendita “LosPantojados” · Santiago de Surco**, confirmado por el propietario. Se configura en `web/lib/pickup-location.ts`; no se ha inventado una dirección de calle. La dirección es de solo lectura, la movilidad es cero y no se solicitan provincia/distrito para el recojo. Al alternar con entrega, se conserva la dirección de entrega durante la edición.

Pruebas: `npm run test:services` y `npm run test:services:pdf`. El segundo comando genera un documento de ejemplo local con datos de prueba. El PDF incluye contenido, presentación, alcance, cantidades, importes y referencia de recojo.


Versión corregida del paquete recibido. La aplicación local integra **TypeScript + Next.js 16 + ASP.NET Core .NET 10 + Python 3.12**. El archivo original ZIP se conserva sin cambios.

## Recorrido por ocasiones y pasarela — 14/10/2026

El Home utiliza una sola llamada a la acción: **Cotizar mi proyecto**. Tiene dos accesos principales (cabecera y cierre de la colección seleccionada) y un enlace discreto en el pie. Las fichas ampliadas conservan el mismo término y la ocasión elegida. Se retiraron las llamadas repetidas del hero, enfoque, adicionales y plan.

La sección «El placer de elegir» es una pasarela horizontal de las 17 fotografías, con filtros de tortas/postres, macarons y chocolates, flechas, desplazamiento táctil y navegación por teclado. No incorpora fichas de insumos ni precios comerciales a partir de las fotos.

«Cada ocasión tiene su propia colección» presenta cuatro familias y filtra los tipos de proyecto. Cada uno de los 12 objetivos muestra una imagen, descripción, detalles por coordinar, servicios existentes y tres referencias visuales. «Proyecto a medida» encabeza su familia; se conservan fitness, alergias y Baby Showers VIP. El objetivo existente `bancos` se presenta como «Entidades y bancos» sin modificar los identificadores de contratos históricos.

Las selecciones viajan a `/cotizar?proyecto=<id>`. Se corrigió la inicialización del cotizador para consumir estos parámetros una sola vez: la repetición de efectos de React en desarrollo ya no restaura el objetivo anterior. El borrador se conserva al recargar.

Componentes: `product-runway.tsx` y `occasion-collection.tsx`. Contenido editorial: `web/lib/project-presentations.ts`. Estilos adicionales: `web/app/sweet-collections.css`. Ejecuta `npm run test:presentations` para verificar cobertura de proyectos, referencias a servicios e imágenes y enlaces al cotizador.

## Home y catálogo CotizaSweet — 14/10/2026

Presentación pública renovada: portada editorial, selección visual, enfoque de trabajo, cuatro colecciones por ocasión, packs, adicionales, fichas de insumos, plan piloto y preguntas frecuentes. Navegación y pie de página compartidos con identidad CotizaSweet por E&A Consultores. Se conservan los servicios y los 12 objetivos de proyecto del cotizador.

Se incorporaron las 17 fotografías facilitadas en `Pictures/sweet`, copiadas sin alterar sus originales a `web/public/images/sweet-*`. Las cuatro capturas de sitios se usaron únicamente como guía de composición. El catálogo presenta 8 tortas y postres, 4 estuches de macarons y 5 referencias de chocolate, con búsqueda que ignora tildes, filtros, contador y fichas ampliadas. La selección visual vive en `web/lib/sweet-showcase.ts`; no añade SKU, precios, disponibilidad, certificaciones ni pedidos. Los 3 packs y 3 fichas de insumos conservan el contrato compartido y sus precios; USD sin tarifa definida muestra «Precio por confirmar».

Las fotografías se sirven mediante Next Image, con tamaños adaptativos y carga diferida; la portada se precarga. El cotizador y el generador PDF conservan su funcionamiento. Los estilos públicos están delimitados en `web/app/sweet.css`. El lanzador local tolera salida redirigida de Windows sin interrumpirse por caracteres Unicode.

## Catálogo comercial — 12/10/2026

Módulo de consulta en `/catalogo`, accesible desde el inicio: 3 packs, 3 fichas de insumos, detalle emergente, variantes y precios por moneda. Datos de muestra identificados, confirmación del negocio y persistencia SQLite. Consulta `docs/CATALOGO.md` para estructura, datos, actualización, pruebas y despliegue, y `docs/REVISION-CATALOGO.md` para la revisión multirrol.

Dirección actual en este ordenador: **http://127.0.0.1:3200/**; catálogo en **/catalogo**. La configuración local usa 3200/8200/8201/9200. Antes de iniciar otra instancia con Visual Studio, detén la que ocupe esos puertos.

## Rediseño del formulario y moneda — 12/10/2026

La sección de cliente presenta tipo/documento y nombre/teléfono en dos columnas; correo, proyecto y fecha del evento ocupan el ancho disponible. En pantallas estrechas los campos pasan a una columna. «Persona Natural con RUC» conserva la consulta automática junto con «Empresa»; el DNI se completa manualmente. El teléfono local lleva prefijo +51 y exige 9 dígitos en las nuevas cotizaciones. Nombre: hasta 300 caracteres; correo: 180; proyecto: 120; notas: 1600. Los contactos históricos conservan su contenido al leerlos y descargar su PDF; para crear una nueva versión deben cumplir la validación actual.

«Servicios de la propuesta» incluye Moneda: PEN · Soles o USD · Dólares, con el aviso «Sin conversión automática de moneda». Cambiar la moneda conserva los valores numéricos de productos, presupuesto y cargos; el usuario revisa sus precios en la moneda elegida. La selección viaja en el contrato JSON y se conserva en el historial, la vista previa, el anticipo, el saldo y el PDF. Las propuestas anteriores sin moneda se interpretan como PEN.

Las secciones 04 «Vigencia e impuestos» y 05 «Condiciones y notas» son independientes. El anticipo parte de 50%, es editable entre 0 y 100 enteros y acompaña al IGV. Las condiciones estructuradas de pago se calculan automáticamente; el campo «Alcance, entrega, revisiones y pago» permite añadir el alcance y las coordinaciones. Los PDF usan la plantilla 4 con moneda explícita, proyecto y fecha del evento, resumen económico y condiciones completas.

## Abrir y ejecutar en este ordenador

El entorno ya está preparado. Para iniciar sin seleccionar proyectos, abre `INICIAR-EN-VISUAL-STUDIO.slnx` y pulsa F5. Para explorar toda la solución, abre `EA-Cotiza.slnx` en Visual Studio 2026, busca **EA.Cotiza.Local**, haz clic derecho → **Establecer como proyecto de inicio** y pulsa **F5**. También se incluye el perfil compartido «Integración local completa».

**Dirección en este ordenador: http://127.0.0.1:3200/cotizar.** Desde el 12/10/2026 esta copia usa los puertos 3200 (web), 8200 (.NET), 8201 (Python) y 9200 (identidad), porque siguen abiertas instancias anteriores. Se conservan ambas instalaciones y las cotizaciones. La selección se guarda en `local.settings.json`, campo `ports`; el lanzador adapta también el inicio de sesión. Al apagar el ordenador o detener la aplicación, vuelve a abrir esta solución y pulsa F5. Abrir la dirección en el navegador por sí solo no inicia los servicios.

Visual Studio compila la API .NET; el lanzador arranca cuatro procesos en la interfaz de bucle local. Los puertos predeterminados para una instalación nueva son:

| Puerto | Componente | Función |
|---|---|---|
| 3000 | Next.js / TypeScript | Formulario, sesión, validación, vista previa y PDF |
| 8000 | ASP.NET Core | Validación, cálculo e historial SQLite; enlace al servicio RUC |
| 8001 | FastAPI / Python | Consulta autenticada a Decolecta, validación de identidad y caché |
| 9000 | Emisor OIDC de desarrollo | Cuenta local de pruebas para usar el historial |

Abre la dirección que muestra el lanzador: **http://127.0.0.1:3200/cotizar en este ordenador**, o http://127.0.0.1:3000/cotizar si se usan los puertos predeterminados. «Iniciar sesión» permite guardar con la cuenta local de desarrollo. Los secretos de sesión cambian al reiniciar: vuelve a iniciar sesión; las cotizaciones se conservan en `data/quotes.sqlite`. Todos los usuarios de este emisor local comparten esa cuenta de prueba. El emisor no debe publicarse ni emplearse como autenticación comercial.

Detén la depuración para cerrar los servicios. El lanzador .NET usa un Job Object de Windows para cerrar también los procesos secundarios. Evita iniciar dos instancias sobre los mismos puertos. Los registros se guardan en `logs/`.

## Consulta real por RUC

`.env.ruc.local` guarda la configuración privada de Decolecta / APIs.net.pe. En este ordenador está configurada; el ZIP de distribución la excluye. Para otra instalación, copia `.env.ruc.example` y completa `RUC_API_TOKEN` con el token sin «Bearer».

Selecciona Empresa, o Persona Natural con tipo de documento RUC, e introduce el número. La aplicación comprueba prefijo, longitud y dígito verificador; consulta después el nombre legal en el servidor. El campo nombre queda de solo lectura y se borra al cambiar el documento. Si la consulta falla, muestra el error y permite reintentar. No se inventa una razón social.

Antes de guardar o generar un PDF nuevo, se vuelve a verificar la identidad y se rechaza un nombre alterado. Se usa una caché de cinco minutos y un máximo de 30 consultas nuevas por minuto. El proveedor `demo` se utiliza exclusivamente en pruebas automáticas, marcado como datos ficticios y bloqueado fuera de desarrollo.

Documentación del proveedor: https://decolecta.gitbook.io/docs/servicios/integrations

## Correcciones implementadas

- Nuevas cotizaciones exigen formulario y precios versión 2 en los tres backends. Las versiones históricas se pueden leer y sus PDF se pueden descargar desde el historial.
- RUC independiente del tipo de persona; comprobación del dígito verificador y del nombre contra el proveedor. El token nunca se envía al navegador.
- Normalización de espacios, rechazo de nombres de producto vacíos y validaciones de correo, fechas, vigencia, IGV, movilidad, distrito, insumos y tamaño de solicitud.
- PDF con filas que pueden continuar en otra página, encabezados repetidos, textos completos, numeración y fuentes Unicode. Se evita dejar el encabezado de la tabla aislado.
- Anticipo y saldo visibles; condiciones coherentes con 0%, pago parcial y 100%. Sin referencias a fotografía ni correos «unknown».
- El botón **Ver PDF** dibuja el PDF generado mediante PDF.js, también en navegadores sin visor PDF nativo; incluye paginación y descarga.
- Python usa UTF-8 explícito, `uvloop` se instala solo fuera de Windows y SQLite se cierra correctamente. Las pruebas cierran procesos y archivos antes de limpiar.

La cabecera «Dulce Atelier» sigue marcada como **identidad referencial / datos de muestra**. Debe personalizarse con los datos reales del negocio antes de uso comercial. Los precios también son referenciales.

## Preparar otro ordenador Windows

Instala Node.js 24+, Python 3.12+ y .NET SDK 10; Visual Studio debe admitir proyectos .NET 10. Desde PowerShell, en la raíz:

```powershell
./scripts/setup-local.ps1 -NodePath "C:/Program Files/nodejs/node.exe" -PythonPath "C:/ruta/python.exe"
```

El script instala las dependencias, crea `.venv` y `local.settings.json`, y conserva cualquier token ya configurado. Si la política local no permite ejecutar el script, puede ejecutarse cada orden revisándola en el archivo; no cambia políticas de seguridad.

Alternativa a F5, con el entorno preparado:

```powershell
dotnet run --project launcher/EA.Cotiza.Local.csproj
```

`local.settings.json` contiene rutas de ejecutables, no el token. `Local.Build.props` es una configuración privada de esta máquina para la caché local de NuGet; se excluye del ZIP. Una instalación nueva restaura los paquetes normalmente desde NuGet.

## Repetir pruebas

En `web/`, con Node.js 24 en PATH:

```powershell
npm run typecheck
npm test
npm run build
npm run test:pdf
```

Desde la raíz, usando el Python que tiene las dependencias instaladas:

```powershell
dotnet build EA-Cotiza.slnx -c Release
python tests/integration.py --backend all
python tests/check_pdf.py
```

El último comando requiere `pdfplumber` como herramienta de comprobación; no es una dependencia de la aplicación. Las pruebas HTTP usan puertos 3190, 8190, 8191 y 9190, identidades y RUC de demostración, bases temporales y procesos reales. `NODE_EXEC` y `DOTNET_EXEC` permiten elegir ejecutables si no están en PATH. El comprobador de PDF analiza todos los caracteres y verifica que se conserven las 149 líneas del caso problemático.

Consulta `docs/VERIFICACION.md` para resultados y límites. El despliegue comercial requiere un proveedor OIDC real y HTTPS; no forma parte del arranque local verificado.

## Revisión de proyecto, pagos y PDF

El nombre del proyecto se muestra completo y destacado en el PDF. El formulario incluye anticipo editable (0 a 100%) y saldo calculado. Las condiciones se adaptan a recojo/entrega y a pago total o sin anticipo. El visor permite página completa o ampliación al ancho. Los errores enlazan a los campos y los números incompletos no reemplazan el último borrador válido. En nuevas entregas en locación se exige dirección o referencia. La lectura del historial conserva los datos originales.

Ver `docs/VERIFICACION.md` para las 7 pruebas unitarias, 3 suites HTTP, 9 PDF y 32 páginas de regresión, además de la cotización descargada desde el navegador (6939D77F).

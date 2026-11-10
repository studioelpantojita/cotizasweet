# CotizaSweet 2.1.0

Upgrade publicado en el repositorio público personal [studioelpantojita/cotizasweet](https://github.com/studioelpantojita/cotizasweet), conservado en una copia independiente de la versión 2.0.0. Incluye red privada permitida explícitamente, tres imágenes Docker con preparación segura de volúmenes y proceso final sin privilegios, infraestructura Railway versionada y workflows de compilación y smoke de contenedores Linux.

Consulta [la guía Railway](docs/RAILWAY.md), [el estado del upgrade](docs/UPGRADE-2.1.md) y las [ejecuciones de GitHub Actions](https://github.com/studioelpantojita/cotizasweet/actions). El acta de v2 enlazada más abajo corresponde a la base 2.0.0; las ejecuciones de 2.1.0 se identifican por separado y no acreditan un despliegue público de la aplicación.

Versión independiente del 10 de noviembre de 2026. Integra Next.js/TypeScript, ASP.NET Core .NET 10 y Python 3.12 para preparar cotizaciones de pastelería, consultar el catálogo, generar PDF y conservar un historial privado por cuenta.

Esta entrega parte del código de CotizaSweet_micropp y conserva su copia anterior. No importa su historial, bases, sesiones ni credenciales. No presupone servicios activos ni una consulta RUC real configurada. El análisis, las pruebas y sus límites se registran en el [acta de validación de la versión 2](docs/VALIDACION-V2.md). Es evidencia técnica local; no equivale a una certificación externa ni acredita un despliegue público.

## Cambios de esta versión

- Actualización de dependencias identificadas en la revisión, incluida la migración a Zod 4 y su exportador nativo de contratos JSON Schema. Los archivos de bloqueo forman parte de la entrega.
- Validación estricta y coherente de solicitudes, tamaño, codificación y campos admitidos, con regresión de las reglas financieras en los tres backends.
- Límites de solicitudes para proteger inicio de sesión, consultas RUC y operaciones de cotización; comunicación de HTTP 429 y esperas de reintento.
- Consulta RUC con caché acotada, agrupación de solicitudes simultáneas del mismo documento y límites de concurrencia, tiempo y respuesta externa.
- Conservación del nombre guardado al abrir un presupuesto o borrador RUC. Editar el documento limpia su identidad, y guardar o generar un PDF nuevo mantiene la verificación del servidor.
- Herramientas de respaldo y restauración SQLite, preflight de producción, comprobación de salud y pruebas de seguridad, finanzas, mutación, navegador y rendimiento local.
- Integración continua y propuestas de actualización de dependencias activas en GitHub. Las propuestas no se fusionan automáticamente; cada cambio debe superar las comprobaciones y revisarse.

El detalle está en [mejoras web](docs/MEJORAS-WEB.md), [seguridad de la versión 2](docs/SEGURIDAD-V2.md), [operaciones](docs/OPERACIONES.md) e [integración continua](docs/CI.md). La documentación de la copia anterior se conserva como [historial de la versión 1](docs/HISTORIAL-v1.md); sus puertos, resultados y configuración no describen esta instalación.

## Preparación y ejecución local en Windows

Instala Node.js 24 o posterior, Python 3.12 o posterior y .NET SDK 10. Para utilizar F5, Visual Studio debe admitir .NET 10. Abre PowerShell en la raíz de esta aplicación y ejecuta:

```powershell
.\scripts\setup-local.ps1 -NodePath node -PythonPath python -DotnetPath dotnet
```

El script comprueba los runtimes, crea `.venv`, instala dependencias, restaura .NET con sus archivos de bloqueo y genera `local.settings.json`. Si tienes varios ejecutables instalados, utiliza sus rutas en los parámetros. No es necesario cambiar políticas de seguridad del sistema. La preparación necesita acceso a los registros de dependencias.

Abre `INICIAR-EN-VISUAL-STUDIO.slnx` en Visual Studio, establece **EA.Cotiza.Local** como proyecto de inicio si se solicita y pulsa **F5**. Para explorar todos los componentes puedes abrir `EA-Cotiza.slnx`. Como alternativa, desde PowerShell:

```powershell
dotnet run --project launcher/EA.Cotiza.Local.csproj
```

Mantén la depuración o la terminal en ejecución mientras utilizas la aplicación. Detén con Mayús+F5 o Ctrl+C. El lanzador indica cuándo están listos los servicios y qué dirección abrir. Abrir una URL por sí sola no inicia la aplicación.

| Componente local | Puerto predeterminado de v2 |
|---|---:|
| Interfaz Next.js | 3340 |
| API .NET | 8340 |
| Servicio Python RUC | 8341 |
| Identidad OIDC de desarrollo | 9340 |

Con esos puertos, abre `http://127.0.0.1:3340/`, `/catalogo` o `/cotizar`. Si necesitas otros, pasa `-WebPort`, `-ApiPort`, `-RucPort` e `-IdentityPort` al script de preparación. Este conserva los puertos previamente guardados cuando se vuelve a ejecutar sin parámetros de puertos. No inicies dos procesos de esta copia sobre los mismos puertos. Sus archivos locales quedan en `data/` y `logs/`, excluidos del versionado.

### Probar con DNI y configurar RUC

Puedes revisar el formulario y generar un PDF con **Persona Natural**, documento **DNI** y datos sintéticos sin disponer de un token RUC. Completa los campos obligatorios, añade un servicio y un precio explícito, revisa recojo/entrega, moneda, anticipo y total, y utiliza **Ver PDF** o **Descargar cotización PDF**. No se generan precios para las fotografías de la cartera.

Para guardar el historial, **Iniciar sesión** utiliza una identidad local de desarrollo y una cuenta de prueba compartida. No es una autenticación comercial. Las sesiones son efímeras; las cotizaciones guardadas permanecen en la base local de esta versión. Al reiniciar puede ser necesario iniciar sesión de nuevo.

La consulta real de RUC requiere una **credencial nueva y vigente**, todavía pendiente para esta copia. El script crea `.env.ruc.local` a partir del ejemplo si no existe; completa allí `RUC_PROVIDER` y `RUC_API_TOKEN` en privado, sin el prefijo `Bearer`. Nunca guardes credenciales en Git, informes, capturas o paquetes. Si la credencial de la versión anterior se compartió en un chat o con terceros, revócala o rótala antes de continuar; no la reutilices por defecto.

Empresa y Persona Natural con RUC completan el nombre mediante el servidor. Si falta la credencial o el proveedor falla, se informa el error y no se inventa una razón social. Las respuestas RUC usadas por las pruebas automáticas son ficticias y se identifican como demostración.

## Datos y condiciones del cotizador

Se conservan PEN y USD sin conversión automática, anticipo editable, recojo/entrega y compatibilidad de lectura de presupuestos anteriores. Las condiciones vigentes del código —incluidos impuestos, movilidad y vigencia— no constituyen asesoría fiscal ni confirmación comercial. Revisa los valores con el propietario antes del uso real.

La identidad comercial referencial, contactos, precios de muestra, disponibilidad, condiciones, imágenes y derechos de uso requieren confirmación. Las fotografías de la cartera son referencias para definir servicios a medida; no acreditan stock, certificaciones alimentarias ni tarifas. No se incorporan cobros, facturación electrónica o políticas comerciales nuevas.

El historial muestra las últimas **200 cotizaciones**. Su paginación y la recuperación individual ante una fila histórica corrupta quedan pendientes. Las cotizaciones están en SQLite sin cifrado de aplicación; protege los volúmenes y respaldos. El estado de sesión sí se cifra, con un propósito diferente.

## Repetir las comprobaciones

Los comandos siguientes usan datos sintéticos y procesos temporales. El [acta de v2](docs/VALIDACION-V2.md) identifica las ejecuciones efectivamente realizadas, resultados y límites; la [definición de CI](docs/CI.md) contiene la secuencia completa para un checkout limpio. No se declara aprobada una prueba por el simple hecho de incluir su comando.

Después de preparar la aplicación, instala las herramientas de QA desde la raíz:

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements-qa.txt
.\.venv\Scripts\python.exe -m pip check
```

Desde `web/`:

```powershell
npx --no-install next typegen
npm run typecheck
npm test
npm run build
npm run test:pdf
npm run test:services:pdf
npm audit --audit-level=moderate
```

`npm test` es el agregador de dominio, catálogo, presentaciones, servicios y seguridad HTTP; no se limita a una sola suite. Para comprobar contratos, ejecuta también `npm run contracts` y `npm run catalog:contracts`, y revisa que los archivos generados en `contracts/` no cambien inesperadamente.

Desde la raíz:

```powershell
dotnet build EA-Cotiza.slnx -c Release
dotnet run --project tests/security_backend/DotnetSecurityChecks.csproj -c Release
dotnet build tests/v2/dotnet-probe/FinancialProbe.csproj -c Release
.\.venv\Scripts\python.exe -m pytest tests/security_backend tests/operations tests/dependencies -q
.\.venv\Scripts\python.exe tests/catalog_test.py
.\.venv\Scripts\python.exe tests/check_pdf.py
.\.venv\Scripts\python.exe tests/v2/run_quality.py --node node --dotnet-probe tests/v2/dotnet-probe/bin/Release/net10.0/FinancialProbe.dll
.\.venv\Scripts\python.exe tests/production_smoke.py
.\.venv\Scripts\python.exe -m pip_audit -r api-python/requirements.lock.txt --disable-pip --no-deps
.\.venv\Scripts\python.exe scripts/audit_nuget.py
```

Las auditorías consultan sus fuentes de vulnerabilidades; requieren conectividad y su resultado corresponde a ese momento. En CI, .NET restaura con `--locked-mode` y auditoría de dependencias directas/transitivas que trata advertencias como errores. La sonda financiera comprueba paridad, mutaciones dirigidas y durabilidad según [tests/v2/README.md](tests/v2/README.md); su puntuación de mutación no representa todo el repositorio.

Para el recorrido de navegador instala Chromium desde `web/`:

```powershell
npx --no-install playwright install chromium
```

Después, desde la raíz:

```powershell
$env:RUN_BROWSER_E2E='1'
.\.venv\Scripts\python.exe tests/integration.py --backend all
```

La integración usa puertos y bases de prueba independientes. No depende del token RUC real. El smoke del bundle de producción comprueba rutas públicas y carga local acotada; no acredita autenticación externa ni capacidad del futuro alojamiento.

## Publicación y operación

El código y los workflows están publicados en la cuenta personal. Los resultados verificables se registran en [el estado de 2.1.0](docs/UPGRADE-2.1.md). Railway es el destino elegido para preparar el piloto; falta conectar la cuenta, autorizar el presupuesto y configurar los servicios externos antes del despliegue funcional.

La aplicación necesita servidores para Next.js, .NET y Python, persistencia y autenticación OIDC real. [GitHub Pages publica contenido estático](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages); por ello no ejecuta por sí solo este sistema dinámico. El alojamiento funcional requiere un destino apropiado, como un servidor con contenedores, HTTPS y volúmenes persistentes.

Consulta [despliegue](docs/DESPLIEGUE.md) antes de publicar y [operaciones](docs/OPERACIONES.md) para el preflight y la restauración a una ruta nueva. Los contadores de memoria y la caché RUC se aplican por instancia; varias réplicas requieren un almacén compartido y nuevas pruebas. Los límites globales web pueden agotarse temporalmente y deben complementarse en el proxy. Un respaldo por base no constituye una transacción coordinada entre servicios.

Las tres imágenes y su smoke de arranque/persistencia ya se verificaron en Linux mediante GitHub Actions. TLS público, OIDC comercial, RUC real y la restauración en el alojamiento elegido quedan pendientes de la fase de despliegue.

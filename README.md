# E&A Cotiza 2.3.0

La entrega autorizada para GitHub se prepara en la rama independiente `release/v2.3.0`, sin modificar `main` ni `mejoras/historial-respaldos-seguridad`. El alcance, las comprobaciones reproducibles y los pendientes de alojamiento se explican en [ENTREGA-GITHUB-2.3.0.md](docs/ENTREGA-GITHUB-2.3.0.md).

La actualización vigente de acceso como invitado y promoción navideña está en [NAVIDAD-INVITADOS-2026-11-23.md](docs/NAVIDAD-INVITADOS-2026-11-23.md). El registro es opcional para cotizar y enviar al negocio.

La configuración de cuentas, el aprovisionamiento del administrador y los límites del despliegue se detallan en [CUENTAS-Y-DESPLIEGUE-V230.md](docs/CUENTAS-Y-DESPLIEGUE-V230.md). El acta de las observaciones actuales está en [NUEVAS-OBSERVACIONES-2026-11-22.md](docs/NUEVAS-OBSERVACIONES-2026-11-22.md).

![E&A Cotiza](web/public/brand/eacotiza-horizontal-granate.svg)

Plataforma de cotización de pastelería del proyecto CotizaSweet, con Next.js/TypeScript, ASP.NET Core .NET 10 y Python 3.12. Permite consultar el catálogo, acceder con User y Password, preparar propuestas, guardar su PDF en un historial por cuenta y enviar una copia a la bandeja del administrador. Las mejoras del 22 y 23 de noviembre de 2026 se aplican sobre esta misma v2.3.0, conservando la marca E&A Cotiza y actualizando las reglas del formulario según las observaciones del propietario.

Esta revisión incorpora administrador y clientes, cotización como invitado, registro opcional con promoción navideña, paquetes opcionales en el primer paso, fecha del evento requerida, sabores y precios referenciales definidos por producto y el flujo Guardar y descargar PDF → Enviar Cotización. El correo externo permanece pendiente de configuración; la recepción operativa se realiza en la bandeja de la plataforma. El alcance está en [UPGRADE-2.3.md](docs/UPGRADE-2.3.md), los recorridos en [REVISION-MANUAL-2.3.md](docs/REVISION-MANUAL-2.3.md) y las evidencias finales en [NUEVAS-OBSERVACIONES-2026-11-22.md](docs/NUEVAS-OBSERVACIONES-2026-11-22.md). La copia anterior 2.2.1 conserva sus fuentes y datos y no se migra automáticamente. La publicación en el repositorio personal [studioelpantojita/cotizasweet](https://github.com/studioelpantojita/cotizasweet) requiere la aprobación expresa del propietario. No se crea una versión adicional por cada observación.

## Capacidades de esta versión

- Cotizador con cuatro pasos: Proyecto y cliente, Servicios e insumos, Entrega y condiciones y Revisar propuesta. El primero contiene paquetes opcionales por objetivo y exige la fecha del evento; el segundo contiene únicamente servicios y ficha opcional de insumos. Detalle del Proyecto conserva hasta 600 unidades de texto y su contador aparece debajo a la izquierda.
- Cuentas de administrador y cliente con User y Password para sus áreas privadas, contraseña independiente de Gmail, registro de clientes y cambio de contraseña en `/cuenta`. Los accesos privados de revisión se entregan en `.local/ACCESOS-REVISION.html` y se excluyen del repositorio.
- Personalización con hasta cuatro sabores, presentación requerida y alcance opcional con `Unknown.` cuando está vacío. Precio y unidad se fijan por producto; las tarifas de `contracts/product-pricing.json` son referenciales para pruebas. Los servicios sin referencia quedan con precio 0 pendiente de evaluación, identificado en el total provisional.
- Guardar y descargar PDF crea una copia en el historial y descarga el documento archivado. Enviar Cotización remite esa misma copia a la bandeja administrativa con recibo y sin duplicar el envío. El correo externo queda pendiente de configuración.
- Fotografías de inicio con fichas emergentes, navegación Catálogo / Cómo Funciona / Accede y dos accesos visibles al cotizador en la página principal. La búsqueda del catálogo muestra un único indicador de foco accesible.
- Marca vectorial en cabeceras, pie, catálogo y PDF, tipografía local DM Sans y favicon específico de 16 × 16 px. La identidad referencial del negocio en la cotización sigue identificada como **Dulce Atelier** y datos de muestra.
- Historial con páginas de 20 y cursor estable en los tres backends. Cada fila se valida por separado y los registros de versiones anteriores se identifican para que puedan revisarse conservando las propuestas compatibles.
- Consulta RUC con guardia de origen del navegador, caché, agrupación de solicitudes concurrentes y cuota diaria persistente. El límite predeterminado de 500 reservas de consulta se cuenta por día de Perú y antes de contactar a Decolecta, incluidos los intentos que terminen con error.
- CSP con nonce por respuesta y HSTS, junto con defensas de cookies, origen, permisos, precios e aislamiento del historial. El acceso local vigente usa cuentas con contraseña. El perfil externo Google está documentado en [GOOGLE.md](docs/GOOGLE.md), con configuración y aceptación reales separadas.
- Respaldo automático de la base de cotizaciones .NET con directorio, intervalo y retención configurables. Por defecto comprueba cada hora, crea una copia cada 24 horas y conserva las siete copias completas válidas más recientes.
- Archivos de infraestructura Railway para **tres servicios y tres volúmenes**, incluido el contador persistente de cuota RUC. El despliegue de las fuentes actuales y su configuración de cuentas requieren validación final en el destino.

## Preparar la ejecución local en Windows

Instala Node.js 24 o posterior, Python 3.12 o posterior y .NET SDK 10. Comprueba que los ejecutables elegidos resuelvan a esas versiones. Si existen varios Python instalados, pasa la ruta explícita del ejecutable 3.12 en `-PythonPath`.

Desde la raíz de esta copia ejecuta lo siguiente.

```powershell
.\scripts\setup-local.ps1 -NodePath node -PythonPath python -DotnetPath dotnet -WebPort 3370 -ApiPort 8370 -RucPort 8371 -IdentityPort 9370 -InstallBrowsers
```

El script crea el entorno `.venv`, instala dependencias, restaura la solución con los archivos de bloqueo y genera `local.settings.json`. `-InstallBrowsers` instala Chromium para las pruebas automatizadas. Las rutas y los puertos locales quedan en ese archivo privado.

El comando anterior prepara los puertos de la revisión 2.3.0. Prepara también las cuentas de esta instalación desde la raíz; la herramienta es idempotente y no imprime las contraseñas.

```powershell
Push-Location web
node scripts/run-ts.cjs scripts/provision-accounts.ts
Pop-Location
```

Abre el documento privado `.local/ACCESOS-REVISION.html` para obtener los accesos de administrador y cliente. Consulta [REVISION-MANUAL-2.3.md](docs/REVISION-MANUAL-2.3.md) para recorrer la plataforma y registrar observaciones.

Abre **INICIAR-EN-VISUAL-STUDIO.slnx**, elige **EA.Cotiza.Local** como proyecto de inicio y pulsa F5. La solución incluye el lanzador y la API para que ambos proyectos se compilen. Ante un error de compilación, revisa la salida y recompila la solución completa antes de iniciar una nueva instancia.

También puedes ejecutar el lanzador desde PowerShell.

```powershell
dotnet run --project launcher/EA.Cotiza.Local.csproj
```

| Componente local | Puerto de esta revisión |
|---|---:|
| Interfaz Next.js | 3370 |
| API .NET | 8370 |
| Servicio Python RUC | 8371 |
| Identidad local de desarrollo | 9370 |

El lanzador indica la dirección efectiva de la aplicación y mantiene los servicios activos hasta detenerlo con Mayús+F5 o Ctrl+C. Los parámetros `-WebPort`, `-ApiPort`, `-RucPort` e `-IdentityPort` permiten asignar puertos diferentes al preparar otra copia. El script conserva los puertos previamente guardados si se vuelve a ejecutar con sus valores predeterminados y sin parámetros de puerto.

Para consultar el historial o administrar la plataforma, pulsa **Accede** y completa **User** y **Password**. Para cotizar y enviar como invitado, abre `/cotizar` y elige **Continuar sin registro**. El cliente entra en `/cotizar`; el administrador entra en `/admin`. **Mi cuenta**, en `/cuenta`, permite cambiar la contraseña y cerrar sesión. El emisor sintético de compatibilidad OIDC no inicia sesión automáticamente en este recorrido. Las cuentas y las cotizaciones guardadas permanecen en las bases de esta copia; las sesiones pueden requerir un acceso nuevo al reiniciar. `data/`, `logs/`, `.local/`, `.venv` y la configuración privada se excluyen del control de versiones. No compartas contraseñas ni claves de firma en el chat o junto a las fuentes.

## Revisar una propuesta y configurar RUC

Puedes continuar como invitado o acceder con una cuenta de cliente. Usa datos ficticios. En Proyecto y cliente completa Objetivo del Proyecto, Detalle del Proyecto, Persona Natural con DNI o Empresa con RUC y la fecha obligatoria del evento. Revisa opcionalmente los paquetes en su diálogo; solo Elegir este paquete reemplaza los servicios actuales. En Servicios e insumos personaliza piezas con de uno a cuatro sabores, presentación requerida, alcance opcional y cantidad; precio y unidad provienen del catálogo y el cliente no los edita. Las seis categorías de acceso incluyen combinaciones de tortas, postres, macarons y chocolates. En Entrega y condiciones revisa recojo o locación, movilidad, fechas, IGV, anticipo fijo del 50% y notas. En Revisar propuesta usa Ver PDF y luego Guardar y descargar PDF; después pulsa Enviar Cotización para recibirla en la bandeja del administrador. Los precios son de prueba, los servicios sin referencia quedan pendientes con precio 0 y el correo externo permanece sin configurar. PEN y USD utilizan sus tarifas declaradas sin conversión automática.

La consulta real de RUC necesita una credencial nueva y vigente de Decolecta. Completa `RUC_PROVIDER`, `RUC_API_TOKEN` y `RUC_DAILY_LIMIT` en `.env.ruc.local`, que el preparador crea desde el ejemplo. Introduce el token en privado y con su valor directo, sin prefijo Bearer. Una credencial que haya quedado expuesta debe revocarse y sustituirse en el proveedor.

El servicio conserva el contador en `RUC_QUOTA_PATH`. El lanzador usa `data/ruc-quota.sqlite` y el contenedor monta `/app/data/ruc-quota.sqlite`. La caché evita nuevas reservas durante su vigencia. Los datos de demostración se identifican en pantalla y en el PDF como ficticios.

## Datos y operación

Dulce Atelier, sus contactos, los precios, la disponibilidad, las condiciones y las imágenes siguen siendo referenciales y deben completarse con información confirmada por el responsable. La cuenta del usuario identifica el propietario de cada cotización. El historial puede contener documentos, correo y teléfono que el operador debe incluir en su aviso de privacidad y su política de retención.

El servicio .NET comprueba al iniciar y cada hora si corresponde un respaldo. Las opciones `BACKUP_DIR`, `BACKUP_INTERVAL_HOURS` y `BACKUP_KEEP` permiten elegir destino, intervalo y retención. Sus valores predeterminados crean una copia cada 24 horas y conservan siete copias completas en `backups/` junto a la base del volumen. Cada copia se crea con la API SQLite, se verifica y recibe metadatos de tamaño y SHA-256. Esta retención se expresa en copias y depende de que el servicio esté en ejecución. Un fallo en la operación se registra y se reintenta en la siguiente comprobación.

La copia externa de los respaldos sigue pendiente de configurar en el alojamiento. El operador debe ensayar la restauración a una ruta nueva y documentar periodicidad, retención, permisos y recuperación de los tres volúmenes. Los comandos están en [OPERACIONES.md](docs/OPERACIONES.md).

## Repetir las comprobaciones

Después de preparar el entorno, instala las herramientas de QA y ejecuta la batería de backend, integración y navegador desde la raíz.

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements-qa.txt
.\.venv\Scripts\python.exe -m pip check
.\scripts\test-backend.ps1 -Integration -Browser
```

El script usa las rutas de `local.settings.json` y admite `-PythonPath`, `-NodePath`, `-DotnetPath` y `-BrowserChannel` para elegir ejecutables o navegador. La integración ejecuta perfiles sintéticos `standard` y `google` sobre los tres backends.

Con la revisión local iniciada, los recorridos de inicio/catálogo y de las nuevas observaciones pueden repetirse desde la raíz. El segundo lee los accesos privados de revisión y usa un contexto de navegador independiente; estas pruebas solo conservan un borrador sintético, sin guardar cotizaciones ni enviar correo.

```powershell
$env:E2E_ORIGIN='http://127.0.0.1:3370'
$env:E2E_BROWSER_CHANNEL='msedge'
node tests/home-catalog.e2e.mjs
node tests/improvements.e2e.mjs
```

Las comprobaciones web se ejecutan desde `web/`.

```powershell
npx --no-install next typegen
npm run typecheck
npm test
npm run build
npm run test:pdf
npm run test:services:pdf
npm audit --audit-level=moderate
```

Desde la raíz se verifican además el catálogo, el PDF, la configuración y las dependencias.

```powershell
.\.venv\Scripts\python.exe tests/catalog_test.py
.\.venv\Scripts\python.exe tests/check_pdf.py
.\.venv\Scripts\python.exe tests/production_smoke.py
.\.venv\Scripts\python.exe -m pip_audit -r api-python/requirements.lock.txt --disable-pip --no-deps
.\.venv\Scripts\python.exe scripts/audit_nuget.py
```

Los informes de ejecución, las capturas y los PDF sintéticos permiten revisar los resultados de cada copia o commit. Las auditorías de dependencias consultan las fuentes de avisos vigentes en el momento de ejecutar. Las pruebas financieras, de mutación, concurrencia y durabilidad se describen en [tests/v2/README.md](tests/v2/README.md). La aceptación del acceso real de Google requiere el cliente registrado y las cuentas del propietario según [GOOGLE.md](docs/GOOGLE.md). El acta debe identificar los controles locales ejecutados, los resultados Docker conservados en la evidencia local y las limitaciones pendientes. La CI remota de esta entrega queda pendiente de publicación y ejecución.

## Publicación funcional

Railway es el destino preparado para el piloto. Esta entrega permanece local hasta que el propietario apruebe expresamente su publicación en GitHub y la continuación del despliegue. El presupuesto máximo indicado por el propietario es **US$30 mensuales**. La activación de Hobby, los controles de gasto efectivos, el dominio HTTPS, Google real, RUC real y la restauración en el destino siguen pendientes de completar y verificar.

[RAILWAY.md](docs/RAILWAY.md) describe los tres servicios y tres volúmenes, las variables y la secuencia de publicación. [DESPLIEGUE.md](docs/DESPLIEGUE.md) y [OPERACIONES.md](docs/OPERACIONES.md) reúnen los requisitos de operación y reversión. Antes de aplicar infraestructura, revisa el commit, sus comprobaciones y el plan concreto del entorno.

La revisión local se documenta en [UPGRADE-2.3.md](docs/UPGRADE-2.3.md) y [NUEVAS-OBSERVACIONES-2026-11-22.md](docs/NUEVAS-OBSERVACIONES-2026-11-22.md), con evidencias y límites de las fuentes actuales. Los resultados anteriores de [UPGRADE-2.2.1.md](docs/UPGRADE-2.2.1.md) y [AUDITORIA-2.2.md](docs/AUDITORIA-2.2.md) pertenecen a sus respectivas versiones. Esta copia mantiene v2.3.0, usa el puerto 3370 y entrega los accesos exclusivamente en `.local/ACCESOS-REVISION.html`. La reconstrucción Docker final y las aceptaciones externas deben confirmarse antes de declarar el despliegue operativo.

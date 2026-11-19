# E&A Cotiza 2.2.0

![E&A Cotiza](web/public/brand/eacotiza-horizontal-granate.svg)

Plataforma de cotización de pastelería del proyecto CotizaSweet, con Next.js/TypeScript, ASP.NET Core .NET 10 y Python 3.12. Permite consultar el catálogo, preparar propuestas, generar PDF y conservar un historial por cuenta. Esta versión incorpora la marca E&A Cotiza y los cambios derivados del informe técnico del 13 de noviembre de 2026.

Esta entrega 2.2.0 se prepara y valida localmente. Su publicación en el repositorio personal [studioelpantojita/cotizasweet](https://github.com/studioelpantojita/cotizasweet) queda pendiente de la aprobación expresa del propietario. Las comprobaciones de esta entrega deben vincularse a la copia o commit y a sus artefactos. Los resultados anteriores están documentados en [VALIDACION-V2.md](docs/VALIDACION-V2.md) y [UPGRADE-2.1.md](docs/UPGRADE-2.1.md), como antecedentes de sus respectivas versiones.

## Cambios de 2.2.0

- Marca vectorial en cabeceras, pie, catálogo y PDF, tipografía local DM Sans y favicon específico de 16 × 16 px. La identidad referencial del negocio en la cotización sigue identificada como **Dulce Atelier** y datos de muestra.
- Historial con páginas de 20 y cursor estable en los tres backends. Cada fila se valida por separado y los registros de versiones anteriores se identifican para que puedan revisarse conservando las propuestas compatibles.
- Consulta RUC con guardia de origen del navegador, caché, agrupación de solicitudes concurrentes y cuota diaria persistente. El límite predeterminado de 500 reservas de consulta se cuenta por día de Perú y antes de contactar a Decolecta, incluidos los intentos que terminen con error.
- CSP con nonce por respuesta y HSTS, junto con las defensas de cookies, origen, permisos y aislamiento del historial. El perfil de inicio de sesión Google está documentado en [GOOGLE.md](docs/GOOGLE.md).
- Respaldo automático de la base de cotizaciones .NET cada 24 horas, con comprobación horaria, integridad SQLite y conservación de las siete copias completas más recientes.
- Infraestructura Railway actualizada a **tres servicios y tres volúmenes**, incluido el contador persistente de cuota RUC. La definición selecciona Google como perfil OIDC predeterminado.

## Preparar la ejecución local en Windows

Instala Node.js 24 o posterior, Python 3.12 o posterior y .NET SDK 10. Comprueba que los ejecutables elegidos resuelvan a esas versiones. Si existen varios Python instalados, pasa la ruta explícita del ejecutable 3.12 en `-PythonPath`.

Desde la raíz de esta copia ejecuta lo siguiente.

```powershell
.\scripts\setup-local.ps1 -NodePath node -PythonPath python -DotnetPath dotnet -InstallBrowsers
```

El script crea el entorno `.venv`, instala dependencias, restaura la solución con los archivos de bloqueo y genera `local.settings.json`. `-InstallBrowsers` instala Chromium para las pruebas automatizadas. Las rutas y los puertos locales quedan en ese archivo privado.

Abre **INICIAR-EN-VISUAL-STUDIO.slnx**, elige **EA.Cotiza.Local** como proyecto de inicio y pulsa F5. La solución incluye el lanzador y la API para que ambos proyectos se compilen. Ante un error de compilación, revisa la salida y recompila la solución completa antes de iniciar una nueva instancia.

También puedes ejecutar el lanzador desde PowerShell.

```powershell
dotnet run --project launcher/EA.Cotiza.Local.csproj
```

| Componente local | Puerto predeterminado |
|---|---:|
| Interfaz Next.js | 3340 |
| API .NET | 8340 |
| Servicio Python RUC | 8341 |
| Identidad local de desarrollo | 9340 |

El lanzador indica la dirección efectiva de la aplicación y mantiene los servicios activos hasta detenerlo con Mayús+F5 o Ctrl+C. Los parámetros `-WebPort`, `-ApiPort`, `-RucPort` e `-IdentityPort` permiten asignar puertos diferentes al preparar otra copia. El script conserva los puertos previamente guardados si se vuelve a ejecutar con sus valores predeterminados y sin parámetros de puerto.

El acceso local utiliza un emisor efímero de desarrollo y una cuenta sintética. Las sesiones caducan y al reiniciar puede ser necesario entrar de nuevo. Las cotizaciones guardadas permanecen en la base de esta copia. `data/`, `logs/`, `.venv` y la configuración privada se excluyen del control de versiones.

## Revisar una propuesta y configurar RUC

Para comprobar el cotizador, elige Persona Natural con DNI y usa datos ficticios. Completa los campos obligatorios, añade servicios con precios explícitos, revisa moneda, recojo o locación, movilidad, IGV, anticipo y saldo y genera el PDF. PEN y USD conservan sus importes sin conversión automática.

La consulta real de RUC necesita una credencial nueva y vigente de Decolecta. Completa `RUC_PROVIDER`, `RUC_API_TOKEN` y `RUC_DAILY_LIMIT` en `.env.ruc.local`, que el preparador crea desde el ejemplo. Introduce el token en privado y con su valor directo, sin prefijo Bearer. Una credencial que haya quedado expuesta debe revocarse y sustituirse en el proveedor.

El servicio conserva el contador en `RUC_QUOTA_PATH`. El lanzador usa `data/ruc-quota.sqlite` y el contenedor monta `/app/data/ruc-quota.sqlite`. La caché evita nuevas reservas durante su vigencia. Los datos de demostración se identifican en pantalla y en el PDF como ficticios.

## Datos y operación

Dulce Atelier, sus contactos, los precios, la disponibilidad, las condiciones y las imágenes siguen siendo referenciales y deben completarse con información confirmada por el responsable. La cuenta del usuario identifica el propietario de cada cotización. El historial puede contener documentos, correo y teléfono que el operador debe incluir en su aviso de privacidad y su política de retención.

El servicio .NET comprueba al iniciar y cada hora si corresponde un respaldo. Cuando han pasado al menos 24 horas desde la última copia completa, crea otra con la API SQLite, verifica integridad y genera metadatos de tamaño y SHA-256. Conserva siete copias completas en `backups/` junto a la base del volumen. Esta retención se expresa en copias y depende de que el servicio esté en ejecución.

La copia externa de los respaldos sigue pendiente de configurar en el alojamiento. El operador debe ensayar la restauración a una ruta nueva y documentar periodicidad, retención, permisos y recuperación de los tres volúmenes. Los comandos están en [OPERACIONES.md](docs/OPERACIONES.md).

## Repetir las comprobaciones

Después de preparar el entorno, instala las herramientas de QA y ejecuta la batería de backend, integración y navegador desde la raíz.

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements-qa.txt
.\.venv\Scripts\python.exe -m pip check
.\scripts\test-backend.ps1 -Integration -Browser
```

El script usa las rutas de `local.settings.json` y admite `-PythonPath`, `-NodePath`, `-DotnetPath` y `-BrowserChannel` para elegir ejecutables o navegador. La integración ejecuta perfiles sintéticos `standard` y `google` sobre los tres backends.

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

Los informes de ejecución, las capturas y los PDF sintéticos permiten revisar los resultados de cada copia o commit. Las auditorías de dependencias consultan las fuentes de avisos vigentes en el momento de ejecutar. Las pruebas financieras, de mutación, concurrencia y durabilidad se describen en [tests/v2/README.md](tests/v2/README.md). La aceptación del acceso real de Google requiere el cliente registrado y las cuentas del propietario según [GOOGLE.md](docs/GOOGLE.md). El acta debe identificar los controles locales ejecutados, los resultados Docker conservados en la evidencia local y las limitaciones pendientes. La CI remota de 2.2.0 queda pendiente de publicación y ejecución.

## Publicación funcional

Railway es el destino preparado para el piloto. Esta entrega permanece local hasta que el propietario apruebe expresamente su publicación en GitHub y la continuación del despliegue. El presupuesto máximo indicado por el propietario es **US$30 mensuales**. La activación de Hobby, los controles de gasto efectivos, el dominio HTTPS, Google real, RUC real y la restauración en el destino siguen pendientes de completar y verificar.

[RAILWAY.md](docs/RAILWAY.md) describe los tres servicios y tres volúmenes, las variables y la secuencia de publicación. [DESPLIEGUE.md](docs/DESPLIEGUE.md) y [OPERACIONES.md](docs/OPERACIONES.md) reúnen los requisitos de operación y reversión. Antes de aplicar infraestructura, revisa el commit, sus comprobaciones y el plan concreto del entorno.

La revisión local de esta entrega se documenta en [AUDITORIA-2.2.md](docs/AUDITORIA-2.2.md), con resultados ejecutados, alcance y requisitos externos pendientes. El acceso preparado en este equipo utiliza [REVISION-MANUAL-2.2.md](docs/REVISION-MANUAL-2.2.md).

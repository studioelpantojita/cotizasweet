# Operaciones y comprobaciones previas

Los programas `scripts/backup_sqlite.py` y `scripts/preflight.py` usan únicamente la biblioteca estándar de Python 3.12 o posterior. No seleccionan bases ni leen archivos privados de forma implícita. Ejecútalos desde la raíz del proyecto con el Python de su entorno virtual. Esta guía corresponde a E&A Cotiza **2.2.1** y distingue el respaldo automático .NET de las tareas manuales del operador.

## Respaldo consistente de SQLite

Para cada base usada por la instalación, elige un directorio privado de respaldos y una ruta nueva. El directorio de destino debe existir y ser accesible únicamente al operador. Sustituye las rutas de ejemplo por las de tu instalación:

```powershell
python scripts/backup_sqlite.py backup data/dotnet.sqlite respaldos/dotnet-2026-11-10.sqlite
python scripts/backup_sqlite.py verify respaldos/dotnet-2026-11-10.sqlite
```

El respaldo utiliza la API online `sqlite3.Connection.backup`, que incluye los cambios confirmados que aún estén en el WAL. No copia a mano el archivo principal de una base activa. Crea primero un archivo temporal, comprueba `PRAGMA integrity_check` y publica el destino mediante creación exclusiva, sin sobrescribir. El tiempo límite de copia predeterminado es de 60 segundos; se puede ajustar con `--timeout` (hasta 3600). Un fallo durante copia o comprobación descarta el archivo temporal.

Junto al respaldo se crea `<archivo>.metadata.json`, con fecha UTC, tamaño, SHA-256 y resultado de integridad. No contiene filas, identidades ni rutas de la base de origen. La salida del programa tampoco imprime filas ni secretos. El archivo SQLite sí contiene todos los datos de la base: protege el respaldo con los mismos controles de acceso que el original y, si se transfiere o conserva fuera del equipo, cifrado y una política de retención definida por el operador. En Windows comprueba las ACL del directorio; los modos POSIX no sustituyen sus permisos.

SHA-256 detecta cambios respecto al metadato conservado, pero no es una firma ni demuestra autenticidad si un tercero puede reemplazar ambos archivos. No cambies el respaldo mientras se verifica o restaura. Conserva el archivo SQLite y su metadato juntos.

## Respaldo automático de la API .NET

`QuoteBackupWorker` comprueba el calendario al arrancar y cada hora. Si no hay una copia completa válida, o ha transcurrido el intervalo configurado desde la más reciente, respalda la base seleccionada por `DATABASE_PATH` mediante la API online SQLite. Comprueba `PRAGMA integrity_check`, calcula SHA-256 y publica el archivo junto con su metadato. Usa un bloqueo entre procesos para evitar copias simultáneas y consulta la edad de las copias existentes después de un reinicio.

La versión 2.2.1 incorpora estas opciones del servicio .NET. Son opcionales y se validan durante el arranque.

| Variable | Valor predeterminado | Valores admitidos |
|---|---|---|
| `BACKUP_INTERVAL_HOURS` | `24` | Entero de 0 a 168. `0` desactiva el respaldo automático |
| `BACKUP_KEEP` | `7` | Entero de 1 a 365, aplicado a las copias completas válidas |
| `BACKUP_DIR` | `backups/` junto a la base | Ruta absoluta o relativa, resuelta desde el directorio de trabajo del proceso, sin caracteres de control |

Omitir una opción o dejarla vacía utiliza su valor predeterminado. Los valores numéricos admiten de uno a cuatro dígitos ASCII y espacios exteriores. El intervalo expresa el tiempo mínimo entre copias y la comprobación horaria determina cuándo se ejecuta la siguiente. La API continúa atendiendo peticiones si una operación de respaldo falla, registra únicamente el tipo de error y vuelve a comprobar en el ciclo siguiente. Una configuración inválida impide iniciar el servicio y debe corregirse antes de aceptar tráfico.

Con la configuración predeterminada, las copias quedan en `/app/data/backups` del volumen .NET y se conservan las **siete copias completas válidas más recientes**. Para reconocerlas se exige el patrón de nombre del planificador, metadato, tamaño y coincidencia del SHA-256 calculado sobre el archivo. La retención y la selección del último respaldo utilizan esa comprobación. Los archivos ajenos al patrón del planificador se excluyen de la poda. Revisa el espacio y los avisos del servicio si una copia falla.

En Compose, las tres opciones se transmiten exclusivamente a `api-dotnet`. En Railway se pueden configurar como variables del servicio `api-dotnet`, con los mismos valores predeterminados de la aplicación. Un directorio personalizado debe corresponder al almacenamiento persistente o externo que el operador haya preparado. Al cambiar de directorio, incluye las copias de la ubicación anterior en la política de conservación y recuperación.

Dedica cada directorio de respaldos a una sola base. El reconocimiento y la retención se aplican a las copias válidas del planificador que contiene ese directorio. El lanzador de desarrollo `EA.Cotiza.Local` fija `data/backups` de su propia copia, intervalo de 24 horas y retención de siete copias para mantener separadas las revisiones locales.

El formato de metadatos es compatible con `scripts/backup_sqlite.py verify` y `restore`. La prueba `tests/operations/test_dotnet_backup.py` crea una copia .NET con datos sintéticos y WAL, la verifica y restaura con Python y compara filas e integridad de origen, respaldo y restauración. Consulta el acta de esta versión para el resultado de la ejecución correspondiente.

Estas copias permanecen en el **mismo volumen** que la base. Define y ensaya una copia cifrada fuera de ese volumen para recuperarte de su pérdida. La definición IaC preparada no configura una copia externa ni acredita snapshots administrados de Railway: su activación, frecuencia, retención y restauración real en la cuenta continúan pendientes de comprobar. El respaldo automático .NET no programa respaldos de las otras bases.

## Restauración sin sobrescritura

```powershell
python scripts/backup_sqlite.py restore respaldos/dotnet-2026-11-10.sqlite recuperacion/dotnet-restaurada.sqlite
python scripts/backup_sqlite.py verify recuperacion/dotnet-restaurada.sqlite
```

El directorio `recuperacion` debe existir. La restauración verifica tamaño, SHA-256 e integridad y **solo crea una ruta nueva**, con su metadato. Rechaza un destino existente, un metadato existente o una fuente modificada durante la copia. No cambia la configuración de la aplicación ni reemplaza la base activa.

Para usar una restauración, detén el servicio afectado, conserva su base actual y configura explícitamente `DATABASE_PATH` hacia el archivo restaurado. Reinicia y verifica historial, aislamiento de propietarios y catálogo con una cuenta autorizada. Regresar a la ruta anterior permite revertir esa selección. Las bases de sesiones contienen estado cifrado; restaurarlas requiere el mismo `SESSION_SECRET`, y las sesiones expiradas continúan expiradas. Rotar la clave invalida el estado anterior. No se incluye ninguna base real en esta entrega.

El respaldo es por base. No coordina una transacción entre los tres servicios ni captura cotizaciones que todavía estén solo en el navegador. Define la retención y la frecuencia para las bases que no cubre el trabajador .NET; el script manual no programa tareas automáticamente.

## Cuota RUC y tercer volumen persistente

La configuración de Compose e IaC de 2.2.1 requiere **tres volúmenes**: sesiones web, cotizaciones .NET y datos del servicio Python/RUC. En Python, `RUC_QUOTA_PATH=/app/data/ruc-quota.sqlite` conserva el contador aunque se reinicie el proceso. Debe ser una ruta absoluta dentro de su volumen persistente; conservar únicamente los volúmenes web y .NET perdería esta protección al recrear Python.

`RUC_DAILY_LIMIT` admite un entero entre 1 y 100000 y parte de 500. Cuenta los intentos enviados a Decolecta por día civil de Perú, con UTC−05:00 explícito, reservando cuota antes de la petición porque una respuesta fallida podría ser facturable. Las respuestas de la caché de cinco minutos y las peticiones concurrentes deduplicadas no realizan una nueva reserva. La caché y la deduplicación son locales al proceso; el contador diario es SQLite persistente. Al agotarse devuelve HTTP 429 y `Retry-After` hasta la siguiente medianoche en Perú; si no puede comprobar el contador, rechaza la consulta con HTTP 503.

Incluye el archivo de cuota en la política de respaldo y recuperación, y no lo reviertas a un estado anterior mientras el proveedor pueda seguir contabilizando consultas del día: restaurar un contador antiguo puede permitir intentos adicionales. La cuota limita intentos de la aplicación, no acredita el consumo ni el importe efectivo del proveedor. El modo RUC de demostración solo funciona en desarrollo; la instancia local actual no acredita consultas reales a Decolecta.

## Preflight de configuración de producción

```powershell
python scripts/preflight.py --env-file .env
```

También se puede omitir `--env-file` para validar exclusivamente las variables del proceso. No se lee `.env` por defecto. Si se proporciona un archivo, las variables ya definidas en el proceso tienen precedencia. El lector admite asignaciones simples, comillas y comentarios; no ejecuta comandos, no expande variables y rechaza claves duplicadas o líneas ambiguas.

El programa comprueba origen HTTPS público, emisor OIDC sin HTTP ni destinos locales/de ejemplo, cliente y audiencia presentes y desactivación explícita de HTTP local. Para `OIDC_PROVIDER=google` exige el emisor oficial, client ID web con terminación `.apps.googleusercontent.com`, audiencia idéntica al client ID y exactamente los scopes básicos `openid profile email`. Para `standard` exige que se incluyan `openid`, `quotes:read` y `quotes:write`.

También comprueba claves de sesión e integración con formato y longitud adecuados y diferentes entre sí, Decolecta con token presente, cuota diaria válida, `RUC_QUOTA_PATH` absoluto, backend y URLs internas permitidas. Las opciones de respaldo son opcionales y se comprueban con los rangos del servicio .NET; `BACKUP_DIR` admite rutas relativas y el preflight valida su texto sin acceder al directorio. Si se declaran modos de entorno, deben ser de producción. La cabecera opcional de IP debe estar admitida y ser reemplazada por un proxy confiable. El preflight rechaza la identidad local de pruebas y los proveedores RUC `demo` o `disabled` para la aceptación de producción.

La salida JSON enumera verificaciones sin mostrar valores de configuración. El código de salida es `0` cuando pasan, `1` ante una configuración no apta y `2` ante un error de lectura/formato del archivo. Los programas de respaldo usan `0` para éxito y `1` para fallo.

El preflight es estático y no usa la red. Un resultado satisfactorio no acredita DNS, certificado TLS, disponibilidad ni permisos del proveedor OIDC, legitimidad de credenciales, entrega RUC, identidad comercial, Docker o publicación. La longitud y variedad de una clave no prueban su aleatoriedad: genérala mediante un generador criptográfico. Antes de publicar se requieren las comprobaciones reales del entorno y un ensayo de restauración con datos de prueba.

La entrega 2.2.1 permanece local y su publicación en GitHub requiere aprobación expresa del propietario. Los resultados de 2.2.0 se conservan como antecedentes de aquella versión. Las pruebas de esta actualización y su alcance se registran en su entrega correspondiente. El despliegue real y la aceptación de sus controles operativos tienen sus propias comprobaciones.

## Pruebas reproducibles

```powershell
python -m unittest discover -s tests/operations -v
```

Las pruebas crean exclusivamente bases y configuraciones sintéticas en directorios temporales. Cubren respaldo con un escritor activo y WAL, exclusión de cambios sin confirmar, integridad, restauración a un destino nuevo, rechazo de sobrescritura y corrupción, metadatos sin filas/rutas, ausencia de valores secretos en informes y controles de configuración de producción. No copian ni inspeccionan la base actual del usuario.

La prueba adicional de interoperabilidad .NET/Python usa `pytest` y requiere construir primero el verificador .NET en Release:

```powershell
dotnet build tests/security_backend/DotnetSecurityChecks.csproj -c Release --locked-mode
python -m pytest tests/operations/test_dotnet_backup.py -q
```

El primer comando requiere el SDK .NET 10 y acceso a las dependencias si aún no están restauradas; el segundo usa el entorno de QA con `pytest`. La copia y restauración se realizan únicamente en el directorio temporal de esa prueba.

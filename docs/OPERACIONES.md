# Operaciones y comprobaciones previas

Estos programas usan únicamente la biblioteca estándar de Python 3.12 o posterior. No seleccionan bases ni leen archivos privados de forma implícita. Ejecútalos desde la raíz del proyecto con el Python de su entorno virtual.

## Respaldo consistente de SQLite

Para cada base usada por la instalación, elige un directorio privado de respaldos y una ruta nueva. El directorio de destino debe existir y ser accesible únicamente al operador. Sustituye las rutas de ejemplo por las de tu instalación:

```powershell
python scripts/backup_sqlite.py backup data/dotnet.sqlite respaldos/dotnet-2026-11-10.sqlite
python scripts/backup_sqlite.py verify respaldos/dotnet-2026-11-10.sqlite
```

El respaldo utiliza la API online `sqlite3.Connection.backup`, que incluye los cambios confirmados que aún estén en el WAL. No copia a mano el archivo principal de una base activa. Crea primero un archivo temporal, comprueba `PRAGMA integrity_check` y publica el destino mediante creación exclusiva, sin sobrescribir. El tiempo límite de copia predeterminado es de 60 segundos; se puede ajustar con `--timeout` (hasta 3600). Un fallo durante copia o comprobación descarta el archivo temporal.

Junto al respaldo se crea `<archivo>.metadata.json`, con fecha UTC, tamaño, SHA-256 y resultado de integridad. No contiene filas, identidades ni rutas de la base de origen. La salida del programa tampoco imprime filas ni secretos. El archivo SQLite sí contiene todos los datos de la base: protege el respaldo con los mismos controles de acceso que el original y, si se transfiere o conserva fuera del equipo, cifrado y una política de retención definida por el operador. En Windows comprueba las ACL del directorio; los modos POSIX no sustituyen sus permisos.

SHA-256 detecta cambios respecto al metadato conservado, pero no es una firma ni demuestra autenticidad si un tercero puede reemplazar ambos archivos. No cambies el respaldo mientras se verifica o restaura. Conserva el archivo SQLite y su metadato juntos.

## Restauración sin sobrescritura

```powershell
python scripts/backup_sqlite.py restore respaldos/dotnet-2026-11-10.sqlite recuperacion/dotnet-restaurada.sqlite
python scripts/backup_sqlite.py verify recuperacion/dotnet-restaurada.sqlite
```

El directorio `recuperacion` debe existir. La restauración verifica tamaño, SHA-256 e integridad y **solo crea una ruta nueva**, con su metadato. Rechaza un destino existente, un metadato existente o una fuente modificada durante la copia. No cambia la configuración de la aplicación ni reemplaza la base activa.

Para usar una restauración, detén el servicio afectado, conserva su base actual y configura explícitamente `DATABASE_PATH` hacia el archivo restaurado. Reinicia y verifica historial, aislamiento de propietarios y catálogo con una cuenta autorizada. Regresar a la ruta anterior permite revertir esa selección. Las bases de sesiones contienen estado cifrado; restaurarlas requiere el mismo `SESSION_SECRET`, y las sesiones expiradas continúan expiradas. Rotar la clave invalida el estado anterior. No se incluye ninguna base real en esta entrega.

El respaldo es por base. No coordina una transacción entre los tres servicios ni captura cotizaciones que todavía estén solo en el navegador. Define la retención y la frecuencia de respaldo según tu operación; este script no programa tareas automáticamente.

## Preflight de configuración de producción

```powershell
python scripts/preflight.py --env-file .env
```

También se puede omitir `--env-file` para validar exclusivamente las variables del proceso. No se lee `.env` por defecto. Si se proporciona un archivo, las variables ya definidas en el proceso tienen precedencia. El lector admite asignaciones simples, comillas y comentarios; no ejecuta comandos, no expande variables y rechaza claves duplicadas o líneas ambiguas.

El programa comprueba origen HTTPS público, emisor OIDC sin HTTP ni destinos locales/de ejemplo, cliente y audiencia presentes, scopes `openid`, `quotes:read` y `quotes:write`, desactivación explícita de HTTP local, claves de sesión e integración con formato y longitud adecuados y diferentes entre sí, Decolecta con token presente, backend y URLs internas permitidas. Si se declaran modos de entorno, deben ser de producción. La cabecera opcional de IP debe estar admitida y ser reemplazada por un proxy confiable.

La salida JSON enumera verificaciones sin mostrar valores de configuración. El código de salida es `0` cuando pasan, `1` ante una configuración no apta y `2` ante un error de lectura/formato del archivo. Los programas de respaldo usan `0` para éxito y `1` para fallo.

El preflight es estático y no usa la red. Un resultado satisfactorio no acredita DNS, certificado TLS, disponibilidad ni permisos del proveedor OIDC, legitimidad de credenciales, entrega RUC, identidad comercial, Docker o publicación. La longitud y variedad de una clave no prueban su aleatoriedad: genérala mediante un generador criptográfico. Antes de publicar se requieren las comprobaciones reales del entorno y un ensayo de restauración con datos de prueba.

## Pruebas reproducibles

```powershell
python -m unittest discover -s tests/operations -v
```

Las pruebas crean exclusivamente bases y configuraciones sintéticas en directorios temporales. Cubren respaldo con un escritor activo y WAL, exclusión de cambios sin confirmar, integridad, restauración a un destino nuevo, rechazo de sobrescritura y corrupción, metadatos sin filas/rutas, ausencia de valores secretos en informes y controles de configuración de producción. No copian ni inspeccionan la base actual del usuario.

# Pruebas adicionales de la versión 2

Esta batería complementa las pruebas de TypeScript, los PDF y `tests/integration.py`. Usa datos sintéticos, bases temporales y procesos de cálculo. No lee la configuración privada ni consulta al proveedor RUC. No utiliza puertos TCP.

## Ejecución

Desde la raíz de la aplicación, después de instalar las dependencias Python y web:

```powershell
dotnet build tests/v2/dotnet-probe/FinancialProbe.csproj -c Release
python tests/v2/run_quality.py --node node --dotnet-probe tests/v2/dotnet-probe/bin/Release/net10.0/FinancialProbe.dll
```

Si los ejecutables no están en `PATH`, indica las rutas completas en `--node` y en la variable `DOTNET_EXEC`. En un entorno aislado, `DOTNET_CLI_HOME` puede apuntar a una carpeta temporal escribible. No hay que cambiar las políticas de seguridad de PowerShell.

El informe se escribe en `tests/artifacts/v2-quality.json`. Puede elegirse otra ubicación mediante `--output`. El código de salida es cero únicamente si pasan todos los grupos solicitados. El informe identifica los grupos ejecutados, la fecha UTC, las versiones de Python/SQLite/SO y las huellas SHA-256 de los archivos relevantes. Sin `--node` o `--dotnet-probe` se ejecutan las pruebas Python; los lenguajes omitidos no se declaran verificados.

## Cobertura concreta

| Grupo | Comprobación | Límite de la evidencia |
|---|---|---|
| Unitarias y regresión financiera | 1.565 cotizaciones: cada centavo de 0 a 100, recojo/locación, anticipos 0/1/49/50/51/99/100, 150 casos con semilla fija y un caso con 30 líneas al máximo permitido. Oráculo separado con `Decimal` y redondeo `ROUND_HALF_UP`. | Verifica estas reglas e importes del contrato; no valida precios comerciales del negocio. |
| Validaciones | 33 casos inválidos: versiones, documentos/campos, teléfono, moneda, fechas, vigencia, ubicación, IGV, movilidad, alérgenos, cantidad/precio, referencia visual y tamaño de listas. Lectura histórica y normalización. | Selección de límites relevantes; no equivale a una prueba exhaustiva de cada cadena posible. |
| Paridad | Los mismos 1.565 casos y los mismos 33 rechazos en TypeScript y .NET, comparados con el oráculo independiente. | Los dos ejecutables deben incluirse al invocar el runner. |
| Mutación | Nueve modificaciones reales del código Python se compilan y ejecutan por separado en memoria: redondeo, movilidad, IGV, anticipo, saldo, versión de creación, teléfono, dirección y vigencia. | La puntuación corresponde exclusivamente a esos nueve mutantes dirigidos; no es cobertura de mutación global del repositorio. La fuente entregada no se reemplaza. |
| Integración de componente y seguridad | Ruta FastAPI real, validación real, persistencia SQLite, 64 guardados con ocho trabajadores, separación entre dos propietarios, scopes, intento de inyección en identificador, JSON/tipo/tamaño inválidos y ausencia de escrituras tras rechazos. | La identidad se sustituye solo dentro de la prueba; esta batería no prueba criptografía JWT ni descubrimiento OIDC. Para ello se usa `tests/integration.py`. |
| Datos y recuperación | Reapertura del archivo, IDs únicos, 64 registros persistidos, `PRAGMA quick_check`, modo WAL y equivalencia de registros al recuperar una copia creada con la API de backup de SQLite. | Valida el mecanismo con datos sintéticos; no afirma que exista una política operativa automatizada de respaldos. |
| Rendimiento local | Latencia mediana, p95 y máxima de las 64 escrituras concurrentes. Umbrales definidos en el código antes de ejecutar: p95 menor a 2.500 ms y lote menor a 30 s. | Prueba de componente en la computadora local; no mide red pública, capacidad del alojamiento ni carga comercial sostenida. |

Las pruebas reales de navegador y el circuito OIDC de extremo a extremo se mantienen como comprobaciones separadas. Una ejecución aprobada de esta batería permite emitir un acta técnica con este alcance; la certificación de un tercero o de la infraestructura de producción requiere una evaluación propia.

# Catálogo comercial de CotizaSweet

Entrega del 12 de octubre de 2026 (America/Bogota). Extensión de la aplicación E&A Cotiza Pastelería existente.

## Alcance y uso

La ruta `/catalogo` y la vitrina de inicio muestran el mismo módulo. Hay tres packs (Desayunos Premium, Boxes de Mini Repostería, Combos Sweet) y tres fichas (Chocolates finos, Insumos orgánicos, Producción artesanal). Cada tarjeta abre un diálogo con fotografía, descripción, variantes, unidad de precio, calidad, condiciones y confirmación del negocio. Incluye filtros por servicio, búsqueda sin distinción de tildes y estados de carga, error, reintento y búsqueda vacía.

Este módulo es de consulta. Elegir una variante no crea pedidos, no guarda cotizaciones, no cambia sus importes y no agrega un carrito. Los adicionales anteriores siguen disponibles en el cotizador. El tipo de ocasión —boda, empresa, etc.— sigue orientando la propuesta; el filtro del catálogo corresponde a Packs y cajas / Ficha de insumos.

Los tres precios base existentes se conservaron: 85, 144 y 210 soles sin IGV. Las variantes adicionales y los suplementos de insumos son ejemplos de configuración, sujetos a aprobación comercial. Todos están identificados como referenciales. Las fichas de insumos usan fotografías del producto terminado existente, con leyendas explícitas; no acreditan certificaciones ni características del proveedor.

El catálogo ofrece PEN y USD. Solo muestra un importe si la variante tiene una tarifa explícita en esa moneda. Los datos entregados incluyen tarifas PEN; USD muestra «Precio por confirmar». No se hace conversión de moneda. El acabado artesanal base tiene precio cero y unidad «incluido en el pack»; no implica que el pack completo sea gratuito.

## Estructura

| Archivo o carpeta | Responsabilidad |
|---|---|
| `contracts/catalog.json` | Catálogo de despliegue, precios en centavos, publicación y confirmaciones |
| `contracts/catalog.schema.json` | Esquema JSON estricto compartido |
| `web/lib/commercial-catalog.ts` | Tipos, validación, búsqueda, moneda y vigencia de confirmación |
| `web/components/commercial-catalog.tsx` | Tarjetas, filtros, estados y detalle accesible |
| `web/app/catalog.css` | Diseño adaptable a escritorio y móvil |
| `web/app/catalogo/page.tsx` | Acceso directo al módulo |
| `web/app/api/catalog/route.ts` | Lectura pública mediante BFF y validación de la respuesta |
| `web/server/catalog-store.ts` | Persistencia del modo alternativo Next.js |
| `api-dotnet/CatalogStore.cs` | Validación, importación y lectura SQLite en la integración principal |
| `api-python/catalog_store.py` | Validación/importación y backend Python alternativo |
| `scripts/check-catalog.py` | Revisión de contrato, referencias de imágenes e importación opcional |
| `web/tests/catalog.test.ts`, `tests/catalog_test.py` | Regresiones de reglas y persistencia |
| `tests/integration.py` | Contrato HTTP, autenticación y aislamiento en tres backends |

## Flujo y base de datos

Integración normal: navegador → `GET /api/catalog` Next.js → `GET /api/catalog` .NET → `catalog_snapshot` en la SQLite configurada por `DATABASE_PATH`. Python sigue prestando el servicio RUC autenticado, y proporciona además el validador/importador del catálogo. No se añade una llamada innecesaria a Python para cada tarjeta.

Los modos `API_BACKEND=next` y `python` tienen implementaciones compatibles para instalaciones alternativas. Son modos excluyentes, con bases independientes; no hay sincronización entre ellos. En Compose se utiliza .NET y el proceso Python ejecuta `ruc_service:app`, no el backend alternativo `main:app`.

La migración es aditiva:

```sql
CREATE TABLE IF NOT EXISTS catalog_snapshot (
  id INTEGER PRIMARY KEY CHECK(id=1),
  content_hash TEXT NOT NULL,
  payload TEXT NOT NULL CHECK(json_valid(payload)),
  imported_at TEXT NOT NULL
);
```

Se almacena una instantánea JSON estrictamente validada, con un máximo de 60 productos, 10 variantes por producto y 5 imágenes por producto. El hash identifica su contenido. Una sola sentencia UPSERT reemplaza la instantánea si cambió el hash; una importación inválida se rechaza antes de escribir. Las tablas `quotes` y `secure_state` no se modifican en esta migración.

La instantánea es una decisión para un catálogo pequeño y de solo consulta. No se implementan inventario, movimientos, SKU transaccionales, tarifas por cliente o un panel administrativo. Esas operaciones necesitarían tablas de productos/variantes, auditoría de cambios y reglas de publicación adicionales. Las cotizaciones históricas conservan sus valores propios.

.NET y Python importan el archivo al iniciar el servicio. Next.js en modo alternativo valida el archivo e importa cambios en cada consulta. Por ello la publicación normal es una actualización del archivo validado seguida de un despliegue/reinicio. No editar directamente la instantánea SQLite: el archivo de despliegue es la fuente y puede reemplazarla al reiniciar.

## Editar precios, imágenes y confirmaciones

1. Editar `contracts/catalog.json`, conservando IDs únicos y estables. Mantener `schemaVersion=1`; cambiar `revision` y `updatedAt`.
2. Guardar cada fotografía pública en `web/public/images/`. Se admiten rutas locales `/images/nombre.jpg`, `.png` o `.webp`; no URL externas, SVG ni rutas con subdirectorios.
3. Configurar `variants[].prices.PEN` y/o `USD` como enteros en centavos, no textos ni decimales. Por ejemplo, 8500 representa S/ 85.00. Añadir una tarifa USD requiere decisión comercial expresa.
4. Usar `published=false` para excluir el producto de la API pública.
5. Mantener `confirmation.status=pending` hasta que el negocio revise la composición. Una confirmación requiere `status=confirmed`, `note`, `by`, `date` y `validUntil`, con fechas ISO reales y ordenadas. La UI solo presenta la confirmación vigente dentro de ese intervalo, evaluado por fecha UTC.
6. `note` y `by` son información pública: no incorporar documentos privados ni datos personales de proveedores. Conservar las evidencias privadas fuera del catálogo.
7. Cambiar `referencePrices` a `false` únicamente cuando todas las tarifas publicadas hayan sido aprobadas. La confirmación de insumos no aprueba por sí sola los precios.
8. Validar y desplegar. No existe una operación pública POST/PATCH/DELETE de publicación.

```powershell
# Desde la raíz, después de preparar el entorno:
./.venv/Scripts/python.exe scripts/check-catalog.py

# Solo si se cambió el modelo TypeScript:
cd web
npm run catalog:contracts
cd ..

# Importación explícita opcional para mantenimiento:
./.venv/Scripts/python.exe scripts/check-catalog.py --source contracts/catalog.json --database data/quotes.sqlite
```

Una importación manual no sustituye actualizar el archivo que usa el servicio. Antes de publicar, revisar también las plantillas de precios del cotizador si deben coincidir: este módulo de consulta no sincroniza ni sobrescribe las cotizaciones.

## Arranque local

Requisitos conservados: Node.js 24+, Python 3.12+, .NET SDK 10 y Visual Studio compatible. El Node del PATH puede ser una versión antigua: comprobar `node --version`. Para preparar una copia limpia:

```powershell
./scripts/setup-local.ps1 -NodePath "C:/Program Files/nodejs/node.exe" -PythonPath "C:/ruta/python.exe"
./.venv/Scripts/python.exe scripts/check-catalog.py
dotnet build EA-Cotiza.slnx -c Release
dotnet run --project launcher/EA.Cotiza.Local.csproj -c Release
```

También se puede abrir `INICIAR-EN-VISUAL-STUDIO.slnx` y pulsar F5. El catálogo no requiere iniciar sesión ni credencial RUC; guardar cotizaciones sí requiere sesión y la consulta RUC requiere su proveedor.

En el ordenador de esta revisión la versión actualizada está en **http://127.0.0.1:3200/catalogo**, con servicios 8200 (.NET), 8201 (Python RUC) y 9200 (identidad). Los puertos están en el archivo local `local.settings.json`, excluido de la distribución. Una instalación nueva usa 3000/8000/8001/9000.

La instancia anterior en 3100 mantiene bloqueados sus binarios Debug; no fue posible detenerla desde el entorno de ejecución. Para recompilar Debug en esa misma carpeta, detener su depuración en Visual Studio. La versión Release actualizada fue compilada y ejecutada en 3200. Cada puerto nuevo usa su propio directorio `.next-local-<puerto>`. El emisor local usa una cuenta de prueba y no debe publicarse. Puede ser necesario iniciar sesión nuevamente después del arranque.

## Despliegue comercial

1. Preparar un entorno de pruebas con proveedor OIDC real, HTTPS, identidad del negocio, fotos y tarifas aprobadas. No utilizar el emisor OIDC local.
2. Configurar `.env` desde `.env.example`, con `APP_ORIGIN=https://su-dominio`, emisor OIDC exacto y callback `https://su-dominio/auth/callback`. Generar secretos propios de sesión e integración. El token RUC se entrega exclusivamente a Python; el secreto del cliente OIDC y de sesión se entregan exclusivamente a Next.js.
3. Ejecutar las pruebas indicadas abajo y `docker compose --env-file .env config --quiet`. Evitar imprimir la configuración resuelta con secretos.
4. Detener escrituras y hacer una copia coherente de SQLite; alternativamente usar su API de backup. No copiar solamente el archivo principal con WAL activo.
5. Ejecutar `docker compose --env-file .env up --build -d`. Los archivos del catálogo y el esquema se incluyen en las imágenes. La API .NET importa la revisión al iniciar.
6. El proxy HTTPS debe apuntar al puerto web local 3000. Las API internas no publican puertos en el host. Configurar límites de solicitudes, cabeceras HTTPS/HSTS adecuadas al dominio, registros sin tokens y alertas de errores.
7. Verificar `/catalogo`, `/api/catalog`, imágenes, autenticación, una cotización de prueba y restauración del respaldo. Confirmar que `/api/quotes` sin sesión devuelve 401 y que el catálogo no permite escritura.
8. Para revertir, restaurar el artefacto previo del catálogo y su aplicación, y reiniciar. La tabla nueva puede conservarse sin afectar al código anterior. Restaurar la base completa solo si es necesario: hacerlo sin una ventana controlada podría perder cotizaciones posteriores al respaldo.

Contenedores no ejecutados en esta revisión: Docker no tenía un daemon disponible. La sintaxis Compose sí se validó con el archivo de ejemplo. La compilación de producción de Next.js y la ejecución local de .NET/Python sí se verificaron. No se realizó despliegue público, ensayo de carga, escaneo CVE en línea ni prueba de restauración en infraestructura productiva.

## Verificaciones

```powershell
cd web
npm run build
npm run typecheck
npm test
npm run test:catalog
cd ..
./.venv/Scripts/python.exe tests/catalog_test.py
dotnet build EA-Cotiza.slnx -c Release
./.venv/Scripts/python.exe tests/integration.py --backend all
```

En instalaciones nuevas ejecutar primero build para generar los tipos de Next.js. Si Node 24 no es el ejecutable predeterminado, configurar PATH o `NODE_EXEC` antes de la suite HTTP.

Resultado comprobado: 6 pruebas de catálogo TypeScript; 9 pruebas de dominio, moneda y sesiones existentes; 2 pruebas Python con casos de importación válida/inválida, idempotencia y conservación de cotizaciones; 3 suites HTTP completas (Next.js, Python y .NET). Interacciones de navegador: packs/insumos, búsqueda sin tildes y sin resultados, precio según variante, USD sin tarifa, precio cero con unidad, cierre, foco, condiciones y pantallas 1365×900 / 390×844 sin desborde horizontal observado.

El generador PDF no fue modificado y no se repitió su batería visual en esta entrega. La suite HTTP sí comprobó las validaciones que preceden a la generación y la persistencia de moneda.

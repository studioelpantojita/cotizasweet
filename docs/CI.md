# Integración continua de E&A Cotiza 2.2.0

Revisión del 19 de noviembre de 2026. Los workflows de esta copia están preparados para un checkout limpio. La publicación de 2.2.0 en GitHub queda pendiente de la aprobación expresa del propietario y su CI remota se validará sobre el commit que se publique. [UPGRADE-2.1.md](UPGRADE-2.1.md) conserva los resultados históricos de 2.1.0.

`.github/workflows/ci.yml` se activa en propuestas de cambio, cambios en `main` o `master` y ejecución manual. El job `quality-windows` usa Windows 2025, Node.js 24, Python 3.12, .NET SDK 10 y Chromium de Playwright. Instala JavaScript con `npm ci`, Python desde sus versiones fijadas y .NET con archivos de bloqueo. Los pasos comprueban sus códigos de salida y los fallos detienen la aprobación.

| Etapa configurada | Evidencia o condición exigida |
|---|---|
| Dependencias | Compatibilidad de Python, auditoría npm desde moderada, auditoría del lock Python y restauración .NET bloqueada con NuGet Audit directo y transitivo |
| Tipos y contratos | `next typegen`, TypeScript y regeneración de contratos sin diferencias |
| Web | Agregado de siete suites de dominio, catálogo, presentaciones, servicios, seguridad HTTP, URL de servicios e historial |
| Compilación | Bundle de producción Next.js, aplicación y lanzador .NET, verificador de seguridad y sonda financiera en Release |
| PDF | Muestras sintéticas y verificación de texto, importes, firma de marca y límites de página |
| Python | Catálogo, seguridad, entradas, historial, operaciones, restauración .NET/Python y pruebas del auditor NuGet |
| .NET | Aserciones de seguridad, identidad Google, historial y copias automáticas |
| Finanzas y datos | Oráculo, paridad de tres lenguajes, mutaciones dirigidas, concurrencia, durabilidad y recuperación SQLite |
| Integración | Perfiles sintéticos `standard` y `google` contra los tres motores, sesión, permisos, origen e historial aislado |
| Navegador | Formulario, guardado, paginación, PDF y móvil contra .NET para cada perfil de identidad |
| Producción local | Cinco rutas públicas, 80 solicitudes con concurrencia 8 y navegador mediante un proxy TLS local efímero |

La verificación de producción del navegador comprueba nonce, CSP efectiva, HSTS, hidratación, vista previa PDF.js, descarga y adaptación móvil. El certificado es local y efímero y el navegador de QA lo acepta expresamente. La aceptación del dominio y certificado público se realiza en el destino.

Los resultados locales registrados para esta entrega son los siguientes. Se conservan por suite porque sus alcances pueden coincidir.

| Comprobación local | Resultado registrado |
|---|---|
| Agregado TypeScript | 42 pruebas en siete suites |
| Python de seguridad, operación y dependencias | 91 pruebas y 51 subpruebas |
| Verificador .NET | 96 aserciones |
| Integración HTTP | 852 aserciones, seis combinaciones de motor y perfil |
| Navegador integrado | 22 comprobaciones por perfil, Microsoft Edge mediante Playwright |
| Navegador del bundle de producción | 11 comprobaciones, cero excepciones y cero infracciones CSP |
| Finanzas | 1565 casos y 33 casos inválidos de frontera por motor |
| Mutaciones | Nueve mutaciones dirigidas de Python detectadas |
| Concurrencia | 64 escrituras sintéticas y recuperación equivalente |
| PDF | 12 archivos y 35 páginas |
| Docker local | Tres imágenes, tres servicios y tres volúmenes aprobados |

Los resultados proceden de los archivos `tests/artifacts` de la copia revisada y del verificador .NET ejecutado localmente. El entorno local usa Edge y la configuración del workflow instala Chromium. La repetición remota de 2.2.0 queda pendiente de aprobación para publicar.

`python scripts/audit_nuget.py` revisa las versiones resueltas directas y transitivas de `api-dotnet/packages.lock.json` frente al índice oficial de vulnerabilidades NuGet. Verifica TLS, limita los endpoints y tamaños y produce un informe con metadatos de origen y hash. Los rangos o datos relevantes que no admite producen un resultado indeterminado. Esta comprobación complementa NuGet Audit de la restauración del workflow. Las auditorías de dependencias se interpretan con la fecha y fuentes de cada ejecución.

El workflow usa `permissions: contents: read` y checkout sin persistir credenciales Git. Las pruebas generan claves efímeras, identidades, bases y respuestas RUC sintéticas. Tras pasar el job, se publican durante catorce días únicamente los informes, PDF y capturas enumerados expresamente en su lista de artefactos. La configuración privada y el estado de sesión quedan fuera de esa lista. Dependabot prepara propuestas de actualización para acciones, npm, Python y NuGet sujetas a revisión y a la misma batería.

`.github/workflows/containers.yml` construye tres imágenes en Ubuntu 24.04 y ejecuta `tests/container_smoke.py`. El smoke usa red, contenedores y volúmenes temporales con nombres únicos y genera `container-smoke.json`. Conserva un informe saneado incluso si falla. En esta entrega el propietario ejecutó localmente `python tests/container_smoke.py --build` desde PowerShell con acceso a Docker Desktop y el informe registra aprobación de las imágenes, usuarios de aplicación sin privilegios root, cuotas persistentes y respaldo automático.

`.github/workflows/infrastructure.yml` valida tipos del SDK Railway, el grafo offline de **tres servicios y tres volúmenes**, dependencias y sintaxis del entrypoint. Esa prueba offline exige una réplica por servicio. La creación de recursos, facturación y redes se comprueban en el entorno real siguiendo [RAILWAY.md](RAILWAY.md).

Para repetir el recorrido local desde una terminal con acceso al motor Docker, usa el comando siguiente desde la raíz.

```powershell
.\.venv\Scripts\python.exe tests/container_smoke.py --build
```

El modo `--build` construye imágenes con etiquetas únicas y retira los recursos temporales creados por esa prueba al terminar. Las instrucciones de preparación y pruebas de backend están en [README.md](../README.md) y el acceso de revisión en [REVISION-MANUAL-2.2.md](REVISION-MANUAL-2.2.md).

La CI preparada acredita su resultado cuando se ejecute sobre un commit concreto y conserve las evidencias correspondientes. Google real, Decolecta real, proxy público, presupuesto efectivo, copia externa y recuperación operativa mantienen su aceptación pendiente en el alojamiento elegido.

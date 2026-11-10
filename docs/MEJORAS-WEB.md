# Mejoras web de CotizaSweet 2.0.0

## Integridad de entrada HTTP

Guardar y validar comparten `web/server/quote-input.ts`. Se exige el tipo de medio `application/json` exacto (sin aceptar prefijos como `application/jsonp`), se rechaza un charset declarado distinto de UTF-8 y se decodifica UTF-8 con errores fatales. El límite es de 70 000 bytes reales, incluso sin `Content-Length`; un tamaño declarado superior también se rechaza antes de consumirlo. Los errores de validación e inicio de sesión llevan `Cache-Control: no-store`.

## Límites de solicitudes

Los contadores se conservan en SQLite, tabla `request_limits`, con ventana fija de 60 segundos. Se comparten entre procesos que usan la misma base y sobreviven a reinicios. No se guardan direcciones IP en claro: las claves de contador son SHA-256. Las ventanas caducadas se eliminan al consumir otra solicitud.

| Ruta | Tope global por minuto | Tope por dirección confiable |
|---|---:|---:|
| `/auth/login` | 20 | 10 |
| `/api/quotes/validate` | 120 | 30 |
| `/api/clients/ruc/:ruc` | 60 | 20 |

El límite global se aplica siempre. Por defecto no se confía en cabeceras de dirección enviadas por el cliente, por lo que se aplica únicamente ese tope global. Detrás de un proxy bajo control del operador, se puede establecer `TRUSTED_CLIENT_IP_HEADER` a `x-real-ip`, `x-forwarded-for` o `cf-connecting-ip`. El proxy **debe borrar y reemplazar** la cabecera de entrada por la dirección real; en `x-forwarded-for` se usa el primer elemento. El servicio web no debe tener una vía pública que omita ese proxy. Una cabecera ausente o inválida solo recibe el control global.

Los rechazos devuelven HTTP 429, `Retry-After` en segundos y `Cache-Control: no-store`. Los límites son deliberadamente conservadores para una instalación pequeña. Un atacante puede consumir el cupo global y afectar temporalmente a otros usuarios: no es una mitigación completa de denegación de servicio. En producción deben dimensionarse estos valores según tráfico, añadirse límites en el proxy y usarse un almacén compartido si hay varias réplicas con bases separadas.

## Identidad RUC al abrir borradores e historial

Se conserva el nombre ya guardado al abrir un presupuesto o restaurar el borrador. El montaje del formulario ya no borra el nombre ni exige una consulta externa para visualizarlo. Cambiar el documento sigue limpiando nombre e identidad, y «Consultar de nuevo» fuerza la consulta. Guardar, obtener una vista previa y generar un PDF nuevo siguen verificando la identidad en el servidor. El PDF histórico descargado desde el historial mantiene sus datos originales.

## Pruebas focalizadas

Con Node.js 24 y dependencias instaladas, desde `web/`:

```powershell
node scripts/run-ts.cjs tests/http-security.test.ts
```

La suite comprueba medios y codificaciones rechazados, límite real del cuerpo (incluido streaming), persistencia/expiración y separación de contadores, cabeceras de proxy sin confianza implícita, HTTP 429 y presupuestos por dirección configurada. La preservación visual de RUC debe incluirse en la comprobación de navegador del formulario.

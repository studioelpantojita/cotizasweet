# Tarifas referenciales de E&A Cotiza 2.3.0

La configuración inicial sirve para pruebas manuales. No constituye una tarifa comercial aprobada. El PDF y el formulario la identifican como referencial; el negocio deberá confirmar alcance, disponibilidad y precio antes de aceptar un servicio.

`contracts/product-pricing.json` es la fuente única de precios y unidades para nuevas cotizaciones en Next.js, .NET y Python. Cada importe está en centavos enteros, con una entrada independiente por moneda. Mantener un mismo número para PEN y USD no representa una conversión monetaria. Las entradas iniciales reutilizan los importes que ya existían en el catálogo de prueba: 8500, 14400, 21000, 3600, 200 y 1800 centavos. El campo `basis` de las fotografías identifica el importe de referencia usado; no es una tasación de los productos fotografiados.

El administrador puede revisar las tarifas en su sección administrativa. Para actualizar la configuración, el responsable de mantenimiento modifica el archivo JSON, revisa moneda/unidad/importes y reconstruye los tres servicios desde la misma revisión del proyecto. Deben desplegarse juntos. No debe cambiarse una copia aislada del JSON en un contenedor. El proceso de reconstrucción y las pruebas conservan la coherencia; los registros históricos no se recalculan.

Las unidades permitidas son unidad, gramos, kilogramos, litros, box y paquete. La configuración inicial utiliza unidad, box y paquete según el producto; no se han inventado pesos ni volúmenes ausentes en las referencias. Los sabores admitidos son vainilla, chocolate, café, frambuesa, lucuma, naranjo, cherry, crema pastelera, pistacho y almendras. Cada servicio admite entre uno y cuatro sabores sin duplicados, presentación obligatoria y alcance opcional. El alcance vacío se representa como `Unknown.`.

Los precios y las unidades no se pueden editar desde la cuenta cliente. Los tres validadores rechazan alterar una tarifa, unificar referencias incompatibles, manipular el texto para que no coincida con los datos elegidos o declarar un precio libre. Un servicio sin referencia queda como solicitud pendiente de evaluación:importe 0, unidad servicio. Su total es provisional; el 0 no implica gratuidad.

Nuevas cotizaciones: fecha del evento obligatoria, anticipo 50%, Persona Natural con DNI o Empresa con RUC. Los borradores admiten campos pendientes y los documentos históricos conservan su fecha, porcentaje, importe y contenido originales. Reabrir un documento histórico no autoriza enviarlo como una nueva solicitud sin ajustarlo a las reglas vigentes.

Verificación local mínima tras editar la configuración:

1. Desde `web`, ejecutar `npm run contracts`, `npm test` y `npm run typecheck`.
2. Desde la raíz, ejecutar `.venv/Scripts/python.exe -m pytest tests/security_backend/test_product_rules.py`.
3. Reconstruir la API .NET y ejecutar el proyecto de pruebas `tests/security_backend/DotnetSecurityChecks.csproj` con la solución detenida para evitar bloqueos de archivos.
4. Comprobar en el navegador el producto, la moneda, el precio de sólo lectura, la cantidad y el PDF generado; contrastar los importes del historial.

Se mantiene la versión 2.3.0. Estos cambios no publican nada en GitHub ni activan una tarifa oficial.

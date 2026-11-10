# Catálogo territorial del Perú

Fuente primaria: INEI, Sistema de Consulta de Códigos Estandarizados (SISCONCODE).

- Servicio oficial: https://www.gob.pe/15028-consultar-codigos-estandarizados-del-inei
- Aplicación: https://webapp.inei.gob.pe:8443/sisconcode/main.htm
- Endpoint: https://webapp.inei.gob.pe:8443/sisconcode/ubigeo/listaBusquedaUbigeoPorUbicacionGeografica.htm
- Versión 2026, categoría `9-1`, consultada el 6 de octubre de 2026.
- Parámetros GET: `versionCategoriaPK=9-1`, `nivel=1`, `strVersion=2026`, `strDpto=TODOS`, `strProv=TODOS`, `strDist=TODOS`, `flagDpto=`, `flagProv=`, `flagDist=`.
- Respuesta oficial en ISO-8859-1. Se excluyeron los modales ocultos de información general y se extrajeron código y nombre de las columnas territoriales.
- Resultado: 25 departamentos (incluida la Provincia Constitucional del Callao), 196 provincias y 1,893 distritos.

El archivo `lib/peru-ubigeo.json` conserva fuente, versión, fecha y SHA-256 de la respuesta oficial. Los códigos se mantienen como cadenas para conservar ceros iniciales. Se verificaron unicidad, relaciones entre departamento/provincia/distrito y las entradas nuevas Sangani (120307), Santa Rosa de Loreto (160405) y Alto Trujillo (130112). La selección guarda códigos estables y el servidor reconstruye los nombres desde el catálogo.

No hay conexión en vivo con INEI: esta es una copia local versionada. Nuevas creaciones territoriales requieren actualizar la fuente y revisar conteos y relaciones antes de publicar.

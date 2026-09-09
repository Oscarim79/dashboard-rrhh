# Dashboard RRHH

Dashboard web estático en español para el CEO (uso principal: teléfono). Unifica el modelo
de costo de rotación por tipo de tienda, el control de vacantes y la rotación mensual de RRHH.
Proyecto interno de Oscar (gestor de RRHH), no es para un cliente externo.

## Stack y despliegue

- Sitio estático → **GitHub Pages**: https://oscarim79.github.io/dashboard-rrhh/
  Repo público: https://github.com/Oscarim79/dashboard-rrhh (la cuenta "oscarimorales" que
  mencionaba la spec no existe; Oscar confirmó usar su cuenta real `Oscarim79`).
- Datos: Google Sheet compartido con enlace, descargado como xlsx por
  `scripts/actualizar_datos.mjs` → genera `public/data/vacantes.json` y `public/data/rotacion.json`.
- GitHub Action diaria (6:00 Guatemala) + `workflow_dispatch`: descarga → sanitiza → build → Pages.
- Node 20, paquete `xlsx` (SheetJS) para leer el Excel.

## Comandos

- `npm run actualizar` — descarga el sheet y regenera los JSON (usa `.env` local).
- (El dev server / build se definirán al construir el dashboard.)

## REGLA INNEGOCIABLE: privacidad (el repo y el sitio son públicos)

1. El `SHEET_ID` vive SOLO en `.env` local (gitignoreado) y en el secret `SHEET_ID` de
   GitHub Actions. Jamás en código, README, commits ni logs.
2. Ningún dato personal puede llegar a `public/`, al bundle ni al repo: nombres de candidatos,
   `¿A QUIEN REEMPLAZA?`, jefes directos, solicitantes, entrevistadores, DPI, teléfonos, sueldos.
   **Tercera excepción (Oscar, 2026-09-09, para la rotación por marca):** las pestañas ALTAS y BASE DE
   DATOS GENERAL se leen SOLO para contar (altas por mes, marca y área; activos por marca y departamento);
   jamás se lee nombre, DPI, teléfono, sueldo ni otro dato individual. Con eso el pipeline calcula el
   indicador de rotación por marca (`rotacion.json → calculado`). Excepción acordada con
   Oscar (2026-08-31): la pestaña SALIDAS sí se lee, pero SOLO se publican conteos agregados
   (razón, sub-motivo, género, área, marca, agencia, rangos de antigüedad) — jamás filas
   individuales. **Cambio (Oscar, 2026-09-09, pedido del CEO):** el desglose de salidas **por supervisor
   o jefe, con nombre**, SÍ se publica (`porSupervisor` en cada desglose de salidas.json: bajas,
   renuncias, despidos y antes de 6 meses por supervisor). Oscar lo decidió sabiendo que el sitio es
   público y tras la advertencia de que son personas identificables; 'SUPERVISOR' salió de la lista
   anti-fugas. De los colaboradores que salieron sigue sin publicarse nada individual.
   Segunda excepción (Oscar, 2026-09-07): la pestaña CONTROL DE INTEGRACIÓN (llamadas de
   seguimiento a nuevos) se lee SOLO para contar, por año y departamento, cuántos tienen cada
   llamada marcada (`public/data/integracion.json`). Nombres y respuestas jamás se leen.
3. `scripts/actualizar_datos.mjs` corre una verificación final anti-fugas (encabezados prohibidos,
   patrones de DPI de 13 dígitos y teléfonos de 8 dígitos). Si detecta algo: aborta sin publicar.
4. Los xlsx descargados van a `.data/` (gitignoreado), nunca al repo.

## Registro de tiendas y mapa (2026-09-09)

- El registro maestro de tiendas es el Google Sheet "Registro de tiendas — Corporación Americana" (Drive
  de Oscar). `config/tiendas.json` lo espeja y lleva por tienda: tipo, marca, activa, alias, supervisor,
  departamento, municipio, lat/lon (centroide INE). Cambios del Sheet → editar el JSON (flujo manual por
  ahora). `scripts/exportar_tiendas.mjs` genera el Excel desde el JSON.
- `public/mapa.html`: mapa por departamentos (contornos en `public/geo/mapa-gt.json`, generados por
  `scripts/generar_mapa.mjs`) coloreado por supervisor, con un punto por tienda; el pipeline publica
  `public/data/tiendas.json` para alimentarlo. Colores por supervisor en `COLOR_SUPERVISOR` (comun.js).
  El mapa tiene semáforo por tienda, línea de tiempo mes a mes, comparación del supervisor con sus pares
  y costo estimado (mismo cálculo que el Resumen). El Resumen enlaza al mapa con `mapa.html#sup=Nombre`.
  Las fichas muestran motivos de salida por tienda/departamento (`porAgencia` en salidas.json; Oscar
  2026-09-09). En escritorio la página Mapa lleva el menú arriba (`body.pagina-mapa`).

## Modelo de costo — valores de control

Con los parámetros por defecto de la especificación, el simulador DEBE reproducir:
renuncia A = Q71,831 · renuncia B = Q54,581 · despido A = Q76,101 · despido B = Q58,851.
Si no cuadra, el bug está en la implementación, no en los controles.
El Excel de referencia es `J:\Mi unidad\RRHH\COLABORADORES\COSTO DE ROTACIÓN POR TIPO DE TIENDA - AJUSTADO 0825.xlsx`.

**Detalles verificados contra el Excel (2026-08-31) — sin esto los controles NO cuadran:**
- Semanas por mes = **4.33** (no 4.3333): jefe A/B = Q7,205.54 · coordinadora = Q3,325.64.
- El 4º canal de atracción difiere por escenario: **Renuncia usa "Internet" Q5,000/mes → Q500**
  prorrateado; **Despido usa "Telo" Q2,700/mes → Q270**.
- El Excel además trae mezcla: 60% renuncias / 40% despidos (la real del sheet es ~84/16).

**Acuerdo final (Oscar, 2026-08-31):** sin Telo; canales = Pauta en Redes Q5,000/mes +
Volanteo Q5,000/bim + Radio Q2,000/bim + Internet Q5,000/mes (Internet es gasto aparte,
confirmado).

**Ampliación (Oscar, 2026-09-01):** se suma el **jefe de RRHH** (Q8,000, 100% de su tiempo
en reclutar, repartido entre las contrataciones del mes igual que la publicidad → Q800 por
contratación) y la coordinadora baja a **Q4,000**. Controles del Excel (ventas 275k/160k):
renuncia A Q72,262 · B Q55,012 · despido A Q76,762 · B Q59,512 —
`scripts/validar_modelo.mjs` los verifica en cada deploy pasando los salarios de entonces.

**Calibración de salarios (Oscar, 2026-09-08):** el salario del vendedor se separa en dos:
`salarioNuevo` **Q4,500** (lo que gana en sus primeros meses; alimenta la curva) y
`salarioVendedor` **Q6,500** (promedio del que sale; base de la indemnización). Jefe de tienda
**Q8,000**, coordinadora de RRHH **Q4,500**. La antigüedad del despedido va en **meses**
(`mesesServicio`, indemnización proporcional). Los gastos de reclutamiento y contratación
(kit, polígrafo, viáticos, pauta, volanteo, radio, internet, contrataciones/mes, jefe de RRHH)
son **fijos**: en el Simulador se muestran sin slider. Controles vigentes con los valores por
defecto: renuncia A Q71,294 · B Q54,044 · despido A Q75,794 · B Q58,544 (también en el validador).
La "coordinadora de RRHH" del modelo es el **comodín** que RRHH manda a la tienda a cubrir la
plaza (fila "Apoyo Coordinadora RRHH" del Excel); por eso está junto al jefe de tienda en
"Cobertura interna" y se multiplica por la fracción de vacantes en que sí va.
Ojo: el Excel de Oscar aún tiene la fila Telo en su hoja "Despido" (por eso su Resumen dice
Q76,101); el dashboard implementa el modelo acordado, no ese residuo.

## Selector General / Comercial (CEO, 2026-09-07)

- Todas las páginas del tablero llevan el selector (por defecto **Comercial**; se recuerda en
  localStorage y admite `?depto=general|comercial`). Salidas y rotación se filtran directo por la
  columna de área del sheet. **La pestaña de vacantes NO trae departamento**: el pipeline lo deduce
  del puesto (`REGLAS_DEPTO` en `scripts/actualizar_datos.mjs`; si aparece una columna
  DEPARTAMENTO, manda ella). El Simulador no cambia de modelo, solo de calibración.
- **Filtro por marca (global, Oscar 2026-09-09):** desplegable en la barra de período (`MARCAS` /
  `marcaActual()` en comun.js). `salidas.json → porMarca.{americana,abiq,friotec}` y `vacantesDe` filtra
  filas por empresa. Con marca elegida el selector General/Comercial no aplica. Rotación usa el
  **indicador calculado** (`rotacion.json → calculado.series.{total,comercial,americana,abiq,friotec}`:
  bajas de SALIDAS + altas de ALTAS + activos de BASE DE DATOS GENERAL, plantilla reconstruida hacia
  atrás, misma fórmula del manual: bajas acumuladas ÷ promedio(inicio, fin)); `comparacion` lo contrasta
  con el manual. La marca "A2K, ABIQ" (corporativo compartido) cuenta en Americana.
- **Selector de período** (también global): `todo` · `12m` (por defecto) · `a:AAAA` · `m:AAAA-MM`.
  Vacantes se filtran por fecha de solicitud y se re-agregan en el navegador (`agregarVacantes` en
  comun.js debe seguir espejando `agregarVacantes` del pipeline); salidas usan `porMesDetalle`
  para meses sueltos; rotación por mes del indicador.
- `public/propuesta.html` es de **acceso abierto** (sin contraseña, decisión del CEO) y está en el
  menú como última opción "Propuesta" (pedido del CEO, 2026-09-07). Solo cargos, nunca nombres. Las cifras a mano (razones de salida, sueldos, comisión)
  viven en `public/js/propuesta-datos.js`. `?solo=capacitador` muestra solo la propuesta 3.

## Qué registro cuenta qué (decisión de Oscar, 2026-09-07)

- **Salidas que se costean, mezcla renuncias/despidos, antigüedad:** registro de SALIDAS
  (`salidas.json → porTipoTienda`, `razon`, `rango`). Es el registro completo.
- **Oficinas, CEDI y regiones ('no tienda'):** se costean con el modelo con ventas = 0 (sin ventas
  perdidas), tarjeta "NT" en el Resumen.
- **Renuncia vs despido:** manda la columna OBSERVACIONES de SALIDAS (razón oficial). El SUB MOTIVO es
  lo que la persona expresó en la entrevista de salida o al jefe de RRHH, y puede no "cuadrar" con la
  razón oficial (p. ej. RENUNCIA con sub-motivo "mala actitud", o DESPIDO con "salario"). Oscar lo
  confirmó (2026-09-08): NO es error de captura ni hay que reclasificar. La mezcla real cambia por
  período (2024 ≈ 64/36, 2026 ≈ 82/18, últimos 12m Comercial ≈ 90/10).
- **Confiabilidad por fecha (Oscar, 2026-09-08):** el sheet se terminó de estructurar a mediados de 2025;
  antes la captura era menos rigurosa. Los últimos 12 meses son el corte más confiable (por eso es el
  período por defecto). **Desde 2026-09-09 el sitio NO lo dice** (Oscar lo quitó: el CEO ya lo sabe y no
  debe verse ante otros gerentes); es contexto interno, no copy.
- **Días de vacante y plazas abiertas:** control de VACANTES. NO usarlo para contar salidas:
  solo registra las plazas que se abrieron (171 vs 474 bajas en todo el registro).
- **Comparativa entre años y "antes de 6 meses, por qué" (CEO, 2026-09-08 → hecho 2026-09-09):** cada
  desglose de `salidas.json` trae `tempranas` (razón/sub-motivo/rango de las salidas con menos de
  6 meses, n≥3 → OTROS) y el bloque `acumuladoAnio[año][mes]` = desglose de enero a ese mes. Los cortes
  acumulados se calculan en el pipeline (no sumando meses en el navegador) para que la regla n≥3 se
  aplique sobre el tramo completo. La comparativa vive al final de Salidas con controles propios.
  **Decisión de Oscar (2026-09-09):** los sub-motivos se publican TODOS por separado, en todas las
  vistas (se quitó la regla "menos de 3 casos → OTROS" que regía desde 2026-08-31) porque el CEO quiere
  ver el detalle; siguen siendo conteos sin nombres. Además el pipeline unifica sinónimos antes de contar
  (`SUB_ALIAS`: por salario → salario; mal ambiente/mal trato → clima laboral; horarios extendidos →
  horarios; descuentos en salario → descuentos) y publica lo unificado en `agrupacionesSubMotivo`.

## Reglas de trabajo

- No inventar datos: los campos vacíos/inconsistentes se excluyen y se reportan como avisos en
  `meta.json` y en el log del pipeline — nunca se rellenan. Por decisión de Oscar (2026-09-03)
  esos avisos NO se muestran en el sitio (se quitó la sección "Calidad de datos" del Resumen).
- Detección de pestañas del sheet por encabezados, nunca por nombre ni posición.
- Formato es-GT para quetzales (Q71,831), tabular-nums para cifras.
- Colores: tinta #17251F, verde #0B7A55 (renuncia/positivo), ámbar #B5741A (despido).

# Estado del proyecto — Dashboard RRHH

## ✅ PUBLICADO Y FUNCIONANDO (2026-08-31)

- **Dashboard en vivo:** https://oscarim79.github.io/dashboard-rrhh/
- **Repo público:** https://github.com/Oscarim79/dashboard-rrhh (cuenta `Oscarim79`; la
  "oscarimorales" de la spec no existe — Oscar confirmó usar la real)
- **Actualización automática:** GitHub Action diaria a las 6:00 de Guatemala + botón
  "Run workflow" en la pestaña Actions. Secret `SHEET_ID` configurado.
- 5 páginas: Resumen CEO · Vacantes · **Salidas** (nueva, 2026-08-31) · Rotación · Simulador.
  Verificado en vivo (curl + navegador, móvil y escritorio) y JSON publicado revisado: cero datos personales.
- Página Salidas reemplaza al viejo tablero de Data Studio (que está roto — sus fuentes no conectan).
  Usa la pestaña SALIDAS del sheet SOLO en agregado: razón, sub-motivos (n≥3), antigüedad por rangos,
  agencia, área, marca, género. Sin supervisores ni filas individuales. Hallazgo clave: 58% de las
  salidas ocurre antes de los 6 meses; antigüedad mediana al salir 4.7 meses.
- Afinado con retroalimentación de Oscar (2026-08-31): título "DASHBOARD RRHH · CORPORACIÓN
  AMERICANA", menú lateral (fijo en escritorio, ☰ deslizable en móvil), tarjetas del Resumen
  separan "cada salida cuesta" del "acumulado anual (volumen × costo)", y la leyenda distingue
  finiquito (verde) de indemnización (naranja).
- Selector de período en Salidas (2026-09-01, pedido de Oscar): botones "Todo el registro ·
  2024 · 2025 · 2026" que redibujan KPIs y todas las gráficas con el año elegido. El pipeline
  ahora publica en `salidas.json → porAnio` el desglose completo de cada año (la regla de
  privacidad n≥3 → OTROS se aplica dentro de cada año). Verificado en vivo.
- Fórmulas visibles en el Simulador (2026-09-01, pedido de Oscar): bajo cada bloque de
  supuestos hay una cajita con la fórmula en palabras y los números actuales sustituidos
  (ventas perdidas, curva, jefe, coordinadora, sobrecarga, gastos, publicidad, salida y suma
  final); se recalculan en vivo al mover cualquier slider. Verificado en vivo. La fórmula de
  ventas perdidas además explica el origen del 15% de impacto (supuesto del modelo: un vendedor
  menos en un equipo de 5-7 = 14-20% de la fuerza de venta).

## ✅ HECHO 2026-09-09 (noche): indicador de rotación calculado por marca (ALTAS + BASE DE DATOS GENERAL)

- **Autorización de Oscar (2026-09-09):** el pipeline lee ALTAS y BASE DE DATOS GENERAL SOLO para contar.
  Con eso reproduce el indicador de rotación que el jefe de RRHH llenaba a mano y lo separa por marca:
  bajas por mes (SALIDAS), altas por mes (ALTAS), plantilla activa de hoy (BASE: fila con fecha de alta y sin
  fecha de salida) y plantilla de los meses anteriores reconstruida hacia atrás (inicio = fin − altas + bajas).
  Fórmula idéntica al manual: bajas acumuladas del año ÷ promedio(inicio, fin). Se publica en
  `rotacion.json → calculado` (series total/comercial/americana/abiq/friotec + comparación con el manual).
- **Validación (2026-09-09):** el calculado se separa del manual entre 0.7 y 3.3 puntos en 2026 (Comercial jul:
  manual 46.7% con 172 personas; calculado 43.4% con 181). Diferencias explicables por las bajas que el
  jefe no contó en ene-feb y por 4 personas de más en BASE. La página Rotación muestra la tabla "Indicador
  manual vs. calculado" para seguirlo; cuando cuadre de forma sostenida, la pestaña manual puede dejar de llenarse.
- **Resultado por marca (acumulado a agosto 2026):** Americana 46.2% (244 activos), Abi Q 62.9% (17 activos,
  11 bajas), Friotec 200% con 1 persona (plantilla demasiado pequeña; las fuentes no cuadran: ALTAS 4, SALIDAS 2,
  BASE 1). Los 20 del corporativo con marca "A2K, ABIQ" se cuentan en Americana.
- **Friotec fuera por ahora (Oscar, 2026-09-09, cierre):** no aparece en el desplegable de marca, ni en el mapa
  (sus 2 tiendas se ocultan), ni en la tabla de rotación por marca. Los datos siguen en los JSON (`porMarca.friotec`,
  `calculado.series.friotec`); para reactivarla: `MARCAS` y `MARCAS_OCULTAS` en comun.js y la lista de
  `pintarMarcas` en pag-rotacion.js.
- **Sitio:** Rotación tiene la tabla "Rotación por marca (calculada)" y, con una marca elegida, todo (KPIs y
  gráficas) usa la serie calculada de esa marca. El Resumen recupera el "% de la plantilla reemplazada" con
  marca usando esa plantilla.

## ✅ HECHO 2026-09-09 (tarde): registro de tiendas en Google Sheets y página Mapa

- **Registro de tiendas (maestro):** Google Sheet "Registro de tiendas — Corporación Americana" en el
  Drive de Oscar (https://docs.google.com/spreadsheets/d/1a6psVSdytSwfIwIrYA75SDTSIa38e_rPQR6pB-Y7HnU/edit).
  Une la clasificación AA/A/B/C (config/tiendas.json) con el archivo "AGENCIAS POR REGION.xlsx" de Oscar
  (supervisor por tienda: Alejandro Zelada, Diana Mendez, Luisa De Leon, Myra Santos, Sergio Corado) y la
  ubicación (departamento, municipio y centroide del municipio según el INE, censo 2018). Columnas:
  Tienda · Marca · Tipo · Estado · Supervisor · Departamento · Municipio · Lat · Lon · Nombres en el Sheet
  de RRHH · Observaciones. `config/tiendas.json` ahora lleva esos mismos campos por tienda y es lo que
  usa el sitio; `node scripts/exportar_tiendas.mjs` regenera el Excel (.data/registro-tiendas.xlsx) desde
  el JSON. **Por ahora el flujo es manual:** si Oscar cambia algo en el Sheet, hay que reflejarlo en
  config/tiendas.json (pendiente: que el pipeline lea el Sheet de tiendas directamente).
  Pendientes que Oscar debe confirmar en el Sheet: "Pradera 2 *" vs "Pradera Chiquimula" (parecen la misma
  tienda; hoy "Pradera 2" cuenta con Myra y "Pradera Chiquimula" sin supervisor); Santa Catarina Mita sin
  supervisor; Santa Cruz (tienda nueva, abre 3 de octubre, se asumió Santa Cruz Verapaz, tipo por definir);
  Catocha (cerrada) sin ubicación; Abi Q Pradera Concepción ubicada de forma aproximada.
  **Resuelto por Oscar en el Sheet (2026-09-09, noche) y aplicado a config/tiendas.json:** Pradera 2 = Pradera
  Chiquimula (región Myra; alias PRADERA 2 unificado, sus 4 salidas ya cuentan ahí); Catocha = Santa Catarina
  Mita (nombre popular; activa, tipo C, región Myra, alias CATOCHA, 8 salidas); Abi Q Online → Diana Mendez;
  Online → "Online Americana" (Luisa De Leon). Además alias SANTA ELENA para Santa Elena Petén (una vacante
  quedaba sin clasificar). Ya no hay tiendas activas sin supervisor. Quedan 53 tiendas. En el Sheet siguen dos
  observaciones viejas (en Pradera Chiquimula y Santa Catarina Mita) que Oscar puede borrar; el Sheet ya no
  trae columnas de latitud/longitud (las coordenadas viven en config/tiendas.json).
- **Página Mapa (public/mapa.html, js/pag-mapa.js):** Guatemala por departamentos coloreada por el
  supervisor con más tiendas en cada uno; un punto por tienda (tamaño = salidas en el período). Tocar un
  departamento, una tienda o un chip de supervisor abre su ficha en el panel (supervisor: salidas,
  renuncias, despidos, % antes de 6 meses, top 3 motivos y sus tiendas; tienda: salidas, tipo, marca,
  ubicación). Respeta el selector de período; siempre muestra el área Comercial. Contornos:
  `public/geo/mapa-gt.json` generado por `scripts/generar_mapa.mjs` desde el TopoJSON del Ministerio de
  Finanzas (minfin-bi/Mapas-TopoJSON-Guatemala; se descarga a .data/geo/). El pipeline publica
  `public/data/tiendas.json` (subconjunto público del registro) para el mapa. Enlace "Mapa" en el menú
  de todas las páginas.
- **Extras del mapa (Oscar dijo "hazlo" a las cinco ideas, misma tarde):**
  - *Semáforo:* botón "Color: Semáforo" pinta cada tienda verde/ámbar/rojo según sus salidas frente al
    promedio de las tiendas de su mismo tipo en el período (≤75% verde, ≥125% rojo).
  - *Línea de tiempo:* "▶ Reproducir mes a mes" recorre los meses con dato (0.9 s por mes) y un
    deslizador permite pararse en un mes; "Volver al período" regresa al selector.
  - *Comparación con pares:* la ficha del supervisor muestra, bajo cada cifra, la diferencia contra el
    promedio de los otros supervisores de región (salidas, % renuncias en neutro, % antes de 6 meses).
  - *Costo:* botón "Tamaño del punto: Costo estimado"; cada ficha muestra el costo = salidas × costo por
    salida de su tipo, con el mismo cálculo del Resumen (modelo del Simulador, días reales de vacante
    del período por tipo y mezcla renuncia/despido del período). Tienda sin tipo se asume B.
  - *Tarjetas por región en el Resumen:* sección "Por región · supervisor" bajo las 6 cifras: una tarjeta
    por supervisor con ≥3 salidas en el período (salidas, % antes de 6 meses, renuncias/despidos, motivo
    principal) que enlaza a `mapa.html#sup=Nombre` (el mapa abre con ese supervisor seleccionado).
    Colores compartidos en `COLOR_SUPERVISOR` (comun.js).
- **Mapa más grande y con motivos (Oscar, 2026-09-09, noche):**
  - En pantalla grande la página Mapa lleva el **menú arriba** (barra horizontal, clase `pagina-mapa` en el
    body) y ocupa hasta 1480 px de ancho; el mapa **arranca recortado a la zona con tiendas** y tiene
    **zoom** (+ / − / ⟲ vista inicial / GT todo el país, Ctrl+rueda, pellizco en el teléfono) y arrastre.
    Etiquetas y puntos se dibujan con tamaño constante en píxeles (`escalaPx`), así en el teléfono no
    salen diminutos.
  - **Por qué se ha ido la gente, por tienda y por departamento:** el pipeline publica `porAgencia` en cada
    desglose de salidas.json (n, renuncia, despido, tempranas y TODOS los motivos por agencia; se omite en
    los cortes acumulados de la comparativa para no engordar el JSON, que quedó en ~490 KB). Las fichas de
    tienda, departamento y supervisor muestran barras de motivos; se quitó el texto que decía que el detalle
    por tienda no se publicaba (decisión de Oscar: es justo lo que el CEO quiere ver).
- **Filtro por marca en el mapa (Oscar, 2026-09-09):** botones Todas · Abi Q · Americana · Friotec en los
  controles. Con una marca elegida, el mapa solo dibuja sus tiendas y TODAS las cifras (chips, tabla general,
  fichas de supervisor y departamento, semáforo, motivos, costo) se recalculan sumando `porAgencia` de esas
  tiendas (sin filtro, el supervisor usa la columna supervisor del registro). Razón de Oscar: Abi Q y Friotec
  son otros negocios y sus costos y motivos no deben mezclarse con Americana.
- **Filtro por marca en TODO el sitio (Oscar, 2026-09-09, noche):** el pipeline publica
  `salidas.json → porMarca.{americana,abiq,friotec}` (bloque completo por marca; el JSON quedó en ~810 KB) y
  la barra de período de todas las páginas lleva un desplegable "Marca: todas / Americana / Abi Q / Friotec"
  (se recuerda en localStorage `dashboard-rrhh:marca`, admite `?marca=`). Con una marca elegida:
  `salidasDe` devuelve el bloque de la marca y `vacantesDe` filtra las filas por empresa; el selector
  General/Comercial deja de aplicar (la nota de alcance lo dice) y las etiquetas dicen "marca X". Rotación
  no distingue marca (muestra el área completa y lo avisa); en el Resumen la cifra "% de la plantilla" se
  sustituye por el conteo (no hay plantilla por marca). La Propuesta no lleva el filtro (Comercial completo).
  Los botones de marca del Mapa quedan ligados al mismo filtro global.

## ✅ HECHO 2026-09-09: comparativa entre años y "por qué se van antes de 6 meses" (pedido del CEO)

Las dos cosas que el CEO pidió el 2026-09-08 ya están en la página **Salidas** (publicadas y verificadas en vivo):

1. **Comparativa entre años · mismo período** — sección al final de Salidas (hay un enlace bajo los KPIs
   que baja hasta ahí). Controles propios: "Comparar [año] con [año] de enero a [mes]". Por defecto
   compara el año anterior con el año en curso hasta el **último mes completo con dato** (hoy: enero a
   agosto de 2025 vs 2026; el CEO pidió ene–jul: se elige julio en el desplegable). Tablas lado a lado
   (año A · año B · Cambio, con el % que cada fila pesa en su tramo): lo esencial (bajas, renuncias,
   despidos, antes de 6 meses, % y antigüedad mediana), bajas por mes, antigüedad, razón, motivos,
   motivos de los que se van antes de 6 meses, agencia (top 12), área (solo en General), marca y género.
   Naranja = más salidas (o peor) en el segundo año; verde = menos (o mejor). Lleva la advertencia de
   confiabilidad cuando alguno de los años es 2025 o anterior.
   - Datos: el pipeline publica `salidas.json → acumuladoAnio[año][mes]` (desglose de enero a ese mes,
     para cada mes con dato, sin meses posteriores a la lectura). Se calcula en el pipeline y NO sumando
     meses en el navegador, para que la regla n≥3 → OTROS se aplique sobre el tramo completo.
     salidas.json pasó de 84 KB a 226 KB (comprimido por Pages es mucho menos); si estorbara, se
     puede recortar `agencia` de los cortes acumulados. `dimsAcumulado()` en comun.js lo lee.
2. **Los que se van antes de 6 meses, ¿por qué se van?** — tarjeta nueva en "Por qué se van" (respeta los
   selectores General/Comercial y de período). El pipeline cruza razón y sub-motivo con antigüedad
   menor a 6 meses (`tempranas` dentro de cada desglose: n, razon, subMotivo, subMotivoRenuncias, rango;
   regla n≥3 → OTROS; solo conteos). Últimos 12 meses Comercial: 87 de 137 salidas (64%) fueron de
   gente con menos de 6 meses; motivos principales salario (30) y clima laboral (20).
   Ojo: en 2025 (ene–ago) el cruce muestra 0 en "salario" y 0 en "clima laboral" — no es que no
   existieran, es que en la primera mitad de 2025 los motivos se capturaban distinto ("descuentos",
   "otros"); de ahí la advertencia de confiabilidad.

**Ajuste de Oscar (2026-09-09, tarde):** en el cruce "antes de 6 meses" se muestran TODOS los motivos,
sin agrupar en "Otros" (el CEO quiere ver el detalle); sigue siendo solo conteos. Además el pipeline
unifica sinónimos antes de contar, en todas las vistas (`SUB_ALIAS`): por salario → salario; mal
ambiente y mal trato → clima laboral; horarios extendidos → horarios; descuentos en salario →
descuentos. Antes la regla n≥3 partía esos sinónimos (p. ej. "mal trato" con 1 caso caía en Otros en
vez de sumar a clima laboral). Lo unificado se publica en `salidas.json → agrupacionesSubMotivo` y se
dice en el pie de cada gráfica de motivos. Después Oscar pidió lo mismo para la gráfica general
"Motivos de salida": desde 2026-09-09 NINGUNA vista de motivos agrupa en "Otros" (se quitó la regla
n≥3 del pipeline para sub-motivos; la razón renuncia/despido sí la conserva).

**Por supervisor (Oscar, 2026-09-09, pedido del CEO):** sección nueva "Por supervisor o jefe" en Salidas
(tabla: bajas, renuncias, despidos, antes de 6 meses por supervisor, con nombre; respeta los selectores)
y tabla equivalente en la comparativa. Se le advirtió a Oscar que son personas identificables en un sitio
público y se le ofreció publicarlo con contraseña o con códigos; eligió **abierto con nombres**. El
pipeline lee la columna SUPERVISOR O JEFE (18 supervisores) y publica solo conteos por supervisor. Ampliación (misma tarde): cada supervisor lleva sus 5 motivos más frecuentes (`motivos`) y el sitio muestra el top 3 bajo el nombre, en la tabla de Salidas y en la comparativa (un renglón por año).

**Revisión de motivos "en cero" (2026-09-09):** ninguna salida tiene sub-motivo vacío. Los ceros de 2025
en la comparativa son un cambio de criterio de captura: de enero a agosto de 2025 nadie usó "salario" ni
"clima laboral" (se usaba "descuentos", "bajo rendimiento", "mala actitud"…); desde septiembre de 2025
casi todo es salario/clima. Las 17 salidas con motivo vago ("voluntaria"/"no confirmado") están en
`.data/revision-motivos-2026-09-09.xlsx` (local, gitignoreado). **Hecho el mismo día:** Oscar las
clasificó (con Claude para Chrome escribió las 17 celdas de la columna P y corrigió J475 → 17/07/2026);
el pipeline las leyó (17/17) y el sitio se republicó con `gh workflow run actualizar.yml`. Ya no queda
ninguna salida con motivo "voluntaria"/"no confirmado". Motivos nuevos en el registro: HIGIENE PERSONAL y
DEUDAS. Aviso de Claude para Chrome: la validación de datos (lista) de la columna P está desactualizada
(marca en rojo valores que sí se usan, como HORARIOS o SALARIO); es cosmético, el valor sí queda guardado.

**Sin avisos de confiabilidad en el sitio (Oscar, 2026-09-09):** se quitaron la frase bajo la barra de
período ("los datos más finos y confiables son los de los últimos 12 meses…") y el "Ojo al comparar" de
la comparativa. El CEO ya conoce el tema y no debe aparecer cuando se presente a otros gerentes. La nota
bajo la barra ahora solo dice qué cubre "todo el registro". El hecho sigue documentado aquí y en CLAUDE.md.

**Globo de detalle por motivo (Oscar, 2026-09-09):** en las dos gráficas de motivos de Salidas, los motivos
subrayados muestran un globo al pasar el cursor (escritorio) o tocar la barra (teléfono) con qué casos
agrupa cada uno. Los textos viven en `public/js/propuesta-datos.js → detalleMotivos` (hoy: Clima laboral,
Salario, Horarios; agregar un motivo = una línea) y se les suma automáticamente lo que el pipeline
unificó del registro ("mal trato", "por salario"…). Mecánica: `barrasH` acepta `detalle` por fila
(graficas.js) y `activarDetalles()` en comun.js pinta el globo (`.globo` en el CSS).

Pendiente de Oscar: enseñárselo al CEO y, si prefiere que la comparativa arranque en julio en vez del
último mes completo, es un cambio de una línea en `pintarComparativa` (pag-salidas.js).

## (Cumplido) PENDIENTE PARA MAÑANA — pedido del CEO (anotado 2026-09-08, noche)

Oscar lo dejó como nota; se resolvió en la sesión del 2026-09-09 (ver arriba). Dos cosas:

1. **Comparativa enero–julio 2025 vs enero–julio 2026 de toda la data de salidas**, lado a
   lado (a la par). Toda la data = las mismas vistas de la página Salidas: total, razón
   (renuncia/despido), sub-motivos, antigüedad por rango, área, marca, agencia, género.
   - Lo que ya hay: `salidas.json → porMesDetalle` trae cada mes con todas esas dimensiones
     (razon, subMotivo, subMotivoRenuncias, genero, area, marca, agencia, rango, diasLab, n),
     así que se pueden sumar los meses ene–jul de cada año en el navegador, igual que se hace
     con los meses sueltos. Falta decidir si el selector de período gana una opción de
     "comparar dos rangos" o si es una sección nueva en Salidas.
   - Ojo con la regla n≥3 → OTROS: al sumar meses hay que aplicarla sobre el rango sumado, no
     mes por mes (si no, se pierden sub-motivos que sí llegan a 3 en el semestre).
   - Ojo con la confiabilidad: 2025 antes de mitad de año se capturaba con menos rigor (nota
     ya visible bajo la barra de período). La comparativa debe llevar esa advertencia.

2. **POR QUÉ se fueron las personas que salieron antes de los 6 meses.** Hoy el sitio muestra
   "razón" y "sub-motivo" por separado de "antigüedad": NO existe el cruce
   sub-motivo × antigüedad < 6 meses. Hay que agregarlo en `scripts/actualizar_datos.mjs`
   (conteo agregado: razón y sub-motivo solo de las filas con rango MENOS 1 MES, 1–2, 2–4 y
   4–6 MESES; regla n≥3 → OTROS; sin nombres ni supervisores) y publicarlo en `salidas.json`
   (por año y por mes, para que respete los selectores). Luego una tarjeta/gráfica en Salidas
   ("Los que se van antes de 6 meses se van por…") y, si aplica, en la comparativa del punto 1.

Ambas cosas van filtradas por el selector General/Comercial como todo lo demás.

## Simulador: salarios recalibrados, gastos fijos y antigüedad en meses (2026-09-08, tarde)

Pedido de Oscar en cuatro puntos, todo en `public/js/modelo.js` y `public/js/pag-simulador.js`:

- **Cobertura interna explicada.** El grupo ahora se llama "Cobertura interna: quién hace el
  trabajo del vendedor que falta" y lleva una nota: el jefe de tienda siempre tapa parte del
  hueco con parte de su jornada, y la coordinadora de RRHH es el **comodín** que RRHH manda a la
  tienda cuando se puede (fila "Apoyo Coordinadora RRHH" del Excel). Las etiquetas y las cajitas
  de fórmula de ambos lo dicen en palabras ("En cuántas vacantes se logra mandarla" en vez de
  "Probabilidad de ese apoyo").
- **Salarios.** El del vendedor se partió en dos: `salarioNuevo` Q4,500 (sus primeros meses,
  alimenta la curva) y `salarioVendedor` Q6,500 (promedio del que sale, base de la indemnización,
  ahora en el grupo "Costo de salida"). Jefe de tienda Q8,000 y coordinadora Q4,500 (Oscar
  escribió "4500 al igual que el de 4500 y el de un jefe promedio son 8"; se interpretó como
  vendedor nuevo / coordinadora / jefe y **Oscar lo confirmó** el mismo día). La curva se queda
  en **3 meses** (confirmado por Oscar).
- **Gastos de reclutamiento y contratación fijos.** Kit, polígrafo, viáticos, pauta, volanteo,
  radio, internet, contrataciones al mes y jefe de RRHH se muestran con su valor y la etiqueta
  "fijo", sin slider (`fijo: true` en CONTROLES). Restablecer no los toca porque nunca cambian.
- **Antigüedad en meses.** `aniosServicio` → `mesesServicio` (0 a 120, paso 1) con etiqueta
  "1 año y 3 meses"; la indemnización es salario × meses ÷ 12.
- Controles nuevos: renuncia A Q71,294 · B Q54,044 · despido A Q75,794 · B Q58,544. El validador
  sigue comprobando también los del Excel (Q72,262 …) pasando los salarios de entonces. El
  Resumen usa los mismos valores por defecto, así que sus cifras de costo bajaron ~Q970 por salida.
- Verificado en el navegador local: sin errores de consola, meses de servicio a 15 → "1 año y 3
  meses" y Q8,125 de indemnización, botones "datos reales", "mitad de días" y "restablecer" bien.
- Nota: apareció un `AGENTS.md` sin commitear en la raíz (copia casi idéntica de CLAUDE.md, no la
  creó esta sesión). Se dejó fuera del commit.

## Sesión del 2026-09-08: copies, propuesta 4 y revisión final de números

- **Datos:** Oscar corrigió en el Sheet varias marcas RENUNCIA/DESPIDO (15 filas de 2026 pasaron a
  despido) y la fórmula de días laborados. Regla confirmada: OBSERVACIONES es la razón oficial y el
  SUB MOTIVO es lo que la persona expresó; no se reclasifica nada (está en CLAUDE.md).
- **Copies por alcance:** el Resumen ya distingue Comercial ("puestos comerciales fuera de tienda:
  CEDI y regiones") de General ("oficinas, CEDI y regiones"), el alcance va primero en la tarjeta
  del costo, singular/plural correcto. Salidas: "Por área" y "Por marca" son tarjetas separadas; la
  de área se oculta en Comercial; áreas con tildes y grafías unificadas (CREDITOS Y COBROS).
  Simulador: la mezcla de "Usar datos reales" sale del registro de salidas.
- **Propuesta:** nueva propuesta 4 "métrica de cultura para el gerente comercial y los supervisores"
  (cifras vivas de clima/actitud) y una Conclusión al final que conecta cada motivo de salida con la
  propuesta que lo ataca; el cierre explica cómo se atacan los primeros seis meses y quiénes son los
  dueños. Anexos renumerados a 5 y 6.
- **Alternativa de Gerencia (tarde, 2026-09-08):** el jefe propuso que regrese a RRHH la colaboradora
  que ya fue asistente del área (seguimiento, entrevistas, viajes, SSO), que Comercial designe 2
  comodines y 1 capacitador por región, y que la inducción general se automatice con IA en una web
  controlada por esa asistente. Está en la Propuesta como bloque "Alternativa planteada por Gerencia"
  (tabla necesidad → propuesta RRHH → alternativa, por qué conviene, qué falta definir) después de
  la propuesta 4; `personasNuevasRRHHAlt: 1` en propuesta-datos.js alimenta el ratio. Sin nombres.
  Oscar aclaró: NO es la candidata de Garantías; es la persona que hoy es el comodín de RRHH (antes
  fue la asistente). Por eso el bloque se llama "Alternativa 2" y `personasNuevasRRHHAlt: 0` (RRHH
  no crece; queda en 1.1 por cada 100, debajo del mínimo 1.5, y la página lo dice).
- **Revisión final (cuadre):** los JSON cuadran entre sí y contra el sheet (474 salidas, 363
  comerciales); el costo del Resumen se reprodujo de forma independiente al quetzal (Comercial 12m
  Q10,095,505 · General 12m Q11,590,530). Indicador de rotación vs registro de salidas: coinciden
  mes a mes salvo pequeñas diferencias en ene–abr 2026 y **agosto 2026 sin bajas en el indicador**
  (el pipeline ahora lo avisa en meta.json). `.claude/launch.json` sirve `public/` en el puerto 4173
  para verificar en el navegador.

## El costo de rotación cuenta salidas con el registro de SALIDAS (2026-09-07, séptima ronda)

- Oscar detectó que General y Comercial daban casi lo mismo: el costo contaba salidas con el
  **control de vacantes** (171 renuncias/despidos en todo el registro) y no con el registro de
  **SALIDAS** (474 bajas). Decisión: **contar con SALIDAS** y seguir tomando los días de vacante
  del control de vacantes. El pipeline publica en cada desglose de salidas `porTipoTienda`
  ({AA,A,B,C,'sin tipo','no tienda'} × {renuncia,despido,otros}) y `sinTipoOrigen`.
- Resumen: costo, "plantilla reemplazada", mezcla renuncias/despidos, hallazgos y el supuesto de
  "sin tipo" usan ahora esas cifras; el Simulador proyecta con ellas. "De dónde salen los datos"
  explica el cambio. Todo el registro Comercial pasó de Q11.4M a **≈ Q26.6M** (339 salidas en
  tiendas clasificadas); últimos 12 meses ≈ Q9.9M.
- Para que el registro de SALIDAS resolviera bien las agencias se agregaron alias en
  `config/tiendas.json`: nueva noTienda **CEDI Capital** (CEDI, ATANASIO, ATANASIO TZUL), Oficina
  Central (CONTABILIDAD, COBROS, COBRADOR, AUDITORIA, GARANTIAS, ADMINISTRATIVO...) y ABIQ OAKLAND
  MALL → Oakland Mall. Quedan sin reconocer: EL CHAL (1) y ABIQ MIRAFLORES (1) — preguntar a Oscar.
- OJO: tras los ajustes de Oscar en el Sheet, 78 salidas de CEDI/oficinas tienen AREA LAB =
  COMERCIAL; en Comercial aparecen como "no tienda".
- **Oficinas, CEDI y regiones SÍ se costean** (pedido de Oscar, mismo día): mismo modelo con
  ventas = 0 (sin ventas perdidas; curva, jefatura/RRHH, contratación, finiquito/indemnización) y
  la mediana global de días. Tarjeta propia "Oficinas, CEDI y regiones · sin ventas perdidas"
  (≈ Q31k renuncia / Q35.5k despido). Todo el registro: Comercial ≈ Q29.1M · General ≈ Q30.3M;
  12 meses: Q10.9M · Q11.4M. La diferencia General–Comercial sigue siendo chica porque el Sheet
  marca 440 de 474 bajas como Comercial.

## Propuesta: selector de período en "Por qué se van" (2026-09-07, sexta ronda)

- La gráfica de motivos de la propuesta tiene su propia barra de período (Todo · 12 meses · año ·
  mes). Es local: no lee ni escribe la memoria global del tablero (`pintarSelectorPeriodo` acepta
  ahora `contenedor`, `guardar:false` e `inicial`). Arranca en "todo el registro".

## Motivos de salida ahora vienen del Sheet; propuesta 1 ajustada (2026-09-07, quinta ronda)

- Oscar cargó los motivos directamente en la pestaña SALIDAS (Comercial pasó a 422 salidas; razón
  capturada 474/474; sub-motivos SALARIO 120, CLIMA LABORAL 117, VOLUNTARIA 58, ...). Por eso el
  reparto manual de `propuesta-datos.js → desgloseVoluntaria.casos` quedó VACÍO (se conserva la
  estructura por si vuelve a hacer falta). `NOMBRE_SUB` en comun.js reconoce SALARIO, CLIMA LABORAL
  y DESCUENTOS; "mal trato" y "mal ambiente" se suman a clima laboral. Las 58 "voluntarias" se
  muestran en gris como "sin detalle".
- La propuesta usa TODAS las salidas comerciales (renuncias y despidos, `subMotivo`), no solo
  renuncias, y ya no muestra ningún aviso de cuadre.
- Propuesta 1: la asistente NO ayuda en entrevistas ni toca MP/MINTRAB (confiados al jefe); hace
  todo lo demás que hace el jefe y lo que podría hacer con más tiempo (planes de seguimiento,
  escalonamiento de salarios); coordina entrevistas con la gerencia cuando el jefe no está.
- Título "Anexos importantes" antes del punto 4 (SSO) y 5 (benchmark).

## Propuesta: recorte pedido por Oscar (2026-09-07, cuarta ronda)

- Fuera de la página: "se queda sin hacer", el bloque de seguimiento a nuevos (control de
  integración; el JSON se sigue generando), la tabla "qué tanto explica el registro", todos los
  costos (Q6,300 / Q6,500), la remuneración del capacitador (bono y variantes), el punto de
  compensación, "lo que se pide" de SSO, los compromisos a 90 días e inversión y retorno. Todo eso
  se discute con el CEO en la reunión, no en la página. `propuesta-datos.js → supuestos` queda sin
  uso por ahora (se conserva por si vuelve a hacer falta).
- Ajustes de texto: al jefe de RRHH lo que más tiempo le lleva son las entrevistas (repartidas
  entre jefe, asistente y gerente de RRHH); MP/MINTRAB ≈ un caso al mes (promedio 6 meses), casi
  dos días cada uno. 1.2 ya no dice "no existe un sistema": sí existe (documentos y sistema); el
  problema es que por urgencia los supervisores piden al jefe de agencia que mande al nuevo antes
  de terminar; se propone priorizar la capacitación con lo que ya hay.
- Sección 2: cada propuesta abre con "Hoy · carga actual" de la persona y luego "Propuesta".
  Quedan 1–3 + 4. SSO (sin petición) + 5. benchmark de industria.

## Propuesta: resumen del documento Word en la Sección 2 (2026-09-07, tercera ronda)

- **"Propuesta" es la última opción del menú izquierdo** en todas las páginas (pedido del CEO) y la
  página lleva el mismo menú del tablero. Se mantiene la versión del CEO (capacitadores con bono, no
  tiempo completo) y las cifras vivas del tablero, no las del documento.

- Fuente: `J:\Mi unidad\RRHH\COLABORADORES\PROPUESTA DE ESTRUCTURACION DEPARTAMENTO DE RRHH con escenarios.docx`
  (tiene nombres; en la página solo van cargos). La Sección 2 ahora es un súper resumen: las tres
  propuestas del CEO (1–3) + 4. compensación (piso Q4,500→Q3,000 en el mes 5 vs permanencia mediana
  viva; decisión ya tomada de garantía caso por caso a los 4 meses; plan de 30 días; descuentos con
  tope, Q0) + 5. SSO (0/43 cumplen, 41 sin VIH, Q202,595 una vez, lo ejecuta la asistente de campo)
  + 6. compromisos a 90 días + 7. benchmark de industria (1.1 → 1.9 por cada 100, calculado con la
  plantilla viva) + 8. inversión y retorno (tabla con SSO y salidas evitadas que pagan la inversión,
  con el costo por salida B–A calculado como en el Resumen).
- Sección 1: cada bloque de cargo lleva ahora "Se queda sin hacer" (del documento).
- Las cifras fijas del documento están en `propuesta-datos.js → documento` (personas de RRHH,
  tiendas, SSO, pisos, salario mínimo, rango de benchmark).

## Selector de período (CEO, 2026-09-07, segunda ronda)

- Barra "Período" en todas las páginas del tablero, global como el de General/Comercial (se
  recuerda en el navegador; admite `?periodo=todo|12m|a:2026|m:2026-08`). Opciones: Todo el
  registro · Últimos 12 meses (por defecto) · año en curso "a la fecha" · años anteriores · un mes
  concreto (desplegable). Los años y meses se arman con los datos que existen.
- Cómo se filtra: una vacante pertenece al período por su **fecha de solicitud** (las agregadas se
  recalculan en el navegador con `agregarVacantes` en comun.js, misma lógica que el pipeline); una
  salida por su fecha de baja (`salidas.json` trae `total`, `ult12m`, `porAnio` y ahora
  `porMesDetalle` con el desglose completo de cada mes, regla n≥3 dentro de cada mes); la rotación
  por el mes del indicador (KPI al último mes del período). "Abiertas hoy" y el costo de las plazas
  abiertas no dependen del período. El Simulador solo cambia su calibración.
- Consecuencia visible: en "últimos 12 meses" los días de cobertura ahora se calculan con las
  vacantes solicitadas en esos 12 meses (mediana 17, n=85 en Comercial), no con todas las cerradas
  del registro (16, n=132) como antes. En vistas de un mes, muchos motivos caen en "Otros" por la
  regla de privacidad.
- Ojo: el reparto de RRHH de las renuncias "voluntarias" solo aplica a Comercial · todo el registro.

## Cambios pedidos por el CEO tras la revisión (2026-09-07)

- **Selector General / Comercial** en todas las páginas del tablero (cabecera en móvil, menú en
  escritorio). Abre en Comercial; se recuerda en el navegador y admite `?depto=general`. Salidas
  (AREA LAB) y rotación (AREAS / DEPARTAMENTO) se filtran con la columna del sheet. Vacantes no trae
  departamento: se deduce del puesto (224 de 254 son comerciales) y el Resumen lo explica en "De
  dónde salen los datos". El pipeline publica `porDepartamento.comercial` en vacantes.json y
  salidas.json. El Simulador solo cambia su calibración.
- **Salidas: motivos por separado.** El CEO quiere salario y mejor oportunidad como motivos
  distintos, así que se deshizo la agrupación "mejor oportunidad · salario · beneficios" de la
  página Salidas; "voluntaria" se rotula como "renuncia sin detalle registrado".
- **Propuesta reescrita y sin contraseña** (`public/propuesta.html`, script de cifrado eliminado).
  Dos secciones: 1) el problema (carga del equipo de RRHH en tres bloques por cargo, sin sistema
  formal de capacitación, razones de salida) y 2) tres propuestas (asistente para el jefe de RRHH por
  traslado interno, segundo comodín, vendedor capacitador por región con bono Q500 + 3 variantes de
  garantía de comisión). `?solo=capacitador` muestra solo la propuesta 3 para el gerente comercial.
- **Razones de salida = registro + reparto de RRHH.** El sheet solo tiene motivo real en 47% de las
  renuncias (el resto dice "voluntaria"). Oscar cargó el reparto de las 110 "voluntarias" de Comercial
  (todo el registro) en `public/js/propuesta-datos.js` → `desgloseVoluntaria.casos`: Salario 45, Mejor
  oportunidad 22, Clima laboral 18, Descuentos en salario 9 (suman 94; Oscar confirmó que las 16
  restantes coinciden con casos ya registrados como mejor oportunidad 9 y mal trato 7, por eso
  `cubreTodas: true`). `aplicarDesglose` en comun.js suma los motivos repetidos ("mal trato" cuenta
  como clima laboral) y lo usan la página Salidas (solo en Comercial · todo el registro) y la
  propuesta (renuncias comerciales: `subMotivoRenuncias`, nuevo en salidas.json).
- **Control de integración** (nuevo, `integracion.json`): solo conteos de llamadas de seguimiento
  (1ª, 20, 40, 60 días) por año y departamento. OJO: el registro muestra que las llamadas SÍ se
  marcan en ~70% de los 194 ingresos comerciales; la propuesta lo dice tal cual y distingue la
  llamada (se hace) del acompañamiento en tienda (no se hace).
- **Supuestos editables pendientes de confirmar por Oscar** (en `propuesta-datos.js`): sueldo
  del comodín Q4,500, reemplazo en Garantías Q4,500, 5 regiones (pestaña DISTRIBUCIONCAP),
  comisión promedio Q2,000/mes, 10 días de capacitación, 50% de venta mientras capacita. Los
  nuevos por mes salen del indicador de rotación (altas COMERCIAL, 12 meses).

## Supuesto del Resumen: ahora dice de dónde vienen las salidas sin tipo (2026-09-03)

- Tras clasificar las 9 tiendas, el supuesto bajó de 21 a 14 salidas. Para que no haya que adivinar,
  la tarjeta del supuesto lista el origen: "Catocha (cerrada) ×N · <nombre> — nombre no reconocido en
  el archivo de tiendas ×N", calculado de `vacantes.filas` con el mismo criterio del pipeline.
- El pipeline separa en `salidas12mPorTipo['no tienda']` las salidas en oficinas/regiones (esTienda
  false): ya no caen en "sin tipo" ni se costean con el modelo de tienda; el Resumen las anota aparte.
- Catocha y Petapa eran tipo C (Oscar, 2026-09-03): ya se costean como dato aunque estén cerradas. Lo que
  queda en "sin tipo" solo puede ser: Zona 9 (cerrada, tipo null) o
  nombres del sheet que no coinciden con ningún alias (arreglo: agregar el alias en config/tiendas.json).

## Sección "Calidad de datos" retirada del sitio (2026-09-03)

- Pedido de Oscar: la lista de avisos de calidad en el Resumen "daña más de lo que ayuda" frente
  a Gerencia. Se quitó del `index.html` (y la referencia en `vacantes.html`). El pipeline sigue
  generando `meta.calidad` y lo imprime en el log de la Action — ahí se consultan los avisos.
- Además, ahora el Resumen trae la tarjeta "De dónde salen los datos" y el pie de todas las
  páginas lleva la línea de fuente (pedido de Oscar para la reunión con el CEO).

## Resumen: "Lo esencial en 6 cifras" (2026-09-03)

- Bloque nuevo al inicio del Resumen con las cifras que RRHH cita al presentar a Gerencia,
  para que el CEO vea en la tablet lo mismo que Oscar dice: % de la plantilla reemplazada en
  12 meses (salidas con vacante ÷ colaboradores al cierre, de `rotacion.json`), % de salidas
  antes de 6 meses y antigüedad mediana (todo el registro, de `salidas.json`), costo por
  salida B→A (modelo con días reales), costo de las plazas abiertas hoy (renuncia por tipo;
  sin tipo → B), días mediana/promedio y mezcla renuncias/despidos.
- **Todo se calcula en vivo de los JSON; nada escrito a mano**, cada tarjeta indica su
  período, y el bloque va en `try/catch` para que nunca rompa el resto de la página.
- Ojo de consistencia: los documentos de la propuesta citan Q55–72 mil por salida (valores de
  control de la especificación, ventas 275k/160k); el tablero, con las ventas por tipo
  acordadas (A 750k / B 400k) y días reales, muestra más (≈ Q63–91 mil con 16 días). Los
  documentos lo aclaran como "cálculo conservador".

## Antigüedad al salir: "más de un año" partido en tramos de años (2026-09-03)

- Oscar notó que la barra "Más de un año" (125 de 474) parecía la mayoría, cuando el 59% se va antes de
  6 meses: el sheet trae un solo rango que junta de 1 a 15+ años frente a tramos naranjas de 1-2 meses.
- El pipeline ahora parte ese rango con los días laborados: 1 a 2 años (365-729), 2 a 5 años (730-1824),
  más de 5 años (≥1825). Si la fila no tiene días válidos (o < 365) queda como "Más de un año (sin
  detalle de años)" y se cuenta en un aviso de calidad. Los rangos tempranos no cambian, así que el
  % antes de 6 meses del Resumen y de Salidas sigue igual.
- La nota bajo la gráfica avisa que los tramos no tienen el mismo ancho y da el % que se va antes de
  cumplir un año (calculado en vivo).

## Propuesta: bloque "Lo que pedimos frente a lo que ya se gasta" (2026-09-03)

- Pedido de Oscar: en un lugar estratégico, el total de inversión pedido contra lo que ya se gasta en
  rotación, sin contar posibles multas del IGSS por SSO. Va justo después de "La idea en 30 segundos".
- Cifras (todas ya estaban en la página): gasto = ~150 salidas × Q55–72 mil = Q8.3–10.8 millones/año
  (escenario conservador; el tablero muestra más). Inversión primer año = Q529,200 (3 prioridades con
  prestaciones) + Q202,595 (SSO, una vez) ≈ Q732 mil → la rotación cuesta 11–15 veces lo pedido
  (Q7–9 de cada Q100); del segundo año, 16–20 veces. Nota explícita: sin multas del IGSS ni
  capacitaciones repetidas.
- Artefacto privado republicado y `public/propuesta.html` regenerado con la misma clave.
- **Corrección (mismo día):** Oscar comparó con el tablero (Q6,436,480 · 84 salidas con vacante en tiendas
  clasificadas, 12 meses) y pidió usar esa cifra. El "~150 salidas/año" venía del n=151 de la calibración
  de días (todo el registro, no 12 meses); el conteo real de 12 meses es 95 (84 tiendas + 11 oficinas).
  El bloque ahora dice Q6.4 millones (≈ Q76,600 por salida, piso: sin oficinas ni salidas sin vacante),
  relación 8.8 veces el primer año y 12 veces después. **Pendiente:** la tesis ("más de 150 vacantes",
  "más de la mitad de la empresa"), el retorno ("8–10 de las ~150 salidas") y las filas "Por qué" de los
  puntos 3 y 4 siguen usando el 150 y hay que alinearlos al tablero (95 salidas, ~un tercio).

## Propuesta: "por qué" de cada meta en "Cinco problemas, cinco respuestas" (2026-09-03)

- Pedido de Oscar: que cada uno de los cinco puntos diga por qué la meta prometida es alcanzable, no
  solo cuál es. Se agregó una fila "Por qué" (etiqueta en ámbar, texto en gris) antes de cada "Meta":
  1) una persona cierra ~12–13 vacantes/mes con mediana 16 días → con dos entrevistando, cola + nuevas
  cabe en 60 días y el tiempo baja a la mitad; 2) con vacantes <10 días quedan 3–4 abiertas a la vez,
  cubribles por dos comodines; 3) 84% renuncias y mediana 4.7 meses = ventana del plan 30/60/90; la meta
  58%→25% es evitar ~50 de ~87 salidas tempranas; 4) Q529k ÷ Q55–72k = 7–10 salidas, 10% de ~87 = ~9;
  5) el diagnóstico de SSO ya está cotizado, faltan horas: 43 tiendas en 90 días = 3–4 por semana.
  Todo sale de cifras que ya están en la misma página; no se agregó ningún dato nuevo.
- Se republicó el artefacto privado "Fortalecimiento de RRHH" (misma URL) y se regeneró
  `public/propuesta.html` cifrado con la misma clave (verificado en navegador: abre con la clave,
  rechaza una incorrecta, muestra las 5 filas). El memo Word y la chuleta no se tocaron.

## Propuesta reestructurada: tres prioridades acordadas con Comercial (2026-09-03)

- Oscar acordó con el área Comercial el orden: 1) analista de RRHH para entrevistas, 2) un segundo
  comodín de tiendas (mismo perfil que la coordinadora, para que ambas cubran las plazas que quedan
  en el aire), 3) capacitadores de área — perfiles nuevos de tiempo completo que capacitan y después
  dan seguimiento y desarrollo a la gente de su área. Ya NO se propone que vendedores capaciten con bono.
- Costos base: Q4,500 + Q4,500 + 5×Q4,500 = Q31,500/mes (≈ Q44,100 con prestaciones ≈ Q529,000/año);
  opción por fases (prioridades 1 y 2) Q9,000/mes. Benchmark: 1.9 por cada 100 con 1+2; ~3.7 con las tres.
- Se regeneraron `public/propuesta.html` (cifrada), el memo Word, la propuesta docx de Oscar y la chuleta.
- Garantía (decisión tomada con Comercial, 2026-09-03): la garantía de Q4,500 se evalúa caso por caso a
  los 4 meses y se extiende solo a quien valga la pena. La página ya NO pide aprobar el piso permanente ni
  la "garantía que se gana" (se quitó la calculadora del escenario A y el piloto); la sección queda como
  información + la propuesta sin costo de descuentos con tope. Paquete total = solo las tres prioridades.

## Sección interna cifrada (2026-09-02) — SUPERADA el 2026-09-07: la propuesta ahora es abierta

- `public/propuesta.html` es la **propuesta interna para Gerencia** (fortalecimiento de RRHH y
  escenarios de compensación), publicada **cifrada** — AES-256-GCM con clave derivada por
  PBKDF2-SHA256 (600k iteraciones). Al repo y al sitio solo llega texto cifrado: sin la clave
  no hay nada legible, por eso puede vivir en el repo público sin violar la regla de privacidad.
- La página **no está enlazada** en el menú público a propósito; se accede por URL directa
  (`/propuesta.html`) y Oscar comparte la clave solo con quien corresponde.
- La fuente en claro vive fuera del repo (`.private/propuesta-fuente.html`, gitignoreado) y la
  clave en `CLAVE_PROPUESTA` (variable de entorno o `.env` local, como SHEET_ID). Regenerar o
  rotar la clave: `CLAVE_PROPUESTA="..." node scripts/cifrar_propuesta.mjs` y commitear el
  `public/propuesta.html` resultante. El contenido en claro también existe como artefacto privado
  de Claude y documentos Word en poder de Oscar.

## Decisiones firmes

- Modelo con **4 tipos de tienda** (AA/A/B/C, archivo de Oscar con marcas A2K/ABIQ/FRIOTEC).
  Ventas por tipo = puntos medios: AA Q1.2M · A Q750k · B Q400k · C Q200k (editables en Simulador).
- Canales de atracción sin Telo; "Internet" es gasto aparte y se queda (confirmado por Oscar).
- Modelo ampliado (Oscar, 2026-09-01): se suma el **jefe de RRHH** (Q8,000, 100% en reclutar,
  repartido entre las contrataciones del mes → Q800 por contratación) y la coordinadora baja a
  Q4,000. Controles del Excel: renuncia A Q72,262 · B Q55,012 · despido A Q76,762 · B Q59,512 —
  validados en cada deploy por `scripts/validar_modelo.mjs` con los salarios de entonces.
- Recalibración (Oscar, 2026-09-08): vendedor nuevo Q4,500 (curva) · vendedor que sale Q6,500
  (indemnización) · jefe de tienda Q8,000 · coordinadora Q4,500 · antigüedad en meses · gastos de
  reclutamiento fijos. Controles vigentes: renuncia A Q71,294 · B Q54,044 · despido A Q75,794 ·
  B Q58,544.
- Calibración con datos reales: **mediana 16 días / promedio 22** de vacante (n=151 cerradas con
  dato; 74 cerradas sin fechas ni días quedan fuera). Corregido 2026-08-31 tras el reclamo de Oscar:
  un bug convertía celdas vacías en 0 días. La mezcla real: 84% renuncias / 16% despidos.
- `SHEET_ID` solo en `.env` local (gitignoreado) y secret de Actions. Pipeline con verificación
  anti-fugas que aborta si detecta datos personales. Pestañas con nombres/DPI/sueldos ignoradas.
- Zona 9 marcada como tienda cerrada (ya no existe).
- Dotación típica de tienda (Oscar, 2026-09-01, **afinable más adelante**): máximo 3 vendedores +
  1 jefe de tienda + 1 asistente. Sustenta el 15% de impacto en ventas del simulador: un vendedor
  menos = 20–33% de la capacidad de venta, así que 15% asume que el equipo cubre buena parte.

## Qué sigue (cierre del 2026-09-09, en orden de prioridad)

1. **Validar el indicador calculado** un par de meses contra el manual (tabla "Indicador manual vs.
   calculado" en Rotación). Preguntar al jefe de RRHH por las bajas de ene-feb 2026 que no contó (manual 8 y
   22; SALIDAS 12 y 26). Cuando cuadre, dejar de llenar la pestaña manual.
2. **Decidir qué hacer con los 20 del corporativo con marca "A2K, ABIQ"** (hoy cuentan en Americana).
3. **Modelo de costo propio para Abi Q** en el Simulador: faltan sus salarios (vendedor nuevo, vendedor que
   sale, jefe de tienda) y si su curva de aprendizaje es distinta. Hoy Abi Q se costea con parámetros de Americana.
4. **Friotec** queda fuera del sitio hasta que sus fuentes cuadren (ALTAS 4 · SALIDAS 2 · BASE 1 activo).
5. **Sheet "Registro de tiendas":** borrar las dos observaciones viejas (Pradera Chiquimula, Santa Catarina
   Mita); confirmar que Santa Catarina Mita ("Catocha") está activa; Santa Cruz abre el 3 de octubre (tipo por
   definir). Pendiente de largo plazo: que el pipeline lea ese Sheet en vez de config/tiendas.json.
6. **Textos de los globos de motivos** (propuesta-datos.js → detalleMotivos): solo hay Clima laboral, Salario y
   Horarios; Oscar puede dar frases para los demás motivos.
7. ~~AGENTS.md~~ borrado el 2026-09-09.

## Pendientes (no bloquean nada)

- (2026-09-08) Sheet: agosto 2026 en DATA INDICADOR ROTACION aún no tiene data (Oscar: la data va
  hasta julio); el pipeline deja fuera cualquier mes con altas/plantilla pero sin bajas y lo avisa
  en meta.json — entra solo cuando lo llenen. Tres salidas con días laborados negativos (abr 2026,
  feb 2024, ago 2024). `propuesta-datos.js` dice 43 tiendas (≈ las 44 Americana activas del archivo
  de tiendas; las 51 incluyen 5 Abi Q y 2 Friotec) y 5 regiones (no se muestran en la página).

1. **RESUELTO 2026-09-03** (clasificación de Oscar en config/tiendas.json: Cayalá → Abi Q AA; Pradera Concepción → Abi Q A; CLM = Concepción Las Minas A; Central = Quezaltepeque Central AA; Peque 2 = Quezaltepeque 2 A; "Pradera 2 *" A con asterisco porque no se sabe cuál Pradera; Abi Q Online A; Catocha y Petapa cerradas. Solo quedan sin tipo tiendas cerradas, así que el supuesto del Resumen solo cubre sus salidas históricas). Antes — **Tiendas sin tipo**: Catocha, Petapa, Pradera Concepción (Americana), Pradera 2, Central,
   Peque 2, CLM, Abi Q Online. Desde 2026-09-01 sus salidas SÍ se costean en el Resumen con un
   **supuesto editable** (default 80% tipo B, resto C — pedido de Oscar, rotulado como supuesto).
   Cuando Oscar las clasifique → editar `config/tiendas.json` y hacer push; el supuesto
   desaparece solo y el costo pasa a ser dato.
2. En el Excel de tiendas de Oscar hay una **fila tipo B sin nombre** — preguntarle cuál es.
3. El Excel del modelo de Oscar aún tiene la fila "Telo" en la hoja Despido y fórmulas de
   Tienda B mal referenciadas en su Resumen (suman columna B corrida una fila). No afecta al
   dashboard; es limpieza de su archivo.
4. **CONFIRMADO 2026-09-03** por Oscar (y además Cayalá y Pradera Concepción solo existen como Abi Q: el pipeline resuelve ambos nombres a la tienda Abi Q aunque la fila diga AMERICANA). Antes — Asumimos "Pradera CSV" (ABIQ) = la tienda Abi Q de Pradera Concepción — Oscar no lo ha corregido,
   así que se da por bueno.
5. En el sheet, la vacante 219 (Jefe agencia, Abiq Chiquimula) tiene empresa "AMERICANA" siendo
   tienda Abi Q — dedazo para que Oscar corrija en el sheet (el dashboard la muestra tal cual).
   Nota: Abi Q Chiquimula tiene DOS vacantes abiertas (Jefe agencia y Asesor ventas), no es error.

## Cómo retomar

Abrir `D:\Proyectos\DASHBOARD RRHH` y preguntar "¿en qué nos quedamos?". Comandos útiles:
`npm run actualizar` (regenerar datos con el .env local), `node scripts/validar_modelo.mjs`
(controles del modelo), `node scripts/exportar_tiendas.mjs` (Excel del registro de tiendas),
`node scripts/generar_mapa.mjs` (contornos del mapa), `npx --yes serve -l 4173 public` (sitio local;
ojo: `serve` recorta la parte "?" de las URL, por eso los enlaces internos usan "#").
Para cambios: editar → commit → push (el push despliega solo; `gh workflow run actualizar.yml` publica
sin esperar a las 6:00). Último cierre: 2026-09-09, sesión larga (comparativa, supervisores, mapa, marcas,
rotación calculada).

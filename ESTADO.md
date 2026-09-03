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

## Propuesta reestructurada: tres prioridades acordadas con Comercial (2026-09-03)

- Oscar acordó con el área Comercial el orden: 1) analista de RRHH para entrevistas, 2) un segundo
  comodín de tiendas (mismo perfil que la coordinadora, para que ambas cubran las plazas que quedan
  en el aire), 3) capacitadores de área — perfiles nuevos de tiempo completo que capacitan y después
  dan seguimiento y desarrollo a la gente de su área. Ya NO se propone que vendedores capaciten con bono.
- Costos base: Q4,500 + Q4,500 + 5×Q4,500 = Q31,500/mes (≈ Q44,100 con prestaciones ≈ Q529,000/año);
  opción por fases (prioridades 1 y 2) Q9,000/mes. Benchmark: 1.9 por cada 100 con 1+2; ~3.7 con las tres.
- Se regeneraron `public/propuesta.html` (cifrada), el memo Word, la propuesta docx de Oscar y la chuleta.

## Sección interna cifrada (2026-09-02)

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
  Q4,000. Controles vigentes: renuncia A Q72,262 · B Q55,012 · despido A Q76,762 · B Q59,512 —
  validados en cada deploy por `scripts/validar_modelo.mjs`.
- Calibración con datos reales: **mediana 16 días / promedio 22** de vacante (n=151 cerradas con
  dato; 74 cerradas sin fechas ni días quedan fuera). Corregido 2026-08-31 tras el reclamo de Oscar:
  un bug convertía celdas vacías en 0 días. La mezcla real: 84% renuncias / 16% despidos.
- `SHEET_ID` solo en `.env` local (gitignoreado) y secret de Actions. Pipeline con verificación
  anti-fugas que aborta si detecta datos personales. Pestañas con nombres/DPI/sueldos ignoradas.
- Zona 9 marcada como tienda cerrada (ya no existe).
- Dotación típica de tienda (Oscar, 2026-09-01, **afinable más adelante**): máximo 3 vendedores +
  1 jefe de tienda + 1 asistente. Sustenta el 15% de impacto en ventas del simulador: un vendedor
  menos = 20–33% de la capacidad de venta, así que 15% asume que el equipo cubre buena parte.

## Pendientes (no bloquean nada)

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
(controles del modelo), `npx --yes http-server public -p 4173` (ver el sitio local).
Para cambios: editar → commit → push (el push despliega solo).

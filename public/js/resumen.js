// Página Resumen (CEO): solo lectura. Costo anual calibrado, costo por salida
// por tipo con barra de composición, y hallazgos generados de los datos.
import { costoSalida, PARAMS_DEFECTO, VENTAS_TIPO, ORDEN_TIPOS, fmtQ } from './modelo.js';
import { cargarDatos, pintarPie, marcarNavActiva, fmtNum, diasCalibrados } from './comun.js';

marcarNavActiva();
const { vacantes, meta } = await cargarDatos();
const A = vacantes.agregados;

// ── costo anual calibrado ──────────────────────────────────────────────────
// salidas reales últimos 12m × costo por salida con días reales, por tipo.
let costoAnual = 0, salidasCosteadas = 0, salidasSinTipo = 0;
const detallePorTipo = [];
const costoTipo = {}; // costo por salida de cada tipo (también para el supuesto de abajo)
for (const tipo of ORDEN_TIPOS) {
  const cal = diasCalibrados(A.diasCobertura, tipo);
  const p = { ...PARAMS_DEFECTO, diasVacante: cal.dias };
  const cR = costoSalida(VENTAS_TIPO[tipo], 'renuncia', p);
  const cD = costoSalida(VENTAS_TIPO[tipo], 'despido', p);
  costoTipo[tipo] = { cR, cD };
  const s = A.salidas12mPorTipo[tipo];
  if (!s) continue;
  const anual = s.renuncia * cR.total + s.despido * cD.total;
  costoAnual += anual;
  salidasCosteadas += s.renuncia + s.despido;
  detallePorTipo.push({ tipo, salidas: s, cR, cD, anual, cal });
}
const st = A.salidas12mPorTipo['sin tipo'];
if (st) salidasSinTipo = st.renuncia + st.despido;

// ── SUPUESTO: reparto de las salidas sin clasificar (pedido de Oscar 2026-09-01)
// No hay dato de tipo para estas tiendas; se estima con un reparto EDITABLE y
// claramente rotulado como supuesto. Por defecto: 80% tipo B y el resto C.
let supuesto = null;
const pctRenST = st && salidasSinTipo ? st.renuncia / salidasSinTipo : 0;
if (salidasSinTipo) {
  const b = Math.round(salidasSinTipo * 0.8);
  supuesto = { AA: 0, A: 0, B: b, C: salidasSinTipo - b };
}
const costoSupuesto = () => ORDEN_TIPOS.reduce((s, t) =>
  s + (supuesto[t] || 0) * (pctRenST * costoTipo[t].cR.total + (1 - pctRenST) * costoTipo[t].cD.total), 0);

// ── KPIs ───────────────────────────────────────────────────────────────────
const medianaDias = A.diasCobertura.global.mediana;
function pintarKpis() {
  const extra = supuesto ? costoSupuesto() : 0;
  document.getElementById('kpis').innerHTML = `
  <div class="kpi" style="grid-column: 1 / -1;">
    <div class="kpi-valor grande">${fmtQ(costoAnual + extra)}</div>
    <div class="kpi-eti">costo de rotación de los últimos 12 meses (${fmtNum(salidasCosteadas)} salidas en tiendas clasificadas${supuesto ? ` + ${fmtNum(salidasSinTipo)} estimadas por supuesto` : ''})</div>
    ${supuesto ? `<div class="kpi-nota">Incluye <b>${fmtQ(extra)}</b> estimados con un <b>SUPUESTO</b> sobre las ${fmtNum(salidasSinTipo)} salidas en tiendas sin clasificar — el reparto se ajusta en la tarjeta de abajo.</div>` : ''}
  </div>
  <div class="kpi">
    <div class="kpi-valor">${medianaDias} días</div>
    <div class="kpi-eti">tarda en cubrirse la vacante típica (mediana real)</div>
    <div class="kpi-nota">Promedio: ${A.diasCobertura.global.promedio} días — sube por unos pocos casos largos.</div>
  </div>
  <div class="kpi">
    <div class="kpi-valor"><span class="verde">${Math.round((A.mezcla.pctRenuncia ?? 0) * 100)}%</span> · <span class="ambar">${Math.round((A.mezcla.pctDespido ?? 0) * 100)}%</span></div>
    <div class="kpi-eti"><span class="verde">renuncias</span> vs <span class="ambar">despidos</span> (mezcla real)</div>
  </div>
  <div class="kpi">
    <div class="kpi-valor">${fmtNum(A.totales.abiertas)}</div>
    <div class="kpi-eti">vacantes abiertas hoy</div>
  </div>`;
}
pintarKpis();

// ── tarjeta del supuesto (solo si hay salidas sin clasificar) ──────────────
if (supuesto) {
  const card = document.getElementById('supuesto-sintipo');
  card.hidden = false;
  card.innerHTML = `
    <h3>⚠️ Supuesto: las ${fmtNum(salidasSinTipo)} salidas en tiendas sin clasificar</h3>
    <p style="font-size:13.5px; margin-bottom:4px">Estas salidas ocurrieron en tiendas que aún no tienen
      tipo asignado (AA/A/B/C), así que su costo no sale de datos: <b>lo que sigue es UN SUPUESTO editable</b>.
      Reparte las ${fmtNum(salidasSinTipo)} salidas entre los tipos; por defecto asumimos 80% tipo B y el resto C.</p>
    <div class="sup-inputs">
      ${ORDEN_TIPOS.map((t) => `<label>${t}
        <input type="number" inputmode="numeric" id="sup-${t}" min="0" max="${salidasSinTipo}" step="1" value="${supuesto[t]}">
      </label>`).join('')}
    </div>
    <p id="sup-aviso" style="font-size:13px; font-weight:600; color:var(--rojo); margin:4px 0"></p>
    <p style="font-size:13.5px">Costo estimado con este supuesto: <b class="num" id="sup-total"></b>
      <span style="color:var(--tinta-suave)">(usando la mezcla real de esas salidas: ${fmtNum(st.renuncia)} renuncias y ${fmtNum(st.despido)} despidos)</span></p>
    <p class="pie">Este supuesto desaparece solo cuando las tiendas se clasifiquen en el archivo de tiendas — ahí el costo pasa a ser dato, no estimación.</p>`;
  const pintarSupuesto = () => {
    const suma = ORDEN_TIPOS.reduce((s, t) => s + (supuesto[t] || 0), 0);
    document.getElementById('sup-aviso').textContent =
      suma === salidasSinTipo ? '' : `Ojo: estás repartiendo ${fmtNum(suma)} salidas y son ${fmtNum(salidasSinTipo)}.`;
    document.getElementById('sup-total').textContent = fmtQ(costoSupuesto());
    pintarKpis();
  };
  for (const t of ORDEN_TIPOS) {
    document.getElementById(`sup-${t}`).oninput = (e) => {
      supuesto[t] = Math.max(0, Math.floor(+e.target.value || 0));
      pintarSupuesto();
    };
  }
  pintarSupuesto();
}

// ── tarjetas por tipo con barra de composición ─────────────────────────────
const NOMBRE_TIPO = {
  AA: 'Tienda AA · ventas arriba de Q1M/mes',
  A: 'Tienda A · Q500k–Q1M/mes',
  B: 'Tienda B · Q300k–500k/mes',
  C: 'Tienda C · abajo de Q300k/mes',
};
function barraComposicion(c, escenario) {
  const t = c.total;
  const seg = (v, clase, titulo) =>
    `<div class="${clase}" style="width:${(v / t) * 100}%" title="${titulo}: ${fmtQ(v)}"></div>`;
  return `<div class="comp">
    ${seg(c.composicion.productividad, 'c-prod', 'Productividad perdida')}
    ${seg(c.composicion.cobertura, 'c-cob', 'Cobertura interna')}
    ${seg(c.composicion.reclutamiento, 'c-rec', 'Reclutamiento')}
    ${seg(c.composicion.salida, escenario === 'renuncia' ? 'c-sal-r' : 'c-sal-d', 'Costo de salida')}
  </div>`;
}
document.getElementById('tarjetas-tipo').innerHTML = detallePorTipo.map((d) => `
  <div class="tarjeta">
    <h3>${NOMBRE_TIPO[d.tipo]}</h3>
    <div style="display:flex; justify-content:space-between; align-items:baseline; gap:8px;">
      <span><span class="pill verde">Renuncia</span> <span class="una-salida">cada una cuesta</span></span>
      <b class="num" style="font-size:20px">${fmtQ(d.cR.total)}</b>
    </div>
    ${barraComposicion(d.cR, 'renuncia')}
    <div style="display:flex; justify-content:space-between; align-items:baseline; gap:8px; margin-top:10px;">
      <span><span class="pill ambar">Despido</span> <span class="una-salida">cada uno cuesta</span></span>
      <b class="num" style="font-size:20px">${fmtQ(d.cD.total)}</b>
    </div>
    ${barraComposicion(d.cD, 'despido')}
    <div class="leyenda">
      <span><i style="background:#46615A"></i>Productividad perdida</span>
      <span><i style="background:#C9CFC9"></i>Cobertura interna</span>
      <span><i style="background:#8FA69B"></i>Reclutamiento</span>
      <span><i style="background:#0B7A55"></i>Finiquito (renuncia)</span>
      <span><i style="background:#B5741A"></i>Indemnización (despido)</span>
    </div>
    <div class="anual">
      <div class="anual-eti">Acumulado anual de este tipo (volumen × costo)</div>
      <div><b class="num anual-num">${fmtQ(d.anual)}</b>
        <span class="anual-det">= ${fmtNum(d.salidas.renuncia)} ${d.salidas.renuncia === 1 ? 'renuncia' : 'renuncias'} + ${fmtNum(d.salidas.despido)} ${d.salidas.despido === 1 ? 'despido' : 'despidos'} en 12 meses</span></div>
      <div class="anual-det">Días de vacante usados: ${d.cal.dias} (${d.cal.fuente}).</div>
    </div>
  </div>`).join('');

// ── hallazgos generados de los datos ───────────────────────────────────────
const hallazgos = [];

// 1. días reales vs supuesto del modelo
const promedioDias = A.diasCobertura.global.promedio;
if (medianaDias != null && medianaDias < PARAMS_DEFECTO.diasVacante) {
  hallazgos.push(`Una vacante típica se cubre en <b>${medianaDias} días</b> (mediana real; el promedio es ${promedioDias} porque algunos casos largos lo suben). Está por debajo de los 30 días que asumía el modelo — este resumen ya usa los días reales.`);
} else if (medianaDias != null && medianaDias > PARAMS_DEFECTO.diasVacante) {
  hallazgos.push(`Las vacantes tardan <b>${medianaDias} días</b> (mediana real; promedio ${promedioDias}) en cubrirse, por encima del supuesto de 30 días del modelo: el costo real es mayor que el teórico.`);
}

// 2. mezcla renuncia/despido
if (A.mezcla.pctRenuncia != null) {
  const extraDespido = detallePorTipo.length
    ? detallePorTipo[0].cD.total - detallePorTipo[0].cR.total : null;
  hallazgos.push(`De cada 100 salidas que generan vacante, <b>${Math.round(A.mezcla.pctRenuncia * 100)} son renuncias</b> y <b>${Math.round(A.mezcla.pctDespido * 100)} despidos</b>.${extraDespido ? ` Cada despido cuesta <b>${fmtQ(extraDespido)}</b> más que una renuncia (indemnización), pero el grueso del costo anual viene del volumen de renuncias.` : ''}`);
}

// 3. dónde se concentran las salidas
const topTipo = [...detallePorTipo].sort((a, b) => b.anual - a.anual)[0];
if (topTipo && costoAnual > 0) {
  hallazgos.push(`Las tiendas <b>tipo ${topTipo.tipo}</b> concentran la mayor parte del costo: <b>${fmtQ(topTipo.anual)}</b> en 12 meses (${Math.round((topTipo.anual / costoAnual) * 100)}% del total costeado), entre volumen de salidas y ventas en riesgo.`);
}

// 4. (si aplica) salidas sin clasificar
if (salidasSinTipo >= salidasCosteadas * 0.25) {
  hallazgos.push(`Hay <b>${fmtNum(salidasSinTipo)} salidas</b> en tiendas todavía sin tipo (Catocha, Petapa, etc.). Su costo se estima con un <b>supuesto ajustable</b> (arriba); clasificarlas en el archivo de tiendas reemplaza el supuesto por el dato real.`);
}

document.getElementById('hallazgos').innerHTML =
  hallazgos.slice(0, 3 + (salidasSinTipo >= salidasCosteadas * 0.25 ? 1 : 0))
    .map((h) => `<div class="hallazgo">${h}</div>`).join('');

// ── calidad ────────────────────────────────────────────────────────────────
document.getElementById('calidad').innerHTML = meta.calidad
  .map((c) => `<li class="${c.tipo === 'error' ? 'error' : ''}">${c.mensaje}</li>`).join('')
  || '<li>Sin observaciones.</li>';

pintarPie(meta);

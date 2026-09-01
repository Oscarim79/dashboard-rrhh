// Página Simulador: todos los supuestos del modelo con sliders,
// botón "usar datos reales" (calibración) y escenario "vacante a la mitad de días".
import { costoSalida, PARAMS_DEFECTO, VENTAS_TIPO, ORDEN_TIPOS, fmtQ } from './modelo.js';
import { cargarDatos, pintarPie, marcarNavActiva, fmtNum } from './comun.js';

marcarNavActiva();
const { vacantes, meta } = await cargarDatos();
const A = vacantes.agregados;

// ── definición de controles ────────────────────────────────────────────────
const fq = (v) => fmtQ(v);
const fd = (v) => `${v} días`;
const fp = (v) => Math.round(v * 100) + '%';
const CONTROLES = [
  { grupo: 'Vacante y ventas' },
  { k: 'diasVacante', eti: 'Días que dura la vacante', min: 1, max: 90, step: 1, fmt: fd },
  { k: 'factorImpacto', eti: 'Impacto en ventas mientras falta gente', min: 0, max: 0.5, step: 0.01, fmt: fp },
  { f: 'iv' },
  { grupo: 'Curva de aprendizaje del nuevo' },
  { k: 'mesesCurva', eti: 'Meses de curva', min: 0, max: 6, step: 0.5, fmt: (v) => `${v} meses` },
  { k: 'prodCurva', eti: 'Productividad durante la curva', min: 0, max: 1, step: 0.05, fmt: fp },
  { k: 'salarioVendedor', eti: 'Salario del vendedor', min: 3000, max: 15000, step: 100, fmt: fq },
  { f: 'cp' },
  { grupo: 'Cobertura interna' },
  { k: 'salarioJefe', eti: 'Salario del jefe de tienda', min: 3000, max: 20000, step: 100, fmt: fq },
  { k: 'semanasJefe', eti: 'Semanas que el jefe cubre el puesto', min: 0, max: 16, step: 1, fmt: (v) => `${v} sem` },
  { k: 'pctJefe', eti: 'Tiempo del jefe dedicado a cubrir', min: 0, max: 1, step: 0.05, fmt: fp },
  { f: 'jefe' },
  { k: 'salarioCoord', eti: 'Salario coordinadora RRHH', min: 2000, max: 12000, step: 100, fmt: fq },
  { k: 'semanasCoord', eti: 'Semanas de apoyo de coordinadora', min: 0, max: 16, step: 1, fmt: (v) => `${v} sem` },
  { k: 'pctCoord', eti: 'Tiempo de coordinadora dedicado', min: 0, max: 1, step: 0.05, fmt: fp },
  { k: 'probCoord', eti: 'Probabilidad de ese apoyo', min: 0, max: 1, step: 0.05, fmt: fp },
  { f: 'coord' },
  { k: 'overtime', eti: 'Sobrecarga / overtime del equipo', min: 0, max: 6000, step: 100, fmt: fq },
  { k: 'retrabajo', eti: 'Retrabajo por errores', min: 0, max: 3000, step: 100, fmt: fq },
  { f: 'sobrecarga' },
  { grupo: 'Reclutamiento y contratación' },
  { k: 'kit', eti: 'Kit de ingreso', min: 0, max: 2000, step: 50, fmt: fq },
  { k: 'poligrafo', eti: 'Polígrafo', min: 0, max: 6000, step: 100, fmt: fq },
  { k: 'viaticos', eti: 'Viáticos', min: 0, max: 5000, step: 100, fmt: fq },
  { f: 'directos' },
  { k: 'pautaRedesMes', eti: 'Pauta en redes (Q/mes)', min: 0, max: 15000, step: 500, fmt: fq },
  { k: 'volanteoBimestre', eti: 'Volanteo y roll-ups (Q/bimestre)', min: 0, max: 15000, step: 500, fmt: fq },
  { k: 'radioBimestre', eti: 'Radio (Q/bimestre)', min: 0, max: 10000, step: 500, fmt: fq },
  { k: 'internetMes', eti: 'Internet (Q/mes)', min: 0, max: 15000, step: 500, fmt: fq },
  { k: 'contratacionesMes', eti: 'Contrataciones promedio al mes', min: 1, max: 30, step: 1, fmt: (v) => `${v}` },
  { f: 'atraccion' },
  { grupo: 'Costo de salida' },
  { k: 'isRenuncia', eti: 'Finiquito estimado por renuncia', min: 0, max: 10000, step: 250, fmt: fq },
  { k: 'aniosServicio', eti: 'Años de servicio (indemnización por despido)', min: 0, max: 10, step: 0.5, fmt: (v) => `${v} años` },
  { f: 'salida' },
  { f: 'total' },
];

// ── fórmulas con los números actuales sustituidos (se recalculan en vivo) ──
// p = supuestos, v = ventas de la tienda, r/d = resultado renuncia/despido
const FORMULAS = {
  iv: (p, v, r) =>
    `<b>Ventas que se pierden</b> = ventas del mes × impacto × (días de vacante ÷ 30)<br>` +
    `= ${fq(v)} × ${fp(p.factorImpacto)} × (${p.diasVacante} ÷ 30) = <b>${fq(r.iv)}</b>`,
  cp: (p, v, r) =>
    `<b>Costo de la curva</b> = salario × meses × lo que el nuevo aún no produce (100% − ${fp(p.prodCurva)})<br>` +
    `= ${fq(p.salarioVendedor)} × ${p.mesesCurva} × ${fp(1 - p.prodCurva)} = <b>${fq(r.cp)}</b>`,
  jefe: (p, v, r) =>
    `<b>Costo del jefe</b> = (salario ÷ 4.33 semanas del mes) × semanas × % de su tiempo<br>` +
    `= (${fq(p.salarioJefe)} ÷ 4.33) × ${p.semanasJefe} × ${fp(p.pctJefe)} = <b>${fq(r.jefe)}</b>`,
  coord: (p, v, r) =>
    `<b>Costo de coordinadora</b> = (salario ÷ 4.33) × semanas × % de su tiempo × probabilidad de que apoye<br>` +
    `= (${fq(p.salarioCoord)} ÷ 4.33) × ${p.semanasCoord} × ${fp(p.pctCoord)} × ${fp(p.probCoord)} = <b>${fq(r.coord)}</b>`,
  sobrecarga: (p) =>
    `<b>Sobrecarga del equipo</b>: se suman tal cual → ${fq(p.overtime)} + ${fq(p.retrabajo)} = <b>${fq(p.overtime + p.retrabajo)}</b>`,
  directos: (p) =>
    `<b>Gastos de contratación</b>: se suman tal cual → kit ${fq(p.kit)} + polígrafo ${fq(p.poligrafo)} + viáticos ${fq(p.viaticos)} = <b>${fq(p.kit + p.poligrafo + p.viaticos)}</b>`,
  atraccion: (p, v, r) =>
    `<b>Publicidad por contratación</b> = (pauta + volanteo÷2 + radio÷2 + internet) ÷ contrataciones del mes<br>` +
    `= (${fq(p.pautaRedesMes)} + ${fq(p.volanteoBimestre / 2)} + ${fq(p.radioBimestre / 2)} + ${fq(p.internetMes)}) ÷ ${p.contratacionesMes} = <b>${fq(r.atraccion)}</b><br>` +
    `El volanteo y la radio se pagan por bimestre: se toma la mitad para un mes.`,
  salida: (p) =>
    `<b>Renuncia</b>: se paga el finiquito tal cual = <b>${fq(p.isRenuncia)}</b><br>` +
    `<b>Despido</b>: indemnización = salario × años de servicio = ${fq(p.salarioVendedor)} × ${p.aniosServicio} = <b>${fq(p.salarioVendedor * p.aniosServicio)}</b>`,
  total: (p, v, r, d) =>
    `<b>Suma final</b> = ventas perdidas + curva + cobertura interna + reclutamiento + costo de salida<br>` +
    `Cada <b>renuncia</b> = ${fq(r.iv)} + ${fq(r.cp)} + ${fq(r.composicion.cobertura)} + ${fq(r.composicion.reclutamiento)} + ${fq(r.composicion.salida)} = <b>${fq(r.total)}</b><br>` +
    `Cada <b>despido</b> = igual, pero con la indemnización: … + ${fq(d.composicion.salida)} = <b>${fq(d.total)}</b>`,
};

let params = { ...PARAMS_DEFECTO };
let ventas = VENTAS_TIPO.AA;
let tipoSel = 'AA';
let escenarioNota = '';

// ── selector de tipo ───────────────────────────────────────────────────────
const NOMBRE_TIPO = { AA: 'AA (ventas arriba de Q1M)', A: 'A (Q500k a 1M)', B: 'B (Q300 a 500k)', C: 'C (abajo de Q300k)' };
const selTipo = document.getElementById('tipo');
selTipo.innerHTML = ORDEN_TIPOS.map((t) => `<option value="${t}">${NOMBRE_TIPO[t]}</option>`).join('');
selTipo.onchange = () => { tipoSel = selTipo.value; ventas = VENTAS_TIPO[tipoSel]; sincronizar(); };

const slVentas = document.getElementById('ventas');
slVentas.oninput = () => { ventas = +slVentas.value; recalcular(); };

// ── render de controles ────────────────────────────────────────────────────
document.getElementById('controles').innerHTML = CONTROLES.map((c) =>
  c.grupo ? `<h3 style="margin:14px 0 8px">${c.grupo}</h3>`
  : c.f ? `<div class="formula" id="f-${c.f}"></div>`
  : `<div class="control">
       <label>${c.eti} <b id="v-${c.k}"></b></label>
       <input type="range" id="sl-${c.k}" min="${c.min}" max="${c.max}" step="${c.step}">
     </div>`).join('');
for (const c of CONTROLES) {
  if (!c.k) continue;
  const sl = document.getElementById(`sl-${c.k}`);
  sl.oninput = () => { params[c.k] = +sl.value; escenarioNota = ''; recalcular(); };
}

function sincronizar() {
  for (const c of CONTROLES) {
    if (!c.k) continue;
    document.getElementById(`sl-${c.k}`).value = params[c.k];
  }
  slVentas.value = ventas;
  recalcular();
}

// ── resultados ─────────────────────────────────────────────────────────────
const filaComp = (c, clase) => {
  const t = c.total;
  return `<div class="comp">
    <div class="c-prod" style="width:${(c.composicion.productividad / t) * 100}%"></div>
    <div class="c-cob" style="width:${(c.composicion.cobertura / t) * 100}%"></div>
    <div class="c-rec" style="width:${(c.composicion.reclutamiento / t) * 100}%"></div>
    <div class="${clase}" style="width:${(c.composicion.salida / t) * 100}%"></div>
  </div>`;
};

function recalcular() {
  for (const c of CONTROLES) {
    if (!c.k) continue;
    document.getElementById(`v-${c.k}`).textContent = c.fmt(params[c.k]);
  }
  document.getElementById('v-ventas').textContent = fmtQ(ventas);

  const r = costoSalida(ventas, 'renuncia', params);
  const d = costoSalida(ventas, 'despido', params);
  for (const [k, fn] of Object.entries(FORMULAS)) {
    document.getElementById(`f-${k}`).innerHTML = fn(params, ventas, r, d);
  }
  document.getElementById('resultado').innerHTML = `
    <div class="kpi">
      <div class="kpi-valor verde">${fmtQ(r.total)}</div>
      <div class="kpi-eti">cuesta cada <b>renuncia</b> en esta tienda</div>
      ${filaComp(r, 'c-sal-r')}
    </div>
    <div class="kpi">
      <div class="kpi-valor ambar">${fmtQ(d.total)}</div>
      <div class="kpi-eti">cuesta cada <b>despido</b> en esta tienda</div>
      ${filaComp(d, 'c-sal-d')}
    </div>
    <div class="leyenda" style="grid-column: 1 / -1;">
      <span><i style="background:#46615A"></i>Productividad perdida</span>
      <span><i style="background:#C9CFC9"></i>Cobertura interna</span>
      <span><i style="background:#8FA69B"></i>Reclutamiento</span>
      <span><i style="background:#0B7A55"></i>Finiquito (renuncia)</span>
      <span><i style="background:#B5741A"></i>Indemnización (despido)</span>
    </div>`;

  // proyección anual con salidas reales del tipo elegido y mezcla real
  const s = A.salidas12mPorTipo[tipoSel];
  const el = document.getElementById('proyeccion');
  if (s) {
    const anual = s.renuncia * r.total + s.despido * d.total;
    el.innerHTML = `<h3>Proyección anual · tiendas tipo ${tipoSel}</h3>
      <p style="font-size:15px">Con las salidas reales de los últimos 12 meses (${fmtNum(s.renuncia)} renuncias, ${fmtNum(s.despido)} despidos) y estos supuestos:
      <b class="num" style="font-size:20px"> ${fmtQ(anual)}</b> al año.</p>`;
  } else {
    el.innerHTML = `<h3>Proyección anual · tiendas tipo ${tipoSel}</h3>
      <p class="sub">No hubo salidas registradas en tiendas de este tipo en los últimos 12 meses.</p>`;
  }
  document.getElementById('nota-escenario').textContent = escenarioNota;
}

// ── botones ────────────────────────────────────────────────────────────────
document.getElementById('btn-reales').onclick = () => {
  const g = A.diasCobertura.global;
  params = { ...params, diasVacante: g.mediana };
  escenarioNota = `Calibrado con datos reales: la vacante dura ${g.mediana} días (mediana de ${g.n} vacantes cerradas). La mezcla real es ${Math.round(A.mezcla.pctRenuncia * 100)}% renuncias / ${Math.round(A.mezcla.pctDespido * 100)}% despidos.`;
  sincronizar();
};
document.getElementById('btn-mitad').onclick = () => {
  const antes = params.diasVacante;
  const r0 = costoSalida(ventas, 'renuncia', params).total;
  params = { ...params, diasVacante: Math.max(1, Math.round(antes / 2)) };
  const r1 = costoSalida(ventas, 'renuncia', params).total;
  escenarioNota = `Escenario: si la vacante se cubriera en ${params.diasVacante} días en vez de ${antes}, cada renuncia costaría ${fmtQ(r1)} (ahorro de ${fmtQ(r0 - r1)} por salida).`;
  sincronizar();
};
document.getElementById('btn-reset').onclick = () => {
  params = { ...PARAMS_DEFECTO };
  ventas = VENTAS_TIPO[tipoSel];
  escenarioNota = '';
  sincronizar();
};

sincronizar();
pintarPie(meta);

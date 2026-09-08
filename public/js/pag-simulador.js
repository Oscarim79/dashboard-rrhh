// Página Simulador: todos los supuestos del modelo con sliders,
// botón "usar datos reales" (calibración) y escenario "vacante a la mitad de días".
import { costoSalida, PARAMS_DEFECTO, VENTAS_TIPO, ORDEN_TIPOS, fmtQ } from './modelo.js';
import { cargarDatos, pintarPie, marcarNavActiva, fmtNum, pintarSelectorDepto, vacantesDe, notaAlcance,
  pintarSelectorPeriodo, vacantesEnPeriodo, agregarVacantes, etiquetaPeriodo, aniosYMeses, salidasDe, dimsSalidas } from './comun.js';

marcarNavActiva();
const datos = await cargarDatos();
const { meta } = datos;
const salidasTodo = await fetch('data/salidas.json', { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
let salidasPorTipo = {}; // salidas del período por tipo de tienda (registro de SALIDAS)
let mezclaSalidas = { pctRenuncia: null, pctDespido: null }; // renuncias vs despidos (registro de SALIDAS)
// El modelo de costo es el mismo con cualquier alcance (es por tipo de tienda); el selector
// solo cambia los datos reales con que se calibra (días de vacante, mezcla y salidas por tipo).
let A = datos.vacantes.agregados;
let deptoSel = 'comercial', periodoSel = '12m';
function aplicarFiltros() {
  const v = vacantesDe(datos.vacantes, deptoSel);
  A = agregarVacantes(vacantesEnPeriodo(v.filas, periodoSel, v.generado));
  const dz = dimsSalidas(salidasDe(salidasTodo, deptoSel), periodoSel);
  salidasPorTipo = dz.porTipoTienda ?? {};
  const rd = (dz.razon?.RENUNCIA ?? 0) + (dz.razon?.DESPIDO ?? 0);
  mezclaSalidas = { pctRenuncia: rd ? (dz.razon.RENUNCIA ?? 0) / rd : null, pctDespido: rd ? (dz.razon.DESPIDO ?? 0) / rd : null };
  document.getElementById('alcance').innerHTML = notaAlcance(deptoSel) +
    ` El modelo de costo no cambia con los selectores; solo cambian los datos reales con que se calibra (días de vacante, mezcla y salidas por tipo · ${etiquetaPeriodo(periodoSel, v.generado)}).`;
}
deptoSel = pintarSelectorDepto((d) => { deptoSel = d; aplicarFiltros(); sincronizar(); });
periodoSel = pintarSelectorPeriodo({ ...aniosYMeses({ vacantes: datos.vacantes }), generado: datos.vacantes.generado },
  (p) => { periodoSel = p; aplicarFiltros(); sincronizar(); });
aplicarFiltros();

// ── definición de controles ────────────────────────────────────────────────
const fq = (v) => fmtQ(v);
const fd = (v) => `${v} días`;
const fp = (v) => Math.round(v * 100) + '%';
const fMeses = (m) => {
  const a = Math.floor(m / 12), r = m % 12;
  const pa = a ? `${a} ${a === 1 ? 'año' : 'años'}` : '';
  const pr = r ? `${r} ${r === 1 ? 'mes' : 'meses'}` : '';
  return pa && pr ? `${pa} y ${pr}` : pa || pr || '0 meses';
};
// fijo: true → se muestra el valor pero no hay slider (gastos reales de la empresa)
const CONTROLES = [
  { grupo: 'Vacante y ventas' },
  { k: 'diasVacante', eti: 'Días que dura la vacante', min: 1, max: 90, step: 1, fmt: fd },
  { k: 'factorImpacto', eti: 'Impacto en ventas mientras falta gente', min: 0, max: 0.5, step: 0.01, fmt: fp },
  { f: 'iv' },
  { grupo: 'Curva de aprendizaje del nuevo' },
  { k: 'mesesCurva', eti: 'Meses de curva', min: 0, max: 6, step: 0.5, fmt: (v) => `${v} meses` },
  { k: 'prodCurva', eti: 'Productividad durante la curva', min: 0, max: 1, step: 0.05, fmt: fp },
  { k: 'salarioNuevo', eti: 'Salario del vendedor nuevo (sus primeros meses)', min: 3000, max: 15000, step: 100, fmt: fq },
  { f: 'cp' },
  { grupo: 'Cobertura interna: quién hace el trabajo del vendedor que falta',
    nota: 'Mientras la plaza está vacía, ese trabajo lo tapan dos personas que ya tienen sueldo: ' +
      'el <b>jefe de tienda</b> (siempre, con parte de su jornada) y la <b>coordinadora de RRHH</b>, ' +
      'que es el comodín que RRHH manda a la tienda cuando se puede. Se cuenta el tiempo pagado que ' +
      'cada uno desvía a cubrir la plaza; lo que ninguno alcanza a tapar lo carga el equipo (sobrecarga).' },
  { k: 'salarioJefe', eti: 'Salario del jefe de tienda', min: 3000, max: 20000, step: 100, fmt: fq },
  { k: 'semanasJefe', eti: 'Semanas que el jefe cubre la plaza', min: 0, max: 16, step: 1, fmt: (v) => `${v} sem` },
  { k: 'pctJefe', eti: 'Parte de su jornada que dedica a cubrirla', min: 0, max: 1, step: 0.05, fmt: fp },
  { f: 'jefe' },
  { k: 'salarioCoord', eti: 'Salario de la coordinadora de RRHH (comodín)', min: 2000, max: 12000, step: 100, fmt: fq },
  { k: 'semanasCoord', eti: 'Semanas que la coordinadora cubre la plaza', min: 0, max: 16, step: 1, fmt: (v) => `${v} sem` },
  { k: 'pctCoord', eti: 'Parte de su jornada que dedica a cubrirla', min: 0, max: 1, step: 0.05, fmt: fp },
  { k: 'probCoord', eti: 'En cuántas vacantes se logra mandarla', min: 0, max: 1, step: 0.05, fmt: fp },
  { f: 'coord' },
  { k: 'overtime', eti: 'Sobrecarga / overtime del equipo', min: 0, max: 6000, step: 100, fmt: fq },
  { k: 'retrabajo', eti: 'Retrabajo por errores', min: 0, max: 3000, step: 100, fmt: fq },
  { f: 'sobrecarga' },
  { grupo: 'Reclutamiento y contratación',
    nota: 'Estos son gastos reales y fijos de la empresa: se muestran como referencia y no se pueden mover.' },
  { k: 'kit', eti: 'Kit de ingreso', fijo: true, fmt: fq },
  { k: 'poligrafo', eti: 'Polígrafo', fijo: true, fmt: fq },
  { k: 'viaticos', eti: 'Viáticos', fijo: true, fmt: fq },
  { f: 'directos' },
  { k: 'pautaRedesMes', eti: 'Pauta en redes (Q/mes)', fijo: true, fmt: fq },
  { k: 'volanteoBimestre', eti: 'Volanteo y roll-ups (Q/bimestre)', fijo: true, fmt: fq },
  { k: 'radioBimestre', eti: 'Radio (Q/bimestre)', fijo: true, fmt: fq },
  { k: 'internetMes', eti: 'Internet (Q/mes)', fijo: true, fmt: fq },
  { k: 'contratacionesMes', eti: 'Contrataciones promedio al mes', fijo: true, fmt: (v) => `${v}` },
  { f: 'atraccion' },
  { k: 'salarioJefeRRHH', eti: 'Salario del jefe de RRHH', fijo: true, fmt: fq },
  { k: 'pctJefeRRHH', eti: 'Tiempo del jefe de RRHH en reclutar', fijo: true, fmt: fp },
  { f: 'rrhh' },
  { grupo: 'Costo de salida' },
  { k: 'isRenuncia', eti: 'Finiquito estimado por renuncia', min: 0, max: 10000, step: 250, fmt: fq },
  { k: 'salarioVendedor', eti: 'Salario promedio del vendedor que sale', min: 3000, max: 15000, step: 100, fmt: fq },
  { k: 'mesesServicio', eti: 'Tiempo de servicio (indemnización por despido)', min: 0, max: 120, step: 1, fmt: fMeses },
  { f: 'salida' },
  { f: 'total' },
];

// ── fórmulas con los números actuales sustituidos (se recalculan en vivo) ──
// p = supuestos, v = ventas de la tienda, r/d = resultado renuncia/despido
const FORMULAS = {
  iv: (p, v, r) =>
    `<b>Ventas que se pierden</b> = ventas del mes × impacto × (días de vacante ÷ 30)<br>` +
    `= ${fq(v)} × ${fp(p.factorImpacto)} × (${p.diasVacante} ÷ 30) = <b>${fq(r.iv)}</b><br>` +
    `¿De dónde sale el impacto (15% inicial)? La mayoría de tiendas opera con 3 vendedores, ` +
    `1 jefe y 1 asistente: un vendedor menos es el 20–33% de la capacidad de venta. Asumir solo ` +
    `15% ya da por hecho que el resto del equipo cubre buena parte. Muévelo para probar otros escenarios.`,
  cp: (p, v, r) =>
    `<b>Costo de la curva</b> = salario del nuevo × meses × lo que aún no produce (100% − ${fp(p.prodCurva)})<br>` +
    `= ${fq(p.salarioNuevo)} × ${p.mesesCurva} × ${fp(1 - p.prodCurva)} = <b>${fq(r.cp)}</b><br>` +
    `Se usa lo que gana un vendedor en sus primeros meses (${fq(p.salarioNuevo)}), no el salario promedio.`,
  jefe: (p, v, r) =>
    `<b>Tiempo del jefe de tienda cubriendo la plaza</b> = (salario ÷ 4.33 semanas del mes) × semanas × parte de su jornada<br>` +
    `= (${fq(p.salarioJefe)} ÷ 4.33) × ${p.semanasJefe} × ${fp(p.pctJefe)} = <b>${fq(r.jefe)}</b><br>` +
    `El jefe es quien primero tapa el hueco: atiende y vende en lugar del vendedor que falta. ` +
    `Ese tiempo se lo quita a su propio trabajo y ya está pagado, por eso cuenta como costo.`,
  coord: (p, v, r) =>
    `<b>Apoyo de la coordinadora de RRHH</b> = (salario ÷ 4.33) × semanas × parte de su jornada × en cuántas vacantes va<br>` +
    `= (${fq(p.salarioCoord)} ÷ 4.33) × ${p.semanasCoord} × ${fp(p.pctCoord)} × ${fp(p.probCoord)} = <b>${fq(r.coord)}</b><br>` +
    `La coordinadora es el comodín: RRHH la manda a la tienda a cubrir la plaza mientras llega el reemplazo. ` +
    `Solo hay una para todas las tiendas, así que no llega a todas las vacantes: ${fp(p.probCoord)} quiere decir ` +
    `que ese porcentaje de las vacantes recibe su apoyo. Es un costo aparte del jefe porque son dos personas ` +
    `distintas cuyo tiempo pagado se desvía a la misma plaza vacía.`,
  sobrecarga: (p) =>
    `<b>Sobrecarga del equipo</b>: se suman tal cual → ${fq(p.overtime)} + ${fq(p.retrabajo)} = <b>${fq(p.overtime + p.retrabajo)}</b>`,
  directos: (p) =>
    `<b>Gastos de contratación</b> (fijos): se suman tal cual → kit ${fq(p.kit)} + polígrafo ${fq(p.poligrafo)} + viáticos ${fq(p.viaticos)} = <b>${fq(p.kit + p.poligrafo + p.viaticos)}</b>`,
  atraccion: (p, v, r) =>
    `<b>Publicidad por contratación</b> = (pauta + volanteo÷2 + radio÷2 + internet) ÷ contrataciones del mes<br>` +
    `= (${fq(p.pautaRedesMes)} + ${fq(p.volanteoBimestre / 2)} + ${fq(p.radioBimestre / 2)} + ${fq(p.internetMes)}) ÷ ${p.contratacionesMes} = <b>${fq(r.atraccion)}</b><br>` +
    `El volanteo y la radio se pagan por bimestre: se toma la mitad para un mes.`,
  rrhh: (p, v, r) =>
    `<b>Jefe de RRHH por contratación</b> = salario × % de su tiempo en reclutar ÷ contrataciones del mes<br>` +
    `= (${fq(p.salarioJefeRRHH)} × ${fp(p.pctJefeRRHH)}) ÷ ${p.contratacionesMes} = <b>${fq(r.rrhh)}</b><br>` +
    `Su costo se reparte porque entrevista para todas las vacantes del mes, no solo para una.`,
  salida: (p, v, r, d) =>
    `<b>Renuncia</b>: se paga el finiquito tal cual = <b>${fq(p.isRenuncia)}</b><br>` +
    `<b>Despido</b>: indemnización = un salario por año de servicio, proporcional a los meses<br>` +
    `= ${fq(p.salarioVendedor)} × (${p.mesesServicio} meses ÷ 12) = <b>${fq(d.salida)}</b><br>` +
    `Se usa el salario promedio del vendedor que sale (${fq(p.salarioVendedor)}), no el del nuevo.`,
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
  c.grupo ? `<h3 style="margin:14px 0 8px">${c.grupo}</h3>${c.nota ? `<p class="sub nota-grupo">${c.nota}</p>` : ''}`
  : c.f ? `<div class="formula" id="f-${c.f}"></div>`
  : c.fijo ? `<div class="control fijo"><label>${c.eti} <span><b id="v-${c.k}"></b><em>fijo</em></span></label></div>`
  : `<div class="control">
       <label>${c.eti} <b id="v-${c.k}"></b></label>
       <input type="range" id="sl-${c.k}" min="${c.min}" max="${c.max}" step="${c.step}">
     </div>`).join('');
for (const c of CONTROLES) {
  if (!c.k || c.fijo) continue;
  const sl = document.getElementById(`sl-${c.k}`);
  sl.oninput = () => { params[c.k] = +sl.value; escenarioNota = ''; recalcular(); };
}

function sincronizar() {
  for (const c of CONTROLES) {
    if (!c.k || c.fijo) continue;
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
  const s = salidasPorTipo[tipoSel];
  const el = document.getElementById('proyeccion');
  const etiP = etiquetaPeriodo(periodoSel, datos.vacantes.generado);
  if (s) {
    const anual = s.renuncia * r.total + s.despido * d.total;
    el.innerHTML = `<h3>Proyección · tiendas tipo ${tipoSel} · ${etiP}</h3>
      <p style="font-size:15px">Con las salidas reales del período según el registro de salidas (${fmtNum(s.renuncia)} renuncias, ${fmtNum(s.despido)} despidos) y estos supuestos:
      <b class="num" style="font-size:20px"> ${fmtQ(anual)}</b>.</p>`;
  } else {
    el.innerHTML = `<h3>Proyección · tiendas tipo ${tipoSel} · ${etiP}</h3>
      <p class="sub">No hubo salidas registradas en tiendas de este tipo en ${etiP}.</p>`;
  }
  document.getElementById('nota-escenario').textContent = escenarioNota;
}

// ── botones ────────────────────────────────────────────────────────────────
document.getElementById('btn-reales').onclick = () => {
  const g = A.diasCobertura.global;
  if (g.mediana == null) { escenarioNota = 'No hay vacantes cerradas con dato en el período elegido: no se puede calibrar. Cambia el período arriba.'; sincronizar(); return; }
  params = { ...params, diasVacante: g.mediana };
  escenarioNota = `Calibrado con datos reales (${etiquetaPeriodo(periodoSel, datos.vacantes.generado)}): la vacante dura ${g.mediana} días (mediana de ${g.n === 1 ? '1 vacante cerrada' : `${g.n} vacantes cerradas`}). ${mezclaSalidas.pctRenuncia != null ? `La mezcla real (registro de salidas) es ${Math.round(mezclaSalidas.pctRenuncia * 100)}% renuncias / ${Math.round(mezclaSalidas.pctDespido * 100)}% despidos.` : ''}`;
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

// Página Rotación: acumulado por año, comercial vs total, bajas mensuales y por departamento.
// Selector General / Comercial: el indicador del sheet ya trae el área de cada fila
// (TOTAL EMPRESA / AREA COMERCIAL en el acumulado; DEPARTAMENTO en el mensual).
// Selector de período: los KPI se leen al último mes del período; las gráficas
// muestran los meses del período (un mes concreto se muestra con su año de contexto).
import { cargarDatos, pintarPie, marcarNavActiva, fmtNum, pintarSelectorDepto, notaAlcance,
  pintarSelectorPeriodo, etiquetaPeriodo, rangoPeriodo, mesesDelPeriodo, aniosYMeses, MES_CORTO, fmtYm, marcaActual, etiquetaMarca, MARCAS } from './comun.js';
import { barrasH, columnas, lineas, leyenda } from './graficas.js';
import { fmtPct } from './modelo.js';

marcarNavActiva();
const { rotacion, meta } = await cargarDatos();
const pct0 = (v) => Math.round(v * 100) + '%';
const titulo = (s) => s.charAt(0) + s.slice(1).toLowerCase();
const ymDe = (r) => `${r.anio}-${String(r.mesNum).padStart(2, '0')}`;

const total = rotacion.acumulado.filter((r) => r.area === 'TOTAL EMPRESA' && r.pctAcum != null);
const comercial = rotacion.acumulado.filter((r) => r.area === 'AREA COMERCIAL' && r.pctAcum != null);
// Indicador calculado por el pipeline (SALIDAS + ALTAS + BASE DE DATOS GENERAL), por alcance:
// total · comercial · americana · abiq · friotec. Misma forma que el manual para poder graficarlo igual.
const CALC = rotacion.calculado ?? null;
const ESCOPO_ETI = { total: 'total empresa', comercial: 'área comercial', americana: 'Americana', abiq: 'Abi Q', friotec: 'Friotec' };
const serieCalc = (escopo) => (CALC?.series?.[escopo] ?? []).filter((r) => !r.parcial && r.pctAcum != null).map((r) => ({ ...r, area: escopo }));
const mesesMensual = [...new Set(rotacion.mensual.map(ymDe))].sort();

function pintar(depto, periodo) {
  const esCom = depto === 'comercial';
  const marca = marcaActual();
  const conMarca = marca !== 'todas' && serieCalc(marca).length > 0;
  // con una marca elegida se usa el indicador calculado de esa marca; si no, el manual del sheet
  const serie = conMarca ? serieCalc(marca) : (esCom && comercial.length ? comercial : total);
  const nombreSerie = conMarca ? `marca ${MARCAS[marca]} (calculado)` : esCom ? 'área comercial' : 'total empresa';
  const generado = rotacion.generado;
  const etiP = etiquetaPeriodo(periodo, generado);
  const rango = rangoPeriodo(periodo, generado);
  const desdeYm = rango.desde ? rango.desde.slice(0, 7) : null, hastaYm = rango.hasta ? rango.hasta.slice(0, 7) : null;
  const enRango = (r) => (!desdeYm || ymDe(r) >= desdeYm) && (!hastaYm || ymDe(r) <= hastaYm);
  document.getElementById('alcance').innerHTML = conMarca
    ? `Viendo la rotación de <b>${MARCAS[marca]}</b>, calculada automáticamente por el dashboard (bajas del registro de SALIDAS, altas de la pestaña ALTAS y plantilla activa de la BASE DE DATOS GENERAL). El indicador manual del sheet no distingue marca.`
    : marca !== 'todas'
      ? `No hay indicador calculado para ${etiquetaMarca()}; se muestra ${esCom ? 'el área comercial' : 'toda la empresa'} completa.`
      : notaAlcance(depto);

  // ── KPIs: al último mes con dato dentro del período ──────────────────────
  const enPeriodo = serie.filter(enRango).sort((a, b) => a.anio - b.anio || a.mesNum - b.mesNum);
  const ultimo = enPeriodo.at(-1);
  if (!ultimo) {
    document.getElementById('kpis').innerHTML = `<div class="kpi" style="grid-column:1/-1"><div class="kpi-eti">El indicador de rotación no tiene filas de ${nombreSerie} en ${etiP}.</div></div>`;
  } else {
    const mismoMesAnterior = serie.find((r) => r.anio === ultimo.anio - 1 && r.mesNum === ultimo.mesNum);
    const dif = mismoMesAnterior ? ultimo.pctAcum - mismoMesAnterior.pctAcum : null;
    document.getElementById('kpis').innerHTML = `
      <div class="kpi">
        <div class="kpi-valor">${fmtPct(ultimo.pctAcum, 1)}</div>
        <div class="kpi-eti">rotación acumulada a ${MES_CORTO[ultimo.mesNum - 1]} ${ultimo.anio} (${nombreSerie})</div>
        <div class="kpi-nota">acumulado del año en curso a ese mes · ${etiP}</div>
      </div>
      <div class="kpi">
        <div class="kpi-valor ${dif == null ? '' : dif <= 0 ? 'verde' : 'ambar'}">${dif == null ? '—' : (dif > 0 ? '+' : '') + fmtPct(dif, 1)}</div>
        <div class="kpi-eti">contra el mismo mes de ${ultimo.anio - 1}</div>
      </div>
      <div class="kpi">
        <div class="kpi-valor">${ultimo.fin != null ? fmtNum(ultimo.fin) : '—'}</div>
        <div class="kpi-eti">colaboradores al cierre de ${MES_CORTO[ultimo.mesNum - 1]} ${ultimo.anio} (${nombreSerie})</div>
      </div>
      <div class="kpi">
        <div class="kpi-valor">${ultimo.bajasAcum != null ? fmtNum(ultimo.bajasAcum) : '—'}</div>
        <div class="kpi-eti">bajas acumuladas en ${ultimo.anio} a ${MES_CORTO[ultimo.mesNum - 1]}</div>
      </div>`;
  }

  // ── acumulado por año (líneas): los años del período; si es uno solo, también el anterior ──
  const aniosTodos = [...new Set(serie.map((r) => r.anio))].sort();
  let anios = [...new Set(enPeriodo.map((r) => r.anio))].sort();
  if (!anios.length) anios = aniosTodos;
  if (anios.length === 1 && aniosTodos.includes(anios[0] - 1)) anios = [anios[0] - 1, anios[0]];
  const COLORES_ANIO = ['#9AA8A1', '#46615A', '#0B7A55'];
  const seriesAnios = anios.map((a, i) => ({
    nombre: String(a),
    color: COLORES_ANIO[(i + (3 - anios.length % 3)) % COLORES_ANIO.length],
    puntos: MES_CORTO.map((_, m) => serie.find((r) => r.anio === a && r.mesNum === m + 1)?.pctAcum ?? null),
  }));
  document.getElementById('h-acum').textContent = `Rotación acumulada del año · ${anios.length > 1 ? 'comparación entre años' : anios[0]}`;
  document.getElementById('acumulado-anios').innerHTML = lineas(MES_CORTO, seriesAnios, { formato: pct0 });
  document.getElementById('leyenda-anios').innerHTML = leyenda(seriesAnios.map((s) => ({ eti: s.nombre, color: s.color })));
  document.getElementById('acumulado-nota').textContent =
    `${conMarca ? `Marca ${MARCAS[marca]}, indicador calculado` : esCom ? 'Área comercial' : 'Total empresa'}. El acumulado crece mes a mes dentro de cada año; la referencia del mercado que usa RRHH es ~60% anual.`;

  // ── rotación por marca (calculada) y validación contra el manual ──────────
  pintarMarcas(rango);
  pintarValidacion(esCom);

  // ── comercial vs total (el último año del período) — siempre se muestra la comparación ──
  const anioCT = ultimo ? ultimo.anio : aniosTodos.at(-1);
  const seriesCT = [
    { nombre: 'Total empresa', color: '#46615A', puntos: MES_CORTO.map((_, m) => total.find((r) => r.anio === anioCT && r.mesNum === m + 1)?.pctAcum ?? null) },
    { nombre: 'Área comercial', color: '#B5741A', puntos: MES_CORTO.map((_, m) => comercial.find((r) => r.anio === anioCT && r.mesNum === m + 1)?.pctAcum ?? null) },
  ];
  document.getElementById('h-ct').textContent = `Comercial vs. total empresa · ${anioCT}`;
  document.getElementById('comercial-total').innerHTML = lineas(MES_CORTO, seriesCT, { formato: pct0 });
  document.getElementById('leyenda-ct').innerHTML = leyenda(seriesCT.map((s) => ({ eti: `${s.nombre} ${anioCT}`, color: s.color })));

  // ── bajas por mes (suma de departamentos, o solo Comercial) ───────────────
  const mensual = esCom ? rotacion.mensual.filter((r) => r.departamento === 'COMERCIAL') : rotacion.mensual;
  const porMes = new Map();
  for (const r of mensual) {
    const k = ymDe(r);
    const a = porMes.get(k) ?? { bajas: 0, altas: 0, fin: 0 };
    a.bajas += r.bajas; a.altas += r.altas; a.fin += r.fin;
    porMes.set(k, a);
  }
  const mesesOrden = mesesDelPeriodo(periodo, mesesMensual, generado).filter((k) => porMes.has(k));
  const mesSel = periodo.startsWith('m:') ? periodo.slice(2) : null;
  document.getElementById('h-bajas').textContent = `Bajas por mes y tamaño del equipo · ${etiP}`;
  document.getElementById('bajas-mes').innerHTML = columnas(
    mesesOrden.map((k) => {
      const [y, m] = k.split('-');
      return { eti: `${MES_CORTO[+m - 1]} ${y.slice(2)}`, valor: porMes.get(k).bajas, color: mesSel && k !== mesSel ? '#E3D3B8' : '#B5741A' };
    }), { formato: fmtNum });
  const ultimoMesK = mesSel && porMes.has(mesSel) ? mesSel : mesesOrden.at(-1);
  const ultimoMes = porMes.get(ultimoMesK);
  document.getElementById('bajas-nota').textContent = ultimoMes
    ? `${mesSel ? `${fmtYm(ultimoMesK)} (barra oscura; los meses anteriores son contexto)` : `Último mes mostrado, ${fmtYm(ultimoMesK)}`} · ${nombreSerie}: ${fmtNum(ultimoMes.bajas)} bajas y ${fmtNum(ultimoMes.altas)} contrataciones, con ${fmtNum(ultimoMes.fin)} colaboradores al cierre.`
    : `Sin datos mensuales en ${etiP}.`;

  // ── bajas por departamento — solo tiene sentido en General ────────────────
  const secDepto = document.getElementById('sec-depto');
  secDepto.hidden = esCom;
  if (!esCom) {
    const corte = mesSel ? [mesSel] : (periodo === 'todo' ? mesesMensual.slice(-12) : mesesOrden);
    const porDepto = new Map();
    for (const r of rotacion.mensual) {
      if (!corte.includes(ymDe(r))) continue;
      porDepto.set(r.departamento, (porDepto.get(r.departamento) ?? 0) + r.bajas);
    }
    document.getElementById('h-depto').textContent = `Bajas por departamento · ${periodo === 'todo' ? 'últimos 12 meses' : etiP}`;
    const items = [...porDepto.entries()].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 10)
      .map(([k, v]) => ({ eti: titulo(k), valor: v, color: k === 'COMERCIAL' ? '#B5741A' : '#46615A' }));
    document.getElementById('bajas-depto').innerHTML = items.length ? barrasH(items, { formato: fmtNum }) : `<p class="sub">Sin bajas registradas en ${etiP}.</p>`;
  }
}

// Tabla: cada alcance con su plantilla al cierre, altas y bajas del año, y % acumulado al último mes completo.
function pintarMarcas(rango) {
  const el = document.getElementById('tabla-marcas'), nota = document.getElementById('marcas-nota');
  if (!CALC) { el.innerHTML = '<p class="sub">El pipeline aún no publica el indicador calculado.</p>'; nota.textContent = ''; return; }
  const hastaYm = rango.hasta ? rango.hasta.slice(0, 7) : null;
  const filas = ['total', 'comercial', 'americana', 'abiq', 'friotec'].map((e) => {
    const s = (CALC.series[e] ?? []).filter((r) => !r.parcial && (!hastaYm || r.ym <= hastaYm));
    const u = s.at(-1); if (!u) return null;
    const delAnio = s.filter((r) => r.anio === u.anio);
    return { e, u, altasAnio: delAnio.reduce((a, r) => a + r.altas, 0) };
  }).filter(Boolean);
  const ultimo = filas[0]?.u;
  document.getElementById('h-marcas').textContent = `Rotación por marca (calculada automáticamente)${ultimo ? ` · acumulada a ${MES_CORTO[ultimo.mesNum - 1]} ${ultimo.anio}` : ''}`;
  el.innerHTML = `<div class="tabla-scroll"><table class="tabla-sup"><thead><tr><th>Alcance</th><th class="n">Plantilla</th><th class="n">Altas</th><th class="n">Bajas</th><th class="n">% acum.</th></tr></thead><tbody>${filas.map(({ e, u, altasAnio }) => `<tr${marcaActual() === e ? ' class="fila-activa"' : ''}><td>${ESCOPO_ETI[e].charAt(0).toUpperCase() + ESCOPO_ETI[e].slice(1)}</td><td class="n">${fmtNum(u.fin)}</td><td class="n">${fmtNum(altasAnio)}</td><td class="n">${fmtNum(u.bajasAcum)}</td><td class="n"><b class="${u.pctAcum >= 0.6 ? 'rojo' : ''}">${u.pctAcum != null ? fmtPct(u.pctAcum, 1) : '—'}</b>${u.fin < 5 ? '<span class="pct">plantilla muy pequeña</span>' : ''}</td></tr>`).join('')}</tbody></table></div>`;
  const a = CALC.anclaje;
  nota.textContent = `Cálculo del dashboard con la misma fórmula del indicador: bajas acumuladas del año ÷ promedio de la plantilla del mes. Bajas del registro de SALIDAS, altas de la pestaña ALTAS y plantilla de hoy (${a.fecha}) contada en la BASE DE DATOS GENERAL: ${fmtNum(a.activos.total)} activos en total, ${fmtNum(a.activos.comercial)} en Comercial. Los meses anteriores se reconstruyen hacia atrás con altas y bajas.${a.marcaCompartidaEnAmericana ? ` ${fmtNum(a.marcaCompartidaEnAmericana)} personas del corporativo tienen marca compartida (A2K y Abi Q) y se cuentan en Americana.` : ''} Solo conteos: ningún dato individual.`;
}
// Tabla: indicador manual del sheet frente al calculado, mes a mes del último año, para el alcance actual.
function pintarValidacion(esCom) {
  const el = document.getElementById('tabla-valida'), nota = document.getElementById('valida-nota');
  const comp = CALC?.comparacion?.[esCom ? 'comercial' : 'total'] ?? [];
  document.getElementById('h-valida').textContent = `Indicador manual vs. calculado · ${esCom ? 'área comercial' : 'total empresa'}`;
  if (!comp.length) { el.innerHTML = '<p class="sub">Sin meses comparables.</p>'; nota.textContent = ''; return; }
  const ult = comp.slice(-12);
  el.innerHTML = `<div class="tabla-scroll"><table class="tabla-comp tabla-valida"><thead><tr><th>Mes</th><th class="n">Manual</th><th class="n">Calculado</th><th class="n">Diferencia</th></tr></thead><tbody>${ult.map((r) => {
    const d = r.calculado.pctAcum != null && r.manual.pctAcum != null ? (r.calculado.pctAcum - r.manual.pctAcum) * 100 : null;
    return `<tr><td>${MES_CORTO[r.mesNum - 1]} ${r.anio}</td><td class="n">${fmtPct(r.manual.pctAcum, 1)}<span class="pct">${fmtNum(r.manual.fin)} pers.</span></td><td class="n">${r.calculado.pctAcum != null ? fmtPct(r.calculado.pctAcum, 1) : '—'}<span class="pct">${fmtNum(r.calculado.fin)} pers.</span></td><td class="n"><span class="delta ${d == null ? 'igual' : Math.abs(d) < 1 ? 'igual' : 'mas'}">${d == null ? '—' : (d > 0 ? '+' : '−') + Math.abs(d).toFixed(1) + ' pts'}</span></td></tr>`;
  }).join('')}</tbody></table></div>`;
  nota.textContent = 'Sirve para validar el cálculo automático contra lo que el jefe de RRHH llena a mano (el número pequeño es la plantilla al cierre del mes; "Altas" y "Bajas" de la tabla de marcas son las del año en curso y "Plantilla" la del cierre del último mes completo). Diferencias de 1 punto o menos son normales; si son mayores, conviene revisar qué bajas o altas faltan en alguna de las dos fuentes. Cuando cuadre de forma sostenida, la pestaña manual puede dejar de llenarse.';
}

let depto = pintarSelectorDepto((d) => { depto = d; pintar(depto, periodo); });
let periodo = pintarSelectorPeriodo({ ...aniosYMeses({ rotacion }), generado: rotacion.generado },
  (p) => { periodo = p; pintar(depto, periodo); });
pintar(depto, periodo);
pintarPie(meta);

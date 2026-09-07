// Página Rotación: acumulado por año, comercial vs total, bajas mensuales y por departamento.
// Selector General / Comercial: el indicador del sheet ya trae el área de cada fila
// (TOTAL EMPRESA / AREA COMERCIAL en el acumulado; DEPARTAMENTO en el mensual).
import { cargarDatos, pintarPie, marcarNavActiva, fmtNum, pintarSelectorDepto, notaAlcance } from './comun.js';
import { barrasH, columnas, lineas, leyenda } from './graficas.js';
import { fmtPct } from './modelo.js';

marcarNavActiva();
const { rotacion, meta } = await cargarDatos();
const MES_CORTO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const pct0 = (v) => Math.round(v * 100) + '%';
const titulo = (s) => s.charAt(0) + s.slice(1).toLowerCase();

const total = rotacion.acumulado.filter((r) => r.area === 'TOTAL EMPRESA' && r.pctAcum != null);
const comercial = rotacion.acumulado.filter((r) => r.area === 'AREA COMERCIAL' && r.pctAcum != null);

function pintar(depto) {
  const esCom = depto === 'comercial';
  const serie = esCom && comercial.length ? comercial : total;
  const nombreSerie = esCom ? 'área comercial' : 'total empresa';
  document.getElementById('alcance').innerHTML = notaAlcance(depto);
  const anios = [...new Set(serie.map((r) => r.anio))].sort();
  const anioActual = anios.at(-1);

  // ── KPIs ───────────────────────────────────────────────────────────────────
  const ultimo = [...serie].sort((a, b) => a.anio - b.anio || a.mesNum - b.mesNum).at(-1);
  const mismoMesAnterior = serie.find((r) => r.anio === ultimo.anio - 1 && r.mesNum === ultimo.mesNum);
  const dif = mismoMesAnterior ? ultimo.pctAcum - mismoMesAnterior.pctAcum : null;
  document.getElementById('kpis').innerHTML = `
    <div class="kpi">
      <div class="kpi-valor">${fmtPct(ultimo.pctAcum, 1)}</div>
      <div class="kpi-eti">rotación acumulada a ${MES_CORTO[ultimo.mesNum - 1]} ${ultimo.anio} (${nombreSerie})</div>
    </div>
    <div class="kpi">
      <div class="kpi-valor ${dif == null ? '' : dif <= 0 ? 'verde' : 'ambar'}">${dif == null ? '—' : (dif > 0 ? '+' : '') + fmtPct(dif, 1)}</div>
      <div class="kpi-eti">contra el mismo mes de ${ultimo.anio - 1}</div>
    </div>
    <div class="kpi">
      <div class="kpi-valor">${ultimo.fin != null ? fmtNum(ultimo.fin) : '—'}</div>
      <div class="kpi-eti">colaboradores al cierre de ${MES_CORTO[ultimo.mesNum - 1]} (${nombreSerie})</div>
    </div>
    <div class="kpi">
      <div class="kpi-valor">${ultimo.bajasAcum != null ? fmtNum(ultimo.bajasAcum) : '—'}</div>
      <div class="kpi-eti">bajas acumuladas en ${ultimo.anio}</div>
    </div>`;

  // ── acumulado por año (líneas) ─────────────────────────────────────────────
  const COLORES_ANIO = ['#9AA8A1', '#46615A', '#0B7A55'];
  const seriesAnios = anios.map((a, i) => ({
    nombre: String(a),
    color: COLORES_ANIO[i % COLORES_ANIO.length],
    puntos: MES_CORTO.map((_, m) => serie.find((r) => r.anio === a && r.mesNum === m + 1)?.pctAcum ?? null),
  }));
  document.getElementById('acumulado-anios').innerHTML = lineas(MES_CORTO, seriesAnios, { formato: pct0 });
  document.getElementById('leyenda-anios').innerHTML = leyenda(seriesAnios.map((s) => ({ eti: s.nombre, color: s.color })));
  document.getElementById('acumulado-nota').textContent =
    `${esCom ? 'Área comercial' : 'Total empresa'}. El acumulado crece mes a mes; la referencia del mercado que usa RRHH es ~60% anual.`;

  // ── comercial vs total (año en curso) — siempre se muestra la comparación ──
  const seriesCT = [
    { nombre: 'Total empresa', color: '#46615A', puntos: MES_CORTO.map((_, m) => total.find((r) => r.anio === anioActual && r.mesNum === m + 1)?.pctAcum ?? null) },
    { nombre: 'Área comercial', color: '#B5741A', puntos: MES_CORTO.map((_, m) => comercial.find((r) => r.anio === anioActual && r.mesNum === m + 1)?.pctAcum ?? null) },
  ];
  document.getElementById('comercial-total').innerHTML = lineas(MES_CORTO, seriesCT, { formato: pct0 });
  document.getElementById('leyenda-ct').innerHTML = leyenda(seriesCT.map((s) => ({ eti: `${s.nombre} ${anioActual}`, color: s.color })));

  // ── bajas por mes (suma de departamentos, o solo Comercial) ───────────────
  const mensual = esCom ? rotacion.mensual.filter((r) => r.departamento === 'COMERCIAL') : rotacion.mensual;
  const porMes = new Map();
  for (const r of mensual) {
    const k = `${r.anio}-${String(r.mesNum).padStart(2, '0')}`;
    const a = porMes.get(k) ?? { bajas: 0, altas: 0, fin: 0 };
    a.bajas += r.bajas; a.altas += r.altas; a.fin += r.fin;
    porMes.set(k, a);
  }
  const mesesOrden = [...porMes.keys()].sort().slice(-18);
  document.getElementById('bajas-mes').innerHTML = columnas(
    mesesOrden.map((k) => {
      const [y, m] = k.split('-');
      return { eti: `${MES_CORTO[+m - 1]} ${y.slice(2)}`, valor: porMes.get(k).bajas, color: '#B5741A' };
    }), { formato: fmtNum });
  const ultimoMes = porMes.get(mesesOrden.at(-1));
  document.getElementById('bajas-nota').textContent = ultimoMes
    ? `Último mes (${nombreSerie}): ${fmtNum(ultimoMes.bajas)} bajas y ${fmtNum(ultimoMes.altas)} contrataciones, con ${fmtNum(ultimoMes.fin)} colaboradores al cierre.`
    : 'Sin datos mensuales.';

  // ── bajas por departamento (últimos 12 meses) — solo tiene sentido en General ──
  const secDepto = document.getElementById('sec-depto');
  secDepto.hidden = esCom;
  if (!esCom) {
    const corte = mesesOrden.slice(-12);
    const porDepto = new Map();
    for (const r of rotacion.mensual) {
      const k = `${r.anio}-${String(r.mesNum).padStart(2, '0')}`;
      if (!corte.includes(k)) continue;
      porDepto.set(r.departamento, (porDepto.get(r.departamento) ?? 0) + r.bajas);
    }
    document.getElementById('bajas-depto').innerHTML = barrasH(
      [...porDepto.entries()].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 10)
        .map(([k, v]) => ({ eti: titulo(k), valor: v, color: k === 'COMERCIAL' ? '#B5741A' : '#46615A' })),
      { formato: fmtNum });
  }
}

const deptoInicial = pintarSelectorDepto((d) => pintar(d));
pintar(deptoInicial);
pintarPie(meta);

// Página Salidas: agregados de la pestaña SALIDAS (sin datos individuales).
import { pintarPie, marcarNavActiva, fmtNum } from './comun.js';
import { barrasH, columnas } from './graficas.js';

marcarNavActiva();
const [salidas, meta] = await Promise.all([
  fetch('data/salidas.json', { cache: 'no-cache' }).then((r) => r.json()),
  fetch('data/meta.json', { cache: 'no-cache' }).then((r) => r.json()),
]);

if (!salidas.total) {
  document.querySelector('main').insertAdjacentHTML('beforeend',
    '<div class="tarjeta">No hay datos de salidas disponibles en el sheet.</div>');
  pintarPie(meta);
} else {
  const T = salidas.total, U = salidas.ult12m;
  const titulo = (s) => s.startsWith('(') ? s.replace(/[()]/g, '').toLowerCase() : s.charAt(0) + s.slice(1).toLowerCase();

  // ── períodos evaluados (calculados de los datos, nunca a mano) ──
  const MES_LARGO = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const fmtYm = (ym) => { const [y, m] = ym.split('-'); return `${MES_LARGO[+m - 1]} ${y}`; };
  const mesesOrdenados = Object.keys(salidas.porMes).sort();
  const rangoTotal = `${fmtYm(mesesOrdenados[0])} a ${fmtYm(mesesOrdenados.at(-1))}`;
  const gen = new Date(salidas.generado);
  const corte12 = new Date(gen); corte12.setFullYear(gen.getFullYear() - 1);
  const rango12m = `${MES_LARGO[corte12.getMonth()]} ${corte12.getFullYear()} a ${MES_LARGO[gen.getMonth()]} ${gen.getFullYear()}`;
  document.getElementById('periodo-eval').textContent =
    `Período evaluado: ${rangoTotal} (todo el registro). Los indicadores de "últimos 12 meses" cubren de ${rango12m}.`;
  document.getElementById('h-razon').textContent = `Razón de salida · ${rangoTotal}`;
  document.getElementById('h-agencia').textContent = `Por agencia / tienda · ${rangoTotal}`;

  // ── KPIs ──
  const RANGOS_TEMPRANOS = ['MENOS 1 MES', 'DE 1 A 2 MESES', 'DE 2 A 4 MESES', 'DE 4 A 6 MESES'];
  const tempranas = (d) => RANGOS_TEMPRANOS.reduce((s, k) => s + (d.rango[k] ?? 0), 0);
  const pctTemprano = Math.round((tempranas(T) / T.n) * 100);
  const mesesMediana = T.diasLab.mediana != null ? (T.diasLab.mediana / 30.4).toFixed(1) : null;
  document.getElementById('kpis').innerHTML = `
    <div class="kpi"><div class="kpi-valor">${fmtNum(U.n)}</div><div class="kpi-eti">bajas en los últimos 12 meses</div><div class="kpi-nota">${rango12m}</div></div>
    <div class="kpi"><div class="kpi-valor ${pctTemprano >= 50 ? 'rojo' : ''}">${pctTemprano}%</div><div class="kpi-eti">se va antes de cumplir 6 meses</div><div class="kpi-nota">todo el registro</div></div>
    <div class="kpi"><div class="kpi-valor">${mesesMediana ?? '—'} meses</div><div class="kpi-eti">antigüedad mediana al salir (${T.diasLab.mediana} días)</div><div class="kpi-nota">todo el registro</div></div>
    <div class="kpi"><div class="kpi-valor">${fmtNum(T.n)}</div><div class="kpi-eti">salidas registradas en total</div><div class="kpi-nota">${rangoTotal}</div></div>`;

  // ── bajas por mes (últimos 18) ──
  const MES_CORTO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const meses = Object.entries(salidas.porMes).sort((a, b) => a[0].localeCompare(b[0])).slice(-18);
  document.getElementById('por-mes').innerHTML = columnas(
    meses.map(([ym, n]) => {
      const [y, m] = ym.split('-');
      return { eti: `${MES_CORTO[+m - 1]} ${y.slice(2)}`, valor: n, color: '#B5741A' };
    }), { formato: fmtNum });
  document.getElementById('mes-nota').textContent =
    `Se muestran los últimos 18 meses (${fmtYm(meses[0][0])} a ${fmtYm(meses.at(-1)[0])}); el registro completo abarca de ${rangoTotal}.`;

  // ── antigüedad (rangos en orden natural) ──
  const ORDEN_RANGO = ['MENOS 1 MES', 'DE 1 A 2 MESES', 'DE 2 A 4 MESES', 'DE 4 A 6 MESES', 'DE 6 A 8 MESES', 'DE 8 A 10 MESES', 'DE 10 A 12 MESES', 'MAS DE UN ANO'];
  const ETI_RANGO = { 'MENOS 1 MES': 'Menos de 1 mes', 'DE 1 A 2 MESES': '1 a 2 meses', 'DE 2 A 4 MESES': '2 a 4 meses', 'DE 4 A 6 MESES': '4 a 6 meses', 'DE 6 A 8 MESES': '6 a 8 meses', 'DE 8 A 10 MESES': '8 a 10 meses', 'DE 10 A 12 MESES': '10 a 12 meses', 'MAS DE UN ANO': 'Más de un año' };
  document.getElementById('antiguedad').innerHTML = barrasH(
    ORDEN_RANGO.filter((k) => T.rango[k]).map((k) => ({
      eti: ETI_RANGO[k], valor: T.rango[k],
      color: RANGOS_TEMPRANOS.includes(k) ? '#B5741A' : '#46615A',
    })), { formato: fmtNum });
  document.getElementById('antiguedad-nota').textContent =
    `Las barras naranjas son salidas antes de los 6 meses: ${fmtNum(tempranas(T))} de ${fmtNum(T.n)} (${pctTemprano}%). ` +
    `Cada una de esas se va sin devolver la inversión de la curva de aprendizaje.`;

  // ── razón ──
  const COLOR_RAZON = { RENUNCIA: '#0B7A55', DESPIDO: '#B5741A' };
  document.getElementById('razon').innerHTML = barrasH(
    Object.entries(T.razon).map(([k, v]) => ({ eti: titulo(k), valor: v, color: COLOR_RAZON[k] ?? '#8FA69B' })),
    { formato: fmtNum });

  // ── sub-motivos (top 10, sin "(sin submotivo)") ──
  // Agrupación de presentación pedida por Oscar: VOLUNTARIA + MEJOR OPORTUNIDAD +
  // POR SALARIO se muestran como una sola barra (el dato del sheet no cambia).
  const GRUPO_MEJOR = 'Mejor oportunidad laboral · salario · beneficios';
  const ETI_SUB = { VOLUNTARIA: GRUPO_MEJOR, 'MEJOR OPORTUNIDAD': GRUPO_MEJOR, 'POR SALARIO': GRUPO_MEJOR };
  const subAgrupado = {};
  for (const [k, v] of Object.entries(T.subMotivo)) {
    if (k.startsWith('(')) continue;
    const eti = ETI_SUB[k] ?? titulo(k);
    subAgrupado[eti] = (subAgrupado[eti] ?? 0) + v;
  }
  document.getElementById('submotivo').innerHTML = barrasH(
    Object.entries(subAgrupado).sort((a, b) => b[1] - a[1]).slice(0, 10)
      .map(([eti, v]) => ({ eti, valor: v, color: '#46615A' })),
    { formato: fmtNum });

  // ── agencia (top 12) ──
  document.getElementById('agencia').innerHTML = barrasH(
    Object.entries(T.agencia).slice(0, 12).map(([k, v]) => {
      const [nombre, tipo] = k.split('·');
      return { eti: tipo ? `${nombre} (${tipo})` : titulo(nombre), valor: v, color: '#46615A' };
    }), { formato: fmtNum });

  // ── área y marca ──
  document.getElementById('area').innerHTML = barrasH(
    Object.entries(T.area).slice(0, 8).map(([k, v]) => ({ eti: titulo(k), valor: v, color: '#46615A' })),
    { formato: fmtNum });
  document.getElementById('marca').innerHTML = barrasH(
    Object.entries(T.marca).map(([k, v]) => ({ eti: k, valor: v, color: '#8FA69B' })),
    { formato: fmtNum });

  // ── género ──
  document.getElementById('genero').innerHTML = barrasH(
    Object.entries(T.genero).map(([k, v]) => ({
      eti: `${titulo(k)} (${Math.round((v / T.n) * 100)}%)`, valor: v, color: '#46615A',
    })), { formato: fmtNum });

  pintarPie(meta);
}

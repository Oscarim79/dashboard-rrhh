// Página Salidas: agregados de la pestaña SALIDAS (sin datos individuales).
// Selector General / Comercial: usa el bloque porDepartamento.comercial del JSON
// (columna AREA LAB del sheet). Selector de período (global): todo el registro,
// últimos 12 meses, un año (el año en curso = "a la fecha") o un mes concreto.
import { pintarPie, marcarNavActiva, fmtNum, pintarSelectorDepto, salidasDe, notaAlcance, aplicarDesglose, SIN_DETALLE,
  pintarSelectorPeriodo, dimsSalidas, etiquetaPeriodo, mesesDelPeriodo, aniosYMeses, fmtYm, fmtYmCorto, MES_LARGO } from './comun.js';
import { DATOS } from './propuesta-datos.js';
import { barrasH, columnas } from './graficas.js';

marcarNavActiva();
const [salidasTodo, meta] = await Promise.all([
  fetch('data/salidas.json', { cache: 'no-cache' }).then((r) => r.json()),
  fetch('data/meta.json', { cache: 'no-cache' }).then((r) => r.json()),
]);

if (!salidasTodo.total) {
  document.querySelector('main').insertAdjacentHTML('beforeend',
    '<div class="tarjeta">No hay datos de salidas disponibles en el sheet.</div>');
  pintarSelectorDepto();
  pintarPie(meta);
} else {
  const titulo = (s) => s.startsWith('(') ? s.replace(/[()]/g, '').toLowerCase() : s.charAt(0) + s.slice(1).toLowerCase();
  const RANGOS_TEMPRANOS = ['MENOS 1 MES', 'DE 1 A 2 MESES', 'DE 2 A 4 MESES', 'DE 4 A 6 MESES'];
  const tempranas = (d) => RANGOS_TEMPRANOS.reduce((s, k) => s + (d.rango[k] ?? 0), 0);
  const ORDEN_RANGO = ['MENOS 1 MES', 'DE 1 A 2 MESES', 'DE 2 A 4 MESES', 'DE 4 A 6 MESES', 'DE 6 A 8 MESES', 'DE 8 A 10 MESES', 'DE 10 A 12 MESES', 'DE 1 A 2 ANOS', 'DE 2 A 5 ANOS', 'MAS DE 5 ANOS', 'MAS DE UN ANO'];
  const ETI_RANGO = { 'MENOS 1 MES': 'Menos de 1 mes', 'DE 1 A 2 MESES': '1 a 2 meses', 'DE 2 A 4 MESES': '2 a 4 meses', 'DE 4 A 6 MESES': '4 a 6 meses', 'DE 6 A 8 MESES': '6 a 8 meses', 'DE 8 A 10 MESES': '8 a 10 meses', 'DE 10 A 12 MESES': '10 a 12 meses', 'DE 1 A 2 ANOS': '1 a 2 años', 'DE 2 A 5 ANOS': '2 a 5 años', 'MAS DE 5 ANOS': 'Más de 5 años', 'MAS DE UN ANO': 'Más de un año (sin detalle de años)' };
  const RANGOS_PRIMER_ANO = [...RANGOS_TEMPRANOS, 'DE 6 A 8 MESES', 'DE 8 A 10 MESES', 'DE 10 A 12 MESES'];

  function pintar(depto, periodo) {
    const salidas = salidasDe(salidasTodo, depto);
    const T = salidas.total;
    const generado = salidas.generado;
    const D = dimsSalidas(salidas, periodo);
    const etiP = etiquetaPeriodo(periodo, generado);
    document.getElementById('alcance').innerHTML = notaAlcance(depto);

    // ── períodos evaluados (calculados de los datos, nunca a mano) ──
    const mesesOrdenados = Object.keys(salidas.porMes).sort();
    const rangoTotal = `${fmtYm(mesesOrdenados[0])} a ${fmtYm(mesesOrdenados.at(-1))}`;
    const gen = new Date(generado);
    const corte12 = new Date(gen); corte12.setFullYear(gen.getFullYear() - 1);
    const rango12m = `${MES_LARGO[corte12.getMonth()]} ${corte12.getFullYear()} a ${MES_LARGO[gen.getMonth()]} ${gen.getFullYear()}`;
    document.getElementById('periodo-eval').textContent =
      `Registro completo: ${rangoTotal}. Viendo ${etiP}${periodo === '12m' ? ` (${rango12m})` : ''}.`;

    document.getElementById('h-razon').textContent = `Razón de salida · ${etiP}`;
    document.getElementById('h-agencia').textContent = `Por agencia / tienda · ${etiP}`;

    // ── KPIs ──
    const pctTemprano = D.n ? Math.round((tempranas(D) / D.n) * 100) : 0;
    const mesesMediana = D.diasLab.mediana != null ? (D.diasLab.mediana / 30.4).toFixed(1) : null;
    document.getElementById('kpis').innerHTML = `
      <div class="kpi"><div class="kpi-valor">${fmtNum(D.n)}</div><div class="kpi-eti">bajas · ${etiP}</div></div>
      <div class="kpi"><div class="kpi-valor ${pctTemprano >= 50 ? 'rojo' : ''}">${pctTemprano}%</div><div class="kpi-eti">se va antes de cumplir 6 meses</div><div class="kpi-nota">${etiP}</div></div>
      <div class="kpi"><div class="kpi-valor">${mesesMediana ?? '—'} meses</div><div class="kpi-eti">antigüedad mediana al salir${D.diasLab.mediana != null ? ` (${D.diasLab.mediana} días)` : ''}</div><div class="kpi-nota">${etiP}</div></div>
      <div class="kpi"><div class="kpi-valor">${fmtNum(T.n)}</div><div class="kpi-eti">salidas registradas en total</div><div class="kpi-nota">${rangoTotal}</div></div>`;

    if (!D.n) {
      for (const id of ['por-mes', 'antiguedad', 'razon', 'submotivo', 'agencia', 'area', 'marca', 'genero']) {
        document.getElementById(id).innerHTML = `<p class="sub">Sin salidas registradas en ${etiP} con este alcance.</p>`;
      }
      for (const id of ['mes-nota', 'antiguedad-nota', 'submotivo-nota']) document.getElementById(id).textContent = '';
      return;
    }

    // ── bajas por mes ──
    const meses = mesesDelPeriodo(periodo, mesesOrdenados, generado).map((ym) => [ym, salidas.porMes[ym] ?? 0]);
    const mesSel = periodo.startsWith('m:') ? periodo.slice(2) : null;
    document.getElementById('por-mes').innerHTML = columnas(
      meses.map(([ym, n]) => ({ eti: fmtYmCorto(ym), valor: n, color: mesSel && ym !== mesSel ? '#E3D3B8' : '#B5741A' })),
      { formato: fmtNum });
    document.getElementById('mes-nota').textContent = meses.length
      ? (mesSel ? `Se muestra ${fmtYm(mesSel)} (barra oscura) con los 11 meses anteriores como contexto.`
        : `Meses mostrados: ${fmtYm(meses[0][0])} a ${fmtYm(meses.at(-1)[0])}${periodo === 'todo' ? ` (los últimos 18; el registro completo abarca de ${rangoTotal})` : ''}.`)
      : '';

    // ── antigüedad (rangos en orden natural) ──
    // El pipeline parte "más de un año" en 1-2 / 2-5 / más de 5 años usando los días
    // laborados; 'MAS DE UN ANO' solo queda para filas sin días válidos.
    const primerAno = RANGOS_PRIMER_ANO.reduce((s, k) => s + (D.rango[k] ?? 0), 0);
    const pctPrimerAno = D.n ? Math.round((primerAno / D.n) * 100) : 0;
    document.getElementById('antiguedad').innerHTML = barrasH(
      ORDEN_RANGO.filter((k) => D.rango[k]).map((k) => ({
        eti: ETI_RANGO[k], valor: D.rango[k],
        color: RANGOS_TEMPRANOS.includes(k) ? '#B5741A' : '#46615A',
      })), { formato: fmtNum });
    document.getElementById('antiguedad-nota').textContent =
      `Las barras naranjas son salidas antes de los 6 meses: ${fmtNum(tempranas(D))} de ${fmtNum(D.n)} (${pctTemprano}%) en ${etiP}. ` +
      `Cada una de esas se va sin devolver la inversión de la curva de aprendizaje. ` +
      `Ojo al leer: los tramos no tienen el mismo ancho — cada barra naranja cubre 1 o 2 meses, mientras que los tramos de años cubren varios años cada uno. ` +
      `Antes de cumplir un año se va el ${pctPrimerAno}% (${fmtNum(primerAno)} de ${fmtNum(D.n)}).`;

    // ── razón ──
    const COLOR_RAZON = { RENUNCIA: '#0B7A55', DESPIDO: '#B5741A' };
    document.getElementById('razon').innerHTML = barrasH(
      Object.entries(D.razon).map(([k, v]) => ({ eti: titulo(k), valor: v, color: COLOR_RAZON[k] ?? '#8FA69B' })),
      { formato: fmtNum });

    // ── motivos (top 12) — cada uno por separado (pedido del CEO, 2026-09-07) ──
    // En Comercial · todo el registro, las renuncias "voluntarias" se reparten con el
    // desglose que RRHH cargó en propuesta-datos.js (salario, mejor oportunidad, clima
    // laboral, descuentos). En los demás cortes no hay reparto: se muestra la barra gris.
    const conReparto = depto === 'comercial' && periodo === 'todo' && Object.keys(DATOS.desgloseVoluntaria?.casos ?? {}).length > 0;
    const des = aplicarDesglose(D.subMotivo, conReparto ? DATOS.desgloseVoluntaria : null);
    document.getElementById('submotivo').innerHTML = des.items.length ? barrasH(
      des.items.slice(0, 12).map((i) => ({ ...i, color: i.eti === SIN_DETALLE ? '#C9CFC9' : '#46615A' })),
      { formato: fmtNum }) : '<p class="sub">Sin motivos registrados.</p>';
    document.getElementById('submotivo-nota').innerHTML = conReparto
      ? `De las ${fmtNum(des.voluntarias)} renuncias que el registro solo marca como "voluntaria", RRHH repartió ${fmtNum(des.repartidas)} por motivo (${Object.entries(DATOS.desgloseVoluntaria.casos).map(([k, v]) => `${k} ${v}`).join(', ')})${des.resto > 0 ? (DATOS.desgloseVoluntaria.cubreTodas ? `; las ${fmtNum(des.resto)} restantes, según RRHH, coinciden con casos ya registrados en mejor oportunidad y clima laboral` : `; ${fmtNum(des.resto)} siguen sin detalle`) : ''}. Los motivos que ya existían en el registro se sumaron ("mal trato" cuenta como clima laboral). Motivos con menos de 3 casos van en "Otros".`
      : `Cada motivo por separado, tal como lo registra RRHH. ${des.notaAgrupaciones} La barra gris son salidas que el registro solo marca como "voluntaria", sin detalle. Motivos con menos de 3 casos en el período van en "Otros".`;

    // ── agencia (top 12) ──
    document.getElementById('agencia').innerHTML = barrasH(
      Object.entries(D.agencia).slice(0, 12).map(([k, v]) => {
        const [nombre, tipo] = k.split('·');
        return { eti: tipo ? `${nombre} (${tipo})` : titulo(nombre), valor: v, color: '#46615A' };
      }), { formato: fmtNum });

    // ── área y marca ──
    document.getElementById('area').innerHTML = barrasH(
      Object.entries(D.area).map(([k, v]) => ({ eti: titulo(k), valor: v, color: '#46615A' })),
      { formato: fmtNum });
    document.getElementById('marca').innerHTML = barrasH(
      Object.entries(D.marca).map(([k, v]) => ({ eti: k, valor: v, color: '#8FA69B' })),
      { formato: fmtNum });

    // ── género ──
    document.getElementById('genero').innerHTML = barrasH(
      Object.entries(D.genero).map(([k, v]) => ({
        eti: `${titulo(k)} (${D.n ? Math.round((v / D.n) * 100) : 0}%)`, valor: v, color: '#46615A',
      })), { formato: fmtNum });
  }

  let depto = pintarSelectorDepto((d) => { depto = d; pintar(depto, periodo); });
  let periodo = pintarSelectorPeriodo({ ...aniosYMeses({ salidas: salidasTodo }), generado: salidasTodo.generado },
    (p) => { periodo = p; pintar(depto, periodo); });
  pintar(depto, periodo);
  pintarPie(meta);
}

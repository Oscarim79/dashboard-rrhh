// Página Salidas: agregados de la pestaña SALIDAS (sin datos individuales).
// Selector General / Comercial: usa el bloque porDepartamento.comercial del JSON
// (columna AREA LAB del sheet). Selector de período (global): todo el registro,
// últimos 12 meses, un año (el año en curso = "a la fecha") o un mes concreto.
import { pintarPie, marcarNavActiva, fmtNum, pintarSelectorDepto, salidasDe, notaAlcance, aplicarDesglose, SIN_DETALLE, activarDetalles,
  pintarSelectorPeriodo, dimsSalidas, dimsAcumulado, etiquetaPeriodo, mesesDelPeriodo, aniosYMeses, fmtYm, fmtYmCorto, MES_LARGO, MES_CORTO } from './comun.js';
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
  // El sheet trae las áreas en mayúsculas y sin tildes; nombres legibles para la gráfica.
  const NOMBRE_AREA = { COMERCIAL: 'Comercial', LOGISTICA: 'Logística', MERCADEO: 'Mercadeo', 'CREDITOS Y COBROS': 'Créditos y cobros', CONTABILIDAD: 'Contabilidad', AUDITORIA: 'Auditoría', REPARTO: 'Reparto', GARANTIAS: 'Garantías', 'SOPORTE IT': 'Soporte IT' };
  const RANGOS_TEMPRANOS = ['MENOS 1 MES', 'DE 1 A 2 MESES', 'DE 2 A 4 MESES', 'DE 4 A 6 MESES'];
  const tempranas = (d) => RANGOS_TEMPRANOS.reduce((s, k) => s + (d.rango[k] ?? 0), 0);
  const ORDEN_RANGO = ['MENOS 1 MES', 'DE 1 A 2 MESES', 'DE 2 A 4 MESES', 'DE 4 A 6 MESES', 'DE 6 A 8 MESES', 'DE 8 A 10 MESES', 'DE 10 A 12 MESES', 'DE 1 A 2 ANOS', 'DE 2 A 5 ANOS', 'MAS DE 5 ANOS', 'MAS DE UN ANO'];
  const ETI_RANGO = { 'MENOS 1 MES': 'Menos de 1 mes', 'DE 1 A 2 MESES': '1 a 2 meses', 'DE 2 A 4 MESES': '2 a 4 meses', 'DE 4 A 6 MESES': '4 a 6 meses', 'DE 6 A 8 MESES': '6 a 8 meses', 'DE 8 A 10 MESES': '8 a 10 meses', 'DE 10 A 12 MESES': '10 a 12 meses', 'DE 1 A 2 ANOS': '1 a 2 años', 'DE 2 A 5 ANOS': '2 a 5 años', 'MAS DE 5 ANOS': 'Más de 5 años', 'MAS DE UN ANO': 'Más de un año (sin detalle de años)' };
  const RANGOS_PRIMER_ANO = [...RANGOS_TEMPRANOS, 'DE 6 A 8 MESES', 'DE 8 A 10 MESES', 'DE 10 A 12 MESES'];
  // El pipeline unifica sinónimos antes de contar (mal ambiente/mal trato → clima laboral, etc.);
  // se dice en el pie de cada gráfica de motivos con lo que de verdad se unificó en el registro.
  const nombreSub = (k) => (aplicarDesglose({ [k]: 1 }, null).items[0]?.eti ?? k);
  // Qué agrupa cada motivo: texto de RRHH (propuesta-datos.js) + lo que el registro unificó.
  // Se muestra en un globo al pasar el cursor o tocar la barra (pedido de Oscar, 2026-09-09).
  const detalleMotivo = (eti) => {
    const manual = DATOS.detalleMotivos?.[eti] ?? '';
    const reg = Object.entries(salidasTodo.agrupacionesSubMotivo ?? {}).find(([dest]) => nombreSub(dest) === eti)?.[1];
    const regTexto = reg ? `En el registro incluye lo anotado como ${Object.keys(reg).map((s) => `"${s.toLowerCase()}"`).join(' y ')}.` : '';
    return [manual, regTexto].filter(Boolean).join(' ') || null;
  };
  const notaUnificados = (() => {
    const g = Object.entries(salidasTodo.agrupacionesSubMotivo ?? {});
    if (!g.length) return '';
    return 'Motivos que significan lo mismo se cuentan juntos: ' + g.map(([dest, src]) =>
      `${nombreSub(dest)} incluye lo registrado como ${Object.keys(src).map((s) => `"${s.toLowerCase()}"`).join(' y ')}`).join('; ') + '.';
  })();

  function pintar(depto, periodo) {
    const salidas = salidasDe(salidasTodo, depto);
    const T = salidas.total;
    const generado = salidas.generado;
    const D = dimsSalidas(salidas, periodo);
    const etiP = etiquetaPeriodo(periodo, generado);
    document.getElementById('alcance').innerHTML = notaAlcance(depto);
    document.getElementById('card-area').hidden = depto === 'comercial';

    // ── períodos evaluados (calculados de los datos, nunca a mano) ──
    const mesesOrdenados = Object.keys(salidas.porMes).sort();
    const hoyYm = generado.slice(0, 7);
    const ultimoMes = [...mesesOrdenados].reverse().find((ym) => ym <= hoyYm) ?? mesesOrdenados.at(-1);
    const rangoTotal = `${fmtYm(mesesOrdenados[0])} a ${fmtYm(ultimoMes)}`;
    const gen = new Date(generado);
    const corte12 = new Date(gen); corte12.setFullYear(gen.getFullYear() - 1);
    const rango12m = `${MES_LARGO[corte12.getMonth()]} ${corte12.getFullYear()} a ${MES_LARGO[gen.getMonth()]} ${gen.getFullYear()}`;
    document.getElementById('periodo-eval').textContent =
      `Viendo ${etiP}${periodo === '12m' ? ` (${rango12m})` : ''}.`;

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
      for (const id of ['por-mes', 'antiguedad', 'razon', 'submotivo', 'tempranas', 'agencia', 'area', 'marca', 'genero', 'supervisor']) {
        document.getElementById(id).innerHTML = `<p class="sub">Sin salidas registradas en ${etiP} con este alcance.</p>`;
      }
      for (const id of ['mes-nota', 'antiguedad-nota', 'submotivo-nota', 'tempranas-nota', 'tempranas-resumen', 'supervisor-nota']) document.getElementById(id).textContent = '';
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

    // ── motivos — todos, cada uno por separado (CEO 2026-09-07; sin "Otros" desde 2026-09-09) ──
    // En Comercial · todo el registro, las renuncias "voluntarias" se reparten con el
    // desglose que RRHH cargó en propuesta-datos.js (salario, mejor oportunidad, clima
    // laboral, descuentos). En los demás cortes no hay reparto: se muestra la barra gris.
    const conReparto = depto === 'comercial' && periodo === 'todo' && Object.keys(DATOS.desgloseVoluntaria?.casos ?? {}).length > 0;
    const des = aplicarDesglose(D.subMotivo, conReparto ? DATOS.desgloseVoluntaria : null);
    document.getElementById('submotivo').innerHTML = des.items.length ? barrasH(
      des.items.map((i) => ({ ...i, color: i.eti === SIN_DETALLE ? '#C9CFC9' : '#46615A', detalle: detalleMotivo(i.eti) })),
      { formato: fmtNum }) : '<p class="sub">Sin motivos registrados.</p>';
    document.getElementById('submotivo-nota').innerHTML = conReparto
      ? `De las ${fmtNum(des.voluntarias)} renuncias que el registro solo marca como "voluntaria", RRHH repartió ${fmtNum(des.repartidas)} por motivo (${Object.entries(DATOS.desgloseVoluntaria.casos).map(([k, v]) => `${k} ${v}`).join(', ')})${des.resto > 0 ? (DATOS.desgloseVoluntaria.cubreTodas ? `; las ${fmtNum(des.resto)} restantes, según RRHH, coinciden con casos ya registrados en mejor oportunidad y clima laboral` : `; ${fmtNum(des.resto)} siguen sin detalle`) : ''}. Los motivos que ya existían en el registro se sumaron ("mal trato" cuenta como clima laboral). ${notaUnificados}`
      : `Todos los motivos por separado, tal como los registra RRHH, sin agrupar en "Otros". Los motivos subrayados tienen detalle: pasa el cursor o tócalos para ver qué casos agrupan. ${notaUnificados} La barra gris son salidas que el registro solo marca como "voluntaria", sin detalle.`;

    // ── los que se van antes de 6 meses: POR QUÉ (pedido del CEO, 2026-09-08) ──
    // El pipeline cruza razón/sub-motivo con antigüedad menor a 6 meses (solo conteos, n≥3).
    const TP = D.tempranas ?? { n: 0, razon: {}, subMotivo: {} };
    document.getElementById('h-tempranas').textContent = `Los que se van antes de 6 meses, ¿por qué se van? · ${etiP}`;
    const desT = aplicarDesglose(TP.subMotivo, null);
    const partesRazon = Object.entries(TP.razon).map(([k, v]) => `${fmtNum(v)} ${k === 'RENUNCIA' ? (v === 1 ? 'renuncia' : 'renuncias') : k === 'DESPIDO' ? (v === 1 ? 'despido' : 'despidos') : k === 'OTROS' ? 'con otra razón' : titulo(k).toLowerCase()}`);
    document.getElementById('tempranas-resumen').textContent = TP.n
      ? `${fmtNum(TP.n)} de las ${fmtNum(D.n)} salidas de ${etiP} (${pctTemprano}%) fueron de personas con menos de 6 meses en la empresa: ${partesRazon.join(', ')}. Estos son sus motivos:`
      : `Sin salidas antes de 6 meses en ${etiP}.`;
    document.getElementById('tempranas').innerHTML = desT.items.length ? barrasH(
      desT.items.map((i) => ({ ...i, color: i.eti === SIN_DETALLE ? '#C9CFC9' : '#B5741A', detalle: detalleMotivo(i.eti) })),
      { formato: fmtNum }) : '';
    document.getElementById('tempranas-nota').innerHTML = TP.n
      ? `Solo cuenta a quienes salieron con menos de 6 meses de antigüedad; los motivos son los que RRHH registró para cada salida, todos por separado, sin agrupar en "Otros". Los motivos subrayados tienen detalle: pasa el cursor o tócalos para ver qué casos agrupan. ${notaUnificados} La barra gris son salidas marcadas solo como "voluntaria", sin detalle.`
      : '';

    // ── agencia (top 12) ──
    document.getElementById('agencia').innerHTML = barrasH(
      Object.entries(D.agencia).slice(0, 12).map(([k, v]) => {
        const [nombre, tipo] = k.split('·');
        return { eti: tipo ? `${nombre} (${tipo})` : titulo(nombre), valor: v, color: '#46615A' };
      }), { formato: fmtNum });

    // ── área y marca (en Comercial todas las salidas son del área comercial: la tarjeta sobra) ──
    document.getElementById('area').innerHTML = barrasH(
      Object.entries(D.area).map(([k, v]) => ({ eti: NOMBRE_AREA[k] ?? titulo(k), valor: v, color: '#46615A' })),
      { formato: fmtNum });
    document.getElementById('marca').innerHTML = barrasH(
      Object.entries(D.marca).map(([k, v]) => ({ eti: k, valor: v, color: '#8FA69B' })),
      { formato: fmtNum });

    // ── por supervisor o jefe (decisión de Oscar 2026-09-09, pedido del CEO) ──
    document.getElementById('h-supervisor').textContent = `Por supervisor o jefe · ${etiP}`;
    const sups = Object.entries(D.porSupervisor ?? {});
    document.getElementById('supervisor').innerHTML = sups.length ? `<div class="tabla-scroll"><table class="tabla-sup">
      <thead><tr><th>Supervisor</th><th class="n">Bajas</th><th class="n">Renuncia</th><th class="n">Despido</th><th class="n">&lt; 6 meses</th></tr></thead>
      <tbody>${sups.map(([nombre, s]) => `<tr><td>${nombre}</td><td class="n"><b>${fmtNum(s.n)}</b></td><td class="n">${fmtNum(s.renuncia)}</td><td class="n">${fmtNum(s.despido)}</td><td class="n">${fmtNum(s.tempranas)}<span class="pct">${s.n ? Math.round((s.tempranas / s.n) * 100) : 0}%</span></td></tr>`).join('')}</tbody>
      </table></div>` : '<p class="sub">Sin dato de supervisor.</p>';
    document.getElementById('supervisor-nota').textContent =
      `Salidas del equipo de cada supervisor o jefe en ${etiP}, según la columna "supervisor o jefe" del registro de RRHH. "< 6 meses" = cuántas de esas salidas tenían menos de 6 meses en la empresa (y qué parte de las bajas de ese equipo representan). Bajas que no son renuncia ni despido (no confirmados, temporales) cuentan en el total pero no en esas dos columnas.`;

    // ── género ──
    document.getElementById('genero').innerHTML = barrasH(
      Object.entries(D.genero).map(([k, v]) => ({
        eti: `${titulo(k)} (${D.n ? Math.round((v / D.n) * 100) : 0}%)`, valor: v, color: '#46615A',
      })), { formato: fmtNum });
  }

  // ── Comparativa entre años del mismo período (pedido del CEO, 2026-09-08) ──
  // Enero→mes de un año frente al mismo tramo de otro año. Usa `acumuladoAnio` del JSON
  // (cortes calculados en el pipeline, con la regla n≥3 aplicada sobre el tramo completo).
  // Los controles son propios de esta sección: no usan el selector global de período.
  const compSel = { a: null, b: null, mm: null };
  const celda = (v, total) => `${fmtNum(v)}${total ? `<span class="pct">${Math.round((v / total) * 100)}%</span>` : ''}`;
  const delta = (a, b, { inverso = false, unidad = '' } = {}) => {
    if (a == null || b == null) return '<span class="delta igual">—</span>';
    const d = Math.round((b - a) * 10) / 10;
    if (!d) return '<span class="delta igual">=</span>';
    const sube = d > 0;
    const malo = inverso ? !sube : sube; // más salidas = malo (ámbar); menos = bueno (verde)
    return `<span class="delta ${malo ? 'mas' : 'menos'}">${sube ? '+' : '−'}${fmtNum(Math.abs(d))}${unidad}</span>`;
  };
  const tablaComp = (filas, etiA, etiB) => filas.length ? `<div class="tabla-scroll"><table class="tabla-comp">
    <thead><tr><th></th><th class="n">${etiA}</th><th class="n">${etiB}</th><th class="n">Cambio</th></tr></thead>
    <tbody>${filas.map((f) => `<tr><td>${f.eti}</td><td class="n">${f.ca ?? celda(f.a, f.na)}</td><td class="n">${f.cb ?? celda(f.b, f.nb)}</td><td class="n">${delta(f.a, f.b, f)}</td></tr>`).join('')}</tbody>
    </table></div>` : '<p class="sub">Sin datos en este tramo.</p>';
  // une dos conteos {clave: n} en filas comparables; orden fijo (si se da) o por total descendente
  const filasDim = (A, B, objA, objB, etiqueta = titulo, orden = null) => {
    const claves = orden ? orden.filter((k) => (objA?.[k] ?? 0) || (objB?.[k] ?? 0)) : [...new Set([...Object.keys(objA ?? {}), ...Object.keys(objB ?? {})])]
      .sort((x, y) => ((objB?.[y] ?? 0) + (objA?.[y] ?? 0)) - ((objB?.[x] ?? 0) + (objA?.[x] ?? 0)));
    return claves.map((k) => ({ eti: etiqueta(k), a: objA?.[k] ?? 0, b: objB?.[k] ?? 0, na: A.n, nb: B.n }));
  };
  const aMapa = (items) => Object.fromEntries(items.map((i) => [i.eti, i.valor]));
  const etiquetaDeptoLarga = (d) => (d === 'comercial' ? 'solo departamento Comercial' : 'toda la empresa');

  function pintarComparativa(depto) {
    const salidas = salidasDe(salidasTodo, depto);
    const acum = salidas.acumuladoAnio ?? {};
    const anios = Object.keys(acum).sort();
    const cont = document.getElementById('comparativa');
    if (anios.length < 2) { cont.innerHTML = '<div class="tarjeta"><p class="sub">Hacen falta al menos dos años con registro para comparar.</p></div>'; return; }
    const hoyYm = salidas.generado.slice(0, 7);
    if (!acum[compSel.b] || !acum[compSel.a]) { compSel.b = anios.at(-1); compSel.a = anios.at(-2); compSel.mm = null; }
    // meses disponibles: los del año más reciente de los dos (los anteriores llegan a diciembre)
    const mesesDisp = Object.keys(acum[compSel.a > compSel.b ? compSel.a : compSel.b]).sort();
    if (!compSel.mm || !mesesDisp.includes(compSel.mm)) {
      // por defecto, el último mes COMPLETO con dato del año en curso (el mes en curso aún se está capturando)
      const completos = mesesDisp.filter((m) => `${anios.at(-1)}-${m}` < hoyYm);
      compSel.mm = completos.at(-1) ?? mesesDisp.at(-1);
    }
    const { a, b, mm } = compSel;
    const A = dimsAcumulado(salidas, a, mm), B = dimsAcumulado(salidas, b, mm);
    const tramo = mm === '01' ? 'enero' : `enero a ${MES_LARGO[+mm - 1]}`;
    // encabezados de tabla: solo el año (el tramo ya está dicho arriba; en teléfono no cabe más)
    const etiA = a, etiB = b;
    const tramoCorto = mm === '01' ? 'ene' : `ene–${MES_CORTO[+mm - 1]}`;
    const opc = (lista, sel, eti = (x) => x) => lista.map((x) => `<option value="${x}" ${x === sel ? 'selected' : ''}>${eti(x)}</option>`).join('');
    const temp = (D) => RANGOS_TEMPRANOS.reduce((s, k) => s + (D.rango?.[k] ?? 0), 0);
    const medMeses = (D) => (D.diasLab?.mediana != null ? Math.round((D.diasLab.mediana / 30.4) * 10) / 10 : null);
    const pct = (v, n) => (n ? Math.round((v / n) * 100) : 0);
    const meses = Array.from({ length: +mm }, (_, i) => String(i + 1).padStart(2, '0'));
    // Sin aviso de confiabilidad (Oscar, 2026-09-09): el CEO ya lo sabe y no debe verse ante otros gerentes.
    const aviso = '';
    const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
    cont.innerHTML = `
      <div class="tarjeta">
        <div class="sup-inputs comp-controles">
          <label>Comparar <select id="comp-a" aria-label="Primer año">${opc(anios, a)}</select></label>
          <label>con <select id="comp-b" aria-label="Segundo año">${opc(anios, b)}</select></label>
          <label>de enero a <select id="comp-mm" aria-label="Mes final del tramo">${opc(mesesDisp, mm, (m) => MES_LARGO[+m - 1])}</select></label>
        </div>
        <p class="comp-titulo"><b>${cap(tramo)} de ${a}</b> frente a <b>${tramo} de ${b}</b>, ${etiquetaDeptoLarga(depto)}.</p>
        <p class="pie">${aviso}En la columna "Cambio", <span class="delta mas">naranja</span> = más salidas (o peor) en ${b} que en ${a}; <span class="delta menos">verde</span> = menos (o mejor). El porcentaje pequeño es la parte que cada fila representa dentro de su tramo.</p>
      </div>
      <div class="tarjeta"><h3>Lo esencial</h3>${tablaComp([
        { eti: 'Bajas en el tramo', a: A.n, b: B.n, ca: fmtNum(A.n), cb: fmtNum(B.n) },
        { eti: 'Renuncias', a: A.razon?.RENUNCIA ?? 0, b: B.razon?.RENUNCIA ?? 0, na: A.n, nb: B.n },
        { eti: 'Despidos', a: A.razon?.DESPIDO ?? 0, b: B.razon?.DESPIDO ?? 0, na: A.n, nb: B.n },
        { eti: 'Se fueron antes de cumplir 6 meses', a: temp(A), b: temp(B), na: A.n, nb: B.n },
        { eti: '% que se va antes de 6 meses', a: pct(temp(A), A.n), b: pct(temp(B), B.n), ca: `${pct(temp(A), A.n)}%`, cb: `${pct(temp(B), B.n)}%`, unidad: ' pts' },
        { eti: 'Antigüedad mediana al salir (meses)', a: medMeses(A), b: medMeses(B), ca: medMeses(A) ?? '—', cb: medMeses(B) ?? '—', inverso: true },
      ], etiA, etiB)}</div>
      <div class="tarjeta"><h3>Bajas por mes</h3>${tablaComp(meses.map((m) => ({
        eti: cap(MES_LARGO[+m - 1]),
        a: salidas.porMes?.[`${a}-${m}`] ?? 0, b: salidas.porMes?.[`${b}-${m}`] ?? 0,
        ca: fmtNum(salidas.porMes?.[`${a}-${m}`] ?? 0), cb: fmtNum(salidas.porMes?.[`${b}-${m}`] ?? 0),
      })), etiA, etiB)}</div>
      <div class="tarjeta"><h3>Antigüedad al momento de salir</h3>${tablaComp(filasDim(A, B, A.rango, B.rango, (k) => ETI_RANGO[k] ?? titulo(k), ORDEN_RANGO), etiA, etiB)}</div>
      <div class="tarjeta"><h3>Razón de salida</h3>${tablaComp(filasDim(A, B, A.razon, B.razon), etiA, etiB)}</div>
      <div class="tarjeta"><h3>Motivos de salida</h3>${tablaComp(filasDim(A, B, aMapa(aplicarDesglose(A.subMotivo, null).items), aMapa(aplicarDesglose(B.subMotivo, null).items), (k) => k), etiA, etiB)}
        <p class="pie">Todos los motivos por separado, sin agrupar en "Otros". ${notaUnificados} "${SIN_DETALLE}" son renuncias sin motivo registrado.</p></div>
      <div class="tarjeta"><h3>Los que se van antes de 6 meses, ¿por qué?</h3>${tablaComp(filasDim(A.tempranas ?? { n: 0 }, B.tempranas ?? { n: 0 }, aMapa(aplicarDesglose(A.tempranas?.subMotivo, null).items), aMapa(aplicarDesglose(B.tempranas?.subMotivo, null).items), (k) => k), etiA, etiB)}
        <p class="pie">Solo salidas con menos de 6 meses de antigüedad: ${fmtNum(A.tempranas?.n ?? 0)} en ${tramoCorto} ${a} y ${fmtNum(B.tempranas?.n ?? 0)} en ${tramoCorto} ${b}. Todos los motivos por separado, sin agrupar en "Otros". El porcentaje es sobre ese grupo.</p></div>
      <div class="tarjeta"><h3>Por agencia / tienda (las 12 con más salidas)</h3>${tablaComp(filasDim(A, B, A.agencia, B.agencia, (k) => { const [n, t] = k.split('·'); return t ? `${n} (${t})` : titulo(n); }).slice(0, 12), etiA, etiB)}</div>
      ${depto === 'comercial' ? '' : `<div class="tarjeta"><h3>Por área de la empresa</h3>${tablaComp(filasDim(A, B, A.area, B.area, (k) => NOMBRE_AREA[k] ?? titulo(k)), etiA, etiB)}</div>`}
      <div class="tarjeta"><h3>Por marca</h3>${tablaComp(filasDim(A, B, A.marca, B.marca, (k) => k), etiA, etiB)}</div>
      <div class="tarjeta"><h3>Por supervisor o jefe</h3>${tablaComp(filasDim(A, B, Object.fromEntries(Object.entries(A.porSupervisor ?? {}).map(([k, s]) => [k, s.n])), Object.fromEntries(Object.entries(B.porSupervisor ?? {}).map(([k, s]) => [k, s.n])), (k) => k), etiA, etiB)}
        <p class="pie">Bajas del equipo de cada supervisor en cada tramo; el porcentaje es su parte del total del tramo.</p></div>
      <div class="tarjeta"><h3>Por género</h3>${tablaComp(filasDim(A, B, A.genero, B.genero), etiA, etiB)}</div>`;
    for (const [id, clave] of [['comp-a', 'a'], ['comp-b', 'b'], ['comp-mm', 'mm']]) {
      cont.querySelector(`#${id}`).addEventListener('change', (e) => {
        compSel[clave] = e.target.value;
        if (clave !== 'mm' && compSel.a === compSel.b) compSel[clave === 'a' ? 'b' : 'a'] = anios.find((x) => x !== compSel[clave]);
        pintarComparativa(depto);
      });
    }
  }

  let depto = pintarSelectorDepto((d) => { depto = d; pintar(depto, periodo); pintarComparativa(depto); });
  let periodo = pintarSelectorPeriodo({ ...aniosYMeses({ salidas: salidasTodo }), generado: salidasTodo.generado },
    (p) => { periodo = p; pintar(depto, periodo); });
  pintar(depto, periodo);
  pintarComparativa(depto);
  activarDetalles();
  pintarPie(meta);
}

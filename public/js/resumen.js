// Página Resumen (CEO): solo lectura. Costo de rotación del período, costo por salida
// por tipo con barra de composición, y hallazgos generados de los datos.
// Todo se pinta con pintar(depto, periodo) y se redibuja al cambiar los selectores
// General / Comercial y de período (pedidos del CEO, 2026-09-07).
import { costoSalida, PARAMS_DEFECTO, VENTAS_TIPO, ORDEN_TIPOS, fmtQ } from './modelo.js';
import { cargarDatos, pintarPie, marcarNavActiva, fmtNum, diasCalibrados,
  pintarSelectorDepto, vacantesDe, salidasDe, etiquetaDepto, notaAlcance,
  pintarSelectorPeriodo, vacantesEnPeriodo, agregarVacantes, dimsSalidas, etiquetaPeriodo, rangoPeriodo, aniosYMeses, MES_CORTO } from './comun.js';

marcarNavActiva();
const datos = await cargarDatos();
const salidasTodo = await fetch('data/salidas.json', { cache: 'no-cache' })
  .then((r) => (r.ok ? r.json() : null)).catch(() => null);
const { rotacion, meta } = datos;

const NOMBRE_TIPO = {
  AA: 'Tienda AA · ventas arriba de Q1M/mes',
  A: 'Tienda A · Q500k–Q1M/mes',
  B: 'Tienda B · Q300k–500k/mes',
  C: 'Tienda C · abajo de Q300k/mes',
};

function pintar(depto, periodo) {
  const vacantes = vacantesDe(datos.vacantes, depto);
  const salidas = salidasDe(salidasTodo, depto);
  const generado = vacantes.generado;
  const filasP = vacantesEnPeriodo(vacantes.filas, periodo, generado);
  const A = agregarVacantes(filasP); // días de vacante, plazas abiertas (control de vacantes)
  const D = dimsSalidas(salidas, periodo); // salidas del período (registro de SALIDAS)
  // Decisión de Oscar (2026-09-07): las salidas que se costean salen del registro de SALIDAS
  // (completo), no del control de vacantes (solo las plazas que se abrieron). Los días de
  // vacante siguen saliendo del control de vacantes.
  const salidasPorTipo = D.porTipoTienda ?? {};
  const rdS = (D.razon?.RENUNCIA ?? 0) + (D.razon?.DESPIDO ?? 0);
  const mezcla = { pctRenuncia: rdS ? (D.razon.RENUNCIA ?? 0) / rdS : null, pctDespido: rdS ? (D.razon.DESPIDO ?? 0) / rdS : null };
  const etiP = etiquetaPeriodo(periodo, generado);
  const rango = rangoPeriodo(periodo, generado);
  document.getElementById('alcance').innerHTML = notaAlcance(depto);
  document.getElementById('sub-titulo').textContent =
    `Resumen ejecutivo · ${etiquetaDepto(depto)} · ${etiP} · calibrado con los datos reales de vacantes`;
  document.getElementById('h-costo').textContent = `Costo de rotación · ${etiP}`;

  // ── costo del período ──────────────────────────────────────────────────────
  // salidas reales del período (vacantes solicitadas en el período) × costo por salida
  // con días reales del período, por tipo.
  let costoAnual = 0, salidasCosteadas = 0, salidasSinTipo = 0;
  const detallePorTipo = [];
  const costoTipo = {}; // costo por salida de cada tipo (también para el supuesto de abajo)
  for (const tipo of ORDEN_TIPOS) {
    const cal = diasCalibrados(A.diasCobertura, tipo);
    const dias = cal.dias ?? PARAMS_DEFECTO.diasVacante;
    const p = { ...PARAMS_DEFECTO, diasVacante: dias };
    const cR = costoSalida(VENTAS_TIPO[tipo], 'renuncia', p);
    const cD = costoSalida(VENTAS_TIPO[tipo], 'despido', p);
    costoTipo[tipo] = { cR, cD };
    const s = salidasPorTipo[tipo];
    if (!s || (!s.renuncia && !s.despido)) continue;
    const anual = s.renuncia * cR.total + s.despido * cD.total;
    costoAnual += anual;
    salidasCosteadas += s.renuncia + s.despido;
    detallePorTipo.push({ tipo, salidas: s, cR, cD, anual, cal: { dias, fuente: cal.dias == null ? 'supuesto del modelo, sin vacantes cerradas en el período' : cal.fuente } });
  }
  const st = salidasPorTipo['sin tipo'];
  if (st) salidasSinTipo = st.renuncia + st.despido;
  const noTienda = salidasPorTipo['no tienda'];
  const salidasNoTienda = noTienda ? noTienda.renuncia + noTienda.despido : 0;
  const salidasOtras = Object.values(salidasPorTipo).reduce((s, v) => s + (v.otros ?? 0), 0); // no confirmados, vacacionistas, sin razón
  // de qué lugares vienen las salidas sin tipo (registro de SALIDAS: tienda sin clasificar o
  // nombre de agencia que no está en config/tiendas.json)
  const origenSinTipo = Object.entries(D.sinTipoOrigen ?? {}).sort((x, y) => y[1] - x[1]).map(([k, n]) => `${k} ×${n}`).join(' · ');

  // ── Lo esencial en 6 cifras (lo primero que ve Gerencia) ───────────────────
  // Calculadas en vivo de los JSON publicados — nunca escritas a mano — y cada
  // tarjeta dice qué período cubre. Va en try/catch: si algo falta, el resto se pinta igual.
  try {
    const kpi = (valor, eti, nota, clase = '', tam = '') =>
      `<div class="kpi"><div class="kpi-valor ${clase} ${tam}">${valor}</div><div class="kpi-eti">${eti}</div>${nota ? `<div class="kpi-nota">${nota}</div>` : ''}</div>`;
    const tiles = [];

    // 1. qué parte de la plantilla se reemplazó en el período (salidas con vacante / colaboradores al cierre)
    const areaRot = depto === 'comercial' ? 'AREA COMERCIAL' : 'TOTAL EMPRESA';
    const hastaYm = rango.hasta ? rango.hasta.slice(0, 7) : null;
    const cierre = rotacion.acumulado
      .filter((r) => r.area === areaRot && r.fin != null && (!hastaYm || `${r.anio}-${String(r.mesNum).padStart(2, '0')}` <= hastaYm))
      .sort((a, b) => a.anio - b.anio || a.mesNum - b.mesNum).at(-1);
    const salidas12 = salidasCosteadas + salidasSinTipo + salidasNoTienda;
    if (cierre && cierre.fin > 0 && salidas12 > 0) {
      const pct = Math.round((salidas12 / cierre.fin) * 100);
      tiles.push(kpi(`${pct}%`, `de la plantilla ${depto === 'comercial' ? 'comercial ' : ''}se reemplazó · ${etiP}`,
        `${fmtNum(salidas12)} renuncias y despidos (registro de salidas) · ${fmtNum(cierre.fin)} colaboradores al cierre de ${MES_CORTO[cierre.mesNum - 1]} ${cierre.anio}`,
        pct >= 50 ? 'rojo' : ''));
    }

    // 2. salidas tempranas y antigüedad mediana (registro de salidas, mismo período)
    if (D.n) {
      const TEMPRANOS = ['MENOS 1 MES', 'DE 1 A 2 MESES', 'DE 2 A 4 MESES', 'DE 4 A 6 MESES'];
      const temp = TEMPRANOS.reduce((s, k) => s + (D.rango[k] ?? 0), 0);
      const pct = Math.round((temp / D.n) * 100);
      const meses = D.diasLab.mediana != null ? (D.diasLab.mediana / 30.4).toFixed(1) : null;
      tiles.push(kpi(`${pct}%`, 'se va antes de cumplir 6 meses',
        `antigüedad mediana al salir: ${meses ?? '—'} meses · ${fmtNum(D.n)} salidas, ${etiP}`,
        pct >= 50 ? 'rojo' : ''));
    }

    // 3. cuánto cuesta cada salida (renuncia; rango tienda B → A, con días reales)
    const cB = costoTipo.B.cR.total, cA = costoTipo.A.cR.total;
    const mil = (v) => fmtNum(Math.round(v / 1000));
    tiles.push(kpi(`Q${mil(cB)}–${mil(cA)} mil`, 'cuesta cada salida (renuncia, tienda B a tienda A)',
      'con días de vacante reales · detalle por tipo más abajo', '', 'medio'));

    // 4. lo que ya cuestan las plazas abiertas hoy (no depende del período)
    const abiertas = vacantes.filas.filter((r) => r.estatus === 'ABIERTA');
    if (abiertas.length) {
      const costoAbiertas = abiertas.reduce((s, r) => s + (costoTipo[r.tipo] ?? costoTipo.B).cR.total, 0);
      tiles.push(kpi(fmtQ(costoAbiertas), `ya cuestan las ${fmtNum(abiertas.length)} plazas abiertas hoy`,
        'costo de renuncia por tipo de tienda; sin tipo se asume tipo B · no depende del período', 'ambar', 'medio'));
    }

    // 5. días para cubrir una vacante
    const g = A.diasCobertura.global;
    if (g.mediana != null) {
      tiles.push(kpi(`${g.mediana} / ${g.promedio} días`, 'mediana / promedio para cubrir una vacante',
        `${fmtNum(g.n)} vacantes cerradas con dato · ${etiP}`, '', 'medio'));
    }

    // 6. renuncias vs despidos (registro de salidas)
    if (mezcla.pctRenuncia != null) {
      tiles.push(kpi(`${Math.round(mezcla.pctRenuncia * 100)}%`, 'de las salidas son renuncias, no despidos',
        `${fmtNum(rdS)} renuncias y despidos · ${etiP}`));
    }

    document.getElementById('cifras-clave').innerHTML = tiles.join('');
  } catch (e) {
    console.warn('Cifras clave no disponibles:', e);
    document.getElementById('cifras-clave').innerHTML = '';
  }

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
      <div class="kpi-eti">costo de rotación · ${etiP} (${fmtNum(salidasCosteadas)} renuncias y despidos en tiendas clasificadas${supuesto ? ` + ${fmtNum(salidasSinTipo)} estimadas por supuesto` : ''}, según el registro de salidas) · ${etiquetaDepto(depto)}</div>
      ${supuesto ? `<div class="kpi-nota">Incluye <b>${fmtQ(extra)}</b> estimados con un <b>SUPUESTO</b> sobre ${salidasSinTipo === 1 ? 'la salida' : `las ${fmtNum(salidasSinTipo)} salidas`} en tiendas sin clasificar — el reparto se ajusta en la tarjeta de abajo.</div>` : ''}
      ${salidasNoTienda ? `<div class="kpi-nota">Otras ${fmtNum(salidasNoTienda)} salidas del período fueron en oficinas, CEDI o regiones (no tiendas): quedan fuera de este costo porque el modelo es de tiendas.</div>` : ''}
      ${salidasOtras ? `<div class="kpi-nota">${fmtNum(salidasOtras)} salidas más no se costean por no ser renuncia ni despido (no confirmados, vacacionistas o sin razón registrada).</div>` : ''}
      ${!salidasCosteadas && !salidasSinTipo ? '<div class="kpi-nota">No hay renuncias ni despidos registrados en este período y alcance.</div>' : ''}
    </div>
    <div class="kpi">
      <div class="kpi-valor">${medianaDias ?? '—'} días</div>
      <div class="kpi-eti">tarda en cubrirse la vacante típica (mediana real, ${etiP})</div>
      <div class="kpi-nota">${A.diasCobertura.global.promedio != null ? `Promedio: ${A.diasCobertura.global.promedio} días — sube por unos pocos casos largos.` : 'Sin vacantes cerradas con dato en el período.'}</div>
    </div>
    <div class="kpi">
      <div class="kpi-valor"><span class="verde">${Math.round((mezcla.pctRenuncia ?? 0) * 100)}%</span> · <span class="ambar">${Math.round((mezcla.pctDespido ?? 0) * 100)}%</span></div>
      <div class="kpi-eti"><span class="verde">renuncias</span> vs <span class="ambar">despidos</span> (registro de salidas, ${etiP})</div>
    </div>
    <div class="kpi">
      <div class="kpi-valor">${fmtNum(vacantes.filas.filter((r) => r.estatus === 'ABIERTA').length)}</div>
      <div class="kpi-eti">vacantes abiertas hoy</div>
    </div>`;
  }
  pintarKpis();

  // ── tarjeta del supuesto (solo si hay salidas sin clasificar) ──────────────
  const card = document.getElementById('supuesto-sintipo');
  card.hidden = !supuesto;
  if (supuesto) {
    card.innerHTML = `
      <h3>⚠️ Supuesto: ${salidasSinTipo === 1 ? 'la salida' : `las ${fmtNum(salidasSinTipo)} salidas`} en tiendas sin clasificar</h3>
      <p style="font-size:13.5px; margin-bottom:4px">Estas salidas ocurrieron en tiendas que aún no tienen
        tipo asignado (AA/A/B/C) o cuyo nombre en el registro de salidas no está en el archivo de tiendas, así que su costo no sale de datos: <b>lo que sigue es UN SUPUESTO editable</b>.
        Reparte ${salidasSinTipo === 1 ? 'esa salida' : `las ${fmtNum(salidasSinTipo)} salidas`} entre los tipos; por defecto asumimos 80% tipo B y el resto C.</p>
      <div class="sup-inputs">
        ${ORDEN_TIPOS.map((t) => `<label>${t}
          <input type="number" inputmode="numeric" id="sup-${t}" min="0" max="${salidasSinTipo}" step="1" value="${supuesto[t]}">
        </label>`).join('')}
      </div>
      <p id="sup-aviso" style="font-size:13px; font-weight:600; color:var(--rojo); margin:4px 0"></p>
      <p style="font-size:13.5px">Costo estimado con este supuesto: <b class="num" id="sup-total"></b>
        <span style="color:var(--tinta-suave)">(usando la mezcla real de esas salidas: ${fmtNum(st.renuncia)} renuncias y ${fmtNum(st.despido)} despidos)</span></p>
      ${origenSinTipo ? `<p style="font-size:13px; margin-top:6px"><b>De dónde vienen:</b> ${origenSinTipo}.</p>` : ''}
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
  document.getElementById('tarjetas-tipo').innerHTML = detallePorTipo.length ? detallePorTipo.map((d) => `
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
        <div class="anual-eti">Acumulado de este tipo · ${etiP} (volumen × costo)</div>
        <div><b class="num anual-num">${fmtQ(d.anual)}</b>
          <span class="anual-det">= ${fmtNum(d.salidas.renuncia)} ${d.salidas.renuncia === 1 ? 'renuncia' : 'renuncias'} + ${fmtNum(d.salidas.despido)} ${d.salidas.despido === 1 ? 'despido' : 'despidos'} (registro de salidas)</span></div>
        <div class="anual-det">Días de vacante usados: ${d.cal.dias} (${d.cal.fuente}).</div>
      </div>
    </div>`).join('')
    : `<p class="sub">No hubo salidas en tiendas clasificadas en ${etiP} con este alcance.</p>`;

  // ── hallazgos generados de los datos ───────────────────────────────────────
  const hallazgos = [];

  // 1. días reales vs supuesto del modelo
  const promedioDias = A.diasCobertura.global.promedio;
  if (medianaDias != null && medianaDias < PARAMS_DEFECTO.diasVacante) {
    hallazgos.push(`Una vacante típica se cubre en <b>${medianaDias} días</b> (mediana real, ${etiP}; el promedio es ${promedioDias} porque algunos casos largos lo suben). Está por debajo de los 30 días que asumía el modelo — este resumen ya usa los días reales.`);
  } else if (medianaDias != null && medianaDias > PARAMS_DEFECTO.diasVacante) {
    hallazgos.push(`Las vacantes tardan <b>${medianaDias} días</b> (mediana real, ${etiP}; promedio ${promedioDias}) en cubrirse, por encima del supuesto de 30 días del modelo: el costo real es mayor que el teórico.`);
  }

  // 2. mezcla renuncia/despido (registro de salidas)
  if (mezcla.pctRenuncia != null) {
    const extraDespido = detallePorTipo.length
      ? detallePorTipo[0].cD.total - detallePorTipo[0].cR.total : null;
    hallazgos.push(`De cada 100 salidas, <b>${Math.round(mezcla.pctRenuncia * 100)} son renuncias</b> y <b>${Math.round(mezcla.pctDespido * 100)} despidos</b> (${etiP}).${extraDespido ? ` Cada despido cuesta <b>${fmtQ(extraDespido)}</b> más que una renuncia (indemnización), pero el grueso del costo viene del volumen de renuncias.` : ''}`);
  }

  // 3. dónde se concentran las salidas
  const topTipo = [...detallePorTipo].sort((a, b) => b.anual - a.anual)[0];
  if (topTipo && costoAnual > 0) {
    hallazgos.push(`Las tiendas <b>tipo ${topTipo.tipo}</b> concentran la mayor parte del costo: <b>${fmtQ(topTipo.anual)}</b> en ${etiP} (${Math.round((topTipo.anual / costoAnual) * 100)}% del total costeado), entre volumen de salidas y ventas en riesgo.`);
  }

  // 4. (si aplica) salidas sin clasificar
  if (salidasSinTipo && salidasSinTipo >= salidasCosteadas * 0.25) {
    hallazgos.push(`Hay <b>${fmtNum(salidasSinTipo)} salidas</b> en tiendas todavía sin tipo (Catocha, Petapa, etc.). Su costo se estima con un <b>supuesto ajustable</b> (arriba); clasificarlas en el archivo de tiendas reemplaza el supuesto por el dato real.`);
  }

  document.getElementById('hallazgos').innerHTML = hallazgos.length
    ? hallazgos.slice(0, 4).map((h) => `<div class="hallazgo">${h}</div>`).join('')
    : `<p class="sub">Sin hallazgos para ${etiP} con este alcance.</p>`;

  // (Los avisos de calidad de datos siguen generándose en meta.json y en el log del
  // pipeline, pero por decisión de Oscar (2026-09-03) ya no se muestran en el sitio.)

  // ── De dónde salen los datos (la primera pregunta de Gerencia) ────────────
  // Conteos en vivo de meta.json y de los agregados; el texto describe el origen
  // y qué se excluye. Nunca incluye el enlace ni el ID del sheet.
  try {
    const f = new Date(meta.generado);
    const fecha = `${f.toLocaleDateString('es-GT', { day: 'numeric', month: 'long', year: 'numeric' })} a las ${f.toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' })}`;
    const g = datos.vacantes.agregados.diasCobertura.global;
    const deptos = datos.vacantes.departamentos ?? {};
    const nComercial = deptos.COMERCIAL ?? 0;
    document.getElementById('fuente-datos').innerHTML = `
      <p style="font-size:13.5px; margin-bottom:8px">Todo lo que muestra este tablero sale de los <b>registros propios de RRHH</b>
        en su archivo de Google Sheets. Se leen automáticamente, se agregan y se publican sin ningún dato personal.
        Última lectura: <b>${fecha}</b></p>
      <ul style="font-size:13.5px; line-height:1.55; padding-left:18px; margin:0">
        <li><b>Registro de salidas</b> (${fmtNum(salidasTodo?.total?.n ?? 0)} bajas): es la base para <b>contar</b> las salidas que se costean
          (renuncias y despidos por tipo de tienda, según la agencia de cada baja), la mezcla renuncias/despidos y la antigüedad al salir. Solo conteos agregados.</li>
        <li><b>Control de vacantes</b> (${fmtNum(meta.filasVacantes)} registros): fecha de solicitud y de cierre → <b>días de cobertura</b>
          (${fmtNum(g.n)} cerradas con dato en todo el registro), con los que se calibra el costo por salida; estatus → abiertas hoy.
          No se usa para contar salidas porque solo registra las plazas que se abrieron.</li>
        <li><b>Selector General / Comercial</b>: el registro de salidas y el indicador de rotación traen el área de cada fila y se
          filtran directo. El control de vacantes <b>no trae departamento</b>: se deduce del puesto (asesores, jefes de agencia,
          asistentes y servicios varios de tienda = Comercial; cobros, auditoría, contabilidad, logística y mercadeo = otros),
          igual que lo registra RRHH en las salidas. Con esa regla ${fmtNum(nComercial)} de ${fmtNum(meta.filasVacantes)} vacantes son comerciales.</li>
        <li><b>Selector de período</b>: una vacante pertenece al período por su fecha de solicitud; una salida, por su fecha de baja;
          la rotación, por el mes del indicador. "Año a la fecha" es el año en curso hasta la última lectura. Las plazas abiertas hoy
          no dependen del período.</li>
        <li><b>Indicador de rotación mensual</b> (${fmtNum(meta.filasRotacionAcumulada)} filas): colaboradores al inicio y cierre de cada mes
          y % de rotación acumulada — de ahí sale la plantilla con la que se compara (total empresa o área comercial, según el selector).</li>
        <li><b>Privacidad</b>: del registro de salidas jamás se publican filas individuales ni nombres; los valores con menos de 3 casos
          se agrupan en "otros" dentro de cada período.</li>
        <li><b>Tipo de tienda (AA / A / B / C)</b>: archivo de clasificación de tiendas de RRHH; las ventas por tipo son puntos medios
          del rango de cada tipo y se pueden cambiar en el Simulador.</li>
        <li><b>Costo por salida</b>: modelo "Costo de rotación por tipo de tienda" (ago 2025) implementado en el Simulador — ventas
          perdidas, curva de aprendizaje, tiempo de jefatura y RRHH, publicidad y finiquito/indemnización — con los días de vacante
          reales. Sus valores de control se verifican en cada publicación.</li>
        <li><b>Actualización</b>: automática todos los días a las 6:00 (Guatemala) y en cada publicación. Antes de publicar corre una
          verificación anti-fugas: si detecta un dato personal, no publica nada.</li>
      </ul>
      <p class="pie">No se usan las pestañas de altas ni la base de datos general (contienen datos personales). Las pestañas se
        reconocen por sus encabezados, no por su nombre ni posición, así que mover o renombrar hojas no rompe el tablero.</p>`;
  } catch (e) {
    console.warn('Fuente de datos no disponible:', e);
  }
}

// ── selectores globales ──────────────────────────────────────────────────────
let depto = pintarSelectorDepto((d) => { depto = d; pintar(depto, periodo); });
let periodo = pintarSelectorPeriodo(
  { ...aniosYMeses({ vacantes: datos.vacantes, salidas: salidasTodo, rotacion }), generado: datos.vacantes.generado },
  (p) => { periodo = p; pintar(depto, periodo); });
pintar(depto, periodo);
pintarPie(meta);

// Página Rotación: acumulado por año, comercial vs total, bajas mensuales y por departamento.
// Selector General / Comercial: el indicador del sheet ya trae el área de cada fila
// (TOTAL EMPRESA / AREA COMERCIAL en el acumulado; DEPARTAMENTO en el mensual).
// Selector de período: los KPI se leen al último mes del período; las gráficas
// muestran los meses del período (un mes concreto se muestra con su año de contexto).
// Cada gráfica lleva su "cómo se lee" (Oscar, 2026-10-07): referencia del 60% anual, valores finales,
// comparación año contra año en el mismo mes, contrataciones junto a las bajas y detalle al tocar.
import { cargarDatos, pintarPie, marcarNavActiva, fmtNum, pintarSelectorDepto, notaAlcance, activarDetalles,
  pintarSelectorPeriodo, etiquetaPeriodo, rangoPeriodo, mesesDelPeriodo, aniosYMeses, MES_CORTO, MES_LARGO, fmtYm, marcaActual, etiquetaMarca, MARCAS } from './comun.js';
import { barrasH, columnas, lineas, leyenda, anchoDe } from './graficas.js';
import { fmtPct } from './modelo.js';

marcarNavActiva();
const { rotacion, meta } = await cargarDatos();
const pct0 = (v) => Math.round(v * 100) + '%';
const titulo = (s) => s.charAt(0) + s.slice(1).toLowerCase();
const ymDe = (r) => `${r.anio}-${String(r.mesNum).padStart(2, '0')}`;
const mesAnio = (r) => `${MES_CORTO[r.mesNum - 1]} ${r.anio}`;
const signo = (n) => (n === 0 ? '0' : `${n > 0 ? '+' : '−'}${fmtNum(Math.abs(n))}`);
const puntos = (d) => `${d > 0 ? '+' : d < 0 ? '−' : ''}${Math.abs(Math.round(d * 1000) / 10).toLocaleString('es-GT')} puntos`;
// Referencia que usa RRHH para leer el indicador: ~60% anual (lo que ya decía la nota del acumulado).
const REFERENCIA = 0.6;

const total = rotacion.acumulado.filter((r) => r.area === 'TOTAL EMPRESA' && r.pctAcum != null);
const comercial = rotacion.acumulado.filter((r) => r.area === 'AREA COMERCIAL' && r.pctAcum != null);
// Indicador calculado por el pipeline (SALIDAS + ALTAS + BASE DE DATOS GENERAL), por alcance:
// total · comercial · americana · abiq · friotec. Misma forma que el manual para poder graficarlo igual.
const CALC = rotacion.calculado ?? null;
const ESCOPO_ETI = { total: 'total empresa', comercial: 'área comercial', americana: 'Americana', abiq: 'Abi Q', friotec: 'Friotec' };
const serieCalc = (escopo) => (CALC?.series?.[escopo] ?? []).filter((r) => !r.parcial && r.pctAcum != null).map((r) => ({ ...r, area: escopo }));
const mesesMensual = [...new Set(rotacion.mensual.map(ymDe))].sort();
const promedio = (r) => (r.inicio != null && r.fin != null && r.inicio + r.fin > 0 ? (r.inicio + r.fin) / 2 : null);

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
    const prom = promedio(ultimo);
    const mesU = MES_CORTO[ultimo.mesNum - 1];
    const promMes = ultimo.bajasAcum != null ? ultimo.bajasAcum / ultimo.mesNum : null;
    document.getElementById('kpis').innerHTML = `
      <div class="kpi">
        <div class="kpi-valor ${ultimo.pctAcum >= REFERENCIA ? 'rojo' : ''}">${fmtPct(ultimo.pctAcum, 1)}</div>
        <div class="kpi-eti">rotación acumulada a ${mesU} ${ultimo.anio} (${nombreSerie})</div>
        <div class="kpi-nota">${ultimo.bajasAcum != null && prom
          ? `${fmtNum(ultimo.bajasAcum)} bajas de ene a ${mesU} ÷ ${fmtNum(Math.round(prom))} de plantilla promedio`
          : `acumulado del año en curso a ese mes`} · ${etiP}</div>
      </div>
      <div class="kpi">
        <div class="kpi-valor ${dif == null ? '' : dif <= 0 ? 'verde' : 'ambar'}">${dif == null ? '—' : (dif > 0 ? '+' : '') + fmtPct(dif, 1)}</div>
        <div class="kpi-eti">contra el mismo mes de ${ultimo.anio - 1}</div>
        <div class="kpi-nota">${mismoMesAnterior
          ? `a ${mesU} ${ultimo.anio - 1} iba en ${fmtPct(mismoMesAnterior.pctAcum, 1)}; ${dif <= 0 ? 'este año rota más despacio' : 'este año rota más rápido'}`
          : `sin dato de ${mesU} ${ultimo.anio - 1} para comparar`}</div>
      </div>
      <div class="kpi">
        <div class="kpi-valor">${ultimo.fin != null ? fmtNum(ultimo.fin) : '—'}</div>
        <div class="kpi-eti">colaboradores al cierre de ${mesU} ${ultimo.anio} (${nombreSerie})</div>
        <div class="kpi-nota">${ultimo.inicio != null && ultimo.fin != null
          ? `empezó el mes con ${fmtNum(ultimo.inicio)}: ${ultimo.fin === ultimo.inicio ? 'el equipo terminó igual' : `${ultimo.fin > ultimo.inicio ? 'creció' : 'se redujo'} en ${fmtNum(Math.abs(ultimo.fin - ultimo.inicio))}`}`
          : 'plantilla al cierre del último mes del período'}</div>
      </div>
      <div class="kpi">
        <div class="kpi-valor">${ultimo.bajasAcum != null ? fmtNum(ultimo.bajasAcum) : '—'}</div>
        <div class="kpi-eti">bajas acumuladas en ${ultimo.anio} a ${mesU}</div>
        <div class="kpi-nota">${promMes != null ? `promedio de ${promMes.toLocaleString('es-GT', { maximumFractionDigits: 1 })} bajas por mes en ${ultimo.anio}` : 'salidas de enero a ese mes'}</div>
      </div>`;
  }

  // ── acumulado por año (líneas): los años del período; si es uno solo, también el anterior ──
  const aniosTodos = [...new Set(serie.map((r) => r.anio))].sort();
  let anios = [...new Set(enPeriodo.map((r) => r.anio))].sort();
  if (!anios.length) anios = aniosTodos;
  if (anios.length === 1 && aniosTodos.includes(anios[0] - 1)) anios = [anios[0] - 1, anios[0]];
  const COLORES_ANIO = ['#9AA8A1', '#46615A', '#0B7A55'];
  // con un mes elegido, las líneas se cortan en ese mes: así la gráfica dice lo mismo que el titular y los KPI
  const mesCorte = periodo.startsWith('m:') && ultimo ? ultimo.mesNum : 12;
  const seriesAnios = anios.map((a, i) => ({
    nombre: String(a),
    color: COLORES_ANIO[(i + (3 - anios.length % 3)) % COLORES_ANIO.length],
    puntos: MES_CORTO.map((_, m) => (m + 1 > mesCorte ? null : serie.find((r) => r.anio === a && r.mesNum === m + 1)?.pctAcum ?? null)),
  }));
  document.getElementById('h-acum').textContent = `Rotación acumulada del año · ${anios.length > 1 ? 'comparación entre años' : anios[0]}`;
  document.getElementById('acum-titular').innerHTML = titularAcumulado(serie, ultimo, conMarca ? `de ${MARCAS[marca]}` : esCom ? 'de las tiendas (Comercial)' : 'de toda la empresa', generado);
  document.getElementById('acumulado-anios').innerHTML = lineas(MES_CORTO, seriesAnios,
    { formato: pct0, ancho: anchoDe('acumulado-anios'), paso: 0.2, tituloY: '% del equipo que se ha ido desde enero (acumulado)', referencia: { valor: REFERENCIA, eti: `alerta RRHH: ${pct0(REFERENCIA)} al año` }, etiquetasFinales: true, nombresFinales: true });
  document.getElementById('leyenda-anios').innerHTML = leyenda([...seriesAnios.map((s) => ({ eti: `${s.nombre}${s.nombre === String(+String(generado).slice(0, 4)) ? ' (en curso)' : ''}`, color: s.color })), { eti: `punteada roja: alerta del ${pct0(REFERENCIA)} anual`, color: '#A33B2E' }]);
  document.getElementById('acumulado-nota').innerHTML = notaAcumulado(serie, anios, ultimo, conMarca ? `Marca ${MARCAS[marca]}, indicador calculado` : esCom ? 'Área comercial' : 'Total empresa', generado);

  // ── rotación por marca (calculada) y validación contra el manual ──────────
  pintarMarcas(rango);

  // ── comercial vs total (el último año del período) — siempre se muestra la comparación ──
  const anioCT = ultimo ? ultimo.anio : aniosTodos.at(-1);
  const seriesCT = [
    { nombre: 'Total empresa', color: '#46615A', puntos: MES_CORTO.map((_, m) => (m + 1 > mesCorte ? null : total.find((r) => r.anio === anioCT && r.mesNum === m + 1)?.pctAcum ?? null)) },
    { nombre: 'Área comercial', color: '#B5741A', puntos: MES_CORTO.map((_, m) => (m + 1 > mesCorte ? null : comercial.find((r) => r.anio === anioCT && r.mesNum === m + 1)?.pctAcum ?? null)) },
  ];
  document.getElementById('h-ct').textContent = `Comercial vs. total empresa · ${anioCT}`;
  seriesCT[0].nombre = 'Toda la empresa'; seriesCT[0].nombreCorto = 'Empresa'; seriesCT[1].nombre = 'Tiendas';
  document.getElementById('ct-titular').innerHTML = titularComercialTotal(anioCT, ultimo && !conMarca ? ultimo.mesNum : null);
  document.getElementById('comercial-total').innerHTML = lineas(MES_CORTO, seriesCT,
    { formato: pct0, ancho: anchoDe('comercial-total'), paso: 0.2, tituloY: `% del equipo que se ha ido desde enero de ${anioCT}`, referencia: { valor: REFERENCIA, eti: `alerta RRHH: ${pct0(REFERENCIA)} al año` }, etiquetasFinales: true, nombresFinales: true });
  document.getElementById('leyenda-ct').innerHTML = leyenda([{ eti: `Tiendas (departamento Comercial) ${anioCT}`, color: '#B5741A' }, { eti: `Toda la empresa ${anioCT}, tiendas incluidas`, color: '#46615A' }, { eti: `punteada roja: alerta del ${pct0(REFERENCIA)} anual`, color: '#A33B2E' }]);
  document.getElementById('ct-nota').innerHTML = notaComercialTotal(anioCT, ultimo && !conMarca ? ultimo.mesNum : null);

  // ── bajas y contrataciones por mes (suma de departamentos, o solo Comercial) ─
  const mensual = esCom ? rotacion.mensual.filter((r) => r.departamento === 'COMERCIAL') : rotacion.mensual;
  const porMes = new Map();
  for (const r of mensual) {
    const k = ymDe(r);
    const a = porMes.get(k) ?? { bajas: 0, altas: 0, fin: 0, inicio: 0 };
    a.bajas += r.bajas; a.altas += r.altas; a.fin += r.fin; a.inicio += r.inicio ?? 0;
    porMes.set(k, a);
  }
  const mesesOrden = mesesDelPeriodo(periodo, mesesMensual, generado).filter((k) => porMes.has(k));
  const mesSel = periodo.startsWith('m:') ? periodo.slice(2) : null;
  const pctEquipo = (m) => (m.fin > 0 ? ` · ${fmtPct(m.bajas / m.fin, 1)} del equipo` : '');
  document.getElementById('h-bajas').textContent = `Bajas y contrataciones por mes · ${etiP}`;
  document.getElementById('bajas-mes').innerHTML = columnas(
    mesesOrden.map((k) => {
      const [y, m] = k.split('-'), v = porMes.get(k), apagado = mesSel && k !== mesSel;
      return {
        eti: `${MES_CORTO[+m - 1]} ${y.slice(2)}`, valor: v.bajas, valor2: v.altas,
        color: apagado ? '#E3D3B8' : '#B5741A', color2: apagado ? '#D6E6DE' : '#9CCBB7',
        titulo: fmtYm(k),
        detalle: `${fmtNum(v.bajas)} bajas · ${fmtNum(v.altas)} contrataciones · saldo ${signo(v.altas - v.bajas)} · ${fmtNum(v.fin)} colaboradores al cierre${pctEquipo(v)}`,
      };
    }), { formato: fmtNum, ancho: anchoDe('bajas-mes') });
  document.getElementById('leyenda-bajas').innerHTML = leyenda([{ eti: 'bajas (con cifra)', color: '#B5741A' }, { eti: 'contrataciones', color: '#9CCBB7' }]);
  const ultimoMesK = mesSel && porMes.has(mesSel) ? mesSel : mesesOrden.at(-1);
  const ultimoMes = porMes.get(ultimoMesK);
  // "En los últimos 12 meses" / "En el año 2025" / "En 2026 a la fecha" / "En todo el registro"
  const enEtiP = etiP.startsWith('últimos') ? `En los ${etiP}` : etiP.startsWith('año') ? `En el ${etiP}` : `En ${etiP}`;
  const quienes = conMarca ? `de ${MARCAS[marca]}` : esCom ? 'de las tiendas (Comercial)' : 'de toda la empresa';
  if (ultimoMes) {
    const tot = mesesOrden.reduce((a, k) => { const v = porMes.get(k); a.bajas += v.bajas; a.altas += v.altas; return a; }, { bajas: 0, altas: 0 });
    const pico = mesesOrden.map((k) => [k, porMes.get(k).bajas]).sort((a, b) => b[1] - a[1])[0];
    const saldo = tot.altas - tot.bajas;
    const cambio = (d) => (d === 0 ? 'el equipo quedó igual' : d > 0 ? `el equipo <b class="verde">creció en ${fmtNum(d)}</b>` : `el equipo <b class="ambar">se redujo en ${fmtNum(-d)}</b>`);
    document.getElementById('bajas-titular').innerHTML = mesSel
      ? `<b>En ${fmtYm(ultimoMesK)} se fueron ${fmtNum(ultimoMes.bajas)} personas ${quienes} y entraron ${fmtNum(ultimoMes.altas)}</b>: ${cambio(ultimoMes.altas - ultimoMes.bajas)} y cerró el mes con ${fmtNum(ultimoMes.fin)} colaboradores${ultimoMes.fin > 0 ? ` (salió el ${fmtPct(ultimoMes.bajas / ultimoMes.fin, 0)} del equipo)` : ''}.`
      : `<b>${enEtiP} se fueron ${fmtNum(tot.bajas)} personas ${quienes} y entraron ${fmtNum(tot.altas)}</b>: ${cambio(saldo)}. Salen unas ${(tot.bajas / mesesOrden.length).toLocaleString('es-GT', { maximumFractionDigits: 0 })} personas al mes; el mes más alto fue ${fmtYm(pico[0])} con ${fmtNum(pico[1])}.`;
    document.getElementById('bajas-nota').textContent = mesSel
      ? `Las columnas oscuras son ${fmtYm(ultimoMesK)}; los meses anteriores son contexto. Ámbar = bajas (con cifra), verde = contrataciones. Toca una columna para ver el detalle de ese mes.`
      : `${mesesOrden.length} meses graficados. Ámbar = bajas (con cifra), verde = contrataciones: si la verde es más alta que la ámbar, ese mes el equipo creció. Último mes, ${fmtYm(ultimoMesK)}: ${fmtNum(ultimoMes.bajas)} bajas, ${fmtNum(ultimoMes.altas)} contrataciones y ${fmtNum(ultimoMes.fin)} colaboradores al cierre${pctEquipo(ultimoMes)}. Toca una columna para ver el detalle de ese mes.`;
  } else {
    document.getElementById('bajas-titular').innerHTML = '';
    document.getElementById('bajas-nota').textContent = `Sin datos mensuales en ${etiP}.`;
  }

  // ── bajas por departamento — solo tiene sentido en General ────────────────
  const secDepto = document.getElementById('sec-depto');
  secDepto.hidden = esCom;
  if (!esCom) {
    const corte = mesSel ? [mesSel] : (periodo === 'todo' ? mesesMensual.slice(-12) : mesesOrden);
    const porDepto = new Map();
    for (const r of rotacion.mensual) {
      if (!corte.includes(ymDe(r))) continue;
      const a = porDepto.get(r.departamento) ?? { bajas: 0, altas: 0, fin: 0, ultimoYm: '' };
      a.bajas += r.bajas; a.altas += r.altas;
      const ym = ymDe(r);
      if (ym >= a.ultimoYm) { a.ultimoYm = ym; a.fin = r.fin; }
      porDepto.set(r.departamento, a);
    }
    const etiTramo = periodo === 'todo' ? 'últimos 12 meses' : etiP;
    const enTramo = etiTramo.startsWith('últimos') ? `en los ${etiTramo}` : etiTramo.startsWith('año') ? `en el ${etiTramo}` : `en ${etiTramo}`;
    document.getElementById('h-depto').textContent = `Bajas por departamento · ${etiTramo}`;
    const totalBajas = [...porDepto.values()].reduce((a, v) => a + v.bajas, 0);
    const items = [...porDepto.entries()].filter(([, v]) => v.bajas > 0).sort((a, b) => b[1].bajas - a[1].bajas).slice(0, 10)
      .map(([k, v]) => ({
        eti: titulo(k), valor: v.bajas, color: k === 'COMERCIAL' ? '#B5741A' : '#46615A',
        extra: totalBajas ? `${fmtPct(v.bajas / totalBajas, 0)} de las bajas` : '',
        detalle: `${fmtNum(v.bajas)} bajas y ${fmtNum(v.altas)} contrataciones en ${etiTramo}${v.fin ? ` · ${fmtNum(v.fin)} colaboradores al cierre de ${fmtYm(v.ultimoYm)}${v.fin > 0 ? ` · las bajas equivalen al ${fmtPct(v.bajas / v.fin, 0)} de ese equipo` : ''}` : ''}`,
      }));
    const com = porDepto.get('COMERCIAL');
    const otros = [...porDepto.entries()].filter(([k, v]) => k !== 'COMERCIAL' && v.bajas > 0);
    document.getElementById('depto-titular').innerHTML = !items.length || !totalBajas ? ''
      : com && com.bajas > 0
        ? `<b>${fmtPct(com.bajas / totalBajas, 0)} de las bajas son de las tiendas (Comercial)</b>: ${fmtNum(com.bajas)} de ${fmtNum(totalBajas)} ${enTramo}. ${otros.length ? `El resto, ${fmtNum(totalBajas - com.bajas)}, se reparte entre ${otros.length === 1 ? 'un departamento' : `${otros.length} departamentos`}.` : ''}`
        : `<b>${titulo(items[0].eti.toUpperCase())} concentra el ${fmtPct(items[0].valor / totalBajas, 0)} de las bajas</b>: ${fmtNum(items[0].valor)} de ${fmtNum(totalBajas)} ${enTramo}.`;
    document.getElementById('bajas-depto').innerHTML = items.length ? barrasH(items, { formato: fmtNum, ancho: anchoDe('bajas-depto') }) : `<p class="sub">Sin bajas registradas en ${etiP}.</p>`;
    document.getElementById('depto-nota').textContent = items.length
      ? `El porcentaje junto a cada barra es la parte de ese departamento en las ${fmtNum(totalBajas)} bajas del tramo. La barra ámbar es Comercial (tiendas). Toca un departamento para ver sus contrataciones y el tamaño de su equipo. El indicador del sheet se lleva por departamento, no por empresa (Americana/Abi Q); por eso la comparación es entre áreas.`
      : 'El indicador del sheet se lleva por departamento, no por empresa (Americana/Abi Q); por eso la comparación es entre áreas.';
  }
}

// Titular del acumulado: la conclusión en una frase, para entender la gráfica sin leer la nota.
function titularAcumulado(serie, ultimo, deQuien, generado) {
  if (!ultimo) return '';
  const anioActual = +String(generado).slice(0, 4);
  const mesU = MES_LARGO[ultimo.mesNum - 1];
  const n = Math.round(ultimo.pctAcum * 100);
  const clase = ultimo.pctAcum >= REFERENCIA ? 'rojo' : '';
  const alerta = ultimo.pctAcum >= REFERENCIA ? ` Ya pasó la línea de alerta del ${pct0(REFERENCIA)} anual.` : '';
  if (ultimo.mesNum === 12 || ultimo.anio < anioActual) {
    const t = `En ${ultimo.anio} se fue el <b class="${clase}">${fmtPct(ultimo.pctAcum, 0)}</b> del equipo ${deQuien}${ultimo.mesNum < 12 ? ` (dato hasta ${mesU})` : ''}.`;
    const ant = serie.find((r) => r.anio === ultimo.anio - 1 && r.mesNum === ultimo.mesNum);
    return t + (ant ? ` En ${ultimo.anio - 1} fue el ${fmtPct(ant.pctAcum, 0)}.` : '') + alerta;
  }
  const ant = serie.find((r) => r.anio === ultimo.anio - 1 && r.mesNum === ultimo.mesNum);
  let t = `<b class="${clase}">De cada 100 personas ${deQuien}, ${n} se han ido</b> en lo que va de ${ultimo.anio} (enero a ${mesU}).`;
  if (ant) {
    const d = ultimo.pctAcum - ant.pctAcum;
    t += ` A esta misma altura de ${ultimo.anio - 1} iban ${Math.round(ant.pctAcum * 100)}: ${Math.abs(d) < 0.005 ? 'va igual que el año pasado' : d > 0 ? `este año <b class="ambar">rota más rápido</b> (${puntos(d)})` : `este año <b class="verde">rota más despacio</b> (${puntos(d)})`}.`;
  }
  return t + alerta;
}

// Titular de Comercial vs. total: quién rota más y cuánto, en una frase.
function titularComercialTotal(anio, mesPreferido) {
  const t = total.filter((r) => r.anio === anio), c = comercial.filter((r) => r.anio === anio);
  const meses = t.map((r) => r.mesNum).filter((m) => c.some((r) => r.mesNum === m)).sort((a, b) => a - b);
  if (!meses.length) return '';
  const m = mesPreferido && meses.includes(mesPreferido) ? mesPreferido : meses.at(-1);
  const rt = t.find((r) => r.mesNum === m), rc = c.find((r) => r.mesNum === m);
  const d = rc.pctAcum - rt.pctAcum;
  let s = Math.abs(d) < 0.005
    ? `<b>Las tiendas rotan igual que el conjunto de la empresa</b>: `
    : d > 0 ? `<b>Las tiendas rotan más que el resto de la empresa</b>: ` : `<b>Las tiendas rotan menos que el resto de la empresa</b>: `;
  s += `a ${MES_LARGO[m - 1]} de ${anio}, en Comercial se ha ido el <b class="ambar">${fmtPct(rc.pctAcum, 0)}</b> del equipo y en toda la empresa el <b>${fmtPct(rt.pctAcum, 0)}</b>.`;
  const promT = promedio(rt), promC = promedio(rc);
  if (rt.bajasAcum != null && rc.bajasAcum != null && promT && promC && promT - promC > 0) {
    s += ` Fuera de las tiendas (oficinas, CEDI, otras áreas) va en ${fmtPct((rt.bajasAcum - rc.bajasAcum) / (promT - promC), 0)}.`;
  }
  return s;
}

// Nota del acumulado: cómo se lee, cada año en el mismo mes y cierres de año.
function notaAcumulado(serie, anios, ultimo, alcance, generado) {
  const partes = [`<b>${alcance}.</b> Cada línea es un año y cada punto, qué parte del equipo se había ido desde enero hasta ese mes (bajas acumuladas ÷ plantilla promedio). Por eso siempre sube: el valor de diciembre es la rotación de todo el año. Para comparar años, mira el mismo mes: la línea que va más arriba rota más rápido. Un tramo punteado une meses sin dato en el registro.`];
  if (!ultimo) return partes.join(' ');
  const mesU = ultimo.mesNum, etiMes = MES_CORTO[mesU - 1];
  const mismoMes = anios.map((a) => [a, serie.find((r) => r.anio === a && r.mesNum === mesU)]).filter(([, r]) => r);
  if (mismoMes.length > 1) partes.push(`A ${etiMes}: ${mismoMes.map(([a, r]) => `${a} <b>${fmtPct(r.pctAcum, 1)}</b>`).join(' · ')}.`);
  const anioActual = +String(generado).slice(0, 4);
  const cierres = anios.filter((a) => a < anioActual).map((a) => [a, serie.find((r) => r.anio === a && r.mesNum === 12)]).filter(([, r]) => r);
  if (cierres.length) partes.push(`Cierre de año: ${cierres.map(([a, r]) => `${a} <b>${fmtPct(r.pctAcum, 1)}</b>`).join(' · ')}.`);
  // Sin proyección a fin de año (Oscar, 2026-10-07): el CEO solo ve datos del registro, no estimaciones.
  return partes.join(' ');
}

// Nota de Comercial vs total: la brecha en el último mes, peso de Comercial en plantilla y bajas, y el resto.
function notaComercialTotal(anio, mesPreferido) {
  const t = total.filter((r) => r.anio === anio), c = comercial.filter((r) => r.anio === anio);
  const meses = t.map((r) => r.mesNum).filter((m) => c.some((r) => r.mesNum === m)).sort((a, b) => a - b);
  const base = 'Las dos líneas son el acumulado del año (qué parte del equipo se ha ido desde enero). La ámbar es solo el departamento Comercial (tiendas); la gris es toda la empresa, tiendas incluidas, así que la separación entre ambas la pone el resto de la empresa (oficinas, CEDI, otras áreas).';
  if (!meses.length) return `${base} Sin meses de ${anio} con las dos series.`;
  const m = mesPreferido && meses.includes(mesPreferido) ? mesPreferido : meses.at(-1);
  const rt = t.find((r) => r.mesNum === m), rc = c.find((r) => r.mesNum === m);
  const partes = [base, `A ${MES_CORTO[m - 1]} ${anio}: Comercial <b>${fmtPct(rc.pctAcum, 1)}</b> vs. total <b>${fmtPct(rt.pctAcum, 1)}</b> (${puntos(rc.pctAcum - rt.pctAcum)}).`];
  if (rt.bajasAcum != null && rc.bajasAcum != null && rt.bajasAcum > 0 && rt.fin && rc.fin) {
    partes.push(`Comercial es el ${fmtPct(rc.fin / rt.fin, 0)} de la plantilla (${fmtNum(rc.fin)} de ${fmtNum(rt.fin)}) y pone el ${fmtPct(rc.bajasAcum / rt.bajasAcum, 0)} de las bajas del año (${fmtNum(rc.bajasAcum)} de ${fmtNum(rt.bajasAcum)}).`);
    const promT = promedio(rt), promC = promedio(rc);
    if (promT && promC && promT - promC > 0) {
      const resto = (rt.bajasAcum - rc.bajasAcum) / (promT - promC);
      partes.push(`El resto de la empresa va en <b>${fmtPct(resto, 1)}</b> acumulado (${fmtNum(rt.bajasAcum - rc.bajasAcum)} bajas entre unas ${fmtNum(Math.round(promT - promC))} personas).`);
    }
  }
  return partes.join(' ');
}

// Tabla por marca (Oscar, 2026-10-07): SOLO Americana y Abi Q. Las filas "Total empresa" y "Área comercial" se
// quitaron: mezclaban un corte por marca con uno por departamento y repetían, con otra cifra (indicador calculado),
// lo que los KPI ya muestran con el indicador oficial del sheet. Cada fila: plantilla al cierre, altas y bajas del
// año y % acumulado al último mes completo.
function pintarMarcas(rango) {
  const el = document.getElementById('tabla-marcas'), nota = document.getElementById('marcas-nota'), titular = document.getElementById('marcas-titular');
  if (!CALC) { el.innerHTML = '<p class="sub">El pipeline aún no publica el indicador calculado.</p>'; nota.textContent = ''; titular.innerHTML = ''; return; }
  const hastaYm = rango.hasta ? rango.hasta.slice(0, 7) : null;
  // Friotec fuera por ahora (Oscar, 2026-09-09); Abi Q de vuelta desde 2026-09-16
  const filas = ['americana', 'abiq'].map((e) => {
    const s = (CALC.series[e] ?? []).filter((r) => !r.parcial && (!hastaYm || r.ym <= hastaYm));
    const u = s.at(-1); if (!u || u.pctAcum == null) return null;
    const delAnio = s.filter((r) => r.anio === u.anio);
    return { e, u, altasAnio: delAnio.reduce((a, r) => a + r.altas, 0) };
  }).filter(Boolean);
  const ultimo = filas[0]?.u;
  document.getElementById('h-marcas').textContent = `Rotación por marca${ultimo ? ` · acumulada a ${MES_CORTO[ultimo.mesNum - 1]} ${ultimo.anio}` : ''}`;
  if (!filas.length) { el.innerHTML = '<p class="sub">Sin datos por marca en este período.</p>'; nota.textContent = ''; titular.innerHTML = ''; return; }
  // titular: quién rota más, y aviso si una marca es muy pequeña (cada salida mueve mucho el %)
  const nombre = (e) => ESCOPO_ETI[e];
  const pequenas = filas.filter(({ u }) => u.fin < 30).map(({ e, u }) => {
    const prom = promedio(u);
    return `${nombre(e)} son solo ${fmtNum(u.fin)} personas${prom ? `: cada salida mueve el porcentaje unos ${Math.round(100 / prom)} puntos` : ''}`;
  });
  const aviso = pequenas.length ? ` Ojo: ${pequenas.join('; ')}.` : '';
  const tramo = `en lo que va de ${ultimo.anio} (enero a ${MES_LARGO[ultimo.mesNum - 1]})`;
  if (filas.length === 2) {
    const [a, b] = [...filas].sort((x, y) => y.u.pctAcum - x.u.pctAcum);
    titular.innerHTML = Math.abs(a.u.pctAcum - b.u.pctAcum) < 0.005
      ? `<b>${nombre(a.e)} y ${nombre(b.e)} rotan igual</b>: ${fmtPct(a.u.pctAcum, 0)} del equipo se ha ido ${tramo}.${aviso}`
      : `<b>${nombre(a.e)} rota más que ${nombre(b.e)}</b>: se ha ido el <b class="${a.u.pctAcum >= REFERENCIA ? 'rojo' : ''}">${fmtPct(a.u.pctAcum, 0)}</b> de su equipo frente al <b class="${b.u.pctAcum >= REFERENCIA ? 'rojo' : ''}">${fmtPct(b.u.pctAcum, 0)}</b> ${tramo}.${aviso}`;
  } else {
    const { e, u } = filas[0];
    titular.innerHTML = `En <b>${nombre(e)}</b> se ha ido el <b class="${u.pctAcum >= REFERENCIA ? 'rojo' : ''}">${fmtPct(u.pctAcum, 0)}</b> del equipo ${tramo}.${aviso}`;
  }
  el.innerHTML = `<div class="tabla-scroll"><table class="tabla-sup"><thead><tr><th>Marca</th><th class="n">Plantilla</th><th class="n">Altas</th><th class="n">Bajas</th><th class="n">% acum.</th></tr></thead><tbody>${filas.map(({ e, u, altasAnio }) => `<tr${marcaActual() === e ? ' class="fila-activa"' : ''}><td>${nombre(e)}</td><td class="n">${fmtNum(u.fin)}</td><td class="n">${fmtNum(altasAnio)}</td><td class="n">${fmtNum(u.bajasAcum)}</td><td class="n"><b class="${u.pctAcum >= REFERENCIA ? 'rojo' : ''}">${fmtPct(u.pctAcum, 1)}</b>${u.fin < 5 ? '<span class="pct">plantilla muy pequeña</span>' : ''}</td></tr>`).join('')}</tbody></table></div>`;
  const a = CALC.anclaje;
  nota.textContent = `Plantilla = colaboradores de la marca al cierre de ${MES_LARGO[ultimo.mesNum - 1]} ${ultimo.anio}; Altas y Bajas = contrataciones y salidas de enero a ese mes; % acum. = bajas ÷ plantilla promedio del mes (en rojo si pasa la referencia de ${pct0(REFERENCIA)} anual). El indicador oficial del sheet no distingue marca, así que estas cifras las calcula el dashboard con la misma fórmula: bajas del registro de SALIDAS, altas de la pestaña ALTAS y plantilla de hoy (${a.fecha}) contada en la BASE DE DATOS GENERAL; los meses anteriores se reconstruyen hacia atrás con altas y bajas.${a.administracionEnAmericana ? ` ${fmtNum(a.administracionEnAmericana)} personas de administración (corporativo) se cuentan en Americana.` : ''} ${CALC.marcasExcluidas?.length ? `${CALC.marcasExcluidas.join(' y ')} quedan fuera por ahora.` : ''} Solo conteos: ningún dato individual.`;
}
// La tabla "Indicador manual vs. calculado" se QUITÓ del sitio (Oscar, 2026-09-16): el CEO no debe ver
// diferencias entre dos fuentes que resten confianza a las cifras. La comparación sigue publicándose en
// rotacion.json → calculado.comparacion.{total,comercial} para validar por dentro (ver ESTADO.md).
let depto = pintarSelectorDepto((d) => { depto = d; pintar(depto, periodo); });
let periodo = pintarSelectorPeriodo({ ...aniosYMeses({ rotacion }), generado: rotacion.generado },
  (p) => { periodo = p; pintar(depto, periodo); });
pintar(depto, periodo);
activarDetalles();
pintarPie(meta);
// Las gráficas se dibujan al ancho real del contenedor: si cambia (girar el teléfono, cambiar la ventana), se redibujan.
let anchoPrevio = window.innerWidth, temporizador = null;
window.addEventListener('resize', () => {
  clearTimeout(temporizador);
  temporizador = setTimeout(() => { if (Math.abs(window.innerWidth - anchoPrevio) > 40) { anchoPrevio = window.innerWidth; pintar(depto, periodo); } }, 150);
});

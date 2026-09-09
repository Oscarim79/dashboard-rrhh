// Utilidades compartidas: carga de datos, formato es-GT y pie de página.
export { fmtQ, fmtPct } from './modelo.js';

// cache: 'no-cache' obliga al navegador a preguntar si hay versión nueva
// (con ETag la respuesta es baratísima) — así los datos nunca se ven viejos.
export async function cargarDatos() {
  const [vacantes, rotacion, meta] = await Promise.all([
    fetch('data/vacantes.json', { cache: 'no-cache' }).then((r) => r.json()),
    fetch('data/rotacion.json', { cache: 'no-cache' }).then((r) => r.json()),
    fetch('data/meta.json', { cache: 'no-cache' }).then((r) => r.json()),
  ]);
  return { vacantes, rotacion, meta };
}

export const fmtNum = (n) => new Intl.NumberFormat('es-GT').format(n);

export const fmtFecha = (iso) => {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('es-GT', { day: 'numeric', month: 'short', year: 'numeric' });
};

export function pintarPie(meta) {
  const f = new Date(meta.generado);
  const el = document.querySelector('footer');
  if (el) el.innerHTML =
    `Datos actualizados automáticamente desde Google Sheets el ` +
    `<b>${f.toLocaleDateString('es-GT', { day: 'numeric', month: 'long', year: 'numeric' })}` +
    ` a las ${f.toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' })}</b>. ` +
    `Sin datos personales: el sitio solo publica cifras agregadas.<br>` +
    `<b>Fuente:</b> control de vacantes, indicador de rotación mensual y registro de salidas de RRHH ` +
    `(el archivo de Google Sheets del área), leídos tal cual y agregados; el costo por salida sale del ` +
    `modelo de rotación por tipo de tienda (ver Simulador). ` +
    `<a href="./index.html#fuente">De dónde salen los datos →</a>`;
}

export function marcarNavActiva() {
  const aqui = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('nav a').forEach((a) => {
    if (a.getAttribute('href').replace('./', '') === aqui) a.classList.add('activo');
  });
  // menú lateral: abrir con ☰, cerrar tocando el velo o un enlace
  const btn = document.getElementById('btn-menu');
  const menu = document.getElementById('menu');
  const velo = document.getElementById('velo');
  if (!btn || !menu || !velo) return;
  const alternar = (abrir) => {
    menu.classList.toggle('abierto', abrir);
    velo.classList.toggle('abierto', abrir);
  };
  btn.onclick = () => alternar(!menu.classList.contains('abierto'));
  velo.onclick = () => alternar(false);
  menu.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => alternar(false)));
}

// ── Selector global General / Comercial (pedido del CEO, 2026-09-07) ─────────
// "Comercial" = solo el departamento comercial (tiendas: asesores, jefes de agencia,
// asistentes y servicios varios). Por defecto se abre en Comercial. La elección se
// recuerda en el navegador para que todas las páginas la respeten.
export const DEPTOS = { comercial: 'Comercial', general: 'General' };
const CLAVE_DEPTO = 'dashboard-rrhh:depto';

export function departamentoActual() {
  try {
    const url = new URLSearchParams(location.search).get('depto');
    if (url && url in DEPTOS) { localStorage.setItem(CLAVE_DEPTO, url); return url; }
    const v = localStorage.getItem(CLAVE_DEPTO);
    if (v && v in DEPTOS) return v;
  } catch { /* navegación privada o sin almacenamiento: se usa el valor por defecto */ }
  return 'comercial';
}

export const etiquetaDepto = (d) => (d === 'comercial' ? 'departamento Comercial' : 'toda la empresa');
export const etiquetaDeptoCorta = (d) => (d === 'comercial' ? 'Comercial' : 'General');

// Pinta el selector en la cabecera (móvil) y en el menú lateral (escritorio) y
// llama a onCambio(depto) cada vez que el usuario cambia la opción.
export function pintarSelectorDepto(onCambio) {
  const actual = departamentoActual();
  const html = (id) => `<div class="selector-depto" id="${id}" role="group" aria-label="Alcance de los datos">
    ${Object.entries(DEPTOS).map(([k, eti]) =>
      `<button type="button" data-depto="${k}" class="${k === actual ? 'activo' : ''}" aria-pressed="${k === actual}">${eti}</button>`).join('')}
  </div>`;
  const cab = document.querySelector('.cabecera');
  if (cab && !document.getElementById('selector-depto-cab')) cab.insertAdjacentHTML('beforeend', html('selector-depto-cab'));
  const menuMarca = document.querySelector('nav#menu .menu-marca');
  if (menuMarca && !document.getElementById('selector-depto-menu')) {
    menuMarca.insertAdjacentHTML('afterend', `<div class="menu-depto"><div class="menu-depto-eti">Datos de</div>${html('selector-depto-menu')}</div>`);
  }
  document.querySelectorAll('.selector-depto button').forEach((b) => {
    b.addEventListener('click', () => {
      const d = b.dataset.depto;
      try { localStorage.setItem(CLAVE_DEPTO, d); } catch { /* sin almacenamiento */ }
      document.querySelectorAll('.selector-depto button').forEach((x) => {
        const on = x.dataset.depto === d;
        x.classList.toggle('activo', on); x.setAttribute('aria-pressed', on);
      });
      onCambio?.(d);
    });
  });
  return actual;
}

// Vista de vacantes.json según el departamento elegido: mismas claves, distinto alcance.
// Si el JSON es viejo y no trae el desglose, se muestra General y se avisa en consola.
export function vacantesDe(vacantes, depto) {
  if (depto !== 'comercial') return vacantes;
  const agg = vacantes.porDepartamento?.comercial;
  if (!agg) { console.warn('vacantes.json sin desglose por departamento; se muestra General'); return vacantes; }
  return { ...vacantes, agregados: agg, filas: vacantes.filas.filter((r) => r.departamento === 'COMERCIAL') };
}

// Idem para salidas.json (total, ult12m, porMes, porAnio, captura).
export function salidasDe(salidas, depto) {
  if (depto !== 'comercial') return salidas;
  const s = salidas?.porDepartamento?.comercial;
  if (!s) { console.warn('salidas.json sin desglose por departamento; se muestra General'); return salidas; }
  return { ...salidas, ...s };
}

// Pie de datos: recuerda al lector qué alcance está viendo.
export function notaAlcance(depto) {
  return depto === 'comercial'
    ? 'Viendo solo el <b>departamento Comercial</b> (tiendas). Cambia a "General" arriba para ver toda la empresa.'
    : 'Viendo <b>toda la empresa</b>. Cambia a "Comercial" arriba para ver solo el departamento comercial.';
}

// ── Selector global de período (pedido del CEO, 2026-09-07) ───────────────────
// Valores: 'todo' · '12m' · 'a:2026' (año; si es el año en curso se rotula "a la fecha")
// · 'm:2026-08' (un mes). Se recuerda en el navegador y admite ?periodo=… en la URL.
export const MES_LARGO = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const MES_CORTO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const CLAVE_PERIODO = 'dashboard-rrhh:periodo';
const periodoValido = (p) => p === 'todo' || p === '12m' || /^a:\d{4}$/.test(p) || /^m:\d{4}-\d{2}$/.test(p);

export function periodoActual() {
  try {
    const url = new URLSearchParams(location.search).get('periodo');
    if (url && periodoValido(url)) { localStorage.setItem(CLAVE_PERIODO, url); return url; }
    const v = localStorage.getItem(CLAVE_PERIODO);
    if (v && periodoValido(v)) return v;
  } catch { /* sin almacenamiento */ }
  return '12m';
}

const anioDe = (generado) => String(new Date(generado).getUTCFullYear());

// Rango de fechas ISO (inclusive) que cubre el período; null = sin límite.
export function rangoPeriodo(p, generado) {
  const hoy = new Date(generado);
  const hoyISO = hoy.toISOString().slice(0, 10);
  if (p === '12m') { const d = new Date(hoy); d.setUTCFullYear(d.getUTCFullYear() - 1); return { desde: d.toISOString().slice(0, 10), hasta: hoyISO }; }
  if (p.startsWith('a:')) { const a = p.slice(2); return { desde: `${a}-01-01`, hasta: `${a}-12-31` }; }
  if (p.startsWith('m:')) { const ym = p.slice(2); return { desde: `${ym}-01`, hasta: `${ym}-31` }; }
  return { desde: null, hasta: null };
}
export const enPeriodo = (iso, rango) => (!rango.desde ? true : !!iso && iso >= rango.desde && iso <= rango.hasta);

export function etiquetaPeriodo(p, generado) {
  if (p === '12m') return 'últimos 12 meses';
  if (p.startsWith('a:')) { const a = p.slice(2); return a === anioDe(generado) ? `${a} a la fecha` : `año ${a}`; }
  if (p.startsWith('m:')) { const [y, m] = p.slice(2).split('-'); return `${MES_LARGO[+m - 1]} ${y}`; }
  return 'todo el registro';
}
export const fmtYm = (ym) => { const [y, m] = ym.split('-'); return `${MES_LARGO[+m - 1]} ${y}`; };
export const fmtYmCorto = (ym) => { const [y, m] = ym.split('-'); return `${MES_CORTO[+m - 1]} ${y.slice(2)}`; };

// Meses que se grafican para un período, a partir de los meses con dato (ordenados 'YYYY-MM'):
// todo → últimos 18 · 12m → los del rango · año → los del año · mes → los 12 que terminan ahí.
export function mesesDelPeriodo(p, mesesDisponibles, generado) {
  if (p === 'todo') return mesesDisponibles.slice(-18);
  if (p.startsWith('m:')) { const ym = p.slice(2); return mesesDisponibles.filter((x) => x <= ym).slice(-12); }
  const r = rangoPeriodo(p, generado);
  return mesesDisponibles.filter((ym) => ym >= r.desde.slice(0, 7) && ym <= r.hasta.slice(0, 7));
}

// Pinta la barra de período debajo de la nota de alcance. `anios` y `meses` salen de los datos
// de la página (años con registro, meses 'YYYY-MM' con registro). Devuelve el período actual.
// Opciones extra: `contenedor` (elemento donde pintar la barra, en vez de bajo la nota de
// alcance) y `guardar: false` (barra local: no lee ni escribe la memoria global; arranca en
// `inicial`, por defecto 'todo').
export function pintarSelectorPeriodo({ anios, meses, generado, contenedor = null, guardar = true, inicial = 'todo', notaRegistro = null }, onCambio) {
  let actual = guardar ? periodoActual() : inicial;
  const anioActual = anioDe(generado);
  // Desde cuándo hay datos (pregunta que le hicieron a Oscar, 2026-09-08): se muestra bajo la barra.
  // El último mes se limita al mes de la lectura por si alguna fila trae fecha futura por error.
  const hoyYm = new Date(generado).toISOString().slice(0, 7);
  const mesesAsc = [...new Set(meses)].sort();
  const hastaYm = [...mesesAsc].reverse().find((ym) => ym <= hoyYm) ?? mesesAsc.at(-1);
  // Oscar (2026-09-09): sin avisos sobre confiabilidad de la captura en el sitio (el CEO ya lo sabe
  // y no debe aparecer ante otros gerentes). Solo se dice qué cubre "todo el registro".
  const nota = notaRegistro ?? (mesesAsc.length ? `"Todo el registro" cubre de ${fmtYm(mesesAsc[0])} a ${fmtYm(hastaYm)}.` : '');
  const botones = [['todo', 'Todo el registro'], ['12m', 'Últimos 12 meses'],
    ...[...new Set(anios.map(String))].sort().reverse().map((a) => [`a:${a}`, a === anioActual ? `${a} a la fecha` : a])];
  const mesesOrd = [...new Set(meses)].sort().reverse();
  // si el período guardado no existe en estos datos, se vuelve a 12 meses
  if (!botones.some(([v]) => v === actual) && !mesesOrd.some((ym) => `m:${ym}` === actual)) actual = '12m';
  const html = `<div class="barra-periodo" role="group" aria-label="Período">
    <span class="barra-periodo-eti">Período</span>
    ${botones.map(([v, eti]) => `<button type="button" data-periodo="${v}" class="${v === actual ? 'primario' : ''}">${eti}</button>`).join('')}
    <select class="sel-mes" aria-label="Un mes concreto">
      <option value="">Un mes…</option>
      ${mesesOrd.map((ym) => `<option value="m:${ym}" ${`m:${ym}` === actual ? 'selected' : ''}>${fmtYm(ym)}</option>`).join('')}
    </select>
    ${nota ? `<span class="barra-periodo-nota">${nota}</span>` : ''}
  </div>`;
  let barra;
  if (contenedor) {
    contenedor.innerHTML = html;
    barra = contenedor.querySelector('.barra-periodo');
  } else {
    const ancla = document.getElementById('alcance') ?? document.querySelector('main h1');
    if (!document.getElementById('barra-periodo')) ancla.insertAdjacentHTML('afterend', html.replace('class="barra-periodo"', 'class="barra-periodo" id="barra-periodo"'));
    barra = document.getElementById('barra-periodo');
  }
  const marcar = (p) => {
    barra.querySelectorAll('button').forEach((b) => b.classList.toggle('primario', b.dataset.periodo === p));
    const sel = barra.querySelector('.sel-mes');
    sel.value = p.startsWith('m:') ? p : '';
    sel.classList.toggle('primario', p.startsWith('m:'));
  };
  const elegir = (p) => {
    if (guardar) { try { localStorage.setItem(CLAVE_PERIODO, p); } catch { /* sin almacenamiento */ } }
    marcar(p);
    onCambio?.(p);
  };
  barra.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => elegir(b.dataset.periodo)));
  barra.querySelector('.sel-mes').addEventListener('change', (e) => { if (e.target.value) elegir(e.target.value); });
  marcar(actual);
  return actual;
}

// Vacantes que pertenecen al período: por su fecha de solicitud (las que no tienen fecha
// solo entran en "todo el registro").
export function vacantesEnPeriodo(filas, p, generado) {
  const r = rangoPeriodo(p, generado);
  return r.desde ? filas.filter((f) => enPeriodo(f.solicitud, r)) : filas;
}

// Agregados de vacantes calculados en el navegador (misma lógica que el pipeline), para
// que respondan al período elegido. `salidas12mPorTipo` conserva su nombre por compatibilidad:
// son las salidas (renuncia/despido) con vacante solicitada dentro del período.
export function agregarVacantes(filas) {
  const stats = (nums) => {
    const a = [...nums].sort((x, y) => x - y);
    if (!a.length) return { n: 0, mediana: null, promedio: null };
    const mediana = a.length % 2 ? a[(a.length - 1) / 2] : (a[a.length / 2 - 1] + a[a.length / 2]) / 2;
    return { n: a.length, mediana, promedio: +(a.reduce((s, x) => s + x, 0) / a.length).toFixed(1), min: a[0], max: a.at(-1) };
  };
  const diasValidos = (arr) => arr.filter((r) => r.dias != null && r.dias >= 0).map((r) => r.dias);
  const porGrupo = (arr, clave) => { const g = {}; for (const r of arr) { const k = clave(r) ?? '(sin dato)'; (g[k] ??= []).push(r); } return g; };
  const statsPorGrupo = (arr, clave) => Object.fromEntries(Object.entries(porGrupo(arr, clave)).map(([k, v]) => [k, stats(diasValidos(v))]));
  const contarPor = (arr, clave) => { const c = {}; for (const r of arr) { const k = clave(r) ?? '(sin dato)'; c[k] = (c[k] ?? 0) + 1; } return c; };
  const porMes = (arr, campo) => { const c = {}; for (const r of arr) if (r[campo]) { const k = r[campo].slice(0, 7); c[k] = (c[k] ?? 0) + 1; } return Object.fromEntries(Object.entries(c).sort()); };

  const cerradas = filas.filter((r) => r.estatus === 'CERRADA');
  const noCanceladas = filas.filter((r) => r.estatus !== 'CANCELADA');
  const mezclaTotal = contarPor(noCanceladas, (r) => r.motivoGrupo);
  const rd = (mezclaTotal.renuncia ?? 0) + (mezclaTotal.despido ?? 0);
  const salidasPorTipo = {};
  for (const r of noCanceladas) {
    if (r.motivoGrupo !== 'renuncia' && r.motivoGrupo !== 'despido') continue;
    const tipo = r.esTienda === false ? 'no tienda' : (r.tipo ?? 'sin tipo');
    salidasPorTipo[tipo] ??= { renuncia: 0, despido: 0 };
    salidasPorTipo[tipo][r.motivoGrupo]++;
  }
  const canales = {};
  for (const canal of ['redes', 'facebook', 'volanteo', 'referidos', 'anuncios', 'perifoneo']) {
    const conDato = cerradas.filter((r) => r.canales?.[canal] != null);
    canales[canal] = {
      registrado: filas.filter((r) => r.canales?.[canal] != null).length,
      si: filas.filter((r) => r.canales?.[canal] === true).length,
      diasConCanal: stats(diasValidos(conDato.filter((r) => r.canales[canal] === true))),
      diasSinCanal: stats(diasValidos(conDato.filter((r) => r.canales[canal] === false))),
    };
  }
  const conSalida = filas.filter((r) => ['renuncia', 'despido'].includes(r.motivoGrupo));
  return {
    totales: { filas: filas.length, cerradas: cerradas.length,
      abiertas: filas.filter((r) => r.estatus === 'ABIERTA').length,
      canceladas: filas.filter((r) => r.estatus === 'CANCELADA').length },
    diasCobertura: {
      global: stats(diasValidos(cerradas)),
      porTipo: statsPorGrupo(cerradas, (r) => r.tipo),
      porPuesto: statsPorGrupo(cerradas, (r) => r.puesto),
      porEmpresa: statsPorGrupo(cerradas, (r) => r.empresa),
      porLugar: statsPorGrupo(cerradas, (r) => r.lugar),
    },
    mezcla: {
      conteos: mezclaTotal,
      pctRenuncia: rd ? +((mezclaTotal.renuncia ?? 0) / rd).toFixed(4) : null,
      pctDespido: rd ? +((mezclaTotal.despido ?? 0) / rd).toFixed(4) : null,
    },
    salidas12mPorTipo: salidasPorTipo,
    salidasPorTienda: contarPor(conSalida, (r) => r.lugar),
    salidasPorEmpresa: contarPor(conSalida, (r) => r.empresa),
    aperturasPorMes: porMes(filas, 'solicitud'),
    cierresPorMes: porMes(filas, 'cierre'),
    ocupadaPor: contarPor(filas.filter((r) => r.ocupadaPor), (r) => r.ocupadaPor),
    canales,
  };
}

// Años y meses con registro, para armar la barra de período con lo que de verdad hay.
export function aniosYMeses({ vacantes, salidas, rotacion } = {}) {
  const anios = new Set(), meses = new Set();
  for (const f of vacantes?.filas ?? []) if (f.solicitud) { anios.add(f.solicitud.slice(0, 4)); meses.add(f.solicitud.slice(0, 7)); }
  for (const a of Object.keys(salidas?.porAnio ?? {})) anios.add(a);
  for (const ym of Object.keys(salidas?.porMes ?? {})) meses.add(ym);
  for (const r of rotacion?.acumulado ?? []) if (r.anio) { anios.add(String(r.anio)); meses.add(`${r.anio}-${String(r.mesNum).padStart(2, '0')}`); }
  return { anios: [...anios].sort(), meses: [...meses].sort() };
}

// Desglose de salidas.json para un período (ya con el alcance General/Comercial aplicado).
const DIMS_VACIAS = () => ({ n: 0, razon: {}, subMotivo: {}, subMotivoRenuncias: {}, genero: {}, area: {}, marca: {}, agencia: {}, rango: {}, diasLab: { n: 0, mediana: null, promedio: null },
  tempranas: { n: 0, razon: {}, subMotivo: {}, subMotivoRenuncias: {}, rango: {} }, porSupervisor: {} });
export const DIMS_SALIDAS_VACIAS = DIMS_VACIAS;
export function dimsSalidas(salidas, p) {
  if (!salidas?.total) return DIMS_VACIAS();
  if (p === 'todo') return salidas.total;
  if (p === '12m') return salidas.ult12m ?? DIMS_VACIAS();
  if (p.startsWith('a:')) return salidas.porAnio?.[p.slice(2)] ?? DIMS_VACIAS();
  if (p.startsWith('m:')) return salidas.porMesDetalle?.[p.slice(2)] ?? DIMS_VACIAS();
  return DIMS_VACIAS();
}

// Desglose acumulado de enero al mes `mm` ('01'…'12') de un año (comparativa entre años del
// mismo período). El pipeline publica un corte por cada mes con dato; si el año no llega al
// mes pedido, vale el último corte disponible (no hay más salidas después).
export function dimsAcumulado(salidas, anio, mm) {
  const cortes = salidas?.acumuladoAnio?.[anio];
  if (!cortes) return DIMS_VACIAS();
  if (cortes[mm]) return cortes[mm];
  const previo = Object.keys(cortes).filter((k) => k <= mm).sort().at(-1);
  return previo ? cortes[previo] : DIMS_VACIAS();
}

// ── Reparto manual de las renuncias "voluntarias" (RRHH, ver propuesta-datos.js) ──
// Recibe los sub-motivos del sheet ({VOLUNTARIA: 110, 'POR SALARIO': 6, ...}) y el reparto
// de RRHH ({Salario: 45, ...}). Devuelve la lista de motivos con nombres legibles, sumando
// los que se repiten, y deja como "sin detalle" lo que el reparto no cubre.
const NOMBRE_SUB = {
  'SALARIO': 'Salario', 'POR SALARIO': 'Salario', 'MEJOR OPORTUNIDAD': 'Mejor oportunidad',
  'CLIMA LABORAL': 'Clima laboral', 'MAL AMBIENTE': 'Clima laboral', 'DESCUENTOS': 'Descuentos en salario', 'DESCUENTOS EN SALARIO': 'Descuentos en salario',
  'MAL TRATO': 'Clima laboral', 'POR FAMILIA': 'Motivos familiares', 'POR ESTUDIOS': 'Estudios',
  'HORARIOS EXTENDIDOS': 'Horarios', 'CAMBIO DE DOMICILIO': 'Cambio de domicilio', 'SALUD': 'Salud',
  'ABANDONO': 'Abandono', 'MALA ACTITUD': 'Mala actitud', 'BAJO RENDIMIENTO': 'Bajo rendimiento',
  'ROBO': 'Robo', 'RESTRUCTURACION': 'Reestructuración', 'CIERRE DE AGENCIA': 'Cierre de agencia',
  'TEMPORAL': 'Temporal', 'NO CONFIRMADO': 'No confirmado', 'VACACIONISTA': 'Vacacionista', 'OTROS': 'Otros',
};
export const SIN_DETALLE = 'Sin detalle registrado ("voluntaria")';
export function aplicarDesglose(subMotivos, desglose) {
  const acc = new Map();
  const suma = (k, v) => acc.set(k, (acc.get(k) ?? 0) + v);
  const fuentes = new Map(); // etiqueta mostrada → categorías del registro que se sumaron en ella
  let voluntarias = 0;
  for (const [k, v] of Object.entries(subMotivos ?? {})) {
    if (k.startsWith('(')) continue;
    if (k === 'VOLUNTARIA') { voluntarias += v; continue; }
    const eti = NOMBRE_SUB[k] ?? (k.charAt(0) + k.slice(1).toLowerCase());
    suma(eti, v);
    fuentes.set(eti, [...(fuentes.get(eti) ?? []), `${k.toLowerCase()} (${v})`]);
  }
  let repartidas = 0;
  if (desglose?.casos) for (const [k, v] of Object.entries(desglose.casos)) { suma(k, v); repartidas += v; }
  const resto = voluntarias - repartidas;
  if (resto > 0 && !desglose?.cubreTodas) suma(SIN_DETALLE, resto);
  const items = [...acc.entries()].sort((a, b) => b[1] - a[1]).map(([eti, valor]) => ({ eti, valor }));
  // texto para el pie de la gráfica: TODAS las agrupaciones que se hicieron con este dato
  const agrupaciones = [...fuentes.entries()].filter(([, f]) => f.length > 1)
    .map(([eti, f]) => `${eti} suma ${f.slice(0, -1).map((x) => `"${x}"`).join(', ')} y "${f.at(-1)}"`);
  return { items, voluntarias, repartidas, resto, agrupaciones,
    notaAgrupaciones: agrupaciones.length ? `Agrupaciones hechas sobre el registro: ${agrupaciones.join('; ')}.` : '' };
}

// Mediana de días calibrada: usa la del tipo si tiene muestra suficiente, si no la global.
export function diasCalibrados(diasCobertura, tipo, minimo = 8) {
  const t = diasCobertura.porTipo[tipo];
  if (t && t.n >= minimo && t.mediana != null) return { dias: t.mediana, fuente: `mediana tipo ${tipo} (n=${t.n})` };
  return { dias: diasCobertura.global.mediana, fuente: `mediana global (n=${diasCobertura.global.n})` };
}

// ── Globo de detalle sobre filas de gráfica (`data-detalle`) ──────────────────
// En escritorio aparece al pasar el cursor; en el teléfono, al tocar la fila (y se cierra al
// tocar fuera). Se activa una sola vez por página; funciona aunque las gráficas se redibujen.
let globoActivo = false;
export function activarDetalles() {
  if (globoActivo) return;
  globoActivo = true;
  const tip = document.createElement('div');
  tip.className = 'globo';
  tip.hidden = true;
  document.body.appendChild(tip);
  let fijado = null; // fila tocada (móvil): el globo queda hasta tocar fuera
  const mostrar = (fila) => {
    tip.innerHTML = `<b>${fila.dataset.titulo}</b> ${fila.dataset.detalle}`;
    tip.hidden = false;
    const r = fila.getBoundingClientRect();
    const ancho = Math.min(360, window.innerWidth - 24);
    tip.style.width = ancho + 'px';
    let x = r.left + r.width / 2 - ancho / 2;
    x = Math.max(12, Math.min(x, window.innerWidth - ancho - 12));
    tip.style.left = x + window.scrollX + 'px';
    tip.style.top = r.bottom + window.scrollY + 6 + 'px';
  };
  const ocultar = () => { tip.hidden = true; fijado = null; };
  document.addEventListener('mouseover', (e) => { const f = e.target.closest?.('.con-detalle'); if (f && !fijado && matchMedia('(hover: hover)').matches) mostrar(f); });
  document.addEventListener('mouseout', (e) => { if (!fijado && e.target.closest?.('.con-detalle') && !e.relatedTarget?.closest?.('.con-detalle')) tip.hidden = true; });
  document.addEventListener('click', (e) => {
    const f = e.target.closest?.('.con-detalle');
    if (!f) { if (!e.target.closest('.globo')) ocultar(); return; }
    if (fijado === f) { ocultar(); return; }
    fijado = f; mostrar(f);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') ocultar();
    if ((e.key === 'Enter' || e.key === ' ') && e.target.classList?.contains('con-detalle')) { e.preventDefault(); e.target.click(); }
  });
  document.addEventListener('focusin', (e) => { if (e.target.classList?.contains('con-detalle')) mostrar(e.target); });
}

// Página Mapa: Guatemala por departamentos, coloreada por supervisor de región, con una
// tienda por punto. Datos: public/geo/mapa-gt.json (contornos), data/tiendas.json (registro de
// tiendas: tipo, supervisor, ubicación) y data/salidas.json (salidas del área Comercial en el
// período elegido). Al tocar un departamento, una tienda o un supervisor se muestra su ficha.
// Extras (Oscar, 2026-09-09): semáforo por tienda, línea de tiempo mes a mes, comparación del
// supervisor con sus pares y costo estimado de la rotación (modelo del Simulador).
import { pintarPie, marcarNavActiva, fmtNum, salidasDe, vacantesDe, pintarSelectorDepto, pintarSelectorPeriodo,
  dimsSalidas, etiquetaPeriodo, aniosYMeses, aplicarDesglose, fmtYm, fmtYmCorto, COLOR_SUPERVISOR,
  vacantesEnPeriodo, agregarVacantes, diasCalibrados } from './comun.js';
import { costoMezcla, VENTAS_TIPO, PARAMS_DEFECTO, fmtQ } from './modelo.js';

marcarNavActiva();
const [salidasTodo, meta, mapa, registro, vacantesTodo] = await Promise.all([
  fetch('data/salidas.json', { cache: 'no-cache' }).then((r) => r.json()),
  fetch('data/meta.json', { cache: 'no-cache' }).then((r) => r.json()),
  fetch('geo/mapa-gt.json', { cache: 'no-cache' }).then((r) => r.json()),
  fetch('data/tiendas.json', { cache: 'no-cache' }).then((r) => r.json()),
  fetch('data/vacantes.json', { cache: 'no-cache' }).then((r) => r.json()),
]);
const vacantes = vacantesDe(vacantesTodo, 'comercial');

// El mapa es de tiendas: siempre usa el área Comercial, sin importar el selector General/Comercial.
pintarSelectorDepto(() => {});
document.getElementById('alcance').innerHTML = 'Mostrando <b>las tiendas (área Comercial)</b>: el mapa no cambia con el selector General/Comercial.';

const SIN_SUP = 'Sin supervisor asignado';
const colorSup = (s) => COLOR_SUPERVISOR[s] ?? '#9AA5A0';
const SEMAFORO = { verde: '#0B7A55', ambar: '#D99A2B', rojo: '#A33B2E' };
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const nombreSub = (k) => aplicarDesglose({ [k]: 1 }, null).items[0]?.eti ?? k;
const pct = (v, n) => (n ? Math.round((v / n) * 100) : 0);

const P = mapa.proyeccion;
const px = (lon) => (lon - P.lon0) * P.s;
const py = (lat) => (P.lat1 - lat) * P.s / P.cosMid;
const [, , W, H] = mapa.viewBox;

const tiendas = registro.tiendas.filter((t) => t.activa);
const ubicadas = tiendas.filter((t) => t.lat != null);
// varias tiendas en el mismo municipio comparten coordenada: se reparten en un circulito
const porCoord = {};
for (const t of ubicadas) (porCoord[`${t.lat},${t.lon}`] ??= []).push(t);
for (const grupo of Object.values(porCoord)) grupo.forEach((t, i) => {
  const ang = grupo.length > 1 ? (i / grupo.length) * Math.PI * 2 - Math.PI / 2 : 0, rad = grupo.length > 1 ? 11 : 0;
  t.x = px(t.lon) + Math.cos(ang) * rad; t.y = py(t.lat) + Math.sin(ang) * rad;
});
const porDepto = {};
for (const t of ubicadas) (porDepto[t.departamento] ??= []).push(t);
const supervisores = [...new Set(tiendas.map((t) => t.supervisor).filter(Boolean))].sort();
const dominante = (lista) => {
  const c = {};
  for (const t of lista) if (t.supervisor) c[t.supervisor] = (c[t.supervisor] ?? 0) + 1;
  return Object.entries(c).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
};

// ── estado ──
const salidas = salidasDe(salidasTodo, 'comercial');
const hoyYm = salidas.generado.slice(0, 7);
const mesesConDato = Object.keys(salidas.porMes ?? {}).filter((ym) => ym <= hoyYm).sort();
let periodo = 'todo';           // selector global
let seleccion = null;           // {tipo:'sup'|'depto'|'tienda', clave}
let modoColor = 'supervisor';   // 'supervisor' | 'semaforo'
let modoTamano = 'salidas';     // 'salidas' | 'costo'
const anim = { activa: false, indice: 0, timer: null }; // línea de tiempo mes a mes
let D = null;                   // desglose de salidas del período (o del mes animado)

const periodoVigente = () => (anim.activa ? `m:${mesesConDato[anim.indice]}` : periodo);
const etiVigente = () => (anim.activa ? fmtYm(mesesConDato[anim.indice]) : etiquetaPeriodo(periodo, salidas.generado));

// ── salidas y costo por tienda ──
const bajasTienda = (nombre) => Object.entries(D.agencia ?? {}).filter(([k]) => k.split('·')[0] === nombre).reduce((s, [, v]) => s + v, 0);
const bajasLista = (lista) => lista.reduce((s, t) => s + bajasTienda(t.nombre), 0);
const tipoEti = (t) => (t.tipo ? `tipo ${t.tipo}` : 'tipo por definir');
// Costo por salida según el tipo de tienda, ponderado con la mezcla renuncia/despido del período.
// Mismo cálculo que el Resumen: modelo del Simulador con los días reales de vacante del período
// (mediana del control de vacantes por tipo; si no hay dato, el supuesto del modelo). Tienda sin
// tipo se asume B, como en el Resumen.
let costoPorTipo = {}, diasPorTipo = {};
function calcularCostos() {
  const rd = (D.razon?.RENUNCIA ?? 0) + (D.razon?.DESPIDO ?? 0);
  const pR = rd ? (D.razon.RENUNCIA ?? 0) / rd : 0.85, pD = rd ? (D.razon.DESPIDO ?? 0) / rd : 0.15;
  const A = agregarVacantes(vacantesEnPeriodo(vacantes.filas, periodoVigente(), vacantes.generado));
  costoPorTipo = {}; diasPorTipo = {};
  for (const [tipo, v] of Object.entries(VENTAS_TIPO)) {
    const dias = diasCalibrados(A.diasCobertura, tipo).dias ?? PARAMS_DEFECTO.diasVacante;
    diasPorTipo[tipo] = dias;
    costoPorTipo[tipo] = costoMezcla(v, pR, pD, { ...PARAMS_DEFECTO, diasVacante: dias });
  }
}
const costoTienda = (t) => bajasTienda(t.nombre) * (costoPorTipo[t.tipo] ?? costoPorTipo.B);
const costoLista = (lista) => lista.reduce((s, t) => s + costoTienda(t), 0);

// ── semáforo: cada tienda frente al promedio de las tiendas de su mismo tipo en el período ──
let semaforo = {}; // nombre → {color, prom}
function calcularSemaforo() {
  semaforo = {};
  const grupos = {};
  for (const t of ubicadas) (grupos[t.tipo ?? 'B'] ??= []).push(t);
  for (const [, lista] of Object.entries(grupos)) {
    const prom = bajasLista(lista) / lista.length;
    for (const t of lista) {
      const b = bajasTienda(t.nombre);
      const color = !prom ? (b ? 'rojo' : 'verde') : b <= prom * 0.75 ? 'verde' : b >= prom * 1.25 ? 'rojo' : 'ambar';
      semaforo[t.nombre] = { color, prom, b };
    }
  }
}
const colorTienda = (t) => (modoColor === 'semaforo' ? SEMAFORO[semaforo[t.nombre]?.color ?? 'verde'] : colorSup(t.supervisor));

function pintarMapa() {
  const etiP = etiVigente();
  document.getElementById('periodo-eval').textContent = anim.activa ? `Reproduciendo: ${etiP}.` : `Salidas del período: ${etiP}.`;
  const sel = seleccion;
  const apagadoSup = (s) => sel?.tipo === 'sup' && s !== sel.clave;
  let s = `<svg viewBox="0 0 ${W} ${H}" class="mapa-svg" role="img" aria-label="Mapa de Guatemala por regiones">`;
  s += '<g class="deptos">';
  for (const d of mapa.departamentos) {
    const lista = porDepto[d.nombre] ?? [];
    const dom = dominante(lista);
    const activo = sel?.tipo === 'depto' && sel.clave === d.nombre;
    const apagado = sel?.tipo === 'sup' && !lista.some((t) => t.supervisor === sel.clave);
    const relleno = modoColor === 'semaforo' ? (lista.length ? '#D9D6CE' : '#ECEAE4') : (dom ? colorSup(dom) : '#ECEAE4');
    s += `<path d="${d.d}" data-depto="${esc(d.nombre)}" fill="${relleno}" fill-opacity="${lista.length && modoColor !== 'semaforo' ? (apagado ? 0.15 : 0.55) : 1}" stroke="#fff" stroke-width="1.6" class="depto${activo ? ' activo' : ''}${lista.length ? ' con-tiendas' : ''}"><title>${esc(d.nombre)}${lista.length ? `: ${lista.length} ${lista.length === 1 ? 'tienda' : 'tiendas'}` : ''}</title></path>`;
  }
  s += '</g><g class="etiquetas">';
  for (const d of mapa.departamentos) if (porDepto[d.nombre]) s += `<text x="${d.cx}" y="${d.cy}" text-anchor="middle" font-size="13" font-weight="600" fill="#17251F" pointer-events="none">${esc(d.nombre)}</text>`;
  s += '</g><g class="tiendas">';
  const medida = (t) => (modoTamano === 'costo' ? costoTienda(t) : bajasTienda(t.nombre));
  const maxM = Math.max(1, ...ubicadas.map(medida));
  for (const t of ubicadas) {
    const b = bajasTienda(t.nombre);
    const r = 5 + Math.sqrt(medida(t) / maxM) * 11;
    const activo = sel?.tipo === 'tienda' && sel.clave === t.nombre;
    const sem = semaforo[t.nombre];
    s += `<circle cx="${t.x.toFixed(1)}" cy="${t.y.toFixed(1)}" r="${r.toFixed(1)}" fill="${colorTienda(t)}" fill-opacity="${apagadoSup(t.supervisor) ? 0.25 : 0.92}" stroke="${activo ? '#17251F' : '#fff'}" stroke-width="${activo ? 3 : 1.5}" data-tienda="${esc(t.nombre)}" class="tienda"><title>${esc(t.nombre)} (${tipoEti(t)}) · ${t.supervisor ?? SIN_SUP} · ${fmtNum(b)} ${b === 1 ? 'salida' : 'salidas'} en ${etiP} · ${fmtQ(costoTienda(t))}${sem ? ` · semáforo ${sem.color} (promedio de su tipo: ${sem.prom.toFixed(1)})` : ''}</title></circle>`;
  }
  s += '</g></svg>';
  document.getElementById('mapa').innerHTML = s;

  // leyenda: por supervisor (chips que seleccionan) o semáforo (solo informativo)
  const leyenda = document.getElementById('leyenda');
  if (modoColor === 'semaforo') {
    const n = { verde: 0, ambar: 0, rojo: 0 };
    for (const t of ubicadas) n[semaforo[t.nombre]?.color ?? 'verde']++;
    leyenda.innerHTML = [['verde', 'Por debajo del promedio de su tipo'], ['ambar', 'Cerca del promedio'], ['rojo', 'Por encima del promedio']]
      .map(([c, eti]) => `<span class="chip-sup chip-info" style="--c:${SEMAFORO[c]}"><i></i><b>${n[c]} ${n[c] === 1 ? 'tienda' : 'tiendas'}</b><span>${eti}</span></span>`).join('')
      + `<span class="leyenda-nota">Cada tienda se compara con el promedio de salidas de las tiendas de su mismo tipo (AA, A, B, C) en ${etiP}: verde si tiene 25% menos o mejor, rojo si tiene 25% más o peor.</span>`;
  } else {
    leyenda.innerHTML = [...supervisores, null].map((sup) => {
      const lista = tiendas.filter((t) => (t.supervisor ?? null) === sup);
      if (!lista.length) return '';
      const activo = sel?.tipo === 'sup' && sel.clave === sup;
      return `<button type="button" class="chip-sup${activo ? ' activo' : ''}" data-sup="${esc(sup ?? '')}" style="--c:${colorSup(sup)}"><i></i><b>${esc(sup ?? SIN_SUP)}</b><span>${lista.length} ${lista.length === 1 ? 'tienda' : 'tiendas'} · ${fmtNum(D.porSupervisor?.[sup]?.n ?? bajasLista(lista))} salidas</span></button>`;
    }).join('');
  }
  // controles de vista
  document.querySelectorAll('[data-modo-color]').forEach((b) => b.classList.toggle('primario', b.dataset.modoColor === modoColor));
  document.querySelectorAll('[data-modo-tamano]').forEach((b) => b.classList.toggle('primario', b.dataset.modoTamano === modoTamano));
  const btn = document.getElementById('anim-play');
  btn.textContent = anim.activa ? '⏸ Pausar' : '▶ Reproducir mes a mes';
  const sl = document.getElementById('anim-mes');
  sl.max = String(Math.max(0, mesesConDato.length - 1));
  sl.value = String(anim.indice);
  document.getElementById('anim-eti').textContent = mesesConDato.length ? (anim.activa ? fmtYm(mesesConDato[anim.indice]) : `${fmtYmCorto(mesesConDato[0])} → ${fmtYmCorto(mesesConDato.at(-1))}`) : '';
}

const semaforoEti = (t) => { const s = semaforo[t.nombre]; return s ? `<i class="punto" style="background:${SEMAFORO[s.color]}" title="Semáforo ${s.color}: promedio de su tipo ${s.prom.toFixed(1)}"></i>` : ''; };
function listaTiendas(lista) {
  const orden = [...lista].sort((a, b) => bajasTienda(b.nombre) - bajasTienda(a.nombre) || a.nombre.localeCompare(b.nombre));
  return `<table class="tabla-mapa"><thead><tr><th>Tienda</th><th>Tipo</th><th class="n">Salidas</th><th class="n">Costo est.</th></tr></thead><tbody>${orden.map((t) => `<tr><td><button type="button" class="enlace" data-ir-tienda="${esc(t.nombre)}"><i class="punto" style="background:${colorSup(t.supervisor)}"></i>${esc(t.nombre)}</button> ${semaforoEti(t)}</td><td>${t.tipo ?? '—'}</td><td class="n">${fmtNum(bajasTienda(t.nombre))}</td><td class="n">${fmtQ(costoTienda(t))}</td></tr>`).join('')}</tbody></table>`;
}
const notaCosto = () => `<p class="pie">Costo estimado = salidas de la tienda × costo por salida de su tipo, con el mismo modelo que el Resumen (días reales de vacante del período: ${Object.entries(diasPorTipo).map(([t, d]) => `${t} ${Math.round(d)} d`).join(' · ')}; mezcla renuncia/despido del período). Es una estimación para comparar, no un dato contable.</p>`;

function pintarPanel() {
  const etiP = etiVigente();
  const el = document.getElementById('panel');
  const cerrar = '<button type="button" class="cerrar" id="panel-cerrar" aria-label="Volver al resumen">✕</button>';
  if (!seleccion) {
    el.innerHTML = `<h3>Todas las regiones · ${etiP}</h3>
      <p class="sub">${tiendas.length} tiendas activas, ${supervisores.length} supervisores de región. Toca un supervisor, un departamento o un punto del mapa.</p>
      <table class="tabla-mapa"><thead><tr><th>Supervisor</th><th class="n">Tiendas</th><th class="n">Salidas</th><th class="n">&lt; 6 m</th><th class="n">Costo est.</th></tr></thead><tbody>${[...supervisores, null].map((sup) => {
        const lista = tiendas.filter((t) => (t.supervisor ?? null) === sup); if (!lista.length) return '';
        const ps = D.porSupervisor?.[sup] ?? null;
        return `<tr><td><button type="button" class="enlace" data-ir-sup="${esc(sup ?? '')}"><i class="punto" style="background:${colorSup(sup)}"></i>${esc(sup ?? SIN_SUP)}</button></td><td class="n">${lista.length}</td><td class="n">${fmtNum(ps?.n ?? bajasLista(lista))}</td><td class="n">${ps ? `${pct(ps.tempranas, ps.n)}%` : '—'}</td><td class="n">${fmtQ(costoLista(lista))}</td></tr>`;
      }).join('')}</tbody></table>
      <p class="pie">"Salidas" y "&lt; 6 m" por supervisor vienen del registro de salidas (columna supervisor); "Tiendas" y el costo, del registro de tiendas (salidas por agencia). Pueden no cuadrar exactamente porque una salida se cuenta por su supervisor, no por la tienda.</p>${notaCosto()}`;
  } else if (seleccion.tipo === 'sup') {
    const sup = seleccion.clave || null;
    const lista = tiendas.filter((t) => (t.supervisor ?? null) === sup);
    const ps = D.porSupervisor?.[sup];
    const deptos = [...new Set(lista.map((t) => t.departamento).filter(Boolean))].sort();
    const top = Object.entries(ps?.motivos ?? {}).slice(0, 3);
    // comparación con los otros supervisores de región (promedio simple de los que tienen salidas)
    const pares = supervisores.filter((s) => s !== sup).map((s) => D.porSupervisor?.[s]).filter((p) => p?.n);
    const promN = pares.length ? pares.reduce((a, p) => a + p.n, 0) / pares.length : null;
    const promT = pares.length ? pares.reduce((a, p) => a + pct(p.tempranas, p.n), 0) / pares.length : null;
    const promR = pares.length ? pares.reduce((a, p) => a + pct(p.renuncia, p.n), 0) / pares.length : null;
    // neutro: la proporción de renuncias no es "mejor" ni "peor" por sí sola (menos renuncias = más despidos)
    const comparar = (v, prom, { inverso = false, unidad = '', neutro = false } = {}) => {
      if (prom == null || v == null) return '';
      const d = Math.round(v - prom); if (!d) return '<span class="delta igual">= promedio</span>';
      const clase = neutro ? 'igual' : ((inverso ? d < 0 : d > 0) ? 'mas' : 'menos');
      return `<span class="delta ${clase}">${d > 0 ? '+' : '−'}${Math.abs(d)}${unidad} vs. promedio</span>`;
    };
    el.innerHTML = `${cerrar}<h3><i class="punto grande" style="background:${colorSup(sup)}"></i>${esc(sup ?? SIN_SUP)}</h3>
      <p class="sub">${lista.length} tiendas en ${deptos.length ? deptos.join(', ') : 'ubicación por definir'}.</p>
      ${ps ? `<div class="kpis kpis-panel">
        <div class="kpi"><div class="kpi-valor">${fmtNum(ps.n)}</div><div class="kpi-eti">salidas · ${etiP}</div><div class="kpi-nota">${comparar(ps.n, promN)}</div></div>
        <div class="kpi"><div class="kpi-valor">${pct(ps.renuncia, ps.n)}%</div><div class="kpi-eti">renuncias (${fmtNum(ps.renuncia)}) · despidos ${fmtNum(ps.despido)}</div><div class="kpi-nota">${comparar(pct(ps.renuncia, ps.n), promR, { unidad: ' pts', neutro: true })}</div></div>
        <div class="kpi"><div class="kpi-valor ${ps.n && ps.tempranas / ps.n >= 0.5 ? 'rojo' : ''}">${pct(ps.tempranas, ps.n)}%</div><div class="kpi-eti">se va antes de 6 meses (${fmtNum(ps.tempranas)})</div><div class="kpi-nota">${comparar(pct(ps.tempranas, ps.n), promT, { unidad: ' pts' })}</div></div>
        <div class="kpi"><div class="kpi-valor medio">${fmtQ(costoLista(lista))}</div><div class="kpi-eti">costo estimado de la rotación de sus tiendas</div></div>
      </div>
      ${pares.length ? `<p class="pie">"Promedio" = los otros ${pares.length} supervisores de región en ${etiP}: ${Math.round(promN)} salidas, ${Math.round(promR)}% renuncias, ${Math.round(promT)}% antes de 6 meses. Naranja = peor que el promedio; verde = mejor.</p>` : ''}
      ${top.length ? `<p class="sub"><b>Por qué se va su gente:</b> ${top.map(([k, v]) => `${nombreSub(k)} ${fmtNum(v)}`).join(' · ')}</p>` : ''}` : `<p class="sub">Sin salidas registradas con este supervisor en ${etiP}.</p>`}
      <h4>Sus tiendas</h4>${listaTiendas(lista)}${notaCosto()}`;
  } else if (seleccion.tipo === 'depto') {
    const lista = porDepto[seleccion.clave] ?? [];
    const sups = [...new Set(lista.map((t) => t.supervisor ?? null))];
    el.innerHTML = `${cerrar}<h3>${esc(seleccion.clave)}</h3>
      <p class="sub">${lista.length} ${lista.length === 1 ? 'tienda' : 'tiendas'} · ${fmtNum(bajasLista(lista))} salidas en ${etiP} · costo estimado ${fmtQ(costoLista(lista))} · ${sups.length === 1 ? 'un supervisor' : `${sups.length} supervisores`}: ${sups.map((s) => `<button type="button" class="enlace" data-ir-sup="${esc(s ?? '')}"><i class="punto" style="background:${colorSup(s)}"></i>${esc(s ?? SIN_SUP)}</button>`).join(', ')}.</p>
      ${lista.length ? listaTiendas(lista) : '<p class="sub">Sin tiendas en este departamento.</p>'}${notaCosto()}`;
  } else {
    const t = tiendas.find((x) => x.nombre === seleccion.clave);
    const b = bajasTienda(t.nombre);
    const sem = semaforo[t.nombre];
    el.innerHTML = `${cerrar}<h3><i class="punto grande" style="background:${colorSup(t.supervisor)}"></i>${esc(t.nombre)}</h3>
      <div class="kpis kpis-panel">
        <div class="kpi"><div class="kpi-valor">${fmtNum(b)}</div><div class="kpi-eti">salidas · ${etiP}</div>${sem ? `<div class="kpi-nota"><i class="punto" style="background:${SEMAFORO[sem.color]}"></i>${sem.color === 'verde' ? 'por debajo del' : sem.color === 'rojo' ? 'por encima del' : 'cerca del'} promedio de su tipo (${sem.prom.toFixed(1)})</div>` : ''}</div>
        <div class="kpi"><div class="kpi-valor medio">${fmtQ(costoTienda(t))}</div><div class="kpi-eti">costo estimado de su rotación</div><div class="kpi-nota">${fmtQ(costoPorTipo[t.tipo] ?? costoPorTipo.B)} por salida (${tipoEti(t)}${t.tipo ? '' : ', se asume B'})</div></div>
        <div class="kpi"><div class="kpi-valor medio">${t.tipo ?? '—'}</div><div class="kpi-eti">tipo de tienda</div></div>
      </div>
      <table class="tabla-mapa"><tbody>
        <tr><td>Marca</td><td>${esc(t.marca)}</td></tr>
        <tr><td>Supervisor</td><td><button type="button" class="enlace" data-ir-sup="${esc(t.supervisor ?? '')}">${esc(t.supervisor ?? SIN_SUP)}</button></td></tr>
        <tr><td>Ubicación</td><td>${esc(t.municipio ?? '—')}${t.departamento ? `, <button type="button" class="enlace" data-ir-depto="${esc(t.departamento)}">${esc(t.departamento)}</button>` : ''}</td></tr>
        ${t.observacion ? `<tr><td>Nota</td><td>${esc(t.observacion)}</td></tr>` : ''}
      </tbody></table>
      <p class="pie">Salidas de esta tienda según la columna agencia del registro de salidas. El detalle de motivos por tienda no se publica (con pocos casos identificaría personas).</p>${notaCosto()}`;
  }
}

function seleccionar(sel) {
  seleccion = sel;
  pintarMapa();
  pintarPanel();
  if (sel && window.innerWidth < 900) document.getElementById('panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function refrescar() {
  D = dimsSalidas(salidas, periodoVigente());
  calcularCostos();
  calcularSemaforo();
  pintarMapa();
  pintarPanel();
}

// ── línea de tiempo ──
function pasoAnim() {
  anim.indice = (anim.indice + 1) % mesesConDato.length;
  refrescar();
  if (anim.indice === mesesConDato.length - 1) detenerAnim(false); // se queda en el último mes
}
function iniciarAnim() {
  if (!mesesConDato.length) return;
  anim.activa = true;
  if (anim.indice >= mesesConDato.length - 1) anim.indice = 0;
  refrescar();
  anim.timer = setInterval(pasoAnim, 900);
}
function detenerAnim(volver = true) {
  clearInterval(anim.timer); anim.timer = null;
  if (volver) { anim.activa = false; anim.indice = 0; }
  else { anim.activa = true; } // pausado en un mes concreto: sigue mostrando ese mes
  document.getElementById('anim-play').textContent = '▶ Reproducir mes a mes';
  refrescar();
}

document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-tienda]'); if (t) return seleccionar({ tipo: 'tienda', clave: t.dataset.tienda });
  const d = e.target.closest('[data-depto]'); if (d) return seleccionar((porDepto[d.dataset.depto] ?? []).length ? { tipo: 'depto', clave: d.dataset.depto } : null);
  const s = e.target.closest('[data-sup]'); if (s) return seleccionar(seleccion?.tipo === 'sup' && seleccion.clave === (s.dataset.sup || null) ? null : { tipo: 'sup', clave: s.dataset.sup || null });
  const is = e.target.closest('[data-ir-sup]'); if (is) return seleccionar({ tipo: 'sup', clave: is.dataset.irSup || null });
  const id = e.target.closest('[data-ir-depto]'); if (id) return seleccionar({ tipo: 'depto', clave: id.dataset.irDepto });
  const it = e.target.closest('[data-ir-tienda]'); if (it) return seleccionar({ tipo: 'tienda', clave: it.dataset.irTienda });
  if (e.target.closest('#panel-cerrar')) return seleccionar(null);
  const mc = e.target.closest('[data-modo-color]'); if (mc) { modoColor = mc.dataset.modoColor; if (modoColor === 'semaforo' && seleccion?.tipo === 'sup') seleccion = null; return refrescar(); }
  const mt = e.target.closest('[data-modo-tamano]'); if (mt) { modoTamano = mt.dataset.modoTamano; return refrescar(); }
  if (e.target.closest('#anim-play')) return anim.timer ? detenerAnim(false) : iniciarAnim();
  if (e.target.closest('#anim-stop')) return detenerAnim(true);
});
document.getElementById('anim-mes').addEventListener('input', (e) => {
  clearInterval(anim.timer); anim.timer = null;
  anim.activa = true; anim.indice = +e.target.value;
  refrescar();
});

periodo = pintarSelectorPeriodo({ ...aniosYMeses({ salidas: salidasTodo }), generado: salidasTodo.generado }, (p) => { periodo = p; if (anim.activa) detenerAnim(true); else refrescar(); });
// #sup=Nombre (desde las tarjetas del Resumen) preselecciona un supervisor. Va en el # y no en ?
// porque algunos servidores recortan la parte "?" al redirigir.
const supUrl = new URLSearchParams(location.hash.replace(/^#/, '')).get('sup') ?? new URLSearchParams(location.search).get('sup');
if (supUrl && supervisores.includes(supUrl)) seleccion = { tipo: 'sup', clave: supUrl };
refrescar();
pintarPie(meta);

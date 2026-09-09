// Página Mapa: Guatemala por departamentos, coloreada por supervisor de región, con una
// tienda por punto. Datos: public/geo/mapa-gt.json (contornos), data/tiendas.json (registro de
// tiendas: tipo, supervisor, ubicación) y data/salidas.json (salidas del área Comercial en el
// período elegido). Al tocar un departamento, una tienda o un supervisor se muestra su ficha.
import { pintarPie, marcarNavActiva, fmtNum, salidasDe, pintarSelectorDepto, pintarSelectorPeriodo,
  dimsSalidas, etiquetaPeriodo, aniosYMeses, aplicarDesglose } from './comun.js';

marcarNavActiva();
const [salidasTodo, meta, mapa, registro] = await Promise.all([
  fetch('data/salidas.json', { cache: 'no-cache' }).then((r) => r.json()),
  fetch('data/meta.json', { cache: 'no-cache' }).then((r) => r.json()),
  fetch('geo/mapa-gt.json', { cache: 'no-cache' }).then((r) => r.json()),
  fetch('data/tiendas.json', { cache: 'no-cache' }).then((r) => r.json()),
]);

// El mapa es de tiendas: siempre usa el área Comercial, sin importar el selector General/Comercial.
pintarSelectorDepto(() => {});
document.getElementById('alcance').innerHTML = 'Mostrando <b>las tiendas (área Comercial)</b>: el mapa no cambia con el selector General/Comercial.';

const COLOR = { 'Alejandro Zelada': '#0B7A55', 'Diana Mendez': '#B5741A', 'Luisa De Leon': '#46615A', 'Myra Santos': '#7B4FA6', 'Sergio Corado': '#2F6DB5' };
const SIN_SUP = 'Sin supervisor asignado';
const colorSup = (s) => COLOR[s] ?? '#9AA5A0';
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const nombreSub = (k) => aplicarDesglose({ [k]: 1 }, null).items[0]?.eti ?? k;

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

let periodo = 'todo', D = null, seleccion = null; // seleccion: {tipo:'sup'|'depto'|'tienda', clave}
const salidas = salidasDe(salidasTodo, 'comercial');
const bajasTienda = (nombre) => Object.entries(D.agencia ?? {}).filter(([k]) => k.split('·')[0] === nombre).reduce((s, [, v]) => s + v, 0);
const bajasLista = (lista) => lista.reduce((s, t) => s + bajasTienda(t.nombre), 0);
const tipoEti = (t) => (t.tipo ? `tipo ${t.tipo}` : 'tipo por definir');

function pintarMapa() {
  const etiP = etiquetaPeriodo(periodo, salidas.generado);
  document.getElementById('periodo-eval').textContent = `Salidas del período: ${etiP}.`;
  const sel = seleccion;
  const apagadoSup = (s) => sel?.tipo === 'sup' && s !== sel.clave;
  let s = `<svg viewBox="0 0 ${W} ${H}" class="mapa-svg" role="img" aria-label="Mapa de Guatemala por regiones">`;
  s += '<g class="deptos">';
  for (const d of mapa.departamentos) {
    const lista = porDepto[d.nombre] ?? [];
    const dom = dominante(lista);
    const activo = sel?.tipo === 'depto' && sel.clave === d.nombre;
    const apagado = sel?.tipo === 'sup' && !lista.some((t) => t.supervisor === sel.clave);
    s += `<path d="${d.d}" data-depto="${esc(d.nombre)}" fill="${dom ? colorSup(dom) : '#ECEAE4'}" fill-opacity="${lista.length ? (apagado ? 0.15 : 0.55) : 1}" stroke="#fff" stroke-width="1.6" class="depto${activo ? ' activo' : ''}${lista.length ? ' con-tiendas' : ''}"><title>${esc(d.nombre)}${lista.length ? `: ${lista.length} ${lista.length === 1 ? 'tienda' : 'tiendas'}` : ''}</title></path>`;
  }
  s += '</g><g class="etiquetas">';
  for (const d of mapa.departamentos) if (porDepto[d.nombre]) s += `<text x="${d.cx}" y="${d.cy}" text-anchor="middle" font-size="13" font-weight="600" fill="#17251F" pointer-events="none">${esc(d.nombre)}</text>`;
  s += '</g><g class="tiendas">';
  const maxB = Math.max(1, ...ubicadas.map((t) => bajasTienda(t.nombre)));
  for (const t of ubicadas) {
    const b = bajasTienda(t.nombre);
    const r = 5 + Math.sqrt(b / maxB) * 11;
    const activo = sel?.tipo === 'tienda' && sel.clave === t.nombre;
    s += `<circle cx="${t.x.toFixed(1)}" cy="${t.y.toFixed(1)}" r="${r.toFixed(1)}" fill="${colorSup(t.supervisor)}" fill-opacity="${apagadoSup(t.supervisor) ? 0.25 : 0.92}" stroke="${activo ? '#17251F' : '#fff'}" stroke-width="${activo ? 3 : 1.5}" data-tienda="${esc(t.nombre)}" class="tienda"><title>${esc(t.nombre)} (${tipoEti(t)}) · ${t.supervisor ?? SIN_SUP} · ${fmtNum(b)} ${b === 1 ? 'salida' : 'salidas'} en ${etiP}</title></circle>`;
  }
  s += '</g></svg>';
  document.getElementById('mapa').innerHTML = s;

  // leyenda: un botón por supervisor con tiendas y salidas del período
  document.getElementById('leyenda').innerHTML = [...supervisores, null].map((sup) => {
    const lista = tiendas.filter((t) => (t.supervisor ?? null) === sup);
    if (!lista.length) return '';
    const activo = sel?.tipo === 'sup' && sel.clave === sup;
    return `<button type="button" class="chip-sup${activo ? ' activo' : ''}" data-sup="${esc(sup ?? '')}" style="--c:${colorSup(sup)}"><i></i><b>${esc(sup ?? SIN_SUP)}</b><span>${lista.length} ${lista.length === 1 ? 'tienda' : 'tiendas'} · ${fmtNum(D.porSupervisor?.[sup]?.n ?? bajasLista(lista))} salidas</span></button>`;
  }).join('');
}

function listaTiendas(lista) {
  const orden = [...lista].sort((a, b) => bajasTienda(b.nombre) - bajasTienda(a.nombre) || a.nombre.localeCompare(b.nombre));
  return `<table class="tabla-mapa"><thead><tr><th>Tienda</th><th>Tipo</th><th class="n">Salidas</th></tr></thead><tbody>${orden.map((t) => `<tr><td><button type="button" class="enlace" data-ir-tienda="${esc(t.nombre)}"><i class="punto" style="background:${colorSup(t.supervisor)}"></i>${esc(t.nombre)}</button></td><td>${t.tipo ?? '—'}</td><td class="n">${fmtNum(bajasTienda(t.nombre))}</td></tr>`).join('')}</tbody></table>`;
}

function pintarPanel() {
  const etiP = etiquetaPeriodo(periodo, salidas.generado);
  const el = document.getElementById('panel');
  const cerrar = '<button type="button" class="cerrar" id="panel-cerrar" aria-label="Volver al resumen">✕</button>';
  if (!seleccion) {
    el.innerHTML = `<h3>Todas las regiones · ${etiP}</h3>
      <p class="sub">${tiendas.length} tiendas activas, ${supervisores.length} supervisores de región. Toca un supervisor, un departamento o un punto del mapa.</p>
      <table class="tabla-mapa"><thead><tr><th>Supervisor</th><th class="n">Tiendas</th><th class="n">Salidas</th><th class="n">&lt; 6 meses</th></tr></thead><tbody>${[...supervisores, null].map((sup) => {
        const lista = tiendas.filter((t) => (t.supervisor ?? null) === sup); if (!lista.length) return '';
        const ps = D.porSupervisor?.[sup] ?? null;
        return `<tr><td><button type="button" class="enlace" data-ir-sup="${esc(sup ?? '')}"><i class="punto" style="background:${colorSup(sup)}"></i>${esc(sup ?? SIN_SUP)}</button></td><td class="n">${lista.length}</td><td class="n">${fmtNum(ps?.n ?? bajasLista(lista))}</td><td class="n">${ps ? `${fmtNum(ps.tempranas)}<span class="pct">${ps.n ? Math.round((ps.tempranas / ps.n) * 100) : 0}%</span>` : '—'}</td></tr>`;
      }).join('')}</tbody></table>
      <p class="pie">"Salidas" por supervisor viene del registro de salidas (columna supervisor); "Tiendas" del registro de tiendas. Pueden no cuadrar exactamente con la suma de puntos porque una salida se cuenta por su supervisor, no por la tienda.</p>`;
  } else if (seleccion.tipo === 'sup') {
    const sup = seleccion.clave || null;
    const lista = tiendas.filter((t) => (t.supervisor ?? null) === sup);
    const ps = D.porSupervisor?.[sup];
    const deptos = [...new Set(lista.map((t) => t.departamento).filter(Boolean))].sort();
    const top = Object.entries(ps?.motivos ?? {}).slice(0, 3);
    el.innerHTML = `${cerrar}<h3><i class="punto grande" style="background:${colorSup(sup)}"></i>${esc(sup ?? SIN_SUP)}</h3>
      <p class="sub">${lista.length} tiendas en ${deptos.length ? deptos.join(', ') : 'ubicación por definir'}.</p>
      ${ps ? `<div class="kpis kpis-panel">
        <div class="kpi"><div class="kpi-valor">${fmtNum(ps.n)}</div><div class="kpi-eti">salidas · ${etiP}</div></div>
        <div class="kpi"><div class="kpi-valor">${fmtNum(ps.renuncia)}</div><div class="kpi-eti">renuncias</div></div>
        <div class="kpi"><div class="kpi-valor">${fmtNum(ps.despido)}</div><div class="kpi-eti">despidos</div></div>
        <div class="kpi"><div class="kpi-valor ${ps.n && ps.tempranas / ps.n >= 0.5 ? 'rojo' : ''}">${ps.n ? Math.round((ps.tempranas / ps.n) * 100) : 0}%</div><div class="kpi-eti">se va antes de 6 meses (${fmtNum(ps.tempranas)})</div></div>
      </div>
      ${top.length ? `<p class="sub"><b>Por qué se va su gente:</b> ${top.map(([k, v]) => `${nombreSub(k)} ${fmtNum(v)}`).join(' · ')}</p>` : ''}` : `<p class="sub">Sin salidas registradas con este supervisor en ${etiP}.</p>`}
      <h4>Sus tiendas</h4>${listaTiendas(lista)}`;
  } else if (seleccion.tipo === 'depto') {
    const lista = porDepto[seleccion.clave] ?? [];
    const sups = [...new Set(lista.map((t) => t.supervisor ?? null))];
    el.innerHTML = `${cerrar}<h3>${esc(seleccion.clave)}</h3>
      <p class="sub">${lista.length} ${lista.length === 1 ? 'tienda' : 'tiendas'} · ${fmtNum(bajasLista(lista))} salidas en ${etiP} · ${sups.length === 1 ? 'un supervisor' : `${sups.length} supervisores`}: ${sups.map((s) => `<button type="button" class="enlace" data-ir-sup="${esc(s ?? '')}"><i class="punto" style="background:${colorSup(s)}"></i>${esc(s ?? SIN_SUP)}</button>`).join(', ')}.</p>
      ${lista.length ? listaTiendas(lista) : '<p class="sub">Sin tiendas en este departamento.</p>'}`;
  } else {
    const t = tiendas.find((x) => x.nombre === seleccion.clave);
    const b = bajasTienda(t.nombre);
    el.innerHTML = `${cerrar}<h3><i class="punto grande" style="background:${colorSup(t.supervisor)}"></i>${esc(t.nombre)}</h3>
      <div class="kpis kpis-panel">
        <div class="kpi"><div class="kpi-valor">${fmtNum(b)}</div><div class="kpi-eti">salidas · ${etiP}</div></div>
        <div class="kpi"><div class="kpi-valor medio">${t.tipo ?? '—'}</div><div class="kpi-eti">tipo de tienda</div></div>
      </div>
      <table class="tabla-mapa"><tbody>
        <tr><td>Marca</td><td>${esc(t.marca)}</td></tr>
        <tr><td>Supervisor</td><td><button type="button" class="enlace" data-ir-sup="${esc(t.supervisor ?? '')}">${esc(t.supervisor ?? SIN_SUP)}</button></td></tr>
        <tr><td>Ubicación</td><td>${esc(t.municipio ?? '—')}${t.departamento ? `, <button type="button" class="enlace" data-ir-depto="${esc(t.departamento)}">${esc(t.departamento)}</button>` : ''}</td></tr>
        ${t.observacion ? `<tr><td>Nota</td><td>${esc(t.observacion)}</td></tr>` : ''}
      </tbody></table>
      <p class="pie">Salidas de esta tienda según la columna agencia del registro de salidas. El detalle de motivos por tienda no se publica (con pocos casos identificaría personas).</p>`;
  }
}

function seleccionar(sel) {
  seleccion = sel;
  pintarMapa();
  pintarPanel();
  if (sel && window.innerWidth < 900) document.getElementById('panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function refrescar() { D = dimsSalidas(salidas, periodo); pintarMapa(); pintarPanel(); }

document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-tienda]'); if (t) return seleccionar({ tipo: 'tienda', clave: t.dataset.tienda });
  const d = e.target.closest('[data-depto]'); if (d) return seleccionar((porDepto[d.dataset.depto] ?? []).length ? { tipo: 'depto', clave: d.dataset.depto } : null);
  const s = e.target.closest('[data-sup]'); if (s) return seleccionar(seleccion?.tipo === 'sup' && seleccion.clave === (s.dataset.sup || null) ? null : { tipo: 'sup', clave: s.dataset.sup || null });
  const is = e.target.closest('[data-ir-sup]'); if (is) return seleccionar({ tipo: 'sup', clave: is.dataset.irSup || null });
  const id = e.target.closest('[data-ir-depto]'); if (id) return seleccionar({ tipo: 'depto', clave: id.dataset.irDepto });
  const it = e.target.closest('[data-ir-tienda]'); if (it) return seleccionar({ tipo: 'tienda', clave: it.dataset.irTienda });
  if (e.target.closest('#panel-cerrar')) return seleccionar(null);
});

periodo = pintarSelectorPeriodo({ ...aniosYMeses({ salidas: salidasTodo }), generado: salidasTodo.generado }, (p) => { periodo = p; refrescar(); });
refrescar();
pintarPie(meta);

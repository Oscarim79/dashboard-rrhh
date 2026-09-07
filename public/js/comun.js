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

// Mediana de días calibrada: usa la del tipo si tiene muestra suficiente, si no la global.
export function diasCalibrados(diasCobertura, tipo, minimo = 8) {
  const t = diasCobertura.porTipo[tipo];
  if (t && t.n >= minimo && t.mediana != null) return { dias: t.mediana, fuente: `mediana tipo ${tipo} (n=${t.n})` };
  return { dias: diasCobertura.global.mediana, fuente: `mediana global (n=${diasCobertura.global.n})` };
}

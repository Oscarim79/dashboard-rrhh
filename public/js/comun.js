// Utilidades compartidas: carga de datos, formato es-GT y pie de página.
export { fmtQ, fmtPct } from './modelo.js';

export async function cargarDatos() {
  const [vacantes, rotacion, meta] = await Promise.all([
    fetch('data/vacantes.json').then((r) => r.json()),
    fetch('data/rotacion.json').then((r) => r.json()),
    fetch('data/meta.json').then((r) => r.json()),
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
    `Sin datos personales: el sitio solo publica cifras agregadas.`;
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

// Mediana de días calibrada: usa la del tipo si tiene muestra suficiente, si no la global.
export function diasCalibrados(diasCobertura, tipo, minimo = 8) {
  const t = diasCobertura.porTipo[tipo];
  if (t && t.n >= minimo && t.mediana != null) return { dias: t.mediana, fuente: `mediana tipo ${tipo} (n=${t.n})` };
  return { dias: diasCobertura.global.mediana, fuente: `mediana global (n=${diasCobertura.global.n})` };
}

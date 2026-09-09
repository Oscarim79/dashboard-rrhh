// Genera public/data/mapa-gt.json: contornos de los 22 departamentos de Guatemala como trazos SVG
// ya proyectados, más los parámetros de proyección para ubicar tiendas por latitud/longitud.
// Fuente: TopoJSON del Ministerio de Finanzas (minfin-bi/Mapas-TopoJSON-Guatemala, público).
// Se descarga a .data/geo/ si no está; el JSON resultante va a public/geo/ y SÍ se commitea (dato público).
// Uso: node scripts/generar_mapa.mjs
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GEO_DIR = path.join(ROOT, '.data', 'geo');
const FUENTE = path.join(GEO_DIR, 'deptos.json');
const URL = 'https://raw.githubusercontent.com/minfin-bi/Mapas-TopoJSON-Guatemala/master/deptos.json';

if (!existsSync(FUENTE)) {
  mkdirSync(GEO_DIR, { recursive: true });
  const res = await fetch(URL);
  if (!res.ok) throw new Error(`No se pudo descargar el mapa (${res.status})`);
  writeFileSync(FUENTE, await res.text());
  console.log('Descargado', URL);
}
const topo = JSON.parse(readFileSync(FUENTE, 'utf8'));
const { scale, translate } = topo.transform;

// ── decodificar arcos (cuantizados como deltas) a lon/lat ──
const arcos = topo.arcs.map((arc) => {
  let x = 0, y = 0;
  return arc.map(([dx, dy]) => { x += dx; y += dy; return [x * scale[0] + translate[0], y * scale[1] + translate[1]]; });
});
const anillo = (indices) => {
  const pts = [];
  for (const i of indices) {
    const a = i < 0 ? [...arcos[~i]].reverse() : arcos[i];
    for (let k = 0; k < a.length; k++) if (k > 0 || !pts.length) pts.push(a[k]);
  }
  return pts;
};

// ── proyección equirectangular ajustada a la latitud media (suficiente para un país pequeño) ──
const todos = arcos.flat();
const lon0 = Math.min(...todos.map((p) => p[0])), lon1 = Math.max(...todos.map((p) => p[0]));
const lat0 = Math.min(...todos.map((p) => p[1])), lat1 = Math.max(...todos.map((p) => p[1]));
const W = 1000;
const cosMid = Math.cos(((lat0 + lat1) / 2) * Math.PI / 180);
const s = W / (lon1 - lon0); // unidades por grado de longitud
const H = Math.round((lat1 - lat0) * s / cosMid);
const px = (lon) => (lon - lon0) * s;
const py = (lat) => (lat1 - lat) * s / cosMid;

// ── simplificar (quitar puntos a menos de 1.2 unidades del anterior) y escribir trazos ──
const trazo = (pts) => {
  const out = [];
  let ux = null, uy = null;
  for (const [lon, lat] of pts) {
    const x = px(lon), y = py(lat);
    if (ux != null && Math.hypot(x - ux, y - uy) < 1.8) continue;
    out.push(`${x.toFixed(1)},${y.toFixed(1)}`); ux = x; uy = y;
  }
  return out.length > 2 ? `M${out.join('L')}Z` : '';
};
const obj = Object.values(topo.objects)[0];
const departamentos = obj.geometries.map((g) => {
  const anillos = g.type === 'Polygon' ? g.arcs : g.arcs.flat();
  const d = anillos.map(anillo).map(trazo).filter(Boolean).join('');
  // centroide aproximado: promedio de los puntos del anillo más grande (para colocar la etiqueta)
  const mayor = anillos.map(anillo).sort((a, b) => b.length - a.length)[0];
  const cx = mayor.reduce((t, p) => t + px(p[0]), 0) / mayor.length;
  const cy = mayor.reduce((t, p) => t + py(p[1]), 0) / mayor.length;
  return { id: g.properties.id, nombre: g.properties.Departamento, d, cx: +cx.toFixed(1), cy: +cy.toFixed(1) };
});
const salida = { fuente: 'Ministerio de Finanzas de Guatemala (minfin-bi/Mapas-TopoJSON-Guatemala), simplificado', viewBox: [0, 0, W, H], proyeccion: { lon0, lat1, s, cosMid }, departamentos };
mkdirSync(path.join(ROOT, 'public', 'geo'), { recursive: true });
writeFileSync(path.join(ROOT, 'public', 'geo', 'mapa-gt.json'), JSON.stringify(salida));
console.log(`mapa-gt.json: ${departamentos.length} departamentos, viewBox ${W}×${H}, ${Math.round(JSON.stringify(salida).length / 1024)} KB`);
console.log(departamentos.map((d) => d.nombre).join(' · '));

// Diagnóstico complementario sobre el xlsx ya descargado en .data/sheet.xlsx
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import XLSX from 'xlsx';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const wb = XLSX.read(readFileSync(path.join(ROOT, '.data', 'sheet.xlsx')), { cellDates: true });

const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
const filas = (nombre) => XLSX.utils.sheet_to_json(wb.Sheets[nombre], { header: 1, defval: null, blankrows: false });
const conteo = (arr) => {
  const c = {};
  for (const v of arr) if (v != null && String(v).trim() !== '') { const k = String(v).trim(); c[k] = (c[k] ?? 0) + 1; }
  return Object.entries(c).sort((a, b) => b[1] - a[1]);
};

function parseFecha(v) {
  if (v == null || v === '') return null;
  if (v instanceof Date && !isNaN(v)) return v;
  const m = String(v).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return new Date(+m[3], +m[1] - 1, +m[2]);
  return null;
}

// ── CONTROL DE VACANTES: columnas pendientes ──
const V = filas('CONTROL DE VACANTES');
const H = V[0].map((h) => norm(h));
const col = (...t) => H.findIndex((h) => t.every((x) => h.includes(norm(x))));
const D = V.slice(1).filter((f) => f.some((c) => c != null && String(c).trim() !== ''));

console.log('═══ VACANTES: columnas pendientes ═══');
const iEmp = col('NOMBRE EMPRESA');
console.log('NOMBRE EMPRESA:', conteo(D.map((f) => f[iEmp])).map(([v, n]) => `${v}×${n}`).join(', '));
const iOcupa = col('VACANTE SE OCUPA');
console.log('LA VACANTE SE OCUPA POR:', conteo(D.map((f) => f[iOcupa])).map(([v, n]) => `${v}×${n}`).join(', '));
for (const t of ['GRUPOS DE TRABAJO', 'PERIFONEO']) {
  const i = col(t);
  console.log(`${V[0][i]}:`, conteo(D.map((f) => f[i])).map(([v, n]) => `${v}×${n}`).join(', ') || '(vacía)');
}

// ── Cruce estatus × fechas y días reales ──
const iEst = col('ESTATUS'), iSol = col('FECHA', 'SOLICITUD'), iCie = col('FECHA', 'CIERRE'), iDias = col('DIAS', 'TRANSCURRIDOS'), iLugar = col('LUGAR');
let cerradaSinCierre = 0, abiertaConCierre = 0;
const diasCerradas = [];
for (const f of D) {
  const est = norm(f[iEst]), s = parseFecha(f[iSol]), c = parseFecha(f[iCie]);
  if (est === 'CERRADA' && !c) cerradaSinCierre++;
  if (est === 'ABIERTA' && c) abiertaConCierre++;
  if (est === 'CERRADA') {
    if (s && c) diasCerradas.push(Math.round((c - s) / 86400000));
    else if (Number.isFinite(Number(f[iDias]))) diasCerradas.push(Number(f[iDias]));
  }
}
diasCerradas.sort((a, b) => a - b);
const mediana = diasCerradas.length ? diasCerradas[Math.floor(diasCerradas.length / 2)] : null;
const prom = diasCerradas.length ? (diasCerradas.reduce((a, b) => a + b, 0) / diasCerradas.length).toFixed(1) : null;
console.log(`\nCerradas sin fecha de cierre: ${cerradaSinCierre} · Abiertas con fecha de cierre: ${abiertaConCierre}`);
console.log(`Días de cobertura en CERRADAS con dato (n=${diasCerradas.length}): mediana ${mediana} · promedio ${prom} · min ${diasCerradas[0]} · max ${diasCerradas.at(-1)}`);

// Empresa × lugar (para el mapeo A/B)
const porEmpresa = {};
for (const f of D) {
  const e = String(f[iEmp] ?? '').trim() || '(sin empresa)';
  const l = String(f[iLugar] ?? '').trim();
  porEmpresa[e] ??= new Set();
  if (l) porEmpresa[e].add(l);
}
console.log('\nLugares por empresa:');
for (const [e, ls] of Object.entries(porEmpresa)) console.log(`  ${e} (${ls.size}): ${[...ls].sort().join(', ')}`);

// ── INDICADOR ROTACION (la pestaña que coincide con la spec) ──
console.log('\n═══ INDICADOR ROTACION ═══');
const R = filas('INDICADOR ROTACION');
const HR = R[0].map((h) => norm(h));
const DR = R.slice(1).filter((f) => f.some((c) => c != null && String(c).trim() !== ''));
const rc = (...t) => HR.findIndex((h) => t.every((x) => h.includes(norm(x))));
const iAno = rc('AÑO'), iMes = rc('MES'), iPct = rc('% ROTACION'), iAreas = rc('AREAS'), iIni = rc('IN ICIO'), iFin = rc('FIN DE MES');
console.log(`Filas: ${DR.length} · AÑO: ${conteo(DR.map((f) => f[iAno])).map(([v, n]) => `${v}×${n}`).join(', ')}`);
console.log(`AREAS: ${conteo(DR.map((f) => f[iAreas])).map(([v, n]) => `${v}×${n}`).join(', ')}`);
const pcts = DR.map((f) => Number(f[iPct])).filter(Number.isFinite);
console.log(`% ROTACION: n=${pcts.length}, min ${Math.min(...pcts).toFixed(4)}, max ${Math.max(...pcts).toFixed(4)} (¿fracción o porcentaje?)`);
console.log('Muestra (primeras 8 filas):');
for (const f of DR.slice(0, 8)) console.log(`  ${f[iAno]} ${f[iMes]} | inicio ${f[iIni]} fin ${f[iFin]} | %rot ${f[iPct]} | areas ${f[iAreas]}`);
console.log('Últimas 4 filas:');
for (const f of DR.slice(-4)) console.log(`  ${f[iAno]} ${f[iMes]} | inicio ${f[iIni]} fin ${f[iFin]} | %rot ${f[iPct]} | areas ${f[iAreas]}`);

// ── REPORTE MENSUAL A GERENCIA (posible fuente del % que ve el CEO) ──
console.log('\n═══ REPORTE MENSUAL A GERENCIA (muestra) ═══');
for (const f of filas('REPORTE MENSUAL A GERENCIA').slice(0, 18)) console.log('  ' + f.map((c) => c instanceof Date ? c.toISOString().slice(0, 10) : c).join(' | '));

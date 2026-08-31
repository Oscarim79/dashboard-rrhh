// Diagnóstico del Google Sheet de RRHH — NO genera nada público.
// Descarga el xlsx con el SHEET_ID del .env, detecta pestañas por encabezados
// y reporta estructura, calidad y valores únicos de columnas NO personales.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import XLSX from 'xlsx';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// --- SHEET_ID desde .env (nunca hardcodeado) ---
function leerEnv() {
  const envPath = path.join(ROOT, '.env');
  if (!existsSync(envPath)) throw new Error('Falta .env con SHEET_ID');
  const m = readFileSync(envPath, 'utf8').match(/^SHEET_ID=(.+)$/m);
  if (!m) throw new Error('.env no contiene SHEET_ID=');
  return m[1].trim();
}

// --- utilidades ---
const norm = (s) => String(s ?? '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toUpperCase().replace(/\s+/g, ' ').trim();

// Columnas cuyos VALORES jamás se imprimen ni exportan (datos personales)
const PATRONES_PERSONALES = [
  'NOMBRE', 'CANDIDATO', 'REEMPLAZA', 'JEFE DIRECTO', 'QUIEN SOLICITO',
  'ENTREVISTADOR', 'DPI', 'TELEFONO', 'CELULAR', 'SUELDO', 'SALARIO',
  'CORREO', 'EMAIL', 'DIRECCION',
];
const esPersonal = (h) => PATRONES_PERSONALES.some((p) => norm(h).includes(p));

// Columnas categóricas seguras: se listan valores únicos con conteo
const PATRONES_SEGUROS = [
  'LUGAR', 'TIENDA', 'PUESTO', 'EMPRESA', 'MOTIVO', 'CANAL', 'FUENTE',
  'MEDIO', 'ESTADO', 'STATUS', 'INTERNO', 'EXTERNO', 'TIPO', 'AREA',
  'DEPARTAMENTO', 'MES', 'ANO', 'AÑO',
];
const esSegura = (h) => PATRONES_SEGUROS.some((p) => norm(h).includes(p)) && !esPersonal(h);

function parseFecha(v) {
  if (v == null || v === '') return null;
  if (v instanceof Date && !isNaN(v)) return v;
  if (typeof v === 'number') { // serial de Excel
    const d = XLSX.SSF.parse_date_code(v);
    return d ? new Date(d.y, d.m - 1, d.d) : null;
  }
  const m = String(v).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); // M/D/YYYY
  if (m) return new Date(+m[3], +m[1] - 1, +m[2]);
  const d = new Date(v);
  return isNaN(d) ? null : d;
}
const fmtFecha = (d) => d ? d.toISOString().slice(0, 10) : null;

// Encuentra la fila de encabezado: la primera de las 10 primeras filas con más celdas de texto
function filaEncabezado(filas) {
  let mejor = 0, mejorScore = -1;
  for (let i = 0; i < Math.min(10, filas.length); i++) {
    const score = (filas[i] ?? []).filter((c) => typeof c === 'string' && c.trim()).length;
    if (score > mejorScore) { mejorScore = score; mejor = i; }
  }
  return mejor;
}

// --- descarga ---
async function descargar(sheetId) {
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=xlsx`;
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`Descarga falló: HTTP ${res.status}`);
  const ct = res.headers.get('content-type') ?? '';
  if (ct.includes('text/html')) throw new Error('Google devolvió HTML (¿el sheet sigue compartido con enlace?)');
  const buf = Buffer.from(await res.arrayBuffer());
  mkdirSync(path.join(ROOT, '.data'), { recursive: true });
  const destino = path.join(ROOT, '.data', 'sheet.xlsx');
  writeFileSync(destino, buf);
  return { destino, bytes: buf.length };
}

// --- diagnóstico por pestaña ---
function diagnosticarPestana(ws, nombre) {
  const filas = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, blankrows: false });
  if (!filas.length) return { nombre, vacia: true };
  const hIdx = filaEncabezado(filas);
  const encabezados = (filas[hIdx] ?? []).map((h) => (h == null ? '' : String(h).trim()));
  const datos = filas.slice(hIdx + 1).filter((f) => f.some((c) => c !== null && String(c).trim() !== ''));

  const columnas = encabezados.map((h, i) => {
    const vals = datos.map((f) => f[i]).filter((v) => v !== null && String(v).trim() !== '');
    const col = { encabezado: h || `(col ${i + 1} sin nombre)`, llenas: vals.length, pctLleno: datos.length ? Math.round((vals.length / datos.length) * 100) : 0 };
    if (esPersonal(h)) { col.personal = true; return col; } // jamás valores
    if (esSegura(h)) {
      const conteo = {};
      for (const v of vals) { const k = String(v).trim(); conteo[k] = (conteo[k] ?? 0) + 1; }
      col.unicos = Object.entries(conteo).sort((a, b) => b[1] - a[1]).slice(0, 40);
    }
    return col;
  });
  return { nombre, filaEncabezado: hIdx + 1, filasDatos: datos.length, encabezados, columnas, _datos: datos };
}

function idx(encabezados, ...tokens) {
  return encabezados.findIndex((h) => tokens.every((t) => norm(h).includes(norm(t))));
}

// --- main ---
const sheetId = leerEnv();
console.log('Descargando sheet…');
const { destino, bytes } = await descargar(sheetId);
console.log(`OK: ${(bytes / 1024).toFixed(0)} KB → .data/sheet.xlsx\n`);

const wb = XLSX.read(readFileSync(destino), { cellDates: true });
console.log(`Pestañas (${wb.SheetNames.length}): ${wb.SheetNames.join(' | ')}\n`);

const diag = { pestanas: [] };
let vacantes = null, rotacion = null;

for (const nombre of wb.SheetNames) {
  const d = diagnosticarPestana(wb.Sheets[nombre], nombre);
  diag.pestanas.push(d);
  if (d.vacia) { console.log(`── ${nombre}: VACÍA`); continue; }
  const H = d.encabezados;
  const esVac = idx(H, 'ITEM') >= 0 && idx(H, 'FECHA', 'SOLICITUD') >= 0 && idx(H, 'FECHA', 'CIERRE') >= 0
    && idx(H, 'DIAS', 'TRANSCURRIDOS') >= 0 && idx(H, 'MOTIVO', 'ORIGINA') >= 0;
  const esRot = idx(H, 'AÑO') >= 0 && idx(H, 'MES') >= 0 && H.some((h) => norm(h).includes('ROTACION'));
  if (esVac && !vacantes) { vacantes = d; d.rol = 'VACANTES'; }
  else if (esRot && !rotacion) { rotacion = d; d.rol = 'ROTACION'; }
  console.log(`── ${nombre}${d.rol ? `  ⇒ detectada como ${d.rol}` : ''}`);
  console.log(`   encabezado en fila ${d.filaEncabezado}, ${d.filasDatos} filas de datos`);
  console.log(`   columnas: ${H.filter(Boolean).join(' · ')}`);
}

// --- detalle VACANTES ---
if (vacantes) {
  const H = vacantes.encabezados, D = vacantes._datos;
  const iSol = idx(H, 'FECHA', 'SOLICITUD'), iCie = idx(H, 'FECHA', 'CIERRE'), iDias = idx(H, 'DIAS', 'TRANSCURRIDOS');
  const sols = D.map((f) => parseFecha(f[iSol])).filter(Boolean).sort((a, b) => a - b);
  const cies = D.map((f) => parseFecha(f[iCie])).filter(Boolean).sort((a, b) => a - b);
  const sinCierre = D.filter((f) => !parseFecha(f[iCie])).length;
  const sinDias = D.filter((f) => f[iDias] == null || String(f[iDias]).trim() === '').length;
  let diasNegativos = 0, diasDiscrepantes = 0;
  for (const f of D) {
    const s = parseFecha(f[iSol]), c = parseFecha(f[iCie]);
    if (s && c) {
      const calc = Math.round((c - s) / 86400000);
      if (calc < 0) diasNegativos++;
      const reg = Number(f[iDias]);
      if (Number.isFinite(reg) && Math.abs(reg - calc) > 1) diasDiscrepantes++;
    }
  }
  console.log('\n═══ DETALLE VACANTES ═══');
  console.log(`Filas: ${D.length} · rango solicitud: ${fmtFecha(sols[0])} → ${fmtFecha(sols.at(-1))} · rango cierre: ${fmtFecha(cies[0])} → ${fmtFecha(cies.at(-1))}`);
  console.log(`Sin fecha de cierre (¿abiertas?): ${sinCierre} · sin DÍAS TRANSCURRIDOS: ${sinDias} · días negativos: ${diasNegativos} · días registrados ≠ calculados (>1): ${diasDiscrepantes}`);
  for (const c of vacantes.columnas) {
    if (c.personal) console.log(`  [PERSONAL — valores ocultos] ${c.encabezado}: ${c.pctLleno}% lleno`);
    else if (c.unicos) console.log(`  ${c.encabezado} (${c.pctLleno}% lleno): ${c.unicos.map(([v, n]) => `${v}×${n}`).join(', ')}`);
  }
}

// --- detalle ROTACIÓN ---
if (rotacion) {
  const H = rotacion.encabezados, D = rotacion._datos;
  console.log('\n═══ DETALLE ROTACIÓN ═══');
  console.log(`Filas: ${D.length}`);
  for (const c of rotacion.columnas) {
    if (c.unicos) console.log(`  ${c.encabezado} (${c.pctLleno}% lleno): ${c.unicos.map(([v, n]) => `${v}×${n}`).join(', ')}`);
    else if (!c.personal) console.log(`  ${c.encabezado}: ${c.pctLleno}% lleno`);
  }
}

if (!vacantes) console.log('\n⚠ NO se detectó pestaña de VACANTES (busqué: ITEM, FECHA SOLICITUD, FECHA DE CIERRE, DÍAS TRANSCURRIDOS, MOTIVO QUE ORIGINA LA VACANTE)');
if (!rotacion) console.log('⚠ NO se detectó pestaña de ROTACIÓN (busqué: AÑO, MES, % ROTACION)');

// Copia del diagnóstico (sin datos personales) para consulta
for (const p of diag.pestanas) delete p._datos;
writeFileSync(path.join(ROOT, '.data', 'diagnostico.json'), JSON.stringify(diag, null, 2));
console.log('\nDiagnóstico guardado en .data/diagnostico.json (carpeta gitignoreada).');

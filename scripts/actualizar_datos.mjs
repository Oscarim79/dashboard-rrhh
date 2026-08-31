// Pipeline de datos del Dashboard RRHH.
// Descarga el Google Sheet (SHEET_ID desde variable de entorno o .env local),
// detecta las pestañas POR SUS ENCABEZADOS (nunca por nombre/posición),
// sanitiza (cero datos personales), agrega y escribe public/data/*.json.
// Antes de escribir corre una verificación anti-fugas; si algo personal
// aparece en la salida, ABORTA sin publicar.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import XLSX from 'xlsx';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const norm = (s) => String(s ?? '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toUpperCase().replace(/[,/]/g, ' ').replace(/\s+/g, ' ').trim();

// ── configuración ──────────────────────────────────────────────────────────
function sheetId() {
  if (process.env.SHEET_ID) return process.env.SHEET_ID.trim();
  const envPath = path.join(ROOT, '.env');
  if (existsSync(envPath)) {
    const m = readFileSync(envPath, 'utf8').match(/^SHEET_ID=(.+)$/m);
    if (m) return m[1].trim();
  }
  throw new Error('No hay SHEET_ID: defínelo como variable de entorno o en el archivo .env local.');
}

const TIENDAS_CFG = JSON.parse(readFileSync(path.join(ROOT, 'config', 'tiendas.json'), 'utf8'));

// ── descarga ───────────────────────────────────────────────────────────────
async function descargar(id) {
  const url = `https://docs.google.com/spreadsheets/d/${id}/export?format=xlsx`;
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`La descarga del sheet falló: HTTP ${res.status}. ¿Sigue compartido con enlace?`);
  const ct = res.headers.get('content-type') ?? '';
  if (ct.includes('text/html')) throw new Error('Google devolvió una página HTML en vez del Excel. Revisa que el sheet esté compartido con "cualquiera con el enlace".');
  return Buffer.from(await res.arrayBuffer());
}

// ── fechas (el sheet usa M/D/YYYY y seriales de Excel) ─────────────────────
function fechaISO(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number' && v > 20000 && v < 60000) {
    const d = XLSX.SSF.parse_date_code(v);
    return d ? `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}` : null;
  }
  const m = String(v).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
  return null;
}
const diasEntre = (isoA, isoB) => Math.round((new Date(isoB) - new Date(isoA)) / 86400000);

// ── detección de pestañas por encabezados ──────────────────────────────────
function filasDe(ws) {
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, blankrows: false });
}
function encabezadosDe(filas) {
  // primera de las 10 primeras filas con más celdas de texto
  let mejor = 0, score = -1;
  for (let i = 0; i < Math.min(10, filas.length); i++) {
    const s = (filas[i] ?? []).filter((c) => typeof c === 'string' && c.trim()).length;
    if (s > score) { score = s; mejor = i; }
  }
  return { idx: mejor, headers: (filas[mejor] ?? []).map((h) => norm(h)) };
}
function detectar(wb, requeridos) {
  for (const nombre of wb.SheetNames) {
    const filas = filasDe(wb.Sheets[nombre]);
    if (!filas.length) continue;
    const { idx, headers } = encabezadosDe(filas);
    const ok = requeridos.every((req) => headers.some((h) => req.every((t) => h.includes(norm(t)))));
    if (ok) return { nombre, filas: filas.slice(idx + 1).filter((f) => f.some((c) => c != null && String(c).trim() !== '')), headers };
  }
  return null;
}
const colIdx = (headers, ...tokens) => headers.findIndex((h) => tokens.every((t) => h.includes(norm(t))));

// ── resolución de tiendas ──────────────────────────────────────────────────
const porAlias = new Map();
for (const t of TIENDAS_CFG.tiendas) for (const a of t.alias) porAlias.set(a, { ...t, esTienda: true });
for (const nt of TIENDAS_CFG.noTiendas) for (const a of nt.alias) porAlias.set(a, { nombre: nt.nombre, categoria: nt.categoria, esTienda: false });
// nombres ambiguos: se resuelven con la empresa de la fila
const AMBIGUOS = {
  'CHIQUIMULA': { 'ABI Q': 'Abi Q Chiquimula', OTRA: 'Chiquimula Centro' },
  'CAYALA': { 'ABI Q': 'Abi Q Cayalá', OTRA: 'Cayalá' },
  'PRADERA CONCEPCION': { 'ABI Q': 'Abi Q Concepción (Pradera CSV)', OTRA: 'Pradera Concepción' },
};
const porNombre = new Map(TIENDAS_CFG.tiendas.map((t) => [t.nombre, t]));
function resolverLugar(lugarCrudo, empresaCruda) {
  const lug = norm(lugarCrudo);
  if (!lug) return { resuelto: null };
  const amb = AMBIGUOS[lug];
  if (amb) {
    const nombre = norm(empresaCruda) === 'ABI Q' ? amb['ABI Q'] : amb.OTRA;
    return { resuelto: { ...porNombre.get(nombre), esTienda: true } };
  }
  const hit = porAlias.get(lug);
  return hit ? { resuelto: hit } : { resuelto: null, desconocido: lugarCrudo };
}

// ── utilidades de agregación ───────────────────────────────────────────────
const siNo = (v) => {
  const n = norm(v);
  return n === 'SI' ? true : n === 'NO' ? false : null;
};
function stats(nums) {
  const a = [...nums].sort((x, y) => x - y);
  if (!a.length) return { n: 0, mediana: null, promedio: null };
  const mediana = a.length % 2 ? a[(a.length - 1) / 2] : (a[a.length / 2 - 1] + a[a.length / 2]) / 2;
  return { n: a.length, mediana, promedio: +(a.reduce((s, x) => s + x, 0) / a.length).toFixed(1), min: a[0], max: a.at(-1) };
}
const MESES = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];

// ── main ───────────────────────────────────────────────────────────────────
const hoy = new Date();
const hoyISO = hoy.toISOString().slice(0, 10);
console.log('Descargando sheet…');
const buf = await descargar(sheetId());
mkdirSync(path.join(ROOT, '.data'), { recursive: true });
writeFileSync(path.join(ROOT, '.data', 'sheet.xlsx'), buf); // copia local para depurar (gitignoreada)
const wb = XLSX.read(buf);

const calidad = [];

// 1) VACANTES
const REQ_VAC = [['ITEM'], ['FECHA', 'SOLICITUD'], ['FECHA', 'CIERRE'], ['DIAS', 'TRANSCURRIDOS'], ['MOTIVO', 'ORIGINA', 'VACANTE']];
const vac = detectar(wb, REQ_VAC);
if (!vac) throw new Error(
  'No encontré la pestaña de VACANTES. Busqué una pestaña cuyos encabezados contengan: ' +
  'ITEM, FECHA SOLICITUD, FECHA DE CIERRE, DÍAS TRANSCURRIDOS y MOTIVO QUE ORIGINA LA VACANTE.');
console.log(`Vacantes: pestaña "${vac.nombre}" (${vac.filas.length} filas)`);

const H = vac.headers;
const I = {
  item: colIdx(H, 'ITEM'),
  sol: colIdx(H, 'FECHA', 'SOLICITUD'),
  cie: colIdx(H, 'FECHA', 'CIERRE'),
  dias: colIdx(H, 'DIAS', 'TRANSCURRIDOS'),
  puesto: colIdx(H, 'PUESTO', 'SOLICITADO'),
  estatus: colIdx(H, 'ESTATUS'),
  lugar: colIdx(H, 'LUGAR', 'TRABAJO'),
  empresa: colIdx(H, 'NOMBRE', 'EMPRESA'),
  motivo: colIdx(H, 'MOTIVO', 'ORIGINA'),
  ocupa: colIdx(H, 'VACANTE', 'OCUPA'),
  canalRedes: colIdx(H, 'PUBLICADO', 'REDES'),
  canalFacebook: colIdx(H, 'GRUPOS', 'FACEBOOK'),
  canalVolanteo: colIdx(H, 'VOLANTEO'),
  canalReferidos: colIdx(H, 'PROGRAMA', 'REFERIDOS'),
  canalAnuncios: colIdx(H, 'PEGAR', 'ANUNCIOS'),
  canalPerifoneo: colIdx(H, 'PERIFONEO'),
};

const desconocidos = new Map();
let negativos = 0, discrepantes = 0, cerradasSinFechaCierre = 0, sinMotivo = 0;

const filasVac = vac.filas.map((f) => {
  const solicitud = fechaISO(f[I.sol]);
  const cierre = fechaISO(f[I.cie]);
  const estatus = norm(f[I.estatus]) || null; // CERRADA / ABIERTA / CANCELADA
  const diasReg = Number.isFinite(Number(f[I.dias])) && String(f[I.dias]).trim() !== '' ? Number(f[I.dias]) : null;

  let dias = null, diasFuente = null;
  if (solicitud && cierre) { dias = diasEntre(solicitud, cierre); diasFuente = 'fechas'; }
  else if (diasReg != null) { dias = diasReg; diasFuente = 'registrado'; }
  if (estatus === 'CERRADA' && !cierre) cerradasSinFechaCierre++;
  if (dias != null && dias < 0) negativos++;
  if (solicitud && cierre && diasReg != null && Math.abs(diasReg - diasEntre(solicitud, cierre)) > 1) discrepantes++;

  const empresa = String(f[I.empresa] ?? '').trim() || null;
  const { resuelto, desconocido } = resolverLugar(f[I.lugar], empresa);
  if (desconocido) desconocidos.set(norm(desconocido), (desconocidos.get(norm(desconocido)) ?? 0) + 1);

  const motivo = String(f[I.motivo] ?? '').trim() || null;
  if (!motivo) sinMotivo++;
  const motivoN = norm(motivo);
  const motivoGrupo = motivoN.includes('RENUNCIA') ? 'renuncia'
    : motivoN.includes('DESPIDO') ? 'despido'
    : motivo ? 'otros' : 'sin dato';

  // normalización ligera de puesto: mayúsculas/acentos/espacios y sin la palabra "DE"
  const puestoCrudo = String(f[I.puesto] ?? '').trim() || null;
  const puesto = puestoCrudo
    ? norm(puestoCrudo).replace(/\bDE\b/g, '').replace(/\s+/g, ' ').trim() : null;

  return {
    item: f[I.item] ?? null,
    solicitud, cierre, dias, diasFuente,
    diasAbierta: estatus === 'ABIERTA' && solicitud ? diasEntre(solicitud, hoyISO) : null,
    estatus,
    puesto,
    lugar: resuelto ? resuelto.nombre : (String(f[I.lugar] ?? '').trim() || null),
    tipo: resuelto?.esTienda ? (resuelto.tipo ?? null) : null,
    marca: resuelto?.esTienda ? resuelto.marca : null,
    esTienda: resuelto ? !!resuelto.esTienda : null,
    categoria: resuelto?.esTienda === false ? resuelto.categoria : null,
    lugarActivo: resuelto?.esTienda ? resuelto.activa : null,
    empresa,
    motivo, motivoGrupo,
    ocupadaPor: String(f[I.ocupa] ?? '').trim() || null,
    canales: {
      redes: siNo(f[I.canalRedes]),
      facebook: siNo(f[I.canalFacebook]),
      volanteo: siNo(f[I.canalVolanteo]),
      referidos: siNo(f[I.canalReferidos]),
      anuncios: siNo(f[I.canalAnuncios]),
      perifoneo: siNo(f[I.canalPerifoneo]),
    },
  };
});

// ── agregados de vacantes ──────────────────────────────────────────────────
const cerradas = filasVac.filter((r) => r.estatus === 'CERRADA');
const diasValidos = (arr) => arr.filter((r) => r.dias != null && r.dias >= 0).map((r) => r.dias);

const porGrupo = (arr, clave) => {
  const g = {};
  for (const r of arr) { const k = clave(r) ?? '(sin dato)'; (g[k] ??= []).push(r); }
  return g;
};
const statsPorGrupo = (arr, clave) =>
  Object.fromEntries(Object.entries(porGrupo(arr, clave)).map(([k, v]) => [k, stats(diasValidos(v))]));

const hace12m = new Date(hoy); hace12m.setFullYear(hoy.getFullYear() - 1);
const hace12mISO = hace12m.toISOString().slice(0, 10);
const ult12m = filasVac.filter((r) => r.solicitud && r.solicitud >= hace12mISO && r.estatus !== 'CANCELADA');

const contarPor = (arr, clave) => {
  const c = {};
  for (const r of arr) { const k = clave(r) ?? '(sin dato)'; c[k] = (c[k] ?? 0) + 1; }
  return c;
};

const mezclaTotal = contarPor(filasVac.filter((r) => r.estatus !== 'CANCELADA'), (r) => r.motivoGrupo);
const rd = (mezclaTotal.renuncia ?? 0) + (mezclaTotal.despido ?? 0);

const salidas12mPorTipo = {};
for (const r of ult12m) {
  if (r.motivoGrupo !== 'renuncia' && r.motivoGrupo !== 'despido') continue;
  const tipo = r.tipo ?? 'sin tipo';
  salidas12mPorTipo[tipo] ??= { renuncia: 0, despido: 0 };
  salidas12mPorTipo[tipo][r.motivoGrupo]++;
}

const porMes = (arr, campo) => {
  const c = {};
  for (const r of arr) if (r[campo]) { const k = r[campo].slice(0, 7); c[k] = (c[k] ?? 0) + 1; }
  return Object.fromEntries(Object.entries(c).sort());
};

// canales: uso y relación con días de cierre (solo filas donde el canal está registrado)
const canales = {};
for (const canal of ['redes', 'facebook', 'volanteo', 'referidos', 'anuncios', 'perifoneo']) {
  const conDato = cerradas.filter((r) => r.canales[canal] != null);
  canales[canal] = {
    registrado: filasVac.filter((r) => r.canales[canal] != null).length,
    si: filasVac.filter((r) => r.canales[canal] === true).length,
    diasConCanal: stats(diasValidos(conDato.filter((r) => r.canales[canal] === true))),
    diasSinCanal: stats(diasValidos(conDato.filter((r) => r.canales[canal] === false))),
  };
}

const vacantesJson = {
  generado: hoy.toISOString(),
  filas: filasVac,
  agregados: {
    totales: { filas: filasVac.length, cerradas: cerradas.length,
      abiertas: filasVac.filter((r) => r.estatus === 'ABIERTA').length,
      canceladas: filasVac.filter((r) => r.estatus === 'CANCELADA').length },
    diasCobertura: {
      global: stats(diasValidos(cerradas)),
      porTipo: statsPorGrupo(cerradas, (r) => r.tipo),
      porPuesto: statsPorGrupo(cerradas, (r) => r.puesto),
      porEmpresa: statsPorGrupo(cerradas, (r) => r.empresa),
      porLugar: statsPorGrupo(cerradas, (r) => r.lugar),
    },
    mezcla: {
      conteos: mezclaTotal,
      pctRenuncia: rd ? +( (mezclaTotal.renuncia ?? 0) / rd).toFixed(4) : null,
      pctDespido: rd ? +((mezclaTotal.despido ?? 0) / rd).toFixed(4) : null,
    },
    salidas12mPorTipo,
    salidasPorTienda: contarPor(filasVac.filter((r) => ['renuncia', 'despido'].includes(r.motivoGrupo)), (r) => r.lugar),
    salidasPorEmpresa: contarPor(filasVac.filter((r) => ['renuncia', 'despido'].includes(r.motivoGrupo)), (r) => r.empresa),
    aperturasPorMes: porMes(filasVac, 'solicitud'),
    cierresPorMes: porMes(filasVac, 'cierre'),
    ocupadaPor: contarPor(filasVac.filter((r) => r.ocupadaPor), (r) => r.ocupadaPor),
    canales,
  },
};

// ── 2) ROTACIÓN acumulada (INDICADOR: AÑO, MES, % ROTACION, inicio/fin) ────
const REQ_ROT = [['AÑO'], ['MES'], ['% ROTACION'], ['CANTIDAD', 'EMPLEADOS'], ['FIN', 'MES']];
const rot = detectar(wb, REQ_ROT);
if (!rot) throw new Error(
  'No encontré la pestaña de ROTACIÓN MENSUAL. Busqué una pestaña cuyos encabezados contengan: ' +
  'AÑO, MES, % ROTACION y las columnas de cantidad de empleados a inicio y fin de mes.');
console.log(`Rotación acumulada: pestaña "${rot.nombre}" (${rot.filas.length} filas)`);
const HR = rot.headers;
const IR = {
  anio: colIdx(HR, 'AÑO'), mes: colIdx(HR, 'MES'),
  inicio: colIdx(HR, 'CANTIDAD', 'EMPLEADOS', 'MES'), fin: colIdx(HR, 'FIN', 'MES'),
  bajas: colIdx(HR, 'TOTAL', 'BAJAS'), pct: colIdx(HR, '% ROTACION'), areas: colIdx(HR, 'AREAS'),
};
let filasRotRaras = 0;
const numOnull = (v) => (Number.isFinite(Number(v)) && String(v).trim() !== '' ? Number(v) : null);
const acumulado = rot.filas.map((f) => {
  const mes = norm(f[IR.mes]);
  if (!MESES.includes(mes)) { filasRotRaras++; return null; }
  return {
    anio: numOnull(f[IR.anio]), mes, mesNum: MESES.indexOf(mes) + 1,
    area: norm(f[IR.areas]) || null,
    inicio: numOnull(f[IR.inicio]), fin: numOnull(f[IR.fin]),
    bajasAcum: numOnull(f[IR.bajas]), pctAcum: numOnull(f[IR.pct]),
  };
}).filter(Boolean).filter((r) => r.anio);

// ── 3) ROTACIÓN mensual por departamento (pestaña DATA, opcional) ──────────
const REQ_DATA = [['AÑO'], ['MES'], ['CONTRATADAS'], ['DESVINCULADAS'], ['INICIO', 'PERIODO'], ['FINAL', 'PERIODO']];
const data = detectar(wb, REQ_DATA);
let mensual = [];
if (!data) {
  calidad.push({ tipo: 'aviso', mensaje: 'No se encontró la pestaña de rotación mensual por departamento (busqué: AÑO, MES, personas CONTRATADAS, DESVINCULADAS, colaboradores al INICIO y FINAL del periodo). La página de Rotación mostrará solo el acumulado.' });
} else {
  console.log(`Rotación mensual: pestaña "${data.nombre}" (${data.filas.length} filas)`);
  const HD = data.headers;
  const ID = {
    anio: colIdx(HD, 'AÑO'), mes: colIdx(HD, 'MES'), dep: colIdx(HD, 'DEPARTAMENTO'),
    altas: colIdx(HD, 'CONTRATADAS'), bajas: colIdx(HD, 'DESVINCULADAS'),
    inicio: colIdx(HD, 'INICIO', 'PERIODO'), fin: colIdx(HD, 'FINAL', 'PERIODO'),
  };
  // agregamos por (año, mes, departamento) y NUNCA publicamos la columna de supervisor (nombres de personas)
  const acc = new Map();
  for (const f of data.filas) {
    const mes = norm(f[ID.mes]);
    if (!MESES.includes(mes)) continue;
    const anio = numOnull(f[ID.anio]);
    if (!anio) continue;
    const dep = norm(f[ID.dep]) || '(SIN DEPARTAMENTO)';
    const k = `${anio}|${mes}|${dep}`;
    const a = acc.get(k) ?? { anio, mes, mesNum: MESES.indexOf(mes) + 1, departamento: dep, altas: 0, bajas: 0, inicio: 0, fin: 0 };
    a.altas += numOnull(f[ID.altas]) ?? 0;
    a.bajas += numOnull(f[ID.bajas]) ?? 0;
    a.inicio += numOnull(f[ID.inicio]) ?? 0;
    a.fin += numOnull(f[ID.fin]) ?? 0;
    acc.set(k, a);
  }
  mensual = [...acc.values()].map((r) => ({
    ...r,
    pctMes: r.inicio + r.fin > 0 ? +(r.bajas / ((r.inicio + r.fin) / 2)).toFixed(4) : null,
  })).sort((a, b) => a.anio - b.anio || a.mesNum - b.mesNum || a.departamento.localeCompare(b.departamento));
}

const rotacionJson = { generado: hoy.toISOString(), acumulado, mensual };

// ── calidad de datos ───────────────────────────────────────────────────────
if (cerradasSinFechaCierre) calidad.push({ tipo: 'aviso', n: cerradasSinFechaCierre, mensaje: `${cerradasSinFechaCierre} vacantes cerradas no tienen fecha de cierre; se usó su columna "días transcurridos" tal cual.` });
if (negativos) calidad.push({ tipo: 'error', n: negativos, mensaje: `${negativos} vacantes tienen días negativos (fecha de cierre anterior a la solicitud); se excluyen de las estadísticas de días.` });
if (discrepantes) calidad.push({ tipo: 'aviso', n: discrepantes, mensaje: `${discrepantes} vacantes tienen "días transcurridos" que no cuadra con sus fechas (diferencia mayor a 1 día); mandan las fechas.` });
if (sinMotivo) calidad.push({ tipo: 'aviso', n: sinMotivo, mensaje: `${sinMotivo} vacantes no registran motivo.` });
if (desconocidos.size) calidad.push({ tipo: 'aviso', n: desconocidos.size, mensaje: `Lugares de trabajo sin clasificar (no están en config/tiendas.json): ${[...desconocidos.entries()].map(([l, n]) => `${l} (×${n})`).join(', ')}. Sus vacantes se muestran sin tipo de tienda.` });
const sinTipo = filasVac.filter((r) => r.esTienda && r.tipo == null).length;
if (sinTipo) calidad.push({ tipo: 'aviso', n: sinTipo, mensaje: `${sinTipo} vacantes son de tiendas aún sin clasificar en AA/A/B/C; no entran al costo por tipo.` });
if (filasRotRaras) calidad.push({ tipo: 'aviso', n: filasRotRaras, mensaje: `${filasRotRaras} filas de la pestaña de rotación tienen un mes no estándar (p. ej. "ENE-JUL") y se omitieron.` });
const canalesFlacos = Object.entries(canales).filter(([, c]) => c.registrado < filasVac.length * 0.25).map(([k]) => k);
if (canalesFlacos.length) calidad.push({ tipo: 'aviso', mensaje: `Los canales de atracción se registran poco (${canalesFlacos.join(', ')} en menos del 25% de las filas); el análisis de canales es limitado.` });

const metaJson = {
  generado: hoy.toISOString(),
  filasVacantes: filasVac.length,
  filasRotacionAcumulada: acumulado.length,
  filasRotacionMensual: mensual.length,
  calidad,
};

// ── VERIFICACIÓN ANTI-FUGAS (última línea de defensa) ──────────────────────
// Términos prohibidos como palabras completas (así "Benito" no dispara "NIT").
const RE_PROHIBIDOS = [
  'NOMBRE DEL CANDIDATO', 'A QUIEN REEMPLAZA', 'NOMBRE JEFE DIRECTO', 'QUIEN SOLICITO',
  'ENTREVISTADOR', 'DPI', 'TELEFONO', 'CELULAR', 'SUELDO', 'SUPERVISOR', 'NIT',
  'CORREO', 'EMAIL', 'DIRECCION', 'CONYUGUE', 'CONTACTO DE EMERGENCIA',
].map((t) => ({ t, re: new RegExp(`\\b${t}\\b`) }));
// Valores legítimos que contienen un término prohibido pero no son datos personales:
const EXCEPCIONES = new Set(['DIRECCION GENERAL']); // nombre de departamento, no una dirección de casa
const RE_DPI = /\b\d{13}\b/;
const RE_TEL = /\b[2-7]\d{7}\b/; // teléfonos guatemaltecos de 8 dígitos

function textoProhibido(s) {
  const n = norm(s);
  if (EXCEPCIONES.has(n)) return null;
  for (const { t, re } of RE_PROHIBIDOS) if (re.test(n)) return t;
  return null;
}
function buscarFugas(valor, ruta, hallazgos) {
  if (valor == null) return;
  if (Array.isArray(valor)) { valor.forEach((v, i) => buscarFugas(v, `${ruta}[${i}]`, hallazgos)); return; }
  if (typeof valor === 'object') {
    for (const [k, v] of Object.entries(valor)) {
      const proh = textoProhibido(k);
      if (proh) hallazgos.push(`clave prohibida "${k}" (término ${proh}) en ${ruta}`);
      buscarFugas(v, `${ruta}.${k}`, hallazgos);
    }
    return;
  }
  if (typeof valor === 'string') {
    const proh = textoProhibido(valor);
    if (proh) hallazgos.push(`texto con "${proh}" en ${ruta}: "${valor.slice(0, 40)}"`);
    if (RE_DPI.test(valor)) hallazgos.push(`posible DPI (13 dígitos) en ${ruta}`);
    if (RE_TEL.test(valor)) hallazgos.push(`posible teléfono (8 dígitos) en ${ruta}`);
  }
}
const hallazgos = [];
buscarFugas(vacantesJson, 'vacantes', hallazgos);
buscarFugas(rotacionJson, 'rotacion', hallazgos);
buscarFugas(metaJson, 'meta', hallazgos);
if (hallazgos.length) {
  console.error('\n⛔ VERIFICACIÓN ANTI-FUGAS FALLÓ — NO se publicó nada. Hallazgos:');
  for (const h of hallazgos) console.error('  - ' + h);
  process.exit(1);
}

// ── escribir salidas ───────────────────────────────────────────────────────
const outDir = path.join(ROOT, 'public', 'data');
mkdirSync(outDir, { recursive: true });
writeFileSync(path.join(outDir, 'vacantes.json'), JSON.stringify(vacantesJson));
writeFileSync(path.join(outDir, 'rotacion.json'), JSON.stringify(rotacionJson));
writeFileSync(path.join(outDir, 'meta.json'), JSON.stringify(metaJson, null, 2));
console.log(`\n✅ Publicado en public/data/: vacantes.json (${filasVac.length} filas), rotacion.json (${acumulado.length}+${mensual.length}), meta.json (${calidad.length} avisos de calidad). Verificación anti-fugas: limpia.`);

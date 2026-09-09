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
// Marcas FUERA de todas las cifras principales por ahora (Oscar, 2026-09-09): Abi Q y Friotec son otros
// negocios y no hay respuestas sobre sus plantillas, costos y personal compartido. Sus filas siguen
// leyéndose y se publican aparte (salidas.json → porMarca, rotacion.json → calculado.series) para
// reactivarlas sin tocar el pipeline: basta con vaciar este conjunto.
const MARCAS_EXCLUIDAS = new Set(['Abi Q', 'Friotec']);

// ── descarga (con reintentos: Google a veces corta la conexión a medias) ───
async function descargar(id, intentos = 3) {
  const url = `https://docs.google.com/spreadsheets/d/${id}/export?format=xlsx`;
  let ultimoError;
  for (let i = 1; i <= intentos; i++) {
    try {
      const res = await fetch(url, { redirect: 'follow' });
      if (!res.ok) throw new Error(`La descarga del sheet falló: HTTP ${res.status}. ¿Sigue compartido con enlace?`);
      const ct = res.headers.get('content-type') ?? '';
      if (ct.includes('text/html')) throw new Error('Google devolvió una página HTML en vez del Excel. Revisa que el sheet esté compartido con "cualquiera con el enlace".');
      return Buffer.from(await res.arrayBuffer());
    } catch (e) {
      ultimoError = e;
      if (i < intentos) {
        console.log(`Descarga interrumpida (intento ${i} de ${intentos}), reintentando en ${i * 5}s…`);
        await new Promise((r) => setTimeout(r, i * 5000));
      }
    }
  }
  throw ultimoError;
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
  'CAYALA': { 'ABI Q': 'Abi Q Cayalá', OTRA: 'Abi Q Cayalá' }, // solo existe la Abi Q (Oscar, 2026-09-03)
  'PRADERA CONCEPCION': { 'ABI Q': 'Abi Q Pradera Concepción', OTRA: 'Abi Q Pradera Concepción' }, // idem
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
  obs: colIdx(H, 'OBSERVACIONES'),
  canalRedes: colIdx(H, 'PUBLICADO', 'REDES'),
  canalFacebook: colIdx(H, 'GRUPOS', 'FACEBOOK'),
  canalVolanteo: colIdx(H, 'VOLANTEO'),
  canalReferidos: colIdx(H, 'PROGRAMA', 'REFERIDOS'),
  canalAnuncios: colIdx(H, 'PEGAR', 'ANUNCIOS'),
  canalPerifoneo: colIdx(H, 'PERIFONEO'),
};

// La columna OBSERVACIONES es texto libre con nombres: JAMÁS se publica tal cual.
// Solo se deriva un estado del proceso con vocabulario fijo (para las vacantes abiertas).
function estadoProceso(obs) {
  const t = norm(obs);
  if (!t) return 'Sin notas de RRHH aún';
  if (/CONTRAT/.test(t)) return 'Contratado, por confirmar';
  if (/POLIGRAFO/.test(t)) return 'En polígrafo';
  if (/PROPUEST/.test(t)) return 'Propuesta hecha';
  // hubo gestiones pero los candidatos no cuajaron — es avance, aunque no positivo
  if (/NO CUMPLE|NO LLENA|NO CONTINUAR|DESCART|RECHAZ|NO SE PRESENT|PRETENSION|PRETENCION/.test(t)) return 'Candidatos vistos, sin elegido';
  if (/ENTREVIST|PERFIL|TERNA|CANDIDAT|PRUEBA/.test(t)) return 'En entrevistas';
  if (/PUBLICAD/.test(t)) return 'Publicada';
  // la nota describe la causa u otro contexto, no la etapa del reclutamiento
  return 'En gestión, sin etapa anotada';
}

// Departamento de la vacante. La pestaña NO trae esa columna, así que se deduce del
// puesto con la misma correspondencia puesto→área que muestra la pestaña SALIDAS
// (ahí es casi 1 a 1: los puestos de tienda son COMERCIAL; cobros, auditoría,
// contabilidad, logística y mercadeo no). Si algún día la pestaña trae una columna
// DEPARTAMENTO, se usa esa y la regla queda como respaldo.
const REGLAS_DEPTO = [
  [/VENDEDOR|ASESOR|JEFE AGENCIA|ASISTENTE ADMON|SERVICIOS VARIOS|VACACIONISTA/, 'COMERCIAL'],
  [/COBRO|CREDITO/, 'CREDITOS Y COBROS'],
  [/AUDITOR/, 'AUDITORIA'],
  [/CONTAB/, 'CONTABILIDAD'],
  [/PILOTO|BODEG|RUTA|REPARTO|VERIFICADOR|LOGIST|CHOFER/, 'LOGISTICA'],
  [/PROMOTOR|MERCADEO/, 'MERCADEO'],
  [/GARANT/, 'GARANTIAS'],
  [/RRHH|RECURSOS HUMANOS/, 'RRHH'],
  [/SISTEMA|SOPORTE|INFORMATICA/, 'SOPORTE IT'],
];
function departamentoDe(puestoN, esTienda) {
  for (const [re, d] of REGLAS_DEPTO) if (puestoN && re.test(puestoN)) return d;
  return esTienda ? 'COMERCIAL' : '(SIN DEPARTAMENTO)';
}
I.depto = colIdx(H, 'DEPARTAMENTO');

const desconocidos = new Map();
let negativos = 0, discrepantes = 0, cerradasSinFechaCierre = 0, cerradasSinDias = 0, sinMotivo = 0;

const filasVacTodas = vac.filas.map((f) => {
  const solicitud = fechaISO(f[I.sol]);
  const cierre = fechaISO(f[I.cie]);
  const estatus = norm(f[I.estatus]) || null; // CERRADA / ABIERTA / CANCELADA
  // ojo: la celda vacía (null) NO es 0 días — se excluye de las estadísticas
  const diasReg = f[I.dias] != null && String(f[I.dias]).trim() !== '' && Number.isFinite(Number(f[I.dias]))
    ? Number(f[I.dias]) : null;

  let dias = null, diasFuente = null;
  if (solicitud && cierre) { dias = diasEntre(solicitud, cierre); diasFuente = 'fechas'; }
  else if (diasReg != null) { dias = diasReg; diasFuente = 'registrado'; }
  if (estatus === 'CERRADA' && !cierre) cerradasSinFechaCierre++;
  if (estatus === 'CERRADA' && dias == null) cerradasSinDias++;
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

  const esTiendaFila = resuelto ? !!resuelto.esTienda : null;
  const deptoCol = I.depto >= 0 ? norm(f[I.depto]) : '';
  const departamento = deptoCol || departamentoDe(puesto, esTiendaFila);

  return {
    item: f[I.item] ?? null,
    solicitud, cierre, dias, diasFuente,
    departamento, departamentoFuente: deptoCol ? 'columna' : 'deducido del puesto',
    diasAbierta: estatus === 'ABIERTA' && solicitud ? diasEntre(solicitud, hoyISO) : null,
    proceso: estatus === 'ABIERTA' ? estadoProceso(f[I.obs]) : null,
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
// Se calculan con una función para poder publicarlos dos veces: toda la empresa
// (agregados) y solo el departamento Comercial (porDepartamento.comercial).
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

const contarPor = (arr, clave) => {
  const c = {};
  for (const r of arr) { const k = clave(r) ?? '(sin dato)'; c[k] = (c[k] ?? 0) + 1; }
  return c;
};

const porMes = (arr, campo) => {
  const c = {};
  for (const r of arr) if (r[campo]) { const k = r[campo].slice(0, 7); c[k] = (c[k] ?? 0) + 1; }
  return Object.fromEntries(Object.entries(c).sort());
};

function agregarVacantes(filas) {
  const cerradas = filas.filter((r) => r.estatus === 'CERRADA');
  const ult12m = filas.filter((r) => r.solicitud && r.solicitud >= hace12mISO && r.estatus !== 'CANCELADA');

  const mezclaTotal = contarPor(filas.filter((r) => r.estatus !== 'CANCELADA'), (r) => r.motivoGrupo);
  const rd = (mezclaTotal.renuncia ?? 0) + (mezclaTotal.despido ?? 0);

  const salidas12mPorTipo = {};
  for (const r of ult12m) {
    if (r.motivoGrupo !== 'renuncia' && r.motivoGrupo !== 'despido') continue;
    // oficinas/regiones no son tiendas: van aparte y no se costean con el modelo de tienda
    const tipo = r.esTienda === false ? 'no tienda' : (r.tipo ?? 'sin tipo');
    salidas12mPorTipo[tipo] ??= { renuncia: 0, despido: 0 };
    salidas12mPorTipo[tipo][r.motivoGrupo]++;
  }

  // canales: uso y relación con días de cierre (solo filas donde el canal está registrado)
  const canales = {};
  for (const canal of ['redes', 'facebook', 'volanteo', 'referidos', 'anuncios', 'perifoneo']) {
    const conDato = cerradas.filter((r) => r.canales[canal] != null);
    canales[canal] = {
      registrado: filas.filter((r) => r.canales[canal] != null).length,
      si: filas.filter((r) => r.canales[canal] === true).length,
      diasConCanal: stats(diasValidos(conDato.filter((r) => r.canales[canal] === true))),
      diasSinCanal: stats(diasValidos(conDato.filter((r) => r.canales[canal] === false))),
    };
  }

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
      pctRenuncia: rd ? +( (mezclaTotal.renuncia ?? 0) / rd).toFixed(4) : null,
      pctDespido: rd ? +((mezclaTotal.despido ?? 0) / rd).toFixed(4) : null,
    },
    salidas12mPorTipo,
    salidasPorTienda: contarPor(filas.filter((r) => ['renuncia', 'despido'].includes(r.motivoGrupo)), (r) => r.lugar),
    salidasPorEmpresa: contarPor(filas.filter((r) => ['renuncia', 'despido'].includes(r.motivoGrupo)), (r) => r.empresa),
    aperturasPorMes: porMes(filas, 'solicitud'),
    cierresPorMes: porMes(filas, 'cierre'),
    ocupadaPor: contarPor(filas.filter((r) => r.ocupadaPor), (r) => r.ocupadaPor),
    canales,
  };
}

const filasVac = filasVacTodas.filter((r) => !MARCAS_EXCLUIDAS.has(r.empresa));
if (filasVacTodas.length !== filasVac.length) console.log(`Vacantes: ${filasVacTodas.length - filasVac.length} filas de ${[...MARCAS_EXCLUIDAS].join(' y ')} quedan fuera (decisión de Oscar, 2026-09-09).`);
const agregadosVac = agregarVacantes(filasVac);
const canales = agregadosVac.canales;
const filasComercial = filasVac.filter((r) => r.departamento === 'COMERCIAL');
console.log(`Vacantes por departamento (deducido del puesto): ${Object.entries(contarPor(filasVac, (r) => r.departamento)).map(([k, n]) => `${k} ${n}`).join(' · ')}`);

const vacantesJson = {
  generado: hoy.toISOString(),
  filas: filasVac,
  agregados: agregadosVac,
  // Selector General / Comercial del sitio. El departamento de cada vacante se
  // deduce del puesto (la pestaña no trae la columna), ver departamentoFuente.
  porDepartamento: { comercial: agregarVacantes(filasComercial) },
  departamentos: contarPor(filasVac, (r) => r.departamento),
  departamentoFuente: I.depto >= 0 ? 'columna DEPARTAMENTO del sheet' : 'deducido del puesto (la pestaña no trae departamento)',
  marcasExcluidas: [...MARCAS_EXCLUIDAS],
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
const numOnull = (v) => (v != null && String(v).trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : null);
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
  // Un mes con altas y plantilla pero sin ninguna baja en toda la empresa casi siempre es un mes
  // que todavía no se terminó de llenar en el sheet: se avisa para no leer ese 0 como dato.
  const porMesTot = new Map();
  for (const r of mensual) { const k = `${r.anio}-${String(r.mesNum).padStart(2, '0')}`; const t = porMesTot.get(k) ?? { bajas: 0, altas: 0, fin: 0 }; t.bajas += r.bajas; t.altas += r.altas; t.fin += r.fin; porMesTot.set(k, t); }
  const mesesSinBajas = [...porMesTot.entries()].filter(([, t]) => t.bajas === 0 && (t.altas > 0 || t.fin > 0)).map(([k]) => k);
  // Oscar (2026-09-08): ese mes todavía no tiene data cargada; se deja fuera para que el sitio
  // no muestre "0 bajas" como si fuera dato. Cuando lo llenen, entra solo.
  if (mesesSinBajas.length) {
    mensual = mensual.filter((r) => !mesesSinBajas.includes(`${r.anio}-${String(r.mesNum).padStart(2, '0')}`));
    calidad.push({ tipo: 'aviso', n: mesesSinBajas.length, mensaje: `El indicador de rotación mensual tiene ${mesesSinBajas.length === 1 ? 'un mes' : 'meses'} con altas y plantilla pero sin ninguna baja registrada (${mesesSinBajas.join(', ')}): aún no está lleno, así que no se publica hasta que tenga bajas.` });
  }
}

const rotacionJson = { generado: hoy.toISOString(), acumulado, mensual };

// ── 4) SALIDAS: SOLO AGREGADOS (la pestaña tiene datos personales que jamás se publican) ──
// Se leen únicamente columnas no personales y se emiten conteos; ninguna fila individual.
const REQ_SAL = [['DIAS LAB'], ['RANGO MES'], ['GENERO'], ['AGENCIA'], ['BAJA']];
let regsSalidas = []; // filas agregables de SALIDAS (sin nombres), para la rotación calculada de la sección 6
const sal = detectar(wb, REQ_SAL);
let salidasJson = null;
if (!sal) {
  // 2026-09-08: pasó de verdad (el encabezado DIAS LAB se perdió al editar una fórmula). Publicar
  // "sin datos" dejaría el Resumen y Salidas vacíos, así que se aborta y el sitio conserva la
  // última versión buena. Cuando el encabezado vuelva, la siguiente corrida publica normal.
  console.error('✖ No se encontró la pestaña de SALIDAS (busqué encabezados: DIAS LAB, RANGO MES, GENERO, AGENCIA, fecha de BAJA). ' +
    'Revisa que esos encabezados sigan en la primera fila de la pestaña. NO se publica nada para no dejar el sitio sin salidas.');
  process.exit(1);
} else {
  console.log(`Salidas: pestaña "${sal.nombre}" (${sal.filas.length} filas, solo agregados)`);
  const HS = sal.headers;
  const IS = {
    baja: colIdx(HS, 'BAJA'), razon: colIdx(HS, 'OBSERVACIONES'), sub: colIdx(HS, 'SUB', 'MOTIVO'),
    genero: colIdx(HS, 'GENERO'), area: colIdx(HS, 'AREA', 'LAB'), marca: colIdx(HS, 'MARCA'),
    agencia: colIdx(HS, 'AGENCIA'), rango: colIdx(HS, 'RANGO', 'MES'), diasLab: colIdx(HS, 'DIAS', 'LAB'),
    // texto libre con la razón detallada: SOLO se registra si está escrito o no (nunca el texto)
    razonLibre: colIdx(HS, 'RAZON', 'SALIDA'),
    // Supervisor o jefe: se publica el desglose de salidas por supervisor CON NOMBRE por decisión
    // de Oscar (2026-09-09, pedido del CEO), tomada sabiendo que el sitio es público. Solo conteos
    // por supervisor; de los colaboradores que salieron sigue sin publicarse nada individual.
    supervisor: colIdx(HS, 'SUPERVISOR'),
  };
  // Un mismo supervisor puede venir con distinta grafía: se agrupa por nombre normalizado y se
  // muestra con la primera grafía vista, en mayúscula inicial por palabra.
  const supervisorVisto = new Map();
  const nombreSupervisor = (v) => {
    const limpio = String(v ?? '').replace(/\s+/g, ' ').trim();
    if (!limpio) return '(sin supervisor registrado)';
    const clave = norm(limpio);
    if (!supervisorVisto.has(clave)) supervisorVisto.set(clave, limpio.toLowerCase().replace(/(^|[\s-])(\S)/g, (m, sep, c) => sep + c.toUpperCase()));
    return supervisorVisto.get(clave);
  };
  // La misma área aparece con varias grafías en el sheet; se unifican para no contarlas aparte.
  const AREA_ALIAS = { 'COBROS Y CREDITOS': 'CREDITOS Y COBROS', 'COBROS': 'CREDITOS Y COBROS' };
  const MARCA_EMPRESA = { ABIQ: 'Abi Q', AMERICANA: 'Americana', FRIOTEC: 'Friotec' };
  // Sub-motivos que significan lo mismo se unifican ANTES de contar (Oscar, 2026-09-09): si no,
  // la regla n≥3 → OTROS los partía (p. ej. "mal trato" con 1 caso se perdía en OTROS en vez de
  // sumar a clima laboral). Lo que se unificó se publica en `agrupacionesSubMotivo` para decirlo en el sitio.
  const SUB_ALIAS = {
    'POR SALARIO': 'SALARIO',
    'MAL AMBIENTE': 'CLIMA LABORAL', 'MAL TRATO': 'CLIMA LABORAL',
    'HORARIOS EXTENDIDOS': 'HORARIOS',
    'DESCUENTOS EN SALARIO': 'DESCUENTOS',
  };
  const agrupacionesSubMotivo = {};
  let diasLabMalos = 0, sinRazon = 0, masDeUnAnoSinDias = 0;
  const bajasFuturas = {}; // mes → cuántas bajas tienen fecha posterior a hoy (error de captura)
  const hoyISO = hoy.toISOString().slice(0, 10);
  // El sheet trae un solo rango "MAS DE UN ANO" que junta de 1 a 15+ años y en la
  // gráfica parecía la mayoría (barra desproporcionada frente a tramos de 1-2 meses).
  // Se parte con los días laborados en 1-2 / 2-5 / más de 5 años; si no hay días
  // válidos (o son < 365, inconsistentes con el rango) queda en el rango original.
  const partirMasDeUnAno = (rango, dias) => {
    if (rango !== 'MAS DE UN ANO') return rango;
    if (dias == null || dias < 365) { masDeUnAnoSinDias++; return rango; }
    return dias < 730 ? 'DE 1 A 2 ANOS' : dias < 1825 ? 'DE 2 A 5 ANOS' : 'MAS DE 5 ANOS';
  };
  const regs = [];
  for (const f of sal.filas) {
    const baja = fechaISO(f[IS.baja]);
    if (!baja) continue;
    if (baja > hoyISO) bajasFuturas[baja.slice(0, 7)] = (bajasFuturas[baja.slice(0, 7)] ?? 0) + 1;
    const marcaCruda = norm(f[IS.marca]);
    const { resuelto } = resolverLugar(f[IS.agencia], MARCA_EMPRESA[marcaCruda] ?? '');
    const razon = norm(f[IS.razon]) || null;
    if (!razon) sinRazon++;
    const subCrudo = norm(f[IS.sub]);
    if (SUB_ALIAS[subCrudo]) {
      agrupacionesSubMotivo[SUB_ALIAS[subCrudo]] ??= {};
      agrupacionesSubMotivo[SUB_ALIAS[subCrudo]][subCrudo] = (agrupacionesSubMotivo[SUB_ALIAS[subCrudo]][subCrudo] ?? 0) + 1;
    }
    let diasLab = numOnull(f[IS.diasLab]);
    if (diasLab != null && (diasLab < 0 || diasLab > 20000)) { diasLabMalos++; diasLab = null; }
    regs.push({
      ym: baja.slice(0, 7), anio: baja.slice(0, 4),
      razon: razon ?? '(SIN RAZON)',
      sub: SUB_ALIAS[subCrudo] ?? (subCrudo || '(SIN SUBMOTIVO)'),
      genero: norm(f[IS.genero]) || '(SIN DATO)',
      area: AREA_ALIAS[norm(f[IS.area])] ?? (norm(f[IS.area]) || '(SIN AREA)'),
      marca: MARCA_EMPRESA[marcaCruda] ?? (String(f[IS.marca] ?? '').trim() || '(SIN MARCA)'),
      agencia: resuelto?.esTienda ? resuelto.nombre : (String(f[IS.agencia] ?? '').trim() || '(SIN AGENCIA)'),
      tipoTienda: resuelto?.esTienda ? (resuelto.tipo ?? null) : null,
      esTienda: resuelto ? !!resuelto.esTienda : null, // null = nombre no reconocido en config/tiendas.json
      rango: partirMasDeUnAno(norm(f[IS.rango]) || '(SIN RANGO)', diasLab),
      diasLab,
      tieneRazonLibre: IS.razonLibre >= 0 && !!norm(f[IS.razonLibre]),
      supervisor: IS.supervisor >= 0 ? nombreSupervisor(f[IS.supervisor]) : '(sin supervisor registrado)',
    });
  }
  regsSalidas = regs; // todas las marcas (para porMarca y la rotación calculada por marca)
  const regsPrincipal = regs.filter((r) => !MARCAS_EXCLUIDAS.has(r.marca)); // cifras principales del sitio
  const corte12m = hace12mISO.slice(0, 7);
  const cuenta = (arr, clave, minimo = 1) => {
    const c = {};
    for (const r of arr) c[clave(r)] = (c[clave(r)] ?? 0) + 1;
    if (minimo > 1) { // agrupa valores raros (posible texto libre) en OTROS
      let otros = 0;
      for (const [k, n] of Object.entries(c)) if (n < minimo && !k.startsWith('(')) { otros += n; delete c[k]; }
      if (otros) c['OTROS'] = (c['OTROS'] ?? 0) + otros;
    }
    return Object.fromEntries(Object.entries(c).sort((a, b) => b[1] - a[1]));
  };
  const ult12 = regs.filter((r) => r.ym >= corte12m);
  // Salidas por tipo de tienda y razón: es lo que el Resumen multiplica por el costo por
  // salida (decisión de Oscar 2026-09-07: contar con el registro de SALIDAS, no con el de
  // vacantes, que solo tiene las plazas abiertas). 'no tienda' = oficinas/regiones/CEDI;
  // 'sin tipo' = tienda sin clasificar o nombre no reconocido.
  const porTipoTienda = (arr) => {
    const c = {};
    for (const r of arr) {
      const tipo = r.esTienda === false ? 'no tienda' : (r.tipoTienda ?? 'sin tipo');
      const raz = r.razon === 'RENUNCIA' ? 'renuncia' : r.razon === 'DESPIDO' ? 'despido' : 'otros';
      c[tipo] ??= { renuncia: 0, despido: 0, otros: 0 };
      c[tipo][raz]++;
    }
    return c;
  };
  // Pedido del CEO (2026-09-08): POR QUÉ se van los que salen antes de los 6 meses. Cruce
  // razón/sub-motivo × antigüedad temprana, solo conteos. Decisión de Oscar (2026-09-09): en este
  // cruce se publican TODOS los motivos (sin agrupar en OTROS) porque el CEO quiere ver el detalle;
  // siguen siendo conteos sin nombres ni supervisores.
  const RANGOS_TEMPRANOS = new Set(['MENOS 1 MES', 'DE 1 A 2 MESES', 'DE 2 A 4 MESES', 'DE 4 A 6 MESES']);
  const tempranas = (arr) => {
    const t = arr.filter((r) => RANGOS_TEMPRANOS.has(r.rango));
    return {
      n: t.length,
      razon: cuenta(t, (r) => r.razon),
      subMotivo: cuenta(t, (r) => r.sub),
      subMotivoRenuncias: cuenta(t.filter((r) => r.razon === 'RENUNCIA'), (r) => r.sub),
      rango: cuenta(t, (r) => r.rango),
    };
  };
  // Desglose por supervisor (decisión de Oscar 2026-09-09): por cada supervisor, cuántas salidas,
  // cuántas renuncias/despidos y cuántas antes de los 6 meses. Solo conteos.
  // `motivos`: los 5 sub-motivos más frecuentes del equipo (Oscar, 2026-09-09: el sitio muestra el top 3).
  const porSupervisor = (arr) => {
    const c = {};
    for (const r of arr) {
      const s = (c[r.supervisor] ??= { n: 0, renuncia: 0, despido: 0, otros: 0, tempranas: 0, motivos: {} });
      s.n++;
      s[r.razon === 'RENUNCIA' ? 'renuncia' : r.razon === 'DESPIDO' ? 'despido' : 'otros']++;
      if (RANGOS_TEMPRANOS.has(r.rango)) s.tempranas++;
      if (!r.sub.startsWith('(')) s.motivos[r.sub] = (s.motivos[r.sub] ?? 0) + 1;
    }
    for (const s of Object.values(c)) s.motivos = Object.fromEntries(Object.entries(s.motivos).sort((a, b) => b[1] - a[1]).slice(0, 5));
    return Object.fromEntries(Object.entries(c).sort((a, b) => b[1].n - a[1].n));
  };
  // Por agencia/tienda (Oscar, 2026-09-09: el CEO quiere ver POR QUÉ se va la gente de cada
  // tienda y región): salidas, renuncias, despidos, antes de 6 meses y todos los motivos. Solo conteos.
  const porAgencia = (arr) => {
    const c = {};
    for (const r of arr) {
      const s = (c[r.agencia] ??= { n: 0, renuncia: 0, despido: 0, otros: 0, tempranas: 0, motivos: {} });
      s.n++;
      s[r.razon === 'RENUNCIA' ? 'renuncia' : r.razon === 'DESPIDO' ? 'despido' : 'otros']++;
      if (RANGOS_TEMPRANOS.has(r.rango)) s.tempranas++;
      if (!r.sub.startsWith('(')) s.motivos[r.sub] = (s.motivos[r.sub] ?? 0) + 1;
    }
    for (const s of Object.values(c)) s.motivos = Object.fromEntries(Object.entries(s.motivos).sort((a, b) => b[1] - a[1]));
    return Object.fromEntries(Object.entries(c).sort((a, b) => b[1].n - a[1].n));
  };
  const dims = (arr) => ({
    razon: cuenta(arr, (r) => r.razon, 3),
    porTipoTienda: porTipoTienda(arr),
    sinTipoOrigen: cuenta(arr.filter((r) => r.esTienda !== false && !r.tipoTienda && ['RENUNCIA', 'DESPIDO'].includes(r.razon)), (r) => `${r.agencia}${r.esTienda === null ? ' — nombre no reconocido en el archivo de tiendas' : ' (sin tipo)'}`),
    // Motivos: TODOS por separado (Oscar, 2026-09-09; antes se agrupaban los de menos de 3 casos en
    // OTROS). Siguen siendo conteos sin nombres; los sinónimos ya vienen unificados por SUB_ALIAS.
    subMotivo: cuenta(arr, (r) => r.sub),
    // solo renuncias: para hablar de "por qué se va la gente" sin mezclar despidos
    subMotivoRenuncias: cuenta(arr.filter((r) => r.razon === 'RENUNCIA'), (r) => r.sub),
    genero: cuenta(arr, (r) => r.genero),
    area: cuenta(arr, (r) => r.area),
    marca: cuenta(arr, (r) => r.marca),
    agencia: cuenta(arr, (r) => `${r.agencia}${r.tipoTienda ? `·${r.tipoTienda}` : ''}`),
    rango: cuenta(arr, (r) => r.rango),
    diasLab: stats(arr.map((r) => r.diasLab).filter((d) => d != null)),
    tempranas: tempranas(arr),
    porSupervisor: porSupervisor(arr),
    porAgencia: porAgencia(arr),
    n: arr.length,
  });
  // los cortes acumulados (comparativa) no necesitan el detalle por agencia: se quita para no engordar el JSON
  const sinAgencia = (d) => { const { porAgencia: _omitido, ...resto } = d; return resto; };
  // porAnio lleva el desglose completo de cada año (misma forma que "total"),
  // para que la página pueda filtrar por año; la regla de privacidad (agrupar
  // valores con menos de 3 casos en OTROS) se aplica dentro de cada año.
  // Qué tan capturada está la razón de salida (solo conteos; sirve para decir con
  // honestidad qué porcentaje del registro sí explica por qué se fue la persona).
  const SUB_SIN_CONTENIDO = new Set(['VOLUNTARIA', 'NO CONFIRMADO', '(SIN SUBMOTIVO)']);
  const captura = (arr) => {
    const ren = arr.filter((r) => r.razon === 'RENUNCIA'), des = arr.filter((r) => r.razon === 'DESPIDO');
    const conSub = (a) => a.filter((r) => !SUB_SIN_CONTENIDO.has(r.sub)).length;
    return {
      n: arr.length,
      conTipo: arr.filter((r) => r.razon !== '(SIN RAZON)').length,
      conSubMotivoReal: conSub(arr),
      conRazonLibre: arr.filter((r) => r.tieneRazonLibre).length,
      renuncias: { n: ren.length, conSubMotivoReal: conSub(ren), soloVoluntaria: ren.filter((r) => r.sub === 'VOLUNTARIA').length, conRazonLibre: ren.filter((r) => r.tieneRazonLibre).length },
      despidos: { n: des.length, conSubMotivoReal: conSub(des) },
    };
  };
  const bloqueSalidas = (arr) => {
    const u12 = arr.filter((r) => r.ym >= corte12m);
    const anios = [...new Set(arr.map((r) => r.anio))].sort();
    return {
      total: dims(arr),
      ult12m: dims(u12),
      porMes: cuenta(arr, (r) => r.ym),
      porAnio: Object.fromEntries(anios.map((a) => [a, dims(arr.filter((r) => r.anio === a))])),
      // desglose completo de cada mes (selector de período del sitio); la regla de
      // privacidad n≥3 → OTROS se aplica dentro de cada mes
      porMesDetalle: Object.fromEntries([...new Set(arr.map((r) => r.ym))].sort().map((ym) => [ym, dims(arr.filter((r) => r.ym === ym))])),
      captura: { total: captura(arr), ult12m: captura(u12) },
      // Comparativa entre años del mismo período (pedido del CEO, 2026-09-08): para cada año,
      // el desglose acumulado de enero al mes MM (todos los meses hasta el último con dato,
      // sin contar meses posteriores a la fecha de lectura). Se calcula aquí y no sumando
      // meses en el navegador porque la regla n≥3 → OTROS debe aplicarse sobre el rango
      // completo: sumando meses ya agrupados se perderían motivos que sí llegan a 3 en el rango.
      acumuladoAnio: Object.fromEntries(anios.map((a) => {
        const ultimoMes = Math.max(...arr.filter((r) => r.anio === a && r.ym <= hoyYm).map((r) => +r.ym.slice(5, 7)), 0);
        const meses = Array.from({ length: ultimoMes }, (_, i) => String(i + 1).padStart(2, '0'));
        return [a, Object.fromEntries(meses.map((mm) => [mm, sinAgencia(dims(arr.filter((r) => r.anio === a && r.ym <= `${a}-${mm}`)))]))];
      })),
    };
  };
  const hoyYm = hoyISO.slice(0, 7);
  const regsComercial = regsPrincipal.filter((r) => r.area === 'COMERCIAL');
  // Filtro por marca en todo el sitio (Oscar, 2026-09-09): Abi Q y Friotec son otros negocios y no
  // deben mezclarse con Americana. Un bloque completo por marca (columna MARCA de la pestaña).
  const CLAVE_MARCA = { Americana: 'americana', 'Abi Q': 'abiq', Friotec: 'friotec' };
  const porMarca = Object.fromEntries(Object.entries(CLAVE_MARCA).map(([eti, clave]) => [clave, bloqueSalidas(regs.filter((r) => r.marca === eti))]));
  salidasJson = {
    generado: hoy.toISOString(),
    // qué etiquetas del registro se unificaron bajo cada motivo (solo etiquetas y conteos)
    agrupacionesSubMotivo,
    marcasExcluidas: [...MARCAS_EXCLUIDAS],
    ...bloqueSalidas(regsPrincipal),
    // Selector General / Comercial del sitio: mismo desglose, solo el área COMERCIAL
    // (columna AREA LAB de la pestaña).
    porDepartamento: { comercial: bloqueSalidas(regsComercial) },
    porMarca,
  };
  console.log(`Salidas: ${regs.length} leídas, ${regsPrincipal.length} en las cifras principales (${regs.length - regsPrincipal.length} de ${[...MARCAS_EXCLUIDAS].join(' y ')} fuera), ${regsComercial.length} del área Comercial; razón capturada ${captura(regs).conTipo}/${regs.length}`);
  if (diasLabMalos) calidad.push({ tipo: 'aviso', n: diasLabMalos, mensaje: `${diasLabMalos} ${diasLabMalos === 1 ? 'salida tiene' : 'salidas tienen'} días laborados imposibles (negativos o enormes); se ${diasLabMalos === 1 ? 'excluye' : 'excluyen'} de la antigüedad.` });
  if (sinRazon) calidad.push({ tipo: 'aviso', n: sinRazon, mensaje: `${sinRazon} salidas no registran razón (renuncia/despido); aparecen como "sin razón".` });
  const nFut = Object.values(bajasFuturas).reduce((a, b) => a + b, 0);
  if (nFut) calidad.push({ tipo: 'aviso', n: nFut, mensaje: `${nFut} ${nFut === 1 ? 'salida tiene' : 'salidas tienen'} fecha de baja posterior a hoy (${Object.entries(bajasFuturas).map(([m, n]) => `${m}: ${n}`).join(', ')}); se cuenta igual, pero conviene corregir la fecha en el sheet.` });
  if (masDeUnAnoSinDias) calidad.push({ tipo: 'aviso', n: masDeUnAnoSinDias, mensaje: `${masDeUnAnoSinDias} salidas con rango "más de un año" no tienen días laborados válidos (o son menos de 365); se muestran como "Más de un año (sin detalle de años)".` });
}

// ── 5) CONTROL DE INTEGRACIÓN: SOLO conteos (acuerdo Oscar 2026-09-07) ─────
// La pestaña lleva las llamadas de seguimiento a cada nuevo (1ª, 20, 40 y 60 días).
// Tiene nombres y respuestas en texto libre: de eso NO se lee nada. Solo se cuenta,
// por año de ingreso y departamento, cuántos nuevos tienen cada llamada marcada.
const REQ_INT = [['FECHA', 'INTEGRACION'], ['LLAMADA', '20 DIAS'], ['LLAMADA', '40 DIAS'], ['LLAMADA', '60 DIAS']];
const integ = detectar(wb, REQ_INT);
let integracionJson = null;
if (!integ) {
  calidad.push({ tipo: 'aviso', mensaje: 'No se encontró la pestaña de CONTROL DE INTEGRACIÓN (busqué: FECHA DE INTEGRACION y las columnas LLAMADA 20/40/60 DIAS). La propuesta no mostrará el seguimiento a nuevos.' });
} else {
  console.log(`Integración: pestaña "${integ.nombre}" (${integ.filas.length} filas, solo conteos)`);
  const HI = integ.headers;
  // la columna de la llamada, no la de su fecha (ambas contienen "LLAMADA")
  const colLlamada = (...tokens) => HI.findIndex((h) => !h.includes('FECHA') && tokens.every((t) => h.includes(norm(t))));
  const II = {
    dep: colIdx(HI, 'DEPARTAMENTO'), fecha: colIdx(HI, 'FECHA', 'INTEGRACION'),
    l1: colLlamada('1A LLAMADA'), l20: colLlamada('LLAMADA', '20 DIAS'), l40: colLlamada('LLAMADA', '40 DIAS'), l60: colLlamada('LLAMADA', '60 DIAS'),
  };
  const marca = (v) => { const n = norm(v); return n === 'YES' || n === 'SI' ? true : n === 'NO' ? false : null; };
  const regsInt = integ.filas.map((f) => ({
    fecha: fechaISO(f[II.fecha]),
    depto: norm(f[II.dep]) || '(SIN DEPARTAMENTO)',
    l1: II.l1 >= 0 ? marca(f[II.l1]) : null, l20: marca(f[II.l20]), l40: marca(f[II.l40]), l60: marca(f[II.l60]),
  }));
  const LLAMADAS = ['l1', 'l20', 'l40', 'l60'];
  const resumenInt = (arr) => ({
    n: arr.length,
    ...Object.fromEntries(LLAMADAS.map((k) => [k, {
      si: arr.filter((r) => r[k] === true).length,
      no: arr.filter((r) => r[k] === false).length,
      sinMarcar: arr.filter((r) => r[k] == null).length,
    }])),
  });
  const bloqueInt = (arr) => {
    const conFecha = arr.filter((r) => r.fecha).sort((a, b) => a.fecha.localeCompare(b.fecha));
    const anios = [...new Set(conFecha.map((r) => r.fecha.slice(0, 4)))].sort();
    const desde = conFecha[0]?.fecha ?? null, hasta = conFecha.at(-1)?.fecha ?? null;
    return {
      total: resumenInt(arr),
      desde, hasta,
      porAnio: Object.fromEntries(anios.map((a) => [a, resumenInt(conFecha.filter((r) => r.fecha.startsWith(a)))])),
      ult12m: resumenInt(conFecha.filter((r) => r.fecha >= hace12mISO)),
    };
  };
  integracionJson = {
    generado: hoy.toISOString(),
    ...bloqueInt(regsInt),
    porDepartamento: { comercial: bloqueInt(regsInt.filter((r) => r.depto === 'COMERCIAL')) },
    departamentos: contarPor(regsInt, (r) => r.depto),
  };
  const sinFechaInt = regsInt.filter((r) => !r.fecha).length;
  if (sinFechaInt) calidad.push({ tipo: 'aviso', n: sinFechaInt, mensaje: `${sinFechaInt} filas del control de integración no tienen fecha de ingreso; cuentan en el total pero no por año.` });
}

// ── calidad de datos ───────────────────────────────────────────────────────
if (cerradasSinFechaCierre) calidad.push({ tipo: 'aviso', n: cerradasSinFechaCierre, mensaje: `${cerradasSinFechaCierre} vacantes cerradas no tienen fecha de cierre; donde existe, se usó su columna "días transcurridos" tal cual.` });
if (cerradasSinDias) calidad.push({ tipo: 'aviso', n: cerradasSinDias, mensaje: `${cerradasSinDias} vacantes cerradas no tienen ni fechas ni días transcurridos: quedan FUERA de las estadísticas de días de cobertura.` });
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
  filasIntegracion: integracionJson ? integracionJson.total.n : 0,
  calidad,
};

// ── 6) ROTACIÓN CALCULADA por marca (autorizado por Oscar, 2026-09-09) ──────────────
// Reproduce el indicador de rotación sin que el jefe de RRHH lo copie a mano:
//   bajas por mes  ← pestaña SALIDAS (ya leída arriba: columnas MARCA y AREA LAB)
//   altas por mes  ← pestaña ALTAS: SOLO se cuentan filas por fecha de alta, marca y área
//   plantilla hoy  ← BASE DE DATOS GENERAL: SOLO se cuentan filas activas (con fecha de alta y sin
//                    fecha de salida) por marca y departamento
// La plantilla de cada mes se reconstruye hacia atrás desde la de hoy:
//   inicio(m) = fin(m) − altas(m) + bajas(m); fin(m−1) = inicio(m).
// % acumulado = bajas acumuladas del año ÷ promedio(inicio, fin): la misma fórmula del indicador manual.
// De estas pestañas JAMÁS se lee nombre, DPI, teléfono, sueldo ni ningún otro dato individual;
// la marca "A2K, ABIQ" (personal corporativo compartido) se cuenta en Americana y se informa aparte.
{
  const ESCOPOS = ['total', 'comercial', 'americana', 'abiq', 'friotec'];
  // ADMINISTRACION = los administrativos del corporativo (antes 'A2K, ABIQ'; Oscar, 2026-09-09): cuentan en Americana
  const MARCA_CLAVE = { AMERICANA: 'americana', A2K: 'americana', 'A2K, ABIQ': 'americana', 'A2K ABIQ': 'americana', 'A2K,ABIQ': 'americana', ADMINISTRACION: 'americana', ADMINISTRATIVOS: 'americana', ADMINISTRATIVO: 'americana', ABIQ: 'abiq', 'ABI Q': 'abiq', FRIOTEC: 'friotec' };
  const esAdministracion = (m) => m.startsWith('ADMINISTRA') || (m.includes('A2K') && m.includes('ABIQ'));
  const MARCA_ETI_CLAVE = { Americana: 'americana', 'Abi Q': 'abiq', Friotec: 'friotec' };
  const AREA_NORM = (a) => { const n = norm(a); return n === 'COBROS Y CREDITOS' || n === 'COBROS' ? 'CREDITOS Y COBROS' : n; };
  const CLAVES_EXCLUIDAS = new Set([...MARCAS_EXCLUIDAS].map((m) => ({ 'Abi Q': 'abiq', Friotec: 'friotec', Americana: 'americana' })[m]));
  const escoposDe = (marcaNorm, areaNorm) => {
    const m = MARCA_CLAVE[marcaNorm];
    const fuera = m && CLAVES_EXCLUIDAS.has(m); // total y comercial se calculan sin las marcas excluidas
    const s = fuera ? [] : ['total'];
    if (!fuera && areaNorm === 'COMERCIAL') s.push('comercial');
    if (m) s.push(m);
    return s;
  };
  const vacio = () => Object.fromEntries(ESCOPOS.map((x) => [x, 0]));
  const altasHoja = detectar(wb, [['ALTA/BAJA'], ['MARCA'], ['AREA', 'LAB'], ['SUPERVISOR']]);
  const baseHoja = detectar(wb, [['FECHA DE ALTA'], ['FECHA DE SALIDA'], ['MARCA'], ['DEPARTAMENTO']]);
  if (!altasHoja || !baseHoja || !salidasJson) {
    calidad.push({ tipo: 'aviso', n: 1, mensaje: 'No se pudo calcular el indicador de rotación por marca: falta la pestaña ALTAS o BASE DE DATOS GENERAL (o sus encabezados cambiaron).' });
  } else {
    // altas por mes
    const HA = altasHoja.headers;
    const iAlta = HA.findIndex((h) => h === 'ALTA'), iMarcaA = HA.findIndex((h) => h === 'MARCA'), iAreaA = colIdx(HA, 'AREA', 'LAB');
    const altasMes = {}; let altasSinFecha = 0;
    for (const f of altasHoja.filas) {
      const alta = fechaISO(f[iAlta]);
      if (!alta) { if (norm(f[iMarcaA]) || norm(f[iAreaA])) altasSinFecha++; continue; }
      const ym = alta.slice(0, 7);
      altasMes[ym] ??= vacio();
      for (const e of escoposDe(norm(f[iMarcaA]), AREA_NORM(f[iAreaA]))) altasMes[ym][e]++;
    }
    // plantilla activa hoy (ancla)
    const HB = baseHoja.headers;
    const iAltaB = colIdx(HB, 'FECHA DE ALTA'), iSalB = colIdx(HB, 'FECHA DE SALIDA'), iMarcaB = HB.findIndex((h) => h === 'MARCA');
    const iDepB = HB.findIndex((h) => h === 'DEPARTAMENTO') >= 0 ? HB.findIndex((h) => h === 'DEPARTAMENTO') : colIdx(HB, 'DEPARTAMENTO');
    const activos = vacio(); let compartida = 0, baseSinAlta = 0;
    for (const f of baseHoja.filas) {
      const alta = fechaISO(f[iAltaB]); const salida = fechaISO(f[iSalB]);
      if (!alta) { if (norm(f[iMarcaB]) || norm(f[iDepB])) baseSinAlta++; continue; }
      if (salida) continue;
      const m = norm(f[iMarcaB]); if (esAdministracion(m)) compartida++;
      for (const e of escoposDe(m, AREA_NORM(f[iDepB]))) activos[e]++;
    }
    // bajas por mes (registro de SALIDAS ya leído)
    const bajasMes = {};
    for (const r of regsSalidas) {
      bajasMes[r.ym] ??= vacio();
      const fuera = MARCAS_EXCLUIDAS.has(r.marca);
      const esc = fuera ? [] : ['total']; if (!fuera && r.area === 'COMERCIAL') esc.push('comercial'); if (MARCA_ETI_CLAVE[r.marca]) esc.push(MARCA_ETI_CLAVE[r.marca]);
      for (const e of esc) bajasMes[r.ym][e]++;
    }
    // reconstrucción mes a mes, desde el primer mes con altas hasta hoy
    const hoyISO = hoy.toISOString().slice(0, 10);
    const hoyYmR = hoyISO.slice(0, 7);
    const primero = Object.keys(altasMes).sort()[0] ?? hoyYmR;
    const meses = []; for (let ym = primero; ym <= hoyYmR; ) { meses.push(ym); const [y, m] = ym.split('-').map(Number); ym = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`; }
    const series = Object.fromEntries(ESCOPOS.map((e) => [e, []]));
    for (const e of ESCOPOS) {
      let fin = activos[e];
      const filas = [];
      for (const ym of [...meses].reverse()) {
        const altas = altasMes[ym]?.[e] ?? 0, bajas = bajasMes[ym]?.[e] ?? 0;
        const inicio = fin - altas + bajas;
        filas.unshift({ ym, anio: +ym.slice(0, 4), mesNum: +ym.slice(5, 7), mes: MESES[+ym.slice(5, 7) - 1], inicio, fin, altas, bajas, parcial: ym === hoyYmR });
        fin = inicio;
      }
      let anioAcc = null, acc = 0;
      for (const r of filas) {
        if (r.anio !== anioAcc) { anioAcc = r.anio; acc = 0; }
        acc += r.bajas; r.bajasAcum = acc;
        const prom = (r.inicio + r.fin) / 2;
        // plantilla negativa = las fuentes no cuadran para ese alcance (p. ej. Friotec, 1 persona activa): sin %
        r.inconsistente = r.inicio < 0 || r.fin < 0;
        r.pctAcum = prom > 0 && !r.inconsistente ? acc / prom : null;
        r.pctMes = prom > 0 && !r.inconsistente ? r.bajas / prom : null;
      }
      series[e] = filas;
    }
    // comparación con el indicador manual (TOTAL EMPRESA / AREA COMERCIAL)
    const comparar = (escopo, areaManual) => series[escopo].filter((r) => !r.parcial).map((r) => {
      const m = acumulado.find((x) => x.area === areaManual && x.anio === r.anio && x.mesNum === r.mesNum);
      return m ? { anio: r.anio, mesNum: r.mesNum, manual: { inicio: m.inicio, fin: m.fin, bajasAcum: m.bajasAcum, pctAcum: m.pctAcum }, calculado: { inicio: r.inicio, fin: r.fin, bajasAcum: r.bajasAcum, pctAcum: r.pctAcum } } : null;
    }).filter(Boolean);
    rotacionJson.calculado = {
      fuente: 'Bajas: pestaña SALIDAS. Altas: pestaña ALTAS (solo conteos). Plantilla de hoy: BASE DE DATOS GENERAL (solo conteo de activos). Plantilla de meses anteriores reconstruida hacia atrás con altas y bajas.',
      anclaje: { fecha: hoyISO, activos, administracionEnAmericana: compartida },
      marcasExcluidas: [...MARCAS_EXCLUIDAS], // total y comercial se calculan sin ellas (el indicador manual del sheet sí las incluye)
      desde: primero, hasta: hoyYmR,
      series,
      comparacion: { total: comparar('total', 'TOTAL EMPRESA'), comercial: comparar('comercial', 'AREA COMERCIAL') },
    };
    console.log(`Rotación calculada: activos hoy ${JSON.stringify(activos)} (administración, contada en Americana: ${compartida}) · meses ${primero}→${hoyYmR}`);
    if (altasSinFecha) calidad.push({ tipo: 'aviso', n: altasSinFecha, mensaje: `${altasSinFecha} filas de ALTAS no tienen fecha de alta; no entran al indicador calculado.` });
    if (baseSinAlta) calidad.push({ tipo: 'aviso', n: baseSinAlta, mensaje: `${baseSinAlta} filas de BASE DE DATOS GENERAL no tienen fecha de alta; no cuentan como activas.` });
    if (compartida) calidad.push({ tipo: 'info', n: compartida, mensaje: `${compartida} colaboradores activos de ADMINISTRACION (corporativo) se cuentan en Americana para el indicador por marca.` });
  }
}

// ── VERIFICACIÓN ANTI-FUGAS (última línea de defensa) ──────────────────────
// Términos prohibidos como palabras completas (así "Benito" no dispara "NIT").
const RE_PROHIBIDOS = [
  'NOMBRE DEL CANDIDATO', 'A QUIEN REEMPLAZA', 'NOMBRE JEFE DIRECTO', 'QUIEN SOLICITO',
  // 'SUPERVISOR' salió de la lista el 2026-09-09: Oscar decidió publicar el desglose por supervisor.
  'ENTREVISTADOR', 'DPI', 'TELEFONO', 'CELULAR', 'SUELDO', 'NIT',
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
// Registro de tiendas para el mapa (config/tiendas.json): solo tipo, marca, supervisor y ubicación.
const tiendasJson = {
  actualizado: TIENDAS_CFG.actualizado,
  tiendas: TIENDAS_CFG.tiendas.map((t) => ({ nombre: t.nombre, tipo: t.tipo ?? null, marca: t.marca, activa: !!t.activa, supervisor: t.supervisor ?? null,
    departamento: t.departamento ?? null, municipio: t.municipio ?? null, lat: t.lat ?? null, lon: t.lon ?? null, observacion: t.observacion ?? null })),
};
const hallazgos = [];
buscarFugas(tiendasJson, 'tiendas', hallazgos);
buscarFugas(vacantesJson, 'vacantes', hallazgos);
buscarFugas(rotacionJson, 'rotacion', hallazgos);
buscarFugas(metaJson, 'meta', hallazgos);
if (salidasJson) buscarFugas(salidasJson, 'salidas', hallazgos);
if (integracionJson) buscarFugas(integracionJson, 'integracion', hallazgos);
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
writeFileSync(path.join(outDir, 'salidas.json'), JSON.stringify(salidasJson ?? { generado: hoy.toISOString(), total: null }));
writeFileSync(path.join(outDir, 'integracion.json'), JSON.stringify(integracionJson ?? { generado: hoy.toISOString(), total: null }));
writeFileSync(path.join(outDir, 'meta.json'), JSON.stringify(metaJson, null, 2));
writeFileSync(path.join(outDir, 'tiendas.json'), JSON.stringify(tiendasJson));
if (calidad.length) {
  console.log('\nAvisos de calidad (van a meta.json; no se muestran en el sitio):');
  for (const a of calidad) console.log(`  ${a.tipo === 'error' ? '✖' : '•'} ${a.mensaje}`);
}
console.log(`\n✅ Publicado en public/data/: vacantes.json (${filasVac.length} filas), rotacion.json (${acumulado.length}+${mensual.length}), salidas.json (${salidasJson ? salidasJson.total.n + ' agregadas' : 'sin datos'}), integracion.json (${integracionJson ? integracionJson.total.n + ' nuevos, solo conteos' : 'sin datos'}), meta.json (${calidad.length} avisos de calidad). Verificación anti-fugas: limpia.`);

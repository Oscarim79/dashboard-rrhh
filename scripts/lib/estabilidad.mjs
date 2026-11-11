// "Los que sí se quedan" (pedido de Oscar, 2026-10-07): antigüedad del equipo ACTIVO según la BASE DE
// DATOS GENERAL, SOLO como conteos (por rango de antigüedad, departamento, puesto, supervisor y tienda).
// De cada fila se lee únicamente: fecha de alta, fecha de salida (vacía = activo), marca, departamento y,
// si existen, puesto, supervisor o jefe y agencia. Jamás nombre, DPI, teléfono, sueldo ni ningún dato
// individual, y no se publica ninguna fila: solo totales. Funciones puras para poder probarlas aparte.
// De aquí sale también el "Equipo activo hoy" del Resumen (activos por tipo de puesto, `porGrupoPuesto`).

export const RANGOS_ACTIVOS = ['MENOS 6 MESES', '6 MESES A 1 ANO', 'DE 1 A 2 ANOS', 'DE 2 A 5 ANOS', 'DE 5 A 10 ANOS', 'MAS DE 10 ANOS'];
export const UMBRAL_ESTABLE_ANIOS = 5;

export function rangoActivo(dias) {
  if (dias < 182) return 'MENOS 6 MESES';
  if (dias < 365) return '6 MESES A 1 ANO';
  if (dias < 730) return 'DE 1 A 2 ANOS';
  if (dias < 1825) return 'DE 2 A 5 ANOS';
  if (dias < 3650) return 'DE 5 A 10 ANOS';
  return 'MAS DE 10 ANOS';
}

const mediana = (nums) => {
  if (!nums.length) return null;
  const s = [...nums].sort((a, b) => a - b), m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

// Resumen de un grupo de activos: cuántos, por rango, cuántos pasan de 5 y de 10 años, antigüedad mediana.
function resumen(regs) {
  const porRango = Object.fromEntries(RANGOS_ACTIVOS.map((r) => [r, 0]));
  let mas5 = 0, mas10 = 0;
  for (const r of regs) { porRango[rangoActivo(r.dias)]++; if (r.dias >= 1825) mas5++; if (r.dias >= 3650) mas10++; }
  const med = mediana(regs.map((r) => r.dias));
  return { n: regs.length, porRango, mas5, mas10, medianaAnios: med == null ? null : +(med / 365.25).toFixed(1) };
}

// "Equipo activo hoy" del Resumen (pedido de Oscar, 2026-10-12): cuántos vendedores, jefes de tienda y
// supervisores hay, y "administrativo" = todos los demás puestos. Se deduce del texto del puesto (ya
// normalizado: mayúsculas, sin acentos ni la palabra "DE"); null si la fila no trae puesto.
export const GRUPOS_PUESTO = ['vendedores', 'jefesTienda', 'supervisores', 'administrativo'];
export function grupoPuesto(puesto, departamento) {
  if (!puesto) return null;
  const com = departamento === 'COMERCIAL';
  if (/\bSUPERVISOR/.test(puesto) && (com || /TIENDA|AGENCIA|REGION|ZONA|VENTA|COMERCIAL/.test(puesto))) return 'supervisores';
  if (/\b(JEF[EA]|ENCARGAD[OA]|GERENTE|ADMINISTRADORA?) (AGENCIA|TIENDA|SALA)\b/.test(puesto)) return 'jefesTienda';
  if (/\bVENDED/.test(puesto) || (/\bASESOR/.test(puesto) && !/CREDITO|COBRO/.test(puesto) && (com || /VENTA|COMERCIAL/.test(puesto)))) return 'vendedores';
  return 'administrativo';
}
function porGrupoPuesto(regs) {
  const grupos = Object.fromEntries(GRUPOS_PUESTO.map((g) => [g, { n: 0, puestos: {} }]));
  let sinPuesto = 0;
  for (const r of regs) {
    const g = grupoPuesto(r.puesto, r.departamento);
    if (!g) { sinPuesto++; continue; }
    grupos[g].n++;
    grupos[g].puestos[r.puesto] = (grupos[g].puestos[r.puesto] ?? 0) + 1;
  }
  for (const g of GRUPOS_PUESTO) grupos[g].puestos = Object.fromEntries(Object.entries(grupos[g].puestos).sort((a, b) => b[1] - a[1]));
  return { ...grupos, sinPuesto };
}

// Conteo por una clave (departamento, puesto…): n y cuántos pasan de 5 años, ordenado por estables.
function porClave(regs, clave) {
  const g = new Map();
  for (const r of regs) { const k = r[clave]; if (!k) continue; const a = g.get(k) ?? { n: 0, mas5: 0, mas10: 0 }; a.n++; if (r.dias >= 1825) a.mas5++; if (r.dias >= 3650) a.mas10++; g.set(k, a); }
  return Object.fromEntries([...g.entries()].sort((a, b) => b[1].mas5 - a[1].mas5 || b[1].n - a[1].n));
}

// filas/headers: la pestaña BASE DE DATOS GENERAL ya detectada. escoposDe(marcaNorm, areaNorm) → alcances
// ('total', 'comercial', 'americana', 'abiq', 'friotec') con las mismas reglas del indicador calculado.
export function calcularEstabilidad({ filas, headers, hoyISO, norm, fechaISO, colIdx, diasEntre, escoposDe, areaNorm }) {
  const iAlta = colIdx(headers, 'FECHA DE ALTA'), iSal = colIdx(headers, 'FECHA DE SALIDA');
  const iMarca = headers.findIndex((h) => h === 'MARCA');
  const iDep = headers.findIndex((h) => h === 'DEPARTAMENTO') >= 0 ? headers.findIndex((h) => h === 'DEPARTAMENTO') : colIdx(headers, 'DEPARTAMENTO');
  const iPuesto = colIdx(headers, 'PUESTO') >= 0 ? colIdx(headers, 'PUESTO') : headers.findIndex((h) => h === 'CARGO');
  const iSup = headers.findIndex((h) => h.includes('SUPERVISOR') || h.includes('JEFE INMEDIATO'));
  const iAgencia = headers.findIndex((h) => h === 'AGENCIA' || h === 'TIENDA' || h.includes('LUGAR DE TRABAJO'));
  const columnasLeidas = ['FECHA DE ALTA', 'FECHA DE SALIDA', 'MARCA', 'DEPARTAMENTO', iPuesto >= 0 && 'PUESTO', iSup >= 0 && 'SUPERVISOR', iAgencia >= 0 && 'AGENCIA'].filter(Boolean);
  const porAlcance = {};
  let activos = 0, sinAlta = 0, altaFutura = 0;
  for (const f of filas) {
    const alta = fechaISO(f[iAlta]);
    if (!alta) { if (norm(f[iMarca]) || norm(f[iDep])) sinAlta++; continue; }
    if (fechaISO(f[iSal])) continue; // ya salió
    const dias = diasEntre(alta, hoyISO);
    if (dias < 0) { altaFutura++; continue; }
    activos++;
    const puesto = iPuesto >= 0 ? norm(f[iPuesto]).replace(/\bDE\b/g, '').replace(/\s+/g, ' ').trim() : '';
    const reg = {
      dias,
      departamento: areaNorm(f[iDep]) || '(SIN DEPARTAMENTO)',
      puesto: puesto || null,
      supervisor: iSup >= 0 ? (String(f[iSup] ?? '').trim() || null) : null,
      agencia: iAgencia >= 0 ? (String(f[iAgencia] ?? '').trim() || null) : null,
    };
    for (const e of escoposDe(norm(f[iMarca]), areaNorm(f[iDep]))) (porAlcance[e] ??= []).push(reg);
  }
  const alcances = Object.fromEntries(Object.entries(porAlcance).map(([e, regs]) => [e, {
    ...resumen(regs),
    porDepartamento: porClave(regs, 'departamento'),
    porPuesto: porClave(regs, 'puesto'),
    porGrupoPuesto: iPuesto >= 0 ? porGrupoPuesto(regs) : null,
    porSupervisor: iSup >= 0 ? porClave(regs, 'supervisor') : null,
    porAgencia: iAgencia >= 0 ? porClave(regs, 'agencia') : null,
  }]));
  return { alcances, activos, sinAlta, altaFutura, columnasLeidas };
}

// Pestaña de PERMANENCIA (por qué se quedan). Hoy NO existe en el sheet: cuando RRHH la cree con una fila
// por entrevista y una columna MOTIVO DE PERMANENCIA (y, si quiere, DEPARTAMENTO y ANTIGUEDAD), aquí se
// cuenta por motivo. Solo conteos; nunca se leen nombres ni respuestas libres.
export function contarPermanencia({ hoja, norm, colIdx }) {
  if (!hoja) return null;
  const H = hoja.headers;
  const iMotivo = colIdx(H, 'MOTIVO');
  if (iMotivo < 0) return null;
  const iDep = colIdx(H, 'DEPARTAMENTO');
  const motivos = {}, porDepartamento = {};
  let n = 0;
  for (const f of hoja.filas) {
    const m = norm(f[iMotivo]);
    if (!m) continue;
    n++;
    motivos[m] = (motivos[m] ?? 0) + 1;
    if (iDep >= 0) { const d = norm(f[iDep]) || '(SIN DEPARTAMENTO)'; porDepartamento[d] ??= {}; porDepartamento[d][m] = (porDepartamento[d][m] ?? 0) + 1; }
  }
  return { n, motivos: Object.fromEntries(Object.entries(motivos).sort((a, b) => b[1] - a[1])), porDepartamento: iDep >= 0 ? porDepartamento : null, pestana: hoja.nombre };
}

// ── PERSONAL ESTABLE (pedido de Oscar, 2026-10-14) ─────────────────────────────────────────────────────────
// Pestaña que RRHH arma a mano: asesores y jefes de agencia que llevan 2 años o más. Trae muchos datos
// personales (nombre, DPI, NIT, afiliación, teléfono, dirección, nacimiento…): de aquí SOLO se leen puesto,
// agencia, fecha de alta, género, edad, estado civil, marca, área y región (supervisor), y solo se publican
// conteos de una dimensión a la vez (nunca cruces como tienda × edad). Un alcance con menos de MIN_DESGLOSE
// personas publica solo su total.
// Fechas: la pestaña está escrita día/mes/año, al revés que el resto del sheet (mes/día). Google convirtió en
// fecha las que pudo leer como mes/día (con día y mes cambiados) y dejó como texto las demás. Si alguna fecha
// de texto empieza con un número mayor que 12, toda la columna se lee como día/mes; si RRHH la corrige algún
// día (todas fechas reales), se lee normal.
// RANGO DE EDAD, TOTAL AÑOS LAB y RANGO ESTABILIDAD son valores fijos escritos a mano (y los rangos no cuadran
// con la edad ni los años): no se usan. La antigüedad se cuenta desde la fecha de alta hasta hoy.
export const MIN_DESGLOSE = 5;
export const RANGOS_ESTABLE = ['MENOS DE 2', '2 A 3', '3 A 4', '4 A 5', '5 O MAS'];
export const RANGOS_EDAD = ['18 A 22', '23 A 27', '28 A 32', '33 A 37', '38 A 42', '43 O MAS'];
const rangoEstable = (a) => (a < 2 ? 'MENOS DE 2' : a < 3 ? '2 A 3' : a < 4 ? '3 A 4' : a < 5 ? '4 A 5' : '5 O MAS');
const rangoEdad = (e) => (e < 23 ? '18 A 22' : e < 28 ? '23 A 27' : e < 33 ? '28 A 32' : e < 38 ? '33 A 37' : e < 43 ? '38 A 42' : '43 O MAS');

// celda → { y, a, b } con a/b = primer y segundo número tal como los dejó Google (serial: a = mes, b = día)
function partesFecha(v) {
  if (typeof v === 'number' && v > 20000 && v < 60000) {
    const d = new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000);
    return { y: d.getUTCFullYear(), a: d.getUTCMonth() + 1, b: d.getUTCDate(), texto: false };
  }
  const m = String(v ?? '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  return m ? { y: +m[3], a: +m[1], b: +m[2], texto: true } : null;
}
const p2 = (n) => String(n).padStart(2, '0');
function aniosCumplidos(isoA, isoB) {
  const [y1, m1, d1] = isoA.split('-').map(Number), [y2, m2, d2] = isoB.split('-').map(Number);
  return y2 - y1 - (m2 < m1 || (m2 === m1 && d2 < d1) ? 1 : 0);
}
const contar = (regs, clave, orden) => {
  const c = {};
  for (const r of regs) if (r[clave] != null) c[r[clave]] = (c[r[clave]] ?? 0) + 1;
  const e = Object.entries(c);
  return Object.fromEntries(orden ? orden.filter((k) => c[k]).map((k) => [k, c[k]]) : e.sort((a, b) => b[1] - a[1]));
};

// hoja: la pestaña ya detectada ({ nombre, filas, headers }). escoposDe: los mismos alcances del resto del
// sitio. tiendaDe(agencia, marca) → nombre canónico de la tienda o null. supervisorDe(region) → nombre completo.
// tiendasActivas(alcance) → tiendas activas de ese alcance (para "tiendas sin nadie con 2 años o más").
export function contarPersonalEstable({ hoja, hoyISO, norm, escoposDe, tiendaDe, supervisorDe, tiendasActivas }) {
  if (!hoja) return null;
  const H = hoja.headers;
  const col = (pred) => H.findIndex(pred);
  const i = {
    puesto: col((h) => h === 'PUESTO'),
    agencia: col((h) => h === 'AGENCIA' || h === 'TIENDA'),
    alta: col((h) => h === 'ALTA' || h.startsWith('FECHA DE ALTA')),
    genero: col((h) => h === 'GENERO' || h === 'SEXO'),
    edad: col((h) => h === 'EDAD'),
    civil: col((h) => h.includes('ESTADO CIVIL')),
    marca: col((h) => h === 'MARCA'),
    area: col((h) => h.startsWith('AREA') || h === 'DEPARTAMENTO'),
    region: col((h) => h === 'REGION' || h.includes('SUPERVISOR')),
  };
  if (i.alta < 0 || i.puesto < 0) return null;
  const vacia = (f) => ![i.puesto, i.agencia, i.alta].some((k) => k >= 0 && String(f[k] ?? '').trim());
  const filas = hoja.filas.filter((f) => !vacia(f));
  const diaPrimero = filas.some((f) => { const p = partesFecha(f[i.alta]); return p?.texto && p.a > 12; });
  const avisos = { sinAlta: 0, sinTienda: new Map(), sinSupervisor: new Set() };
  const porAlcance = {};
  for (const f of filas) {
    const p = partesFecha(f[i.alta]);
    const [mes, dia] = p ? (diaPrimero ? [p.b, p.a] : [p.a, p.b]) : [0, 0];
    if (!p || mes < 1 || mes > 12 || dia < 1 || dia > 31) { avisos.sinAlta++; continue; }
    const alta = `${p.y}-${p2(mes)}-${p2(dia)}`;
    const anios = aniosCumplidos(alta, hoyISO);
    const marca = i.marca >= 0 ? norm(f[i.marca]) : '';
    const agenciaCruda = i.agencia >= 0 ? String(f[i.agencia] ?? '').trim() : '';
    const tienda = agenciaCruda ? tiendaDe(agenciaCruda, marca) : null;
    if (agenciaCruda && !tienda) avisos.sinTienda.set(agenciaCruda, (avisos.sinTienda.get(agenciaCruda) ?? 0) + 1);
    const regionCruda = i.region >= 0 ? String(f[i.region] ?? '').trim() : '';
    const supervisor = regionCruda ? supervisorDe(regionCruda) : null;
    if (regionCruda && !supervisor) avisos.sinSupervisor.add(regionCruda);
    const edad = i.edad >= 0 && Number.isFinite(Number(f[i.edad])) && String(f[i.edad] ?? '').trim() ? Number(f[i.edad]) : null;
    const g = i.genero >= 0 ? norm(f[i.genero]) : '';
    const reg = {
      anios, rango: rangoEstable(anios),
      puesto: norm(f[i.puesto]).replace(/\bDE\b/g, '').replace(/\s+/g, ' ').trim() || null,
      genero: g.startsWith('FEM') || g === 'F' || g === 'MUJER' ? 'MUJERES' : g.startsWith('MAS') || g === 'M' || g === 'HOMBRE' ? 'HOMBRES' : null,
      edad: edad == null ? null : rangoEdad(edad),
      civil: i.civil >= 0 ? norm(f[i.civil]) || null : null,
      supervisor: supervisor ?? (regionCruda || null),
      tienda: tienda ?? (agenciaCruda || null),
    };
    for (const e of escoposDe(marca, i.area >= 0 ? norm(f[i.area]) : 'COMERCIAL')) (porAlcance[e] ??= []).push(reg);
  }
  const alcances = Object.fromEntries(Object.entries(porAlcance).map(([e, regs]) => {
    if (regs.length < MIN_DESGLOSE) return [e, { n: regs.length }];
    const anios = regs.map((r) => r.anios).sort((a, b) => a - b), m = Math.floor(anios.length / 2);
    const conEstables = new Set(regs.map((r) => r.tienda));
    return [e, {
      n: regs.length,
      medianaAnios: anios.length % 2 ? anios[m] : (anios[m - 1] + anios[m]) / 2,
      mas5: regs.filter((r) => r.anios >= 5).length,
      porAntiguedad: contar(regs, 'rango', RANGOS_ESTABLE),
      porPuesto: contar(regs, 'puesto'),
      porGenero: contar(regs, 'genero'),
      porEdad: contar(regs, 'edad', RANGOS_EDAD),
      porEstadoCivil: contar(regs, 'civil'),
      porSupervisor: contar(regs, 'supervisor'),
      porTienda: contar(regs, 'tienda'),
      tiendasSinEstables: tiendasActivas(e).filter((t) => !conEstables.has(t)).sort(),
    }];
  }));
  return {
    pestana: hoja.nombre, filas: filas.length, alcances, diaPrimero,
    columnasLeidas: Object.entries(i).filter(([, k]) => k >= 0).map(([, k]) => H[k]),
    avisos: { sinAlta: avisos.sinAlta, sinTienda: Object.fromEntries(avisos.sinTienda), sinSupervisor: [...avisos.sinSupervisor] },
  };
}

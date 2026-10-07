// "Los que sí se quedan" (pedido de Oscar, 2026-10-07): antigüedad del equipo ACTIVO según la BASE DE
// DATOS GENERAL, SOLO como conteos (por rango de antigüedad, departamento, puesto, supervisor y tienda).
// De cada fila se lee únicamente: fecha de alta, fecha de salida (vacía = activo), marca, departamento y,
// si existen, puesto, supervisor o jefe y agencia. Jamás nombre, DPI, teléfono, sueldo ni ningún dato
// individual, y no se publica ninguna fila: solo totales. Funciones puras para poder probarlas aparte.

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
  const iPuesto = colIdx(headers, 'PUESTO');
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

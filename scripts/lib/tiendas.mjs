// "Tiendas por marca" del Resumen (pedido de Oscar, 2026-10-12): cuántas tiendas activas tiene cada marca,
// según la pestaña de tiendas que Oscar agregó al sheet de RRHH (mismas columnas que el "Registro general de
// tiendas": Tienda · Marca · Tipo (AA/A/B/C) · Estado · Supervisor / región · …). De cada fila se leen solo
// tienda, marca, tipo y estado; la pestaña no trae datos personales y no se publica ninguna fila: solo conteos.
// Funciones puras para poder probarlas aparte.

// En la pestaña TIENDAS las tiendas Americana vienen con la marca "A2K" (Americana 2000), como en la BASE DE DATOS
// GENERAL; se cuentan como Americana (primera corrida real, 2026-10-12).
export const MARCA_TIENDA = { AMERICANA: 'Americana', A2K: 'Americana', 'AMERICANA 2000': 'Americana', 'ABI Q': 'Abi Q', ABIQ: 'Abi Q', FRIOTEC: 'Friotec' };
export const TIPOS_TIENDA = ['AA', 'A', 'B', 'C', 'por definir'];

// ¿Es la pestaña de tiendas? Debe traer columna de tienda, de marca y de estado o tipo, y ninguna de fechas,
// altas/bajas, DPI ni sueldos: así no se confunde con SALIDAS, VACANTES, ALTAS ni la BASE DE DATOS GENERAL,
// que también traen agencia y marca. Devuelve los índices de columna o null.
export function columnasTiendas(headers) {
  if (headers.some((h) => /FECHA|\bALTA\b|\bBAJA\b|\bDPI\b|SUELDO|SALARIO/.test(h))) return null;
  const i = {
    tienda: headers.findIndex((h) => /^(TIENDA|AGENCIA|SUCURSAL)\b/.test(h)),
    marca: headers.findIndex((h) => h === 'MARCA' || h === 'EMPRESA'),
    tipo: headers.findIndex((h) => h.startsWith('TIPO')),
    estado: headers.findIndex((h) => /^(ESTADO|ESTATUS|STATUS|ACTIVA)\b/.test(h)),
  };
  return i.tienda < 0 || i.marca < 0 || (i.tipo < 0 && i.estado < 0) ? null : i;
}

// Tiendas activas y cerradas por marca, y activas por tipo. Sin columna de estado, todas cuentan como activas.
// Las filas sin marca o con un estado que no es activa/cerrada no se cuentan (van como aviso); una tienda
// repetida (mismo nombre y misma marca) cuenta una sola vez. Dos marcas pueden tener una tienda con el mismo
// nombre (p. ej. "Tienda en línea" de Americana y de Abi Q): son dos tiendas. Una fila con marca o estado pero
// sin nombre de tienda no se cuenta y va como aviso (sinNombre). `activasPorMarca` lista los nombres contados,
// solo para el log del pipeline (no se publica).
export function contarTiendas(filas, i, norm) {
  const porMarca = {}, activasPorMarca = {};
  const vistas = new Set();
  let sinMarca = 0, sinEstado = 0, repetidas = 0, sinNombre = 0;
  for (const f of filas) {
    const tienda = norm(f[i.tienda]);
    if (!tienda) { if (norm(f[i.marca]) || (i.estado >= 0 && norm(f[i.estado]))) sinNombre++; continue; }
    const marcaN = norm(f[i.marca]);
    if (!marcaN) { sinMarca++; continue; }
    const marca = MARCA_TIENDA[marcaN] ?? marcaN.charAt(0) + marcaN.slice(1).toLowerCase();
    if (vistas.has(`${marca}|${tienda}`)) { repetidas++; continue; }
    vistas.add(`${marca}|${tienda}`);
    const est = i.estado >= 0 ? norm(f[i.estado]) : 'ACTIVA';
    const activa = /^(ACTIV|ABIERT)/.test(est) || est === 'SI' ? true : /^(CERRAD|INACTIV)/.test(est) || est === 'NO' ? false : null;
    if (activa == null) { sinEstado++; continue; }
    const m = porMarca[marca] ??= { activas: 0, cerradas: 0, porTipo: Object.fromEntries(TIPOS_TIENDA.map((t) => [t, 0])) };
    if (!activa) { m.cerradas++; continue; }
    m.activas++;
    (activasPorMarca[marca] ??= []).push(String(f[i.tienda]).trim());
    const tipo = i.tipo >= 0 ? norm(f[i.tipo]) : '';
    m.porTipo[TIPOS_TIENDA.includes(tipo) ? tipo : 'por definir']++;
  }
  return { porMarca, sinMarca, sinEstado, repetidas, sinNombre, activasPorMarca };
}

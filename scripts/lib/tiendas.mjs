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
    // opcionales, para el mapa (unirRegistro): -1 si la pestaña no las trae
    supervisor: headers.findIndex((h) => h.includes('SUPERVISOR')),
    departamento: headers.findIndex((h) => h.startsWith('DEPARTAMENTO')),
    municipio: headers.findIndex((h) => h.startsWith('MUNICIPIO')),
    alias: headers.findIndex((h) => h.includes('NOMBRES CON QUE') || h.startsWith('ALIAS')),
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

// Registro de tiendas que usa el pipeline y el mapa (Oscar, 2026-10-12: "que el mapa también lea la pestaña
// TIENDAS"). La pestaña manda en qué tiendas hay y en su marca, estado y, si trae esas columnas, supervisor,
// departamento y municipio. config/tiendas.json aporta lo que la pestaña no trae: coordenadas, el nombre con que
// se cruzan las salidas por tienda y los nombres con que cada tienda aparece en vacantes y salidas (alias).
// El TIPO (AA/A/B/C) de una tienda ya clasificada sale de config/tiendas.json, la clasificación por ventas de Oscar
// (decisión de Oscar, 2026-10-12: "dejar la clasificación de antes"); el de la pestaña solo se usa para tiendas sin
// tipo en el registro (p. ej. Santa Cruz, por definir) o tiendas nuevas.
// Cada fila de la pestaña se empareja con su tienda de config/tiendas.json de la misma marca por nombre o alias
// (sin el prefijo "Tienda "; en Abi Q también con "ABIQ " delante, p. ej. "Tienda Online" → "ABIQ ONLINE").
// - Tienda de la pestaña sin pareja: entra con el nombre de la pestaña; toma coordenadas de otra tienda del mismo
//   municipio si la hay (si no, sin punto en el mapa) y va en `sinPareja` para avisar.
// - Tienda de config/tiendas.json que no está en la pestaña: queda como no activa (no sale en el mapa, pero sus
//   alias siguen resolviendo las salidas históricas); si estaba activa va en `faltan`.
// - Si la pestaña pone otro departamento o municipio que config/tiendas.json, se buscan coordenadas de ese
//   municipio en otra tienda; si no hay, la tienda queda sin punto en el mapa (va en `sinUbicacion`).
// - `difTipo`: tiendas clasificadas cuyo tipo en la pestaña es otro (se mantiene el de config/tiendas.json).
const TIPOS_AAC = ['AA', 'A', 'B', 'C'];
const tituloNombre = (s) => s.toLowerCase().replace(/(^|[\s-])(\S)/g, (m, sep, c) => sep + c.toUpperCase());
export function unirRegistro({ filas, cols, cfgTiendas, norm, deptosMapa = [] }) {
  const quitarPrefijo = (s) => s.replace(/^TIENDA\s+/, '');
  const deptoCanon = new Map(deptosMapa.map((d) => [norm(d), d]));
  const supCanon = new Map(cfgTiendas.map((t) => t.supervisor).filter(Boolean).map((s) => [norm(s), s]));
  const indice = new Map(); // marca → (clave → tienda de config)
  for (const t of cfgTiendas) {
    const m = indice.get(t.marca) ?? new Map(); indice.set(t.marca, m);
    for (const k of [norm(t.nombre), ...(t.alias ?? [])]) if (k && !m.has(k)) m.set(k, t);
  }
  const usadas = new Set(), vistas = new Set();
  const tiendas = [], sinPareja = [], difTipo = [], sinUbicacion = [];
  const coordsDe = (municipio, departamento) => (municipio ? cfgTiendas.find((t) => t.lat != null && norm(t.municipio) === norm(municipio) && (!departamento || t.departamento === departamento)) : null);
  const celda = (f, j) => (j >= 0 ? String(f[j] ?? '').trim() : '');
  for (const f of filas) {
    const crudo = celda(f, cols.tienda), nombreN = norm(crudo);
    const marcaN = norm(f[cols.marca]);
    if (!nombreN || !marcaN) continue;
    const marca = MARCA_TIENDA[marcaN] ?? marcaN.charAt(0) + marcaN.slice(1).toLowerCase();
    if (vistas.has(`${marca}|${nombreN}`)) continue;
    vistas.add(`${marca}|${nombreN}`);
    const base = quitarPrefijo(nombreN);
    const aliasPestana = celda(f, cols.alias).split(/[,;\n]/).map(norm).filter(Boolean);
    const claves = [nombreN, base, ...(marca === 'Abi Q' ? [`ABIQ ${base}`, `ABI Q ${base}`] : []), ...aliasPestana];
    const idx = indice.get(marca);
    const cfg = claves.map((k) => idx?.get(k)).find((t) => t && !usadas.has(t.nombre)) ?? null;
    if (cfg) usadas.add(cfg.nombre);
    const est = cols.estado >= 0 ? norm(f[cols.estado]) : 'ACTIVA';
    const activa = /^(ACTIV|ABIERT)/.test(est) || est === 'SI';
    const tipoN = cols.tipo >= 0 ? norm(f[cols.tipo]) : null;
    const tipoPestana = tipoN != null && TIPOS_AAC.includes(tipoN) ? tipoN : null;
    const tipo = cfg?.tipo ?? tipoPestana;
    const supCrudo = celda(f, cols.supervisor);
    const supervisor = supCrudo ? (supCanon.get(norm(supCrudo)) ?? tituloNombre(supCrudo)) : (cfg?.supervisor ?? null);
    const depCrudo = celda(f, cols.departamento);
    const departamento = depCrudo ? (deptoCanon.get(norm(depCrudo)) ?? cfg?.departamento ?? depCrudo) : (cfg?.departamento ?? null);
    const municipio = celda(f, cols.municipio) || cfg?.municipio || null;
    // el nombre de la pestaña solo es alias de una tienda nueva: en una ya registrada podría robarle el alias a otra
    // (p. ej. "Tienda Online" de Abi Q → "ONLINE", que es la tienda en línea de Americana)
    const alias = [...new Set([...(cfg?.alias ?? (cfg ? [] : [base])), ...aliasPestana])];
    let lat = cfg?.lat ?? null, lon = cfg?.lon ?? null;
    const seMovio = cfg && (departamento !== (cfg.departamento ?? null) || norm(municipio) !== norm(cfg.municipio));
    if (!cfg || seMovio) {
      const vecina = coordsDe(municipio, departamento);
      lat = vecina?.lat ?? null; lon = vecina?.lon ?? null;
    }
    if (!cfg) sinPareja.push({ nombre: crudo.replace(/^tienda\s+/i, ''), marca, ubicada: lat != null });
    else {
      if (activa && cfg.tipo && tipoN != null && tipoPestana !== cfg.tipo) difTipo.push({ nombre: cfg.nombre, pestana: tipoPestana ?? 'por definir', registro: cfg.tipo });
      if (activa && seMovio && lat == null) sinUbicacion.push(`${cfg.nombre} (${[municipio, departamento].filter(Boolean).join(', ')})`);
    }
    tiendas.push({
      nombre: cfg?.nombre ?? crudo.replace(/^tienda\s+/i, ''), tipo, marca, activa, supervisor, departamento, municipio, lat, lon,
      alias, observacion: cfg?.observacion ?? null, enPestana: true,
    });
  }
  const faltan = [];
  for (const t of cfgTiendas) {
    if (usadas.has(t.nombre)) continue;
    if (t.activa) faltan.push(t.nombre);
    tiendas.push({ ...t, activa: false, enPestana: false });
  }
  return { tiendas, sinPareja, faltan, difTipo, sinUbicacion };
}

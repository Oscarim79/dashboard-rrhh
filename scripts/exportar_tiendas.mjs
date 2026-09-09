// Exporta config/tiendas.json a un Excel (.data/registro-tiendas.xlsx) con una fila por tienda:
// clasificación, supervisor, ubicación y los nombres con que aparece en el Sheet de RRHH.
// Es el formato del Google Sheet "Registro de tiendas" (el registro maestro desde 2026-09-09).
// Uso: node scripts/exportar_tiendas.mjs
import { readFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const xlsx = createRequire(path.join(ROOT, 'package.json'))('xlsx');
const cfg = JSON.parse(readFileSync(path.join(ROOT, 'config', 'tiendas.json'), 'utf8'));

const ORDEN_TIPO = { AA: 0, A: 1, B: 2, C: 3 };
const tiendas = [...cfg.tiendas].sort((a, b) => (a.supervisor ?? 'zz').localeCompare(b.supervisor ?? 'zz') || (ORDEN_TIPO[a.tipo] ?? 9) - (ORDEN_TIPO[b.tipo] ?? 9) || a.nombre.localeCompare(b.nombre));
const filas = tiendas.map((t) => ({
  'Tienda': t.nombre,
  'Marca': t.marca,
  'Tipo (AA/A/B/C)': t.tipo ?? 'por definir',
  'Estado': t.activa ? 'Activa' : 'Cerrada',
  'Supervisor / región': t.supervisor ?? '',
  'Departamento': t.departamento ?? '',
  'Municipio': t.municipio ?? '',
  'Latitud': t.lat ?? '',
  'Longitud': t.lon ?? '',
  'Nombres con que aparece en el Sheet de RRHH': (t.alias ?? []).join(', '),
  'Observaciones': t.observacion ?? '',
}));
const noTiendas = (cfg.noTiendas ?? []).map((n) => ({ 'Lugar': n.nombre, 'Categoría': n.categoria, 'Nombres con que aparece en el Sheet de RRHH': (n.alias ?? []).join(', ') }));

const wb = xlsx.utils.book_new();
const ws = xlsx.utils.json_to_sheet(filas);
ws['!cols'] = [24, 11, 14, 9, 20, 16, 22, 10, 10, 48, 60].map((w) => ({ wch: w }));
ws['!autofilter'] = { ref: `A1:K${filas.length + 1}` };
xlsx.utils.book_append_sheet(wb, ws, 'Tiendas');
const ws2 = xlsx.utils.json_to_sheet(noTiendas);
ws2['!cols'] = [22, 14, 70].map((w) => ({ wch: w }));
xlsx.utils.book_append_sheet(wb, ws2, 'Oficinas y regiones');
const ws3 = xlsx.utils.aoa_to_sheet([
  ['Registro de tiendas — Corporación Americana'],
  [''],
  ['Este archivo es el registro maestro de tiendas: clasificación por venta (AA/A/B/C), marca, estado, supervisor de región y ubicación.'],
  ['Tipos por venta mensual: AA arriba de Q1M · A entre Q500k y Q1M · B entre Q300k y Q500k · C abajo de Q300k.'],
  ['Las coordenadas son el centroide del municipio según el INE (censo 2018); sirven para ubicar la tienda en el mapa del dashboard, no son la dirección exacta.'],
  ['La columna "Nombres con que aparece en el Sheet de RRHH" es lo que permite reconocer la tienda en los registros de vacantes y salidas: si en RRHH escriben la tienda de otra forma, agregar aquí esa forma.'],
  ['Cuando cambie algo (tienda nueva, cierre, cambio de supervisor o de tipo), avisar para reflejarlo en el dashboard (config/tiendas.json).'],
  [`Generado el ${new Date().toLocaleDateString('es-GT')} desde config/tiendas.json del proyecto Dashboard RRHH.`],
]);
ws3['!cols'] = [{ wch: 120 }];
xlsx.utils.book_append_sheet(wb, ws3, 'Léeme');
mkdirSync(path.join(ROOT, '.data'), { recursive: true });
const destino = path.join(ROOT, '.data', 'registro-tiendas.xlsx');
xlsx.writeFile(wb, destino);
console.log(`Escrito ${destino}: ${filas.length} tiendas, ${noTiendas.length} oficinas/regiones`);

// Valida que el motor reproduzca los valores de control acordados con Oscar.
// Dos juegos:
//  1) Controles del Excel (2026-09-01: sin Telo, canal Internet vigente, + jefe de RRHH
//     Q8,000 al 100% repartido entre contrataciones del mes). Se pasan los salarios de
//     entonces (vendedor 6,500 · jefe 6,500 · coordinadora 4,000) para que el motor siga
//     anclado al Excel aunque cambien los valores por defecto.
//  2) Controles con los valores por defecto vigentes (Oscar, 2026-09-08: nuevo 4,500 ·
//     vendedor que sale 6,500 · jefe 8,000 · coordinadora 4,500).
// Los controles usan las ventas del modelo original: A=275000, B=160000.
import { costoSalida, PARAMS_DEFECTO } from '../public/js/modelo.js';

const EXCEL = { ...PARAMS_DEFECTO, salarioNuevo: 6500, salarioVendedor: 6500, salarioJefe: 6500, salarioCoord: 4000, mesesServicio: 12 };

const CONTROLES = [
  { nombre: 'Excel · Renuncia Tienda A (ventas 275k)', ventas: 275000, escenario: 'renuncia', p: EXCEL, esperado: 72262 },
  { nombre: 'Excel · Renuncia Tienda B (ventas 160k)', ventas: 160000, escenario: 'renuncia', p: EXCEL, esperado: 55012 },
  { nombre: 'Excel · Despido Tienda A (ventas 275k)', ventas: 275000, escenario: 'despido', p: EXCEL, esperado: 76762 },
  { nombre: 'Excel · Despido Tienda B (ventas 160k)', ventas: 160000, escenario: 'despido', p: EXCEL, esperado: 59512 },
  { nombre: 'Vigente · Renuncia Tienda A (ventas 275k)', ventas: 275000, escenario: 'renuncia', p: PARAMS_DEFECTO, esperado: 71294 },
  { nombre: 'Vigente · Renuncia Tienda B (ventas 160k)', ventas: 160000, escenario: 'renuncia', p: PARAMS_DEFECTO, esperado: 54044 },
  { nombre: 'Vigente · Despido Tienda A (ventas 275k)', ventas: 275000, escenario: 'despido', p: PARAMS_DEFECTO, esperado: 75794 },
  { nombre: 'Vigente · Despido Tienda B (ventas 160k)', ventas: 160000, escenario: 'despido', p: PARAMS_DEFECTO, esperado: 58544 },
];

let fallos = 0;
for (const c of CONTROLES) {
  const r = costoSalida(c.ventas, c.escenario, c.p);
  const obtenido = Math.round(r.total);
  const ok = obtenido === c.esperado;
  if (!ok) fallos++;
  console.log(`${ok ? '✓' : '✗'} ${c.nombre}: esperado Q${c.esperado.toLocaleString('es-GT')}, obtenido Q${obtenido.toLocaleString('es-GT')} (${r.total.toFixed(2)})`);
  const sumaComp = Object.values(r.composicion).reduce((a, b) => a + b, 0);
  if (Math.abs(sumaComp - r.total) > 0.01) {
    fallos++;
    console.log(`  ✗ La composición no suma el total: ${sumaComp.toFixed(2)} vs ${r.total.toFixed(2)}`);
  }
}

if (fallos) {
  console.error(`\n${fallos} control(es) fallaron — el bug está en la implementación, NO ajustar los controles.`);
  process.exit(1);
}
console.log('\nTodos los valores de control cuadran.');

// Valida que el motor reproduzca los valores de control acordados con Oscar
// (2026-09-01: sin Telo, canal Internet vigente, + jefe de RRHH Q8,000 al 100%
// repartido entre contrataciones del mes, coordinadora a Q4,000).
// Los controles usan las ventas del modelo original: A=275000, B=160000.
import { costoSalida } from '../public/js/modelo.js';

const CONTROLES = [
  { nombre: 'Renuncia Tienda A (ventas 275k)', ventas: 275000, escenario: 'renuncia', esperado: 72262 },
  { nombre: 'Renuncia Tienda B (ventas 160k)', ventas: 160000, escenario: 'renuncia', esperado: 55012 },
  { nombre: 'Despido Tienda A (ventas 275k)', ventas: 275000, escenario: 'despido', esperado: 76762 },
  { nombre: 'Despido Tienda B (ventas 160k)', ventas: 160000, escenario: 'despido', esperado: 59512 },
];

let fallos = 0;
for (const c of CONTROLES) {
  const r = costoSalida(c.ventas, c.escenario);
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

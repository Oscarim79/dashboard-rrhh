// Página Vacantes: cobertura, abiertas hoy, cierres por mes, interno/externo, canales.
import { cargarDatos, pintarPie, marcarNavActiva, fmtNum, fmtFecha } from './comun.js';
import { barrasH, columnas } from './graficas.js';

marcarNavActiva();
const { vacantes, meta } = await cargarDatos();
const A = vacantes.agregados;
const titulo = (s) => s ? s.charAt(0) + s.slice(1).toLowerCase() : s;

// ── KPIs ───────────────────────────────────────────────────────────────────
const abiertas = vacantes.filas.filter((r) => r.estatus === 'ABIERTA');
const masVieja = abiertas.reduce((m, r) => Math.max(m, r.diasAbierta ?? 0), 0);
document.getElementById('kpis').innerHTML = `
  <div class="kpi"><div class="kpi-valor">${fmtNum(abiertas.length)}</div><div class="kpi-eti">abiertas hoy</div></div>
  <div class="kpi"><div class="kpi-valor">${A.diasCobertura.global.mediana ?? '—'} días</div><div class="kpi-eti">mediana para cerrar (real)</div></div>
  <div class="kpi"><div class="kpi-valor">${A.diasCobertura.global.promedio ?? '—'} días</div><div class="kpi-eti">promedio para cerrar</div></div>
  <div class="kpi"><div class="kpi-valor ${masVieja > 30 ? 'rojo' : ''}">${fmtNum(masVieja)} días</div><div class="kpi-eti">la vacante abierta más antigua</div></div>`;

// ── abiertas hoy ───────────────────────────────────────────────────────────
const filasAb = [...abiertas].sort((a, b) => (b.diasAbierta ?? 0) - (a.diasAbierta ?? 0));
const COLOR_PROCESO = {
  'Contratado, por confirmar': 'verde',
  'En polígrafo': 'verde',
  'Propuesta hecha': 'verde',
  'En entrevistas': 'gris',
  'Publicada': 'gris',
  'Sin avance registrado': 'ambar',
};
document.getElementById('abiertas').innerHTML = filasAb.length ? `
  <table>
    <thead><tr><th>Tienda / lugar</th><th>Puesto</th><th>Empresa</th><th>Avance del proceso</th><th class="n">Días abierta</th></tr></thead>
    <tbody>${filasAb.map((r) => `
      <tr>
        <td>${r.lugar ?? '—'} ${r.tipo ? `<span class="pill gris">${r.tipo}</span>` : ''}</td>
        <td>${titulo(r.puesto) ?? '—'}</td>
        <td>${r.empresa ?? '—'}</td>
        <td>${r.proceso ? `<span class="pill ${COLOR_PROCESO[r.proceso] ?? 'gris'}">${r.proceso}</span>` : '—'}</td>
        <td class="n"><b style="${(r.diasAbierta ?? 0) > 30 ? 'color:var(--rojo)' : ''}">${r.diasAbierta ?? '—'}</b></td>
      </tr>`).join('')}
    </tbody>
  </table>
  <p class="pie">El avance se deriva automáticamente de las notas internas de RRHH (publicada → entrevistas → propuesta → polígrafo → contratado); las notas completas no se publican por privacidad.</p>`
  : '<p class="sub">No hay vacantes abiertas registradas.</p>';

// ── días por tipo ──────────────────────────────────────────────────────────
const ORDEN = ['AA', 'A', 'B', 'C', '(sin dato)'];
const porTipo = ORDEN
  .filter((t) => A.diasCobertura.porTipo[t]?.n)
  .map((t) => ({
    eti: t === '(sin dato)' ? 'Sin tipo / no tienda' : `Tipo ${t}`,
    valor: A.diasCobertura.porTipo[t].mediana,
    extra: `(n=${A.diasCobertura.porTipo[t].n})`,
  }));
document.getElementById('dias-tipo').innerHTML = barrasH(porTipo, { formato: (v) => `${v} días` });

// ── días por puesto (top 8 por frecuencia) ─────────────────────────────────
const puestos = Object.entries(A.diasCobertura.porPuesto)
  .filter(([k, v]) => k !== '(sin dato)' && v.n >= 3)
  .sort((a, b) => b[1].n - a[1].n).slice(0, 8)
  .map(([k, v]) => ({ eti: titulo(k), valor: v.mediana, extra: `(n=${v.n})` }));
document.getElementById('dias-puesto').innerHTML = barrasH(puestos, { formato: (v) => `${v} días` });

// ── cierres por mes (últimos 18 meses) ─────────────────────────────────────
const MES_CORTO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const cierres = Object.entries(A.cierresPorMes).slice(-18).map(([ym, n]) => {
  const [y, m] = ym.split('-');
  return { eti: `${MES_CORTO[+m - 1]} ${y.slice(2)}`, valor: n };
});
document.getElementById('cierres-mes').innerHTML = columnas(cierres, { formato: fmtNum });

// ── interno vs externo ─────────────────────────────────────────────────────
const ocupada = Object.entries(A.ocupadaPor).sort((a, b) => b[1] - a[1])
  .map(([k, v]) => ({ eti: k, valor: v, color: k.startsWith('Interno') ? '#0B7A55' : k === 'Referido' ? '#8FA69B' : '#46615A' }));
document.getElementById('ocupada-por').innerHTML = barrasH(ocupada, { formato: fmtNum });
const totalOcupada = ocupada.reduce((s, o) => s + o.valor, 0);
document.getElementById('ocupada-nota').textContent =
  `Registrado en ${fmtNum(totalOcupada)} de ${fmtNum(vacantes.filas.length)} vacantes; el resto no indica cómo se cubrió.`;

// ── canales ────────────────────────────────────────────────────────────────
const NOMBRE_CANAL = { redes: 'Redes de la empresa', facebook: 'Grupos de Facebook', volanteo: 'Volanteo', referidos: 'Programa de referidos', anuncios: 'Anuncios pagados', perifoneo: 'Perifoneo' };
const canales = Object.entries(A.canales)
  .map(([k, c]) => ({ eti: NOMBRE_CANAL[k], valor: c.si, extra: c.diasConCanal.n >= 3 ? `— con canal: ${c.diasConCanal.mediana} días (n=${c.diasConCanal.n})` : '' }))
  .sort((a, b) => b.valor - a.valor);
document.getElementById('canales').innerHTML = barrasH(canales, { formato: (v) => `${fmtNum(v)} usos` });
document.getElementById('canales-nota').textContent =
  'Los canales se registran en pocas vacantes (empezó a llenarse en 2026), así que esta lectura es parcial: dice cuáles se usan, no todavía cuál cierra más rápido.';

pintarPie(meta);

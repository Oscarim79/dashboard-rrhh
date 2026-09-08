// Página Vacantes: cobertura, abiertas hoy, cierres por mes, interno/externo, canales.
// Se redibuja con los selectores General / Comercial y de período. Una vacante
// pertenece al período por su fecha de solicitud; "abiertas hoy" no depende del período.
import { cargarDatos, pintarPie, marcarNavActiva, fmtNum,
  pintarSelectorDepto, vacantesDe, notaAlcance,
  pintarSelectorPeriodo, vacantesEnPeriodo, agregarVacantes, etiquetaPeriodo, aniosYMeses, fmtYmCorto } from './comun.js';
import { barrasH, columnas } from './graficas.js';

marcarNavActiva();
const datos = await cargarDatos();
const { meta } = datos;
const titulo = (s) => s ? s.charAt(0) + s.slice(1).toLowerCase() : s;
const COLOR_PROCESO = {
  'Contratado, por confirmar': 'verde',
  'En polígrafo': 'verde',
  'Propuesta hecha': 'verde',
  'En entrevistas': 'gris',
  'Publicada': 'gris',
  'Candidatos vistos, sin elegido': 'ambar',
  'En gestión, sin etapa anotada': 'gris',
  'Sin notas de RRHH aún': 'ambar',
};

function pintar(depto, periodo) {
  const vacantes = vacantesDe(datos.vacantes, depto);
  const filasP = vacantesEnPeriodo(vacantes.filas, periodo, vacantes.generado);
  const A = agregarVacantes(filasP);
  const etiP = etiquetaPeriodo(periodo, vacantes.generado);
  document.getElementById('alcance').innerHTML = notaAlcance(depto) + (depto === 'comercial'
    ? ' El departamento de cada vacante se deduce del puesto: la pestaña del sheet no lo trae.' : '');
  document.getElementById('h-dias').textContent = `Días para cubrir una vacante (mediana, cerradas · ${etiP})`;
  document.getElementById('h-cierres').textContent = `Cierres por mes · vacantes solicitadas en ${etiP}`;
  document.getElementById('h-como').textContent = `Cómo se cubren · ${etiP}`;

  // ── KPIs (abiertas hoy: siempre todas, sin importar el período) ───────────
  const abiertas = vacantes.filas.filter((r) => r.estatus === 'ABIERTA');
  const masVieja = abiertas.reduce((m, r) => Math.max(m, r.diasAbierta ?? 0), 0);
  document.getElementById('kpis').innerHTML = `
    <div class="kpi"><div class="kpi-valor">${fmtNum(abiertas.length)}</div><div class="kpi-eti">abiertas hoy</div></div>
    <div class="kpi"><div class="kpi-valor">${A.diasCobertura.global.mediana ?? '—'} días</div><div class="kpi-eti">mediana para cerrar (real)</div><div class="kpi-nota">${A.diasCobertura.global.n === 1 ? '1 cerrada' : `${fmtNum(A.diasCobertura.global.n)} cerradas`} con dato · ${etiP}</div></div>
    <div class="kpi"><div class="kpi-valor">${A.diasCobertura.global.promedio ?? '—'} días</div><div class="kpi-eti">promedio para cerrar</div><div class="kpi-nota">${etiP}</div></div>
    <div class="kpi"><div class="kpi-valor ${masVieja > 30 ? 'rojo' : ''}">${fmtNum(masVieja)} días</div><div class="kpi-eti">la vacante abierta más antigua</div></div>`;

  // ── abiertas hoy ───────────────────────────────────────────────────────────
  const filasAb = [...abiertas].sort((a, b) => (b.diasAbierta ?? 0) - (a.diasAbierta ?? 0));
  document.getElementById('abiertas').innerHTML = filasAb.length ? `
    <table>
      <thead><tr><th>Tienda / lugar</th><th>Puesto</th><th>Empresa</th>${depto === 'general' ? '<th>Departamento</th>' : ''}<th>Avance del proceso</th><th class="n">Días abierta</th></tr></thead>
      <tbody>${filasAb.map((r) => `
        <tr>
          <td>${r.lugar ?? '—'} ${r.tipo ? `<span class="pill gris">${r.tipo}</span>` : ''}</td>
          <td>${titulo(r.puesto) ?? '—'}</td>
          <td>${r.empresa ?? '—'}</td>
          ${depto === 'general' ? `<td>${titulo(r.departamento ?? '') || '—'}</td>` : ''}
          <td>${r.proceso ? `<span class="pill ${COLOR_PROCESO[r.proceso] ?? 'gris'}">${r.proceso}</span>` : '—'}</td>
          <td class="n"><b style="${(r.diasAbierta ?? 0) > 30 ? 'color:var(--rojo)' : ''}">${r.diasAbierta ?? '—'}</b></td>
        </tr>`).join('')}
      </tbody>
    </table>
    <p class="pie">Las abiertas son las de hoy, sin importar el período elegido. El avance se deriva automáticamente de las notas internas de RRHH (publicada → entrevistas → propuesta → polígrafo → contratado). "Candidatos vistos, sin elegido" significa que sí hubo gestiones pero los perfiles no cuajaron; "en gestión, sin etapa anotada" es que la nota describe la causa de la vacante, no el proceso. Las notas completas no se publican por privacidad.</p>`
    : '<p class="sub">No hay vacantes abiertas registradas con este alcance.</p>';

  // ── días por tipo ──────────────────────────────────────────────────────────
  const ORDEN = ['AA', 'A', 'B', 'C', '(sin dato)'];
  const porTipo = ORDEN
    .filter((t) => A.diasCobertura.porTipo[t]?.n)
    .map((t) => ({
      eti: t === '(sin dato)' ? 'Sin tipo / no tienda' : `Tipo ${t}`,
      valor: A.diasCobertura.porTipo[t].mediana,
      extra: `(n=${A.diasCobertura.porTipo[t].n})`,
    }));
  document.getElementById('dias-tipo').innerHTML = porTipo.length ? barrasH(porTipo, { formato: (v) => `${v} días` }) : `<p class="sub">Sin vacantes cerradas con dato en ${etiP}.</p>`;

  // ── días por puesto (top 8 por frecuencia) ─────────────────────────────────
  const puestos = Object.entries(A.diasCobertura.porPuesto)
    .filter(([k, v]) => k !== '(sin dato)' && v.n >= 3)
    .sort((a, b) => b[1].n - a[1].n).slice(0, 8)
    .map(([k, v]) => ({ eti: titulo(k), valor: v.mediana, extra: `(n=${v.n})` }));
  document.getElementById('dias-puesto').innerHTML = puestos.length ? barrasH(puestos, { formato: (v) => `${v} días` }) : `<p class="sub">Ningún puesto con 3 o más vacantes cerradas en ${etiP}.</p>`;

  // ── cierres por mes (de las vacantes del período; hasta 18 meses) ──────────
  const cierres = Object.entries(A.cierresPorMes).slice(-18).map(([ym, n]) => ({ eti: fmtYmCorto(ym), valor: n }));
  document.getElementById('cierres-mes').innerHTML = columnas(cierres, { formato: fmtNum });

  // ── interno vs externo ─────────────────────────────────────────────────────
  const ocupada = Object.entries(A.ocupadaPor).sort((a, b) => b[1] - a[1])
    .map(([k, v]) => ({ eti: k, valor: v, color: k.startsWith('Interno') ? '#0B7A55' : k === 'Referido' ? '#8FA69B' : '#46615A' }));
  document.getElementById('ocupada-por').innerHTML = ocupada.length ? barrasH(ocupada, { formato: fmtNum }) : '<p class="sub">Sin datos en este período.</p>';
  const totalOcupada = ocupada.reduce((s, o) => s + o.valor, 0);
  document.getElementById('ocupada-nota').textContent =
    `Registrado en ${fmtNum(totalOcupada)} de ${fmtNum(filasP.length)} vacantes de ${etiP}; el resto no indica cómo se cubrió.`;

  // ── canales ────────────────────────────────────────────────────────────────
  const NOMBRE_CANAL = { redes: 'Redes de la empresa', facebook: 'Grupos de Facebook', volanteo: 'Volanteo', referidos: 'Programa de referidos', anuncios: 'Anuncios pagados', perifoneo: 'Perifoneo' };
  const canales = Object.entries(A.canales)
    .map(([k, c]) => ({ eti: NOMBRE_CANAL[k], valor: c.si, extra: c.diasConCanal.n >= 3 ? `— con canal: ${c.diasConCanal.mediana} días (n=${c.diasConCanal.n})` : '' }))
    .sort((a, b) => b.valor - a.valor);
  document.getElementById('canales').innerHTML = canales.some((c) => c.valor) ? barrasH(canales, { formato: (v) => `${fmtNum(v)} usos` }) : `<p class="sub">Sin canales registrados en ${etiP}.</p>`;
  document.getElementById('canales-nota').textContent =
    'Los canales se registran en pocas vacantes (empezó a llenarse en 2026), así que esta lectura es parcial: dice cuáles se usan, no todavía cuál cierra más rápido.';
}

let depto = pintarSelectorDepto((d) => { depto = d; pintar(depto, periodo); });
let periodo = pintarSelectorPeriodo({ ...aniosYMeses({ vacantes: datos.vacantes }), generado: datos.vacantes.generado },
  (p) => { periodo = p; pintar(depto, periodo); });
pintar(depto, periodo);
pintarPie(meta);

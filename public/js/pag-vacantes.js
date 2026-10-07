// Página Vacantes: cobertura, abiertas hoy, cierres por mes (interno/externo y canales: retirados, ver abajo).
// Se redibuja con los selectores General / Comercial y de período. Una vacante
// pertenece al período por su fecha de solicitud; "abiertas hoy" no depende del período.
import { cargarDatos, pintarPie, marcarNavActiva, fmtNum,
  pintarSelectorDepto, vacantesDe, notaAlcance,
  pintarSelectorPeriodo, vacantesEnPeriodo, agregarVacantes, etiquetaPeriodo, aniosYMeses, fmtYmCorto } from './comun.js';
import { barrasH, columnas, anchoDe } from './graficas.js';
import { DESCRIPCION_PROCESO, notaDePuesto } from './vacantes-notas.js';

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

  // ── KPIs (abiertas hoy: siempre todas, sin importar el período) ───────────
  const abiertas = vacantes.filas.filter((r) => r.estatus === 'ABIERTA');
  const masVieja = abiertas.reduce((m, r) => Math.max(m, r.diasAbierta ?? 0), 0);
  document.getElementById('kpis').innerHTML = `
    <div class="kpi"><div class="kpi-valor">${fmtNum(abiertas.length)}</div><div class="kpi-eti">abiertas hoy</div></div>
    <div class="kpi"><div class="kpi-valor">${A.diasCobertura.global.mediana ?? '—'} días</div><div class="kpi-eti">mediana para cerrar (real)</div><div class="kpi-nota">valor del medio: la mitad de las vacantes se cubrió en menos días y la otra mitad en más · ${A.diasCobertura.global.n === 1 ? '1 cerrada' : `${fmtNum(A.diasCobertura.global.n)} cerradas`} con dato · ${etiP}</div></div>
    <div class="kpi"><div class="kpi-valor">${A.diasCobertura.global.promedio ?? '—'} días</div><div class="kpi-eti">promedio para cerrar</div><div class="kpi-nota">suma de días ÷ vacantes; sube mucho si una se atasca · ${etiP}</div></div>
    <div class="kpi"><div class="kpi-valor ${masVieja > 30 ? 'rojo' : ''}">${fmtNum(masVieja)} días</div><div class="kpi-eti">la vacante abierta más antigua</div></div>`;

  // ── abiertas hoy ───────────────────────────────────────────────────────────
  const filasAb = [...abiertas].sort((a, b) => (b.diasAbierta ?? 0) - (a.diasAbierta ?? 0));
  document.getElementById('abiertas').innerHTML = filasAb.length ? `
    <table>
      <thead><tr><th>Tienda / lugar</th><th>Puesto</th><th>Empresa</th>${depto === 'general' ? '<th>Departamento</th>' : ''}<th>Avance del proceso</th><th class="n">Días abierta</th></tr></thead>
      <tbody>${filasAb.map((r) => `
        <tr>
          <td data-eti="Tienda / lugar">${r.lugar ?? '—'} ${r.tipo ? `<span class="pill gris">${r.tipo}</span>` : ''}</td>
          <td data-eti="Puesto">${titulo(r.puesto) ?? '—'}</td>
          <td data-eti="Empresa">${r.empresa ?? '—'}</td>
          ${depto === 'general' ? `<td data-eti="Departamento">${titulo(r.departamento ?? '') || '—'}</td>` : ''}
          <td class="proceso" data-eti="Avance del proceso">${r.proceso ? `<span class="pill ${COLOR_PROCESO[r.proceso] ?? 'gris'}">${r.proceso}</span>${DESCRIPCION_PROCESO[r.proceso] ? `<div class="proceso-desc">${DESCRIPCION_PROCESO[r.proceso]}</div>` : ''}` : '—'}${(() => { const n = notaDePuesto(r.puesto); return n ? `<div class="proceso-nota"><b>Por qué cuesta llenarla:</b> ${n.nota} <span class="fuente">(${n.fuente})</span></div>` : ''; })()}</td>
          <td class="n" data-eti="Días abierta"><b style="${(r.diasAbierta ?? 0) > 30 ? 'color:var(--rojo)' : ''}">${r.diasAbierta ?? '—'}</b></td>
        </tr>`).join('')}
      </tbody>
    </table>
    <p class="pie">Las abiertas son las de hoy, sin importar el período elegido. El avance se deriva automáticamente de las notas internas de RRHH (publicada → entrevistas → propuesta → polígrafo → contratado) y debajo de cada estado se explica qué significa. El recuadro "Por qué cuesta llenarla" es contexto que agrega RRHH a mano para los puestos difíciles de cubrir. Las notas completas del sheet no se publican por privacidad.</p>`
    : '<p class="sub">No hay vacantes abiertas registradas con este alcance.</p>';

  // ── días por tipo ──────────────────────────────────────────────────────────
  const ORDEN = ['AA', 'A', 'B', 'C', '(sin dato)'];
  const porTipo = ORDEN
    .filter((t) => A.diasCobertura.porTipo[t]?.n)
    .map((t) => ({
      eti: t === '(sin dato)' ? 'Sin tipo / no tienda' : `Tipo ${t}`,
      valor: A.diasCobertura.porTipo[t].mediana,
      extra: `· ${A.diasCobertura.porTipo[t].n === 1 ? '1 vacante cerrada' : `${fmtNum(A.diasCobertura.porTipo[t].n)} vacantes cerradas`}`,
    }));
  document.getElementById('dias-tipo').innerHTML = porTipo.length ? barrasH(porTipo, { formato: (v) => `${v} días`, ancho: anchoDe('dias-tipo') }) : `<p class="sub">Sin vacantes cerradas con dato en ${etiP}.</p>`;
  document.getElementById('dias-tipo-nota').innerHTML =
    `<b>Qué es la mediana:</b> el valor del medio. Si se ordenan las vacantes de la que se cubrió más rápido a la más lenta, la mediana es la que queda justo en el centro: la mitad se cubrió en menos días y la otra mitad en más. Ejemplo: cinco vacantes que tardaron 8, 10, 15, 20 y 90 días tienen mediana de 15 días; el promedio sería 29, arrastrado por la de 90. Por eso se usa la mediana: una vacante atascada no distorsiona la cifra. <b>Cómo leer la gráfica:</b> la barra es la mediana de días para cubrir una vacante de ese tipo de tienda, y el número junto a ella es cuántas vacantes cerradas, con fechas registradas, hay detrás de esa mediana: con pocas, la cifra es menos confiable. Período: ${etiP}.`;
  // ── días por puesto (top 8 por frecuencia) ─────────────────────────────────
  const puestos = Object.entries(A.diasCobertura.porPuesto)
    .filter(([k, v]) => k !== '(sin dato)' && v.n >= 3)
    .sort((a, b) => b[1].n - a[1].n).slice(0, 8)
    .map(([k, v]) => ({ eti: titulo(k), valor: v.mediana, extra: `· ${fmtNum(v.n)} vacantes cerradas` }));
  document.getElementById('dias-puesto').innerHTML = puestos.length ? barrasH(puestos, { formato: (v) => `${v} días`, ancho: anchoDe('dias-puesto') }) : `<p class="sub">Ningún puesto con 3 o más vacantes cerradas en ${etiP}.</p>`;
  document.getElementById('dias-puesto-nota').textContent =
    'Misma lectura: la barra es la mediana de días para cubrir el puesto (el valor del medio: la mitad de esas vacantes se cubrió en menos días y la otra mitad en más) y, al lado, cuántas vacantes cerradas la respaldan. Solo aparecen puestos con 3 o más vacantes cerradas en el período, para no sacar conclusiones de un caso suelto.';

  // ── cierres por mes (de las vacantes del período; hasta 18 meses) ──────────
  const cierres = Object.entries(A.cierresPorMes).slice(-18).map(([ym, n]) => ({ eti: fmtYmCorto(ym), valor: n }));
  document.getElementById('cierres-mes').innerHTML = columnas(cierres, { formato: fmtNum, ancho: anchoDe('cierres-mes') });

  // "Cómo se cubren" (interno vs. externo) y "Canales de atracción" se QUITARON del sitio (Oscar, 2026-10-07):
  // el registro tiene pocas vacantes con esos campos y la lectura era parcial. Los agregados siguen en
  // vacantes.json / agregarVacantes (ocupadaPor, canales) por si se retoman; la página deja una observación.
  document.getElementById('como-nota').textContent =
    `Observación: el sheet también registra cómo se cubrió cada vacante (interno, externo, referido) y qué canales de atracción se usaron, pero todavía en pocas filas (${fmtNum(Object.values(A.ocupadaPor).reduce((a, v) => a + v, 0))} de ${fmtNum(filasP.length)} vacantes del período indican cómo se cubrieron). Cuando haya más información se mostrará aquí qué canal cierra más rápido y cuánto se cubre desde adentro.`;
}

let depto = pintarSelectorDepto((d) => { depto = d; pintar(depto, periodo); });
let periodo = pintarSelectorPeriodo({ ...aniosYMeses({ vacantes: datos.vacantes }), generado: datos.vacantes.generado },
  (p) => { periodo = p; pintar(depto, periodo); });
pintar(depto, periodo);
pintarPie(meta);
// Las gráficas se dibujan al ancho real del contenedor (legibles en el teléfono); si cambia, se redibujan.
let anchoPrevio = window.innerWidth, temporizador = null;
window.addEventListener('resize', () => {
  clearTimeout(temporizador);
  temporizador = setTimeout(() => { if (Math.abs(window.innerWidth - anchoPrevio) > 40) { anchoPrevio = window.innerWidth; pintar(depto, periodo); } }, 150);
});

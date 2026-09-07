// Propuesta a Gerencia: capacitación y retención. Página de acceso abierto (sin
// contraseña, decisión del CEO 2026-09-07). Solo cargos, nunca nombres.
// Las cifras vivas salen de los JSON del tablero (alcance: departamento Comercial);
// las que RRHH carga a mano viven en propuesta-datos.js.
import { DATOS } from './propuesta-datos.js';
import { fmtQ } from './modelo.js';
import { fmtNum, salidasDe, vacantesDe, aplicarDesglose, SIN_DETALLE } from './comun.js';

const q = (id) => document.getElementById(id);
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
const MES_LARGO = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const fmtFechaLarga = (iso) => { if (!iso) return '—'; const [y, m, d] = iso.split('-').map(Number); return `${d} de ${MES_LARGO[m - 1]} de ${y}`; };

// ── modo "solo capacitador" (para mostrar esa parte al gerente comercial) ─────
const solo = new URLSearchParams(location.search).get('solo');
if (solo === 'capacitador') document.body.classList.add('solo-capacitador');

// ── datos vivos del tablero ───────────────────────────────────────────────────
const carga = (f) => fetch(`data/${f}`, { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
const [salidasTodo, vacantesTodo, integracionTodo, rotacion, meta] = await Promise.all([
  carga('salidas.json'), carga('vacantes.json'), carga('integracion.json'), carga('rotacion.json'), carga('meta.json'),
]);
const salidas = salidasTodo ? salidasDe(salidasTodo, 'comercial') : null;
const vacantes = vacantesTodo ? vacantesDe(vacantesTodo, 'comercial') : null;
const integracion = integracionTodo?.porDepartamento?.comercial ?? integracionTodo;
const S = DATOS.supuestos;

// ── 1.1 seguimiento a nuevos (control de integración, solo conteos) ───────────
try {
  const el = q('integracion');
  if (integracion?.total?.n) {
    const T = integracion.total, U = integracion.ult12m;
    const fila = (eti, b) => `<tr><td>${eti}</td><td class="n">${pct(b.si, T.n)}%</td><td class="n">${pct(b.no, T.n)}%</td><td class="n">${pct(b.sinMarcar, T.n)}%</td></tr>`;
    el.innerHTML = `
      <p>El control de integración de RRHH registra <b>${fmtNum(T.n)} ingresos comerciales</b> desde ${fmtFechaLarga(integracion.desde)}
        (${fmtNum(U.n)} en los últimos 12 meses) y marca si se hizo cada llamada de seguimiento:</p>
      <div class="tabla-scroll"><table>
        <thead><tr><th>Llamada</th><th class="n">Hecha</th><th class="n">No hecha</th><th class="n">Sin marcar</th></tr></thead>
        <tbody>${fila('Primera semana', T.l1)}${fila('A los 20 días', T.l20)}${fila('A los 40 días', T.l40)}${fila('A los 60 días', T.l60)}</tbody>
      </table></div>
      <p class="pie">Porcentajes sobre los ${fmtNum(T.n)} ingresos registrados. "Sin marcar" incluye ingresos recientes que todavía no llegan a esa fecha. Solo conteos: la pestaña tiene nombres y respuestas, y de eso no se publica nada.</p>
      <p><b>Lo que sí queda registrado:</b> la llamada de seguimiento. <b>Lo que no se está haciendo por falta de tiempo:</b> el acompañamiento en tienda al nuevo — ver cómo trabaja, corregir y reforzar — que es lo que evita que se vaya en los primeros meses.</p>`;
  } else {
    el.innerHTML = '<p class="pie">El control de integración no está disponible en los datos publicados.</p>';
  }
} catch (e) { console.warn('integración', e); }

// ── 1.3 razones de salida ─────────────────────────────────────────────────────
try {
  if (salidas?.total?.n) {
    const D = salidas.total, U = salidas.ult12m;
    const meses = (d) => (d.diasLab.mediana != null ? (d.diasLab.mediana / 30.4).toFixed(1) : '—');
    const TEMP = ['MENOS 1 MES', 'DE 1 A 2 MESES', 'DE 2 A 4 MESES', 'DE 4 A 6 MESES'];
    const temp = TEMP.reduce((s, k) => s + (D.rango[k] ?? 0), 0);
    const generalMeses = salidasTodo.total ? (salidasTodo.total.diasLab.mediana / 30.4).toFixed(1) : null;
    q('permanencia').innerHTML = `
      <div class="kpi"><div class="kpi-valor">${meses(D)} meses</div><div class="kpi-eti">permanencia mediana al salir (Comercial, todo el registro: ${fmtNum(D.n)} salidas)</div>
        ${generalMeses ? `<div class="kpi-nota">Toda la empresa: ${generalMeses} meses (${fmtNum(salidasTodo.total.n)} salidas)</div>` : ''}</div>
      <div class="kpi"><div class="kpi-valor ${pct(temp, D.n) >= 50 ? 'rojo' : ''}">${pct(temp, D.n)}%</div><div class="kpi-eti">se va antes de cumplir 6 meses</div></div>
      <div class="kpi"><div class="kpi-valor">${meses(U)} meses</div><div class="kpi-eti">permanencia mediana, últimos 12 meses (${fmtNum(U.n)} salidas)</div></div>`;

    // qué tan capturada está la razón en el sheet (honestidad sobre el dato)
    const C = salidas.captura;
    if (C) {
      const t = C.total, u = C.ult12m;
      q('captura').innerHTML = `
        <h3>Qué tanto explica el registro por qué se va la gente</h3>
        <div class="tabla-scroll"><table>
          <thead><tr><th>Nivel de detalle en el registro de salidas (Comercial)</th><th class="n">Todo el registro (${fmtNum(t.n)})</th><th class="n">Últimos 12 meses (${fmtNum(u.n)})</th></tr></thead>
          <tbody>
            <tr><td>Tipo de salida (renuncia o despido)</td><td class="n">${pct(t.conTipo, t.n)}%</td><td class="n">${pct(u.conTipo, u.n)}%</td></tr>
            <tr><td>Motivo con contenido real (salario, ambiente, familia…)</td><td class="n">${pct(t.conSubMotivoReal, t.n)}%</td><td class="n">${pct(u.conSubMotivoReal, u.n)}%</td></tr>
            <tr><td>Solo en renuncias: motivo real</td><td class="n">${pct(t.renuncias.conSubMotivoReal, t.renuncias.n)}%</td><td class="n">${pct(u.renuncias.conSubMotivoReal, u.renuncias.n)}%</td></tr>
            <tr><td>Solo en renuncias: registrada apenas como "voluntaria", sin detalle</td><td class="n">${pct(t.renuncias.soloVoluntaria, t.renuncias.n)}%</td><td class="n">${pct(u.renuncias.soloVoluntaria, u.renuncias.n)}%</td></tr>
            <tr><td>Solo en despidos: motivo real</td><td class="n">${pct(t.despidos.conSubMotivoReal, t.despidos.n)}%</td><td class="n">${pct(u.despidos.conSubMotivoReal, u.despidos.n)}%</td></tr>
          </tbody>
        </table></div>
        <p class="pie">Por eso los motivos de arriba combinan el registro con el reparto de RRHH: las renuncias marcadas solo como "voluntaria" se asignan a salario, mejor oportunidad, clima laboral y descuentos con el conocimiento de los casos. La categoría "descuentos en salario" no existe en el registro.</p>`;
    }
  }
} catch (e) { console.warn('razones', e); }

// motivos de las renuncias: registro (solo renuncias, Comercial, todo el registro)
// + reparto de RRHH de las "voluntarias" (propuesta-datos.js)
try {
  const subR = salidas?.total?.subMotivoRenuncias;
  const des = aplicarDesglose(subR ?? {}, DATOS.desgloseVoluntaria);
  const total = des.items.reduce((s, i) => s + i.valor, 0);
  const max = Math.max(...des.items.map((i) => i.valor), 1);
  q('razones-meta').textContent = `Renuncias del departamento Comercial, todo el registro (${fmtNum(total)} con motivo). Motivos del registro de salidas más el reparto de RRHH de las renuncias marcadas solo como "voluntaria" ("mal trato" se cuenta como clima laboral). Fuente del reparto: ${DATOS.desgloseVoluntaria.fuente}.`;
  q('razones').innerHTML = des.items.map((i) => `
    <div class="razon">
      <div class="razon-eti">${i.eti}</div>
      <div class="razon-barra"><div style="width:${(i.valor / max) * 100}%; ${i.eti === SIN_DETALLE ? 'background:#C9CFC9' : ''}"></div></div>
      <div class="razon-val">${fmtNum(i.valor)} · ${pct(i.valor, total)}%</div>
    </div>`).join('');
  q('razones-aviso').innerHTML = des.resto > 0 && !DATOS.desgloseVoluntaria.cubreTodas
    ? `<b>Pendiente:</b> el reparto de RRHH cubre ${fmtNum(des.repartidas)} de las ${fmtNum(des.voluntarias)} renuncias "voluntarias"; ${fmtNum(des.resto)} siguen sin detalle. Se completa en el archivo de datos de la propuesta.`
    : (des.resto < 0 ? `<b>Ojo:</b> el reparto suma ${fmtNum(des.repartidas)} casos y solo hay ${fmtNum(des.voluntarias)} renuncias "voluntarias".` : '');
} catch (e) { console.warn('motivos', e); }

// ── 2. costos de las propuestas ───────────────────────────────────────────────
try {
  // contrataciones comerciales por mes: personas contratadas según el indicador de
  // rotación mensual de RRHH (departamento COMERCIAL, últimos 12 meses con dato)
  let nuevosMes = null, notaNuevos = 'sin dato';
  const MES_CORTO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const mensualCom = (rotacion?.mensual ?? []).filter((r) => r.departamento === 'COMERCIAL')
    .sort((a, b) => a.anio - b.anio || a.mesNum - b.mesNum).slice(-12);
  if (mensualCom.length >= 6) {
    const altas = mensualCom.reduce((s, r) => s + (r.altas ?? 0), 0);
    nuevosMes = altas / mensualCom.length;
    const a = mensualCom[0], z = mensualCom.at(-1);
    notaNuevos = `${fmtNum(altas)} personas contratadas en Comercial de ${MES_CORTO[a.mesNum - 1]} ${a.anio} a ${MES_CORTO[z.mesNum - 1]} ${z.anio}, según el indicador de rotación`;
  } else if (integracion?.ult12m?.n) {
    nuevosMes = integracion.ult12m.n / 12;
    notaNuevos = `${fmtNum(integracion.ult12m.n)} ingresos en el control de integración en 12 meses`;
  }
  const f = S.factorPrestaciones;
  const p1 = S.reemplazarEnGarantias ? S.sueldoReemplazoGarantias * f : 0;
  const p2 = S.sueldoComodin * f;
  const bonoTotal = S.regiones * S.bonoCapacitador;
  const comisionDia = S.comisionPromedio / S.diasLaborales;
  const nuevos = nuevosMes ?? 0;
  // variante A: garantía de comisión promedio en los días de capacitación
  const garantiaTope = nuevos * S.diasCapacitacion * comisionDia;                       // si no vendiera nada mientras capacita
  const garantiaEsperada = garantiaTope * (1 - S.pctVentaMientrasCapacita);             // si logra parte de sus ventas
  // variante B: comisión compartida (no hay costo fijo; se acredita parte de la comisión del nuevo)
  // variante C: bono por retención
  const bonoRetencion = nuevos * S.bonoPorNuevoRetenido;

  q('p1-costo').innerHTML = S.reemplazarEnGarantias
    ? `<b>${fmtQ(p1)}/mes</b> con prestaciones, si se reemplaza la plaza en Garantías (sueldo de reemplazo ${fmtQ(S.sueldoReemplazoGarantias)}, supuesto editable). La persona trasladada conserva su sueldo actual, así que ese no es costo nuevo.`
    : '<b>Sin costo nuevo de sueldo</b>: es un traslado interno y la plaza de Garantías no se reemplaza (supuesto editable).';
  q('p2-costo').innerHTML = `<b>${fmtQ(p2)}/mes</b> con prestaciones (sueldo ${fmtQ(S.sueldoComodin)} × ${f}, mismo perfil y sueldo que la propuesta anterior; supuesto editable).`;

  q('p3-param').innerHTML = `
    <p>Supuestos para costear (editables en el archivo de datos; los marcados con ⚠ los confirma RRHH):</p>
    <ul>
      <li>${S.regiones} regiones → ${S.regiones} capacitadores; bono <b>${fmtQ(S.bonoCapacitador)}/mes</b> cada uno = <b>${fmtQ(bonoTotal)}/mes</b>.</li>
      <li>⚠ Comisión promedio de un vendedor: ${fmtQ(S.comisionPromedio)}/mes (≈ ${fmtQ(comisionDia)} por día laboral, ${S.diasLaborales} días).</li>
      <li>⚠ Días de capacitación por cada nuevo: ${S.diasCapacitacion}.</li>
      <li>Nuevos por mes en Comercial: ${nuevosMes != null ? `<b>${nuevosMes.toFixed(1)}</b> (${notaNuevos})` : 'sin dato'}; entre ${S.regiones} regiones, ${nuevosMes != null ? (nuevosMes / S.regiones).toFixed(1) : '—'} por región al mes.</li>
    </ul>`;

  q('var-a-costo').innerHTML = `Costo estimado: entre <b>${fmtQ(garantiaEsperada)}</b> y <b>${fmtQ(garantiaTope)}</b> al mes en garantías (el tope es si el capacitador no vendiera nada mientras capacita; lo esperado asume que logra ${Math.round(S.pctVentaMientrasCapacita * 100)}% de sus ventas). Más el bono: <b>${fmtQ(bonoTotal + garantiaEsperada)}–${fmtQ(bonoTotal + garantiaTope)}/mes</b>.`;
  q('var-b-costo').innerHTML = `Costo estimado: solo el bono, <b>${fmtQ(bonoTotal)}/mes</b>. La comisión compartida (${Math.round(S.pctComisionCompartida * 100)}% de lo que venda el nuevo mientras lo capacitan) sale de ventas que sin el nuevo no existirían, así que no es un gasto fijo. Riesgo: si el nuevo vende poco, el capacitador sí pierde ingreso.`;
  q('var-c-costo').innerHTML = `Costo estimado: bono <b>${fmtQ(bonoTotal)}/mes</b> + <b>${fmtQ(S.bonoPorNuevoRetenido)}</b> por cada nuevo que llegue a 90 días (≈ ${fmtQ(bonoRetencion)}/mes si llegaran todos los ${nuevos.toFixed(1)} nuevos del mes; menos en la práctica). No cubre las ventas que deja de hacer mientras capacita.`;

  const p3Bajo = bonoTotal + garantiaEsperada, p3Alto = bonoTotal + garantiaTope;
  q('resumen-costos').innerHTML = `
    <div class="tabla-scroll"><table>
      <thead><tr><th>Propuesta</th><th class="n">Costo mensual</th><th class="n">Al año</th></tr></thead>
      <tbody>
        <tr><td>1. Asistente para el jefe de RRHH (traslado interno${S.reemplazarEnGarantias ? ', reemplazando la plaza en Garantías' : ', sin reemplazo'})</td><td class="n">${fmtQ(p1)}</td><td class="n">${fmtQ(p1 * 12)}</td></tr>
        <tr><td>2. Segundo comodín</td><td class="n">${fmtQ(p2)}</td><td class="n">${fmtQ(p2 * 12)}</td></tr>
        <tr><td>3. ${S.regiones} vendedores capacitadores (bono + garantía, variante A)</td><td class="n">${fmtQ(p3Bajo)}–${fmtQ(p3Alto)}</td><td class="n">${fmtQ(p3Bajo * 12)}–${fmtQ(p3Alto * 12)}</td></tr>
        <tr><td><b>Total</b></td><td class="n"><b>${fmtQ(p1 + p2 + p3Bajo)}–${fmtQ(p1 + p2 + p3Alto)}</b></td><td class="n"><b>${fmtQ((p1 + p2 + p3Bajo) * 12)}–${fmtQ((p1 + p2 + p3Alto) * 12)}</b></td></tr>
      </tbody>
    </table></div>
    <p class="pie">Los sueldos y la comisión promedio son supuestos editables (archivo de datos de la propuesta); el número de nuevos por mes sale del tablero. Para comparar: el tablero estima el costo de rotación del departamento Comercial en su Resumen.</p>`;
} catch (e) { console.warn('costos', e); }

// ── pie ───────────────────────────────────────────────────────────────────────
try {
  const g = new Date(meta?.generado ?? salidasTodo?.generado);
  q('pie-datos').textContent = `Cifras del tablero actualizadas el ${g.toLocaleDateString('es-GT', { day: 'numeric', month: 'long', year: 'numeric' })}. Alcance: departamento Comercial. Sin datos personales: solo cargos y conteos agregados.`;
} catch { /* sin meta */ }

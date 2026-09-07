// Propuesta a Gerencia: capacitación y retención. Página de acceso abierto (sin
// contraseña, decisión del CEO 2026-09-07). Solo cargos, nunca nombres.
// Las cifras vivas salen de los JSON del tablero (alcance: departamento Comercial);
// el reparto de motivos que RRHH carga a mano vive en propuesta-datos.js.
// Costos, remuneración e inversión NO van en la página: se discuten con el CEO.
import { DATOS } from './propuesta-datos.js';
import { fmtNum, salidasDe, aplicarDesglose, SIN_DETALLE, marcarNavActiva, MES_LARGO } from './comun.js';

marcarNavActiva();

const q = (id) => document.getElementById(id);
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);

// ── modo "solo capacitador" (para mostrar esa parte al gerente comercial) ─────
const solo = new URLSearchParams(location.search).get('solo');
if (solo === 'capacitador') document.body.classList.add('solo-capacitador');

// ── datos vivos del tablero ───────────────────────────────────────────────────
const carga = (f) => fetch(`data/${f}`, { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
const [salidasTodo, rotacion, meta] = await Promise.all([carga('salidas.json'), carga('rotacion.json'), carga('meta.json')]);
const salidas = salidasTodo ? salidasDe(salidasTodo, 'comercial') : null;
const DOC = DATOS.documento;

// ── 1.3 permanencia (Comercial, cifras vivas) ─────────────────────────────────
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
  }
} catch (e) { console.warn('permanencia', e); }

// ── 1.3 motivos de las renuncias: registro (solo renuncias, Comercial, todo el
// registro) + reparto de RRHH de las "voluntarias" (propuesta-datos.js) ────────
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

// ── 4. SSO (cifras del informe, en propuesta-datos.js → documento) ────────────
try {
  q('sso').innerHTML = `
    <div class="cifras3">
      <div><div class="cifra">${DOC.ssoTiendasCumplen} de ${DOC.tiendas}</div>tiendas cumplen todos los requisitos de SSO: en cualquier inspección de MINTRAB o IGSS hay hallazgos</div>
      <div><div class="cifra">${DOC.ssoSinVIH} de ${DOC.tiendas}</div>tiendas sin la capacitación anual de VIH, obligatoria para todo el personal</div>
      <div><div class="cifra">15 meses</div>lleva el informe de SSO (cotizado en junio de 2025) sin ejecutarse, porque no hay quién le dé seguimiento constante</div>
    </div>
    <p>Fallas por requisito: señalización de punto de reunión 100%, botiquín 98%, plan de evacuación 95%, cinta antideslizante 91%, monitores 44%, plan de riesgos 35%, extintores 14%. Frio Tec y las tiendas Abi Q no tienen ninguna implementación.</p>
    <p><b>La rotación borra las capacitaciones:</b> tiendas que cumplían en junio ya aparecen sin la capacitación en el seguimiento de septiembre porque la gente capacitada se fue. Ese costo de repetir capacitaciones aún no está en el modelo de costo.</p>`;
} catch (e) { console.warn('sso', e); }

// ── 5. referencia de industria (plantilla viva del indicador de rotación) ─────
try {
  const cierre = (rotacion?.acumulado ?? []).filter((r) => r.area === 'TOTAL EMPRESA' && r.fin != null).sort((a, b) => a.anio - b.anio || a.mesNum - b.mesNum).at(-1);
  const plantilla = cierre?.fin;
  const [bMin, bMax] = DOC.benchmarkRango;
  const hoyRatio = plantilla ? (DOC.personasRRHH / plantilla) * 100 : null;
  const conRatio = plantilla ? ((DOC.personasRRHH + DOC.personasNuevasRRHH) / plantilla) * 100 : null;
  q('benchmark').innerHTML = `
    <div class="cifras3">
      <div><div class="cifra">${hoyRatio != null ? hoyRatio.toFixed(1) : '—'}</div>personas de RRHH por cada 100 colaboradores hoy (${DOC.personasRRHH} personas${plantilla ? ` para ${fmtNum(plantilla)} colaboradores al cierre de ${MES_LARGO[cierre.mesNum - 1]} ${cierre.anio}` : ''})</div>
      <div><div class="cifra">${bMin}–${bMax}</div>rango de referencia del sector (SHRM, ADP, Indeed); las empresas con alta rotación están en la parte alta</div>
      <div><div class="cifra">${conRatio != null ? conRatio.toFixed(1) : '—'}</div>con la propuesta (${DOC.personasRRHH + DOC.personasNuevasRRHH} personas): dentro del rango, no arriba. Los capacitadores siguen siendo vendedores</div>
    </div>
    <p>Las cadenas grandes del país separan reclutamiento de generalista de RRHH, y la más parecida en tamaño se apoya en un RRHH corporativo. La propuesta no infla el área; la lleva al tamaño normal de una operación como la nuestra.</p>`;
} catch (e) { console.warn('benchmark', e); }

// ── pie ───────────────────────────────────────────────────────────────────────
try {
  const g = new Date(meta?.generado ?? salidasTodo?.generado);
  q('pie-datos').textContent = `Cifras del tablero actualizadas el ${g.toLocaleDateString('es-GT', { day: 'numeric', month: 'long', year: 'numeric' })}. Alcance: departamento Comercial. Sin datos personales: solo cargos y conteos agregados.`;
} catch { /* sin meta */ }

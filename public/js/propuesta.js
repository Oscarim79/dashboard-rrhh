// Propuesta a Gerencia: capacitación y retención. Página de acceso abierto (sin
// contraseña, decisión del CEO 2026-09-07). Solo cargos, nunca nombres.
// Las cifras vivas salen de los JSON del tablero (alcance: departamento Comercial);
// el reparto de motivos que RRHH carga a mano vive en propuesta-datos.js.
// Costos, remuneración e inversión NO van en la página: se discuten con el CEO.
import { DATOS } from './propuesta-datos.js';
import { fmtNum, salidasDe, aplicarDesglose, SIN_DETALLE, marcarNavActiva, MES_LARGO,
  pintarSelectorPeriodo, dimsSalidas, etiquetaPeriodo, aniosYMeses } from './comun.js';

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

// ── 1.3 motivos de salida: TODAS las salidas del departamento Comercial (renuncias
// y despidos), tal como las registra RRHH en el Sheet; cada motivo por separado.
// Selector de período propio (pedido del CEO): todo · 12 meses · año · mes ────────
try {
  const pintarRazones = (p) => {
    const D = dimsSalidas(salidas, p);
    const etiP = etiquetaPeriodo(p, salidas.generado);
    // el reparto manual de "voluntarias" (si lo hubiera) solo aplica a todo el registro
    const des = aplicarDesglose(D.subMotivo ?? {}, p === 'todo' ? DATOS.desgloseVoluntaria : null);
    const total = des.items.reduce((s, i) => s + i.valor, 0);
    const max = Math.max(...des.items.map((i) => i.valor), 1);
    q('razones-titulo').textContent = `Por qué se van (cada motivo por separado) · ${etiP}`;
    q('razones-meta').textContent = total
      ? `Salidas del departamento Comercial, ${etiP} (${fmtNum(total)} con motivo, renuncias y despidos), según el registro de salidas de RRHH. Motivos con menos de 3 casos en el período van en "Otros".`
      : `Sin salidas comerciales con motivo registrado en ${etiP}.`;
    q('razones-nota').textContent = des.notaAgrupaciones;
    q('razones').innerHTML = des.items.map((i) => `
      <div class="razon">
        <div class="razon-eti">${i.eti}</div>
        <div class="razon-barra"><div style="width:${(i.valor / max) * 100}%; ${i.eti === SIN_DETALLE ? 'background:#C9CFC9' : ''}"></div></div>
        <div class="razon-val">${fmtNum(i.valor)} · ${pct(i.valor, total)}%</div>
      </div>`).join('');
  };
  if (salidas?.total) {
    const inicial = pintarSelectorPeriodo(
      { ...aniosYMeses({ salidas }), generado: salidas.generado, contenedor: q('razones-periodo'), guardar: false, inicial: 'todo' },
      pintarRazones);
    pintarRazones(inicial);
  }
} catch (e) { console.warn('motivos', e); }

// ── Propuesta 4: cultura. Salidas comerciales cuyo motivo es clima laboral, mal ambiente,
// mal trato o mala actitud (registro de salidas, cifras vivas; todo el registro y 12 meses) ──
try {
  const CULTURA = ['CLIMA LABORAL', 'MAL AMBIENTE', 'MAL TRATO', 'MALA ACTITUD'];
  const cuenta = (d) => CULTURA.reduce((s, k) => s + (d?.subMotivo?.[k] ?? 0), 0);
  if (salidas?.total?.n) {
    const T = salidas.total, U = salidas.ult12m ?? { n: 0, subMotivo: {} };
    const cT = cuenta(T), cU = cuenta(U);
    const sU = (U.subMotivo?.SALARIO ?? 0) + (U.subMotivo?.['POR SALARIO'] ?? 0);
    const vsSalario = sU ? (cU > sU ? `más que las ${fmtNum(sU)} que se fueron por salario` : `frente a ${fmtNum(sU)} que se fueron por salario`) : '';
    q('cultura-cifras').innerHTML = `
      <div><div class="cifra">${fmtNum(cT)} de ${fmtNum(T.n)}</div>salidas comerciales de todo el registro (${pct(cT, T.n)}%) se fueron por clima laboral, mal trato o mala actitud</div>
      <div><div class="cifra">${fmtNum(cU)} de ${fmtNum(U.n)}</div>en los últimos 12 meses (${pct(cU, U.n)}%)${vsSalario ? `, ${vsSalario}` : ''}</div>
      <div><div class="cifra">0</div>indicadores del área comercial miden hoy el ambiente de una tienda</div>`;
  }
} catch (e) { console.warn('cultura', e); }

// ── Conclusión: una sola línea con cifras vivas (Comercial, últimos 12 meses) ──
try {
  if (salidas?.ult12m?.n) {
    const U = salidas.ult12m;
    const TEMP = ['MENOS 1 MES', 'DE 1 A 2 MESES', 'DE 2 A 4 MESES', 'DE 4 A 6 MESES'];
    const temp = TEMP.reduce((s, k) => s + (U.rango[k] ?? 0), 0);
    const sal = (U.subMotivo?.SALARIO ?? 0) + (U.subMotivo?.['POR SALARIO'] ?? 0);
    const cli = ['CLIMA LABORAL', 'MAL AMBIENTE', 'MAL TRATO', 'MALA ACTITUD'].reduce((s, k) => s + (U.subMotivo?.[k] ?? 0), 0);
    q('conclusion-dato').innerHTML = `En los últimos 12 meses, <b>${pct(sal + cli, U.n)}%</b> de las salidas comerciales fue por salario (${pct(sal, U.n)}%) o por clima y actitud (${pct(cli, U.n)}%), y <b>${pct(temp, U.n)}%</b> ocurrió antes de los seis meses. Las propuestas se dirigen a eso:`;
  }
} catch (e) { console.warn('conclusion', e); }

// ── 5. SSO (cifras del informe, en propuesta-datos.js → documento) ────────────
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

// ── 6. referencia de industria (plantilla viva del indicador de rotación) ─────
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

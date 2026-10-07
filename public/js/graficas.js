// Gráficas SVG mínimas, sin dependencias. Cada elemento codifica un dato.
// `ancho` es el ancho del viewBox: si se pasa el ancho real del contenedor (ver anchoDe), los textos
// se dibujan a su tamaño real en el teléfono en vez de encogerse con el SVG.
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

// Ancho real (px CSS) del contenedor de una gráfica, acotado: con él los textos quedan legibles en móvil.
export function anchoDe(el, { min = 300, max = 800 } = {}) {
  const w = (typeof el === 'string' ? document.getElementById(el) : el)?.clientWidth || 0;
  return w ? Math.max(min, Math.min(max, Math.round(w))) : max;
}

const grupoDetalle = (it) => it.detalle
  ? `<g class="con-detalle" tabindex="0" role="button" aria-label="${esc(it.eti)}: ${esc(it.detalle)}" data-detalle="${esc(it.detalle)}" data-titulo="${esc(it.titulo ?? it.eti)}">`
  : '';

// Barras horizontales: items = [{eti, valor, extra?, color?, detalle?}]
// `detalle`: texto que se muestra al pasar el cursor o tocar la fila (ver activarDetalles en comun.js).
// Con `ancho` angosto (< 480) la etiqueta va encima de la barra para que quepa completa.
export function barrasH(items, { formato = (v) => v, ancho = 800, colorDef = '#46615A' } = {}) {
  const max = Math.max(...items.map((i) => i.valor), 1);
  const apilado = ancho < 480;
  const filaH = apilado ? 46 : 34;
  const alto = items.length * filaH + 6;
  // apilado: etiqueta a la izquierda y cifra a la derecha en la misma línea, barra de ancho completo debajo
  // la zona de la cifra crece si hay texto extra ("82% de las bajas") para que no se corte
  const anchoCifra = Math.max(...items.map((i) => String(formato(i.valor)).length * 8.5 + (i.extra ? String(i.extra).length * 6.6 + 4 : 0)), 0) + 12;
  const zonaEti = apilado ? 0 : 210, zonaVal = apilado ? 0 : Math.max(110, Math.min(anchoCifra, ancho * 0.4));
  const zonaBarra = ancho - zonaEti - zonaVal;
  let s = `<svg viewBox="0 0 ${ancho} ${alto}" xmlns="http://www.w3.org/2000/svg" role="img">`;
  items.forEach((it, i) => {
    const y = i * filaH + 4;
    const w = Math.max((it.valor / max) * zonaBarra, 2);
    const cifra = `${esc(formato(it.valor))}${it.extra ? ` <tspan font-weight="400" fill="#5A6660">${esc(it.extra)}</tspan>` : ''}`;
    s += grupoDetalle(it);
    if (it.detalle) s += `<rect x="0" y="${y}" width="${ancho}" height="${filaH - 4}" fill="transparent"/>`;
    if (apilado) {
      s += `<text x="0" y="${y + 13}" font-size="13" fill="#17251F"${it.detalle ? ' class="eti-detalle"' : ''}>${esc(it.eti)}</text>`;
      s += `<text x="${ancho}" y="${y + 13}" text-anchor="end" font-size="13" font-weight="700" fill="#17251F" style="font-variant-numeric:tabular-nums">${cifra}</text>`;
      s += `<rect x="0" y="${y + 21}" width="${w}" height="14" rx="4" fill="${it.color ?? colorDef}"/>`;
    } else {
      s += `<text x="${zonaEti - 8}" y="${y + 17}" text-anchor="end" font-size="13" fill="#17251F"${it.detalle ? ' class="eti-detalle"' : ''}>${esc(it.eti)}</text>`;
      s += `<rect x="${zonaEti}" y="${y + 4}" width="${w}" height="18" rx="4" fill="${it.color ?? colorDef}"/>`;
      s += `<text x="${zonaEti + w + 8}" y="${y + 17}" font-size="13" font-weight="700" fill="#17251F" style="font-variant-numeric:tabular-nums">${cifra}</text>`;
    }
    if (it.detalle) s += '</g>';
  });
  return s + '</svg>';
}

// Columnas por mes: items = [{eti, valor, color?, valor2?, color2?, detalle?}] — etiquetas rotadas si son muchas.
// `valor2` dibuja una segunda columna más clara al lado (p. ej. contrataciones junto a bajas); su cifra
// va en el `detalle` (globo al tocar la columna) para no amontonar números.
export function columnas(items, { formato = (v) => v, ancho = 800, alto = 240, colorDef = '#0B7A55', color2Def = '#9CCBB7' } = {}) {
  if (!items.length) return '<p class="sub">Sin datos.</p>';
  const doble = items.some((i) => i.valor2 != null);
  const max = Math.max(...items.flatMap((i) => [i.valor, i.valor2 ?? 0]), 1);
  const margen = { arr: 24, aba: 46, izq: 8, der: 8 };
  const zw = ancho - margen.izq - margen.der;
  const zh = alto - margen.arr - margen.aba;
  const paso = zw / items.length;
  const bw = doble ? Math.min(paso * 0.36, 26) : Math.min(paso * 0.66, 48);
  const sep = doble ? Math.min(paso * 0.06, 4) : 0;
  const fuenteVal = paso < 30 ? 10 : 11.5, fuenteEti = paso < 30 ? 10 : 10.5;
  let s = `<svg viewBox="0 0 ${ancho} ${alto}" xmlns="http://www.w3.org/2000/svg" role="img">`;
  items.forEach((it, i) => {
    const x0 = margen.izq + i * paso;
    const anchoGrupo = doble ? bw * 2 + sep : bw;
    const x = x0 + (paso - anchoGrupo) / 2;
    const h = (it.valor / max) * zh;
    const y = margen.arr + zh - h;
    s += grupoDetalle(it);
    if (it.detalle) s += `<rect x="${x0}" y="0" width="${paso}" height="${alto}" fill="transparent"/>`;
    s += `<rect x="${x}" y="${y}" width="${bw}" height="${Math.max(h, 1)}" rx="3" fill="${it.color ?? colorDef}"/>`;
    if (doble) {
      const h2 = ((it.valor2 ?? 0) / max) * zh;
      s += `<rect x="${x + bw + sep}" y="${margen.arr + zh - h2}" width="${bw}" height="${Math.max(h2, 1)}" rx="3" fill="${it.color2 ?? color2Def}"/>`;
    }
    if (it.valor > 0) s += `<text x="${x + bw / 2}" y="${y - 5}" text-anchor="middle" font-size="${fuenteVal}" font-weight="700" fill="#17251F" style="font-variant-numeric:tabular-nums">${esc(formato(it.valor))}</text>`;
    s += `<text x="${x0 + paso / 2}" y="${alto - 30}" text-anchor="middle" font-size="${fuenteEti}" fill="#5A6660" transform="rotate(-38 ${x0 + paso / 2} ${alto - 30})">${esc(it.eti)}</text>`;
    if (it.detalle) s += '</g>';
  });
  return s + '</svg>';
}

// Líneas por serie: series = [{nombre, color, puntos:[valor|null]}] — eje X compartido.
// Opciones: `referencia` = {valor, eti, color?} dibuja una línea punteada horizontal (p. ej. la meta);
// `etiquetasFinales` escribe el último valor de cada serie junto a su último punto, con su color.
export function lineas(etiquetasX, series, { formato = (v) => v, ancho = 800, alto = 260, referencia = null, etiquetasFinales = false } = {}) {
  const valores = series.flatMap((s) => s.puntos.filter((p) => p != null));
  if (!valores.length) return '<p class="sub">Sin datos.</p>';
  const max = Math.max(...valores, referencia?.valor ?? 0, 0.0001) * (etiquetasFinales ? 1.08 : 1);
  const fuente = ancho < 480 ? 11 : 10.5;
  const margen = { arr: 16, aba: 34, izq: 44, der: etiquetasFinales ? 46 : 10 };
  const zw = ancho - margen.izq - margen.der;
  const zh = alto - margen.arr - margen.aba;
  const px = (i) => margen.izq + (etiquetasX.length === 1 ? zw / 2 : (i / (etiquetasX.length - 1)) * zw);
  const py = (v) => margen.arr + zh - (v / max) * zh;
  let s = `<svg viewBox="0 0 ${ancho} ${alto}" xmlns="http://www.w3.org/2000/svg" role="img">`;
  // rejilla horizontal ligera (4 líneas) con etiqueta
  for (let g = 0; g <= 4; g++) {
    const v = (max / 4) * g, y = py(v);
    s += `<line x1="${margen.izq}" y1="${y}" x2="${ancho - margen.der}" y2="${y}" stroke="#E3E1DB" stroke-width="1"/>`;
    s += `<text x="${margen.izq - 6}" y="${y + 4}" text-anchor="end" font-size="${fuente}" fill="#5A6660" style="font-variant-numeric:tabular-nums">${esc(formato(v))}</text>`;
  }
  etiquetasX.forEach((e, i) => {
    s += `<text x="${px(i)}" y="${alto - 12}" text-anchor="middle" font-size="${fuente}" fill="#5A6660">${esc(e)}</text>`;
  });
  if (referencia && referencia.valor != null) {
    const y = py(referencia.valor), c = referencia.color ?? '#A33B2E';
    s += `<line x1="${margen.izq}" y1="${y}" x2="${ancho - margen.der}" y2="${y}" stroke="${c}" stroke-width="1.5" stroke-dasharray="6 5"/>`;
    if (referencia.eti) s += `<text x="${margen.izq + 4}" y="${y - 5}" font-size="${fuente}" font-weight="600" fill="${c}">${esc(referencia.eti)}</text>`;
  }
  const finales = [];
  for (const serie of series) {
    const pts = serie.puntos.map((v, i) => (v == null ? null : `${px(i)},${py(v)}`));
    const trazos = [];
    let seg = [];
    for (const p of pts) { if (p == null) { if (seg.length) trazos.push(seg); seg = []; } else seg.push(p); }
    if (seg.length) trazos.push(seg);
    for (const t of trazos) {
      if (t.length > 1) s += `<polyline points="${t.join(' ')}" fill="none" stroke="${serie.color}" stroke-width="2.5" stroke-linejoin="round"/>`;
      for (const p of t) { const [x, y] = p.split(','); s += `<circle cx="${x}" cy="${y}" r="3" fill="${serie.color}"/>`; }
    }
    const iUlt = serie.puntos.map((v, i) => (v == null ? -1 : i)).reduce((a, b) => Math.max(a, b), -1);
    if (etiquetasFinales && iUlt >= 0) finales.push({ x: px(iUlt), y: py(serie.puntos[iUlt]), texto: formato(serie.puntos[iUlt]), color: serie.color });
  }
  // etiquetas finales: separadas al menos 13px para que no se pisen
  finales.sort((a, b) => a.y - b.y);
  for (let i = 1; i < finales.length; i++) if (finales[i].y - finales[i - 1].y < 13) finales[i].y = finales[i - 1].y + 13;
  for (const f of finales) {
    s += `<text x="${f.x + 7}" y="${f.y + 4}" font-size="${fuente + 1}" font-weight="700" fill="${f.color}" style="font-variant-numeric:tabular-nums">${esc(f.texto)}</text>`;
  }
  return s + '</svg>';
}

export function leyenda(items) {
  return `<div class="leyenda">${items.map((i) => `<span><i style="background:${i.color}"></i>${esc(i.eti)}</span>`).join('')}</div>`;
}

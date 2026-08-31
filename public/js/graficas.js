// Gráficas SVG mínimas, sin dependencias. Cada elemento codifica un dato.
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

// Barras horizontales: items = [{eti, valor, extra?, color?}]
export function barrasH(items, { formato = (v) => v, ancho = 800, colorDef = '#46615A' } = {}) {
  const alto = items.length * 34 + 6;
  const max = Math.max(...items.map((i) => i.valor), 1);
  const zonaEti = 210, zonaVal = 110;
  const zonaBarra = ancho - zonaEti - zonaVal;
  let s = `<svg viewBox="0 0 ${ancho} ${alto}" xmlns="http://www.w3.org/2000/svg" role="img">`;
  items.forEach((it, i) => {
    const y = i * 34 + 4;
    const w = Math.max((it.valor / max) * zonaBarra, 2);
    s += `<text x="${zonaEti - 8}" y="${y + 17}" text-anchor="end" font-size="13" fill="#17251F">${esc(it.eti)}</text>`;
    s += `<rect x="${zonaEti}" y="${y + 4}" width="${w}" height="18" rx="4" fill="${it.color ?? colorDef}"/>`;
    s += `<text x="${zonaEti + w + 8}" y="${y + 17}" font-size="13" font-weight="700" fill="#17251F" style="font-variant-numeric:tabular-nums">${esc(formato(it.valor))}${it.extra ? ` <tspan font-weight="400" fill="#5A6660">${esc(it.extra)}</tspan>` : ''}</text>`;
  });
  return s + '</svg>';
}

// Columnas por mes: items = [{eti, valor, color?}] — etiquetas rotadas si son muchas
export function columnas(items, { formato = (v) => v, ancho = 800, alto = 240, colorDef = '#0B7A55' } = {}) {
  if (!items.length) return '<p class="sub">Sin datos.</p>';
  const max = Math.max(...items.map((i) => i.valor), 1);
  const margen = { arr: 24, aba: 46, izq: 8, der: 8 };
  const zw = ancho - margen.izq - margen.der;
  const zh = alto - margen.arr - margen.aba;
  const paso = zw / items.length;
  const bw = Math.min(paso * 0.66, 48);
  let s = `<svg viewBox="0 0 ${ancho} ${alto}" xmlns="http://www.w3.org/2000/svg" role="img">`;
  items.forEach((it, i) => {
    const h = (it.valor / max) * zh;
    const x = margen.izq + i * paso + (paso - bw) / 2;
    const y = margen.arr + zh - h;
    s += `<rect x="${x}" y="${y}" width="${bw}" height="${Math.max(h, 1)}" rx="3" fill="${it.color ?? colorDef}"/>`;
    if (it.valor > 0) s += `<text x="${x + bw / 2}" y="${y - 6}" text-anchor="middle" font-size="11.5" font-weight="700" fill="#17251F" style="font-variant-numeric:tabular-nums">${esc(formato(it.valor))}</text>`;
    s += `<text x="${x + bw / 2}" y="${alto - 30}" text-anchor="middle" font-size="10.5" fill="#5A6660" transform="rotate(-38 ${x + bw / 2} ${alto - 30})">${esc(it.eti)}</text>`;
  });
  return s + '</svg>';
}

// Líneas por serie: series = [{nombre, color, puntos:[{x eti, y valor|null}]}] — eje X compartido
export function lineas(etiquetasX, series, { formato = (v) => v, ancho = 800, alto = 260 } = {}) {
  const valores = series.flatMap((s) => s.puntos.filter((p) => p != null));
  if (!valores.length) return '<p class="sub">Sin datos.</p>';
  const max = Math.max(...valores, 0.0001);
  const margen = { arr: 16, aba: 34, izq: 44, der: 10 };
  const zw = ancho - margen.izq - margen.der;
  const zh = alto - margen.arr - margen.aba;
  const px = (i) => margen.izq + (etiquetasX.length === 1 ? zw / 2 : (i / (etiquetasX.length - 1)) * zw);
  const py = (v) => margen.arr + zh - (v / max) * zh;
  let s = `<svg viewBox="0 0 ${ancho} ${alto}" xmlns="http://www.w3.org/2000/svg" role="img">`;
  // rejilla horizontal ligera (4 líneas) con etiqueta
  for (let g = 0; g <= 4; g++) {
    const v = (max / 4) * g, y = py(v);
    s += `<line x1="${margen.izq}" y1="${y}" x2="${ancho - margen.der}" y2="${y}" stroke="#E3E1DB" stroke-width="1"/>`;
    s += `<text x="${margen.izq - 6}" y="${y + 4}" text-anchor="end" font-size="10.5" fill="#5A6660" style="font-variant-numeric:tabular-nums">${esc(formato(v))}</text>`;
  }
  etiquetasX.forEach((e, i) => {
    s += `<text x="${px(i)}" y="${alto - 12}" text-anchor="middle" font-size="10.5" fill="#5A6660">${esc(e)}</text>`;
  });
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
  }
  return s + '</svg>';
}

export function leyenda(items) {
  return `<div class="leyenda">${items.map((i) => `<span><i style="background:${i.color}"></i>${esc(i.eti)}</span>`).join('')}</div>`;
}

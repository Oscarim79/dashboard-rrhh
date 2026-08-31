// Modelo de costo de rotación por tipo de tienda.
// Replica el Excel de referencia de Oscar (versión sin Telo, con Pauta en Redes,
// canal Internet vigente en ambos escenarios). Valores de control con ventas del
// modelo original (A=275000, B=160000):
//   renuncia A Q71,831 · renuncia B Q54,581 · despido A Q76,331 · despido B Q59,081
// El Excel usa 4.33 semanas/mes (no 4.3333) — cambiarlo rompe los controles.

export const SEMANAS_MES = 4.33;

export const PARAMS_DEFECTO = {
  salarioVendedor: 6500,
  salarioJefe: 6500,
  salarioCoord: 4500,
  diasVacante: 30,
  factorImpacto: 0.15,
  mesesCurva: 3,
  prodCurva: 0.5,
  semanasJefe: 8,
  pctJefe: 0.6,
  semanasCoord: 8,
  pctCoord: 0.8,
  probCoord: 0.5,
  overtime: 1500,
  retrabajo: 500,
  kit: 450,
  poligrafo: 3000,
  viaticos: 1500,
  pautaRedesMes: 5000,
  volanteoBimestre: 5000,
  radioBimestre: 2000,
  internetMes: 5000,
  contratacionesMes: 10,
  isRenuncia: 2000,
  aniosServicio: 1,
};

// Venta mensual representativa por tipo (punto medio de los rangos de Oscar,
// confirmado 2026-08-31): AA >1M · A 500k-1M · B 300-500k · C <300k. Editables en el Simulador.
export const VENTAS_TIPO = { AA: 1200000, A: 750000, B: 400000, C: 200000 };

export const ORDEN_TIPOS = ['AA', 'A', 'B', 'C'];

// Costo de una salida (una persona que se va y hay que reemplazar).
// ventas: venta mensual de la tienda · escenario: 'renuncia' | 'despido'
export function costoSalida(ventas, escenario, p = PARAMS_DEFECTO) {
  const iv = ventas * p.factorImpacto * (p.diasVacante / 30);
  const cp = p.salarioVendedor * p.mesesCurva * (1 - p.prodCurva);
  const jefe = (p.salarioJefe / SEMANAS_MES) * p.semanasJefe * p.pctJefe;
  const coord = (p.salarioCoord / SEMANAS_MES) * p.semanasCoord * p.pctCoord * p.probCoord;
  const atraccion =
    p.pautaRedesMes / p.contratacionesMes +
    p.volanteoBimestre / 2 / p.contratacionesMes +
    p.radioBimestre / 2 / p.contratacionesMes +
    p.internetMes / p.contratacionesMes;
  const salida = escenario === 'despido' ? p.salarioVendedor * p.aniosServicio : p.isRenuncia;

  const total = iv + cp + jefe + coord + p.overtime + p.retrabajo +
    p.kit + p.poligrafo + p.viaticos + atraccion + salida;

  return {
    iv, cp, jefe, coord, atraccion, salida, total,
    // Barra de composición del Resumen: 4 bloques que suman el total
    composicion: {
      productividad: iv + cp,                                        // ventas perdidas + curva
      cobertura: jefe + coord + p.overtime + p.retrabajo,            // el equipo tapa el hueco
      reclutamiento: p.kit + p.poligrafo + p.viaticos + atraccion,   // atraer y contratar
      salida,                                                        // finiquito / indemnización
    },
  };
}

// Costo ponderado por la mezcla renuncia/despido (fracciones que suman 1 sobre
// las salidas que sí cuestan; "otros" no entra al costo de rotación).
export function costoMezcla(ventas, pctRenuncia, pctDespido, p = PARAMS_DEFECTO) {
  const r = costoSalida(ventas, 'renuncia', p);
  const d = costoSalida(ventas, 'despido', p);
  return r.total * pctRenuncia + d.total * pctDespido;
}

export const fmtQ = (n) =>
  'Q' + new Intl.NumberFormat('es-GT', { maximumFractionDigits: 0 }).format(Math.round(n));

export const fmtPct = (x, dec = 1) =>
  new Intl.NumberFormat('es-GT', { minimumFractionDigits: dec, maximumFractionDigits: dec }).format(x * 100) + '%';

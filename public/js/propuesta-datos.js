// ============================================================================
//  DATOS EDITABLES DE LA PROPUESTA (public/propuesta.html)
//  Este es el ÚNICO archivo que hay que tocar para cargar cifras a mano.
//  Todo lo demás de la página se calcula solo con los datos del tablero.
//  Reglas: nunca nombres de personas; solo cargos y cifras.
// ============================================================================

export const DATOS = {

  // ── 1. Reparto de las renuncias "voluntarias" (cargado por RRHH) ───────────
  // En el registro de salidas, la mayoría de las renuncias del área Comercial solo
  // dicen "voluntaria" (110 en todo el registro). RRHH sí conoce el motivo: se
  // reparte aquí. Cada número son CASOS (personas), no porcentajes. Si un motivo ya
  // existe en el registro (Salario, Mejor oportunidad, Clima laboral) se suma; los
  // casos que no alcancen el total quedan como "sin detalle registrado".
  // Aplica a: departamento Comercial, todo el registro (Salidas y Propuesta).
  desgloseVoluntaria: {
    fuente: 'RRHH, a partir de entrevistas de salida y conocimiento de los casos (2026-09-07)',
    // true = RRHH confirma que este reparto cubre TODAS las "voluntarias" (no se muestra
    // barra de "sin detalle" aunque los casos sumen menos que el conteo del registro).
    cubreTodas: true,
    casos: {
      'Salario': 45,
      'Mejor oportunidad': 22,
      'Clima laboral': 18,
      'Descuentos en salario': 9,
    },
  },

  // ── 1b. Cifras del documento "Propuesta de estructuración de RRHH" (sep 2026) ──
  documento: {
    personasRRHH: 3,                  // jefe + dos asistentes
    personasNuevasRRHH: 2,            // asistente del jefe (traslado) + segundo comodín
    tiendas: 43,
    ssoPresupuesto: 202595,           // cerrar TODOS los hallazgos de SSO, una sola vez (cotizado jun 2025)
    ssoTiendasCumplen: 0,
    ssoSinVIH: 41,                    // tiendas sin la capacitación anual de VIH (informe)
    pisoInicial: 4500,                // garantía del vendedor los primeros 4 meses
    pisoMes5: 3000,                   // garantía del mes 5 en adelante
    salarioMinimo: 4100,
    benchmarkRango: [1.5, 4.5],       // personas de RRHH por cada 100 colaboradores (SHRM, ADP, Indeed)
  },

  // ── 2. Supuestos para costear las propuestas ───────────────────────────────
  // Todo lo que está aquí es SUPUESTO editable y la página lo rotula como tal.
  supuestos: {
    factorPrestaciones: 1.4,          // sueldo × 1.4 ≈ costo con prestaciones (igual que la propuesta anterior)

    // Propuesta 1: asistente para el jefe de RRHH (traslado interno desde Garantías).
    // El sueldo de la persona se mantiene, así que el costo nuevo es reemplazarla
    // en Garantías (si se decide reemplazar).
    reemplazarEnGarantias: true,
    sueldoReemplazoGarantias: 4500,

    // Propuesta 2: segundo comodín (mismo perfil que la asistente de RRHH actual).
    sueldoComodin: 4500,

    // Propuesta 3: vendedor capacitador oficial por región.
    regiones: 5,                      // Chiquimula, Morales, Capital, Jalapa y Zacapa (pestaña de capacitaciones del sheet)
    bonoCapacitador: 500,             // Q por mes por la función de capacitador (fijado por Gerencia)
    sueldoBaseVendedor: 4500,         // sueldo base de un vendedor
    comisionPromedio: 2000,           // Q de comisión promedio mensual de un vendedor (SUPUESTO — RRHH lo confirma)
    diasCapacitacion: 10,             // días que un nuevo pasa a la par del capacitador (SUPUESTO)
    diasLaborales: 26,                // días laborales al mes
    pctVentaMientrasCapacita: 0.5,    // qué parte de sus ventas normales logra el capacitador mientras capacita (SUPUESTO)
    bonoPorNuevoRetenido: 300,        // variante C: Q por cada nuevo que llega a 90 días (SUPUESTO)
    pctComisionCompartida: 0.5,       // variante B: parte de la comisión del nuevo que se acredita al capacitador (SUPUESTO)
  },
};

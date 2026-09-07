// ============================================================================
//  DATOS EDITABLES DE LA PROPUESTA (public/propuesta.html)
//  Este es el ÚNICO archivo que hay que tocar para cargar cifras a mano.
//  Todo lo demás de la página se calcula solo con los datos del tablero.
//  Reglas: nunca nombres de personas; solo cargos y cifras.
// ============================================================================

export const DATOS = {

  // ── 1. Razones de salida (distribución cargada por RRHH) ───────────────────
  // El registro de salidas del sheet NO trae la razón completa (ver % capturado en
  // la página), así que la distribución se carga aquí a mano. Escribe en `pct` el
  // porcentaje de cada motivo (números que sumen 100). Mientras esté en null, la
  // página muestra la categoría con el espacio vacío y el aviso "pendiente".
  razonesSalida: {
    universo: 'renuncias del departamento Comercial',   // sobre qué salidas es la distribución
    periodo: 'últimos 12 meses',                         // qué período cubre
    fuente: 'estimación de RRHH a partir de entrevistas de salida y conocimiento de los casos',
    categorias: [
      { nombre: 'Salario', pct: null },
      { nombre: 'Mejor oportunidad laboral', pct: null },
      { nombre: 'Descuentos aplicados', pct: null },
      { nombre: 'Mal ambiente o trato del jefe', pct: null },
      { nombre: 'Motivos familiares', pct: null },
      { nombre: 'Salud', pct: null },
      { nombre: 'Estudios', pct: null },
      { nombre: 'Horarios', pct: null },
      { nombre: 'Distancia o cambio de domicilio', pct: null },
      { nombre: 'Abandono o no se presentó', pct: null },
      { nombre: 'Otros', pct: null },
    ],
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

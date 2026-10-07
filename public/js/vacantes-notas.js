// Notas a mano sobre vacantes abiertas (Oscar, jefe de RRHH). Son contexto que el sheet no trae:
// por qué una plaza cuesta llenarse. Se muestran en la columna "Avance del proceso" de "Abiertas hoy",
// debajo del estado, para todas las vacantes cuyo puesto cumpla el patrón. Solo cargos, nunca personas
// ni montos. Cuando una nota deje de aplicar, quitarla de aquí.
export const NOTAS_PUESTO = [
  {
    re: /COBRO|COBRADOR/,
    nota: 'El salario ofrecido es muy bajo para el mercado y no atrae candidatos; la plaza seguirá abierta hasta revisarlo.',
    fuente: 'RRHH, oct. 2026',
  },
];

// Qué significa cada estado del proceso, en una línea, para que el CEO no tenga que leer el pie de la tabla.
export const DESCRIPCION_PROCESO = {
  'Contratado, por confirmar': 'Ya hay persona elegida; falta que empiece o que RRHH confirme el cierre.',
  'En polígrafo': 'Candidato elegido, en la prueba de polígrafo previa a contratar.',
  'Propuesta hecha': 'Se le hizo oferta a un candidato; se espera su respuesta.',
  'En entrevistas': 'Hay candidatos en entrevistas o pruebas; aún no hay elegido.',
  'Publicada': 'La plaza está anunciada; todavía no hay candidatos entrevistados.',
  'Candidatos vistos, sin elegido': 'Se entrevistó gente pero ningún perfil cuajó (no cumplen, se retiran o piden más salario); hay que volver a buscar.',
  'En gestión, sin etapa anotada': 'RRHH está en ello, pero la nota del sheet describe la causa de la vacante y no la etapa del proceso.',
  'Sin notas de RRHH aún': 'La plaza está registrada pero el sheet no tiene ninguna nota de gestión todavía.',
};

export const notaDePuesto = (puesto) => NOTAS_PUESTO.find((n) => puesto && n.re.test(puesto)) ?? null;

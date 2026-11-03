/**
 * Qué tan a salvo están los datos.
 *
 * La app guarda todo en el navegador. Eso está bien para probarla y es un
 * riesgo real en cuanto entra la cartera de verdad: si alguien limpia los
 * datos del sitio, o el navegador necesita espacio, no queda nada. El único
 * seguro es la copia que se baja a un archivo, y depende de que alguien se
 * acuerde de bajarla.
 *
 * Esto decide cuándo hay que dejar de confiar en que se acuerden.
 */
import type { BaseDatos, ISODate } from './types';
import { diasEntre, hoy } from './util';

export type AlertaDatos = 'ninguna' | 'demo' | 'sin_respaldo' | 'respaldo_viejo';

export interface SaludDatos {
  esDemo: boolean;
  /** Registros cargados, para no molestar con una base vacía. */
  registros: number;
  diasSinRespaldo: number | null;
  alerta: AlertaDatos;
}

/** A partir de acá el respaldo quedó viejo. Una semana de cobranzas es mucho. */
export const DIAS_TOLERADOS = 7;

export function saludDeLosDatos(db: BaseDatos, fechaRef: ISODate = hoy()): SaludDatos {
  const registros =
    db.propiedades.length + db.contratos.length + db.personas.length + db.pagos.length;
  const esDemo = db.demo === true;

  const diasSinRespaldo = db.configuracion.ultimoRespaldo
    ? Math.max(0, diasEntre(db.configuracion.ultimoRespaldo, fechaRef))
    : null;

  let alerta: AlertaDatos = 'ninguna';
  if (registros === 0) alerta = 'ninguna';
  // Mientras sean datos de ejemplo no tiene sentido pedir respaldos: lo
  // urgente es que nadie los confunda con los reales.
  else if (esDemo) alerta = 'demo';
  else if (diasSinRespaldo === null) alerta = 'sin_respaldo';
  else if (diasSinRespaldo > DIAS_TOLERADOS) alerta = 'respaldo_viejo';

  return { esDemo, registros, diasSinRespaldo, alerta };
}

import type { BaseDatos, ID, Liquidacion } from './types';
import { redondear, sumar } from './util';

/**
 * Integridad referencial.
 *
 * La base es un objeto plano en el navegador: no hay claves foráneas ni un
 * motor que las haga cumplir. Sin esto, borrar un contrato dejaba sus cuotas y
 * sus pagos dando vueltas, y la app seguía contando cobranzas de un contrato
 * que ya no existe.
 *
 * `sanear` es la única fuente de verdad sobre qué depende de qué. Se corre al
 * abrir la app —así se repara cualquier base que haya quedado inconsistente— y
 * después de cada borrado.
 */

export type ColeccionBorrable = 'personas' | 'propiedades' | 'contratos' | 'gastos';

export interface Saneamiento {
  db: BaseDatos;
  /** Cuántos registros huérfanos se quitaron de cada colección. */
  quitados: Record<string, number>;
  /** Ids de adjuntos que quedaron sin dueño: hay que borrar su binario de IndexedDB. */
  archivosHuerfanos: ID[];
  huboCambios: boolean;
}

export function sanear(base: BaseDatos): Saneamiento {
  const quitados: Record<string, number> = {};
  const anotar = (clave: string, antes: number, despues: number) => {
    if (antes !== despues) quitados[clave] = antes - despues;
  };

  const idsPropiedades = new Set(base.propiedades.map((p) => p.id));
  const idsPersonas = new Set(base.personas.map((p) => p.id));

  // El orden importa: cada paso trabaja sobre el resultado del anterior, así
  // una propiedad borrada arrastra sus contratos, y esos sus cuotas y pagos.
  const contratos = base.contratos.filter((c) => idsPropiedades.has(c.propiedadId));
  anotar('contratos', base.contratos.length, contratos.length);

  const idsContratos = new Set(contratos.map((c) => c.id));
  const cuotas = base.cuotas.filter((c) => idsContratos.has(c.contratoId));
  anotar('cuotas', base.cuotas.length, cuotas.length);

  const idsCuotas = new Set(cuotas.map((c) => c.id));
  const pagos = base.pagos.filter((p) => idsCuotas.has(p.cuotaId));
  anotar('pagos', base.pagos.length, pagos.length);

  const novedades = base.novedades.filter((n) => idsContratos.has(n.contratoId));
  anotar('novedades', base.novedades.length, novedades.length);

  // Un adjunto cuelga del contrato, y a veces además de una novedad: si se cae
  // cualquiera de los dos, el archivo ya no tiene dónde mostrarse.
  const idsNovedades = new Set(novedades.map((n) => n.id));
  const adjuntos = base.adjuntos.filter(
    (a) => idsContratos.has(a.contratoId) && (!a.novedadId || idsNovedades.has(a.novedadId)),
  );
  anotar('adjuntos', base.adjuntos.length, adjuntos.length);

  const idsAdjuntos = new Set(adjuntos.map((a) => a.id));
  const archivosHuerfanos = base.adjuntos.filter((a) => !idsAdjuntos.has(a.id)).map((a) => a.id);

  const gastos = base.gastos.filter((g) => idsPropiedades.has(g.propiedadId));
  anotar('gastos', base.gastos.length, gastos.length);

  const idsGastos = new Set(gastos.map((g) => g.id));
  const liquidaciones = base.liquidaciones
    .filter((l) => idsPersonas.has(l.propietarioId))
    .map((l) => recortarLiquidacion(l, idsCuotas, idsGastos))
    .filter((l): l is Liquidacion => l !== null);
  anotar('liquidaciones', base.liquidaciones.length, liquidaciones.length);

  // El vínculo de una cuota a su liquidación se cae si la liquidación ya no está.
  const idsLiquidaciones = new Set(liquidaciones.map((l) => l.id));
  const cuotasLimpias = cuotas.map((c) =>
    c.liquidacionId && !idsLiquidaciones.has(c.liquidacionId) ? { ...c, liquidacionId: undefined } : c,
  );
  const gastosLimpios = gastos.map((g) =>
    g.liquidacionId && !idsLiquidaciones.has(g.liquidacionId) ? { ...g, liquidacionId: undefined } : g,
  );

  const db: BaseDatos = {
    ...base,
    contratos,
    cuotas: cuotasLimpias,
    pagos,
    gastos: gastosLimpios,
    liquidaciones,
    novedades,
    adjuntos,
  };

  return {
    db,
    quitados,
    archivosHuerfanos,
    huboCambios: Object.keys(quitados).length > 0,
  };
}

/**
 * Saca de la liquidación los ítems que apuntan a algo que ya no existe y
 * recalcula el neto. Si no le queda ningún ítem, la liquidación se descarta.
 */
function recortarLiquidacion(
  liq: Liquidacion,
  idsCuotas: Set<ID>,
  idsGastos: Set<ID>,
): Liquidacion | null {
  const items = liq.items.filter((i) => {
    if (!i.referenciaId) return true;
    if (i.tipo === 'gasto') return idsGastos.has(i.referenciaId);
    return idsCuotas.has(i.referenciaId);
  });

  if (items.length === 0) return null;
  if (items.length === liq.items.length) return liq;

  return {
    ...liq,
    items,
    neto: redondear(sumar(items, (i) => i.monto)),
    comisionTotal: redondear(
      Math.abs(sumar(items.filter((i) => i.tipo === 'comision_admin'), (i) => i.monto)),
    ),
  };
}

/* ─────────────────── Qué se lleva puesto un borrado ───────────────── */

export interface Impacto {
  contratos: number;
  cuotas: number;
  pagos: number;
  gastos: number;
  liquidaciones: number;
  novedades: number;
  adjuntos: number;
}

/**
 * Cuánto arrastra borrar algo, para poder avisarlo antes de hacerlo.
 *
 * Se calcula simulando el borrado y saneando: así lo que dice el cartel de
 * confirmación es exactamente lo que va a pasar, porque sale del mismo código.
 */
export function impactoDeBorrar(base: BaseDatos, coleccion: ColeccionBorrable, id: ID): Impacto {
  const simulada: BaseDatos = {
    ...base,
    [coleccion]: (base[coleccion] as { id: ID }[]).filter((x) => x.id !== id),
  } as BaseDatos;

  const { db } = sanear(simulada);

  return {
    contratos: base.contratos.length - db.contratos.length,
    cuotas: base.cuotas.length - db.cuotas.length,
    pagos: base.pagos.length - db.pagos.length,
    gastos: base.gastos.length - db.gastos.length,
    liquidaciones: base.liquidaciones.length - db.liquidaciones.length,
    novedades: base.novedades.length - db.novedades.length,
    adjuntos: base.adjuntos.length - db.adjuntos.length,
  };
}

import { create } from 'zustand';
import type {
  Asiento,
  BaseDatos,
  Contrato,
  CuentaFinanciera,
  Cuota,
  Gasto,
  ID,
  Liquidacion,
  Operacion,
  Pago,
  Periodo,
  Persona,
  Propiedad,
  Tarea,
  ValorIndice,
} from '../domain/types';
import { generarCuotasFaltantes } from '../domain/cobranzas';
import { armarLiquidacion } from '../domain/liquidaciones';
import { hoy, nuevoId, periodoActual } from '../domain/util';
import { cargarBase, guardarBase } from './db';
import { baseVacia, crearBaseDemo } from './seed';

type ClaveColeccion =
  | 'personas'
  | 'propiedades'
  | 'contratos'
  | 'cuotas'
  | 'pagos'
  | 'liquidaciones'
  | 'operaciones'
  | 'gastos'
  | 'cuentas'
  | 'asientos'
  | 'tareas';

interface EstadoApp {
  db: BaseDatos;

  reemplazarBase: (db: BaseDatos) => void;
  cargarDemo: () => void;
  vaciar: () => void;
  actualizarConfiguracion: (cambios: Partial<BaseDatos['configuracion']>) => void;
  guardarIndices: (indices: ValorIndice[]) => void;

  guardarPersona: (p: Persona) => void;
  guardarPropiedad: (p: Propiedad) => void;
  guardarContrato: (c: Contrato) => void;
  guardarOperacion: (o: Operacion) => void;
  guardarGasto: (g: Gasto) => void;
  guardarCuenta: (c: CuentaFinanciera) => void;
  guardarTarea: (t: Tarea) => void;
  guardarAsiento: (a: Asiento) => void;
  eliminar: (coleccion: ClaveColeccion, id: ID) => void;

  emitirCuotas: (hasta?: Periodo) => number;
  anularCuota: (cuotaId: ID) => void;
  registrarPago: (pago: Omit<Pago, 'id'>) => void;
  eliminarPago: (pagoId: ID) => void;

  generarLiquidaciones: (periodo: Periodo) => number;
  cambiarEstadoLiquidacion: (id: ID, estado: Liquidacion['estado'], cuentaId?: ID) => void;
  eliminarLiquidacion: (id: ID) => void;

  alternarTarea: (id: ID) => void;
}

function upsert<T extends { id: ID }>(lista: T[], item: T): T[] {
  const i = lista.findIndex((x) => x.id === item.id);
  if (i === -1) return [...lista, item];
  const copia = [...lista];
  copia[i] = item;
  return copia;
}

export const useApp = create<EstadoApp>((set, get) => {
  /** Toda mutación pasa por acá: muta el estado y persiste en un solo lugar. */
  const mutar = (fn: (db: BaseDatos) => BaseDatos) =>
    set((estado) => {
      const db = fn(estado.db);
      guardarBase(db);
      return { db };
    });

  return {
    db: cargarBase(),

    reemplazarBase: (db) => mutar(() => db),
    cargarDemo: () => mutar(() => crearBaseDemo()),
    vaciar: () => mutar(() => baseVacia()),

    actualizarConfiguracion: (cambios) =>
      mutar((db) => ({ ...db, configuracion: { ...db.configuracion, ...cambios } })),

    guardarIndices: (indices) =>
      mutar((db) => ({ ...db, indices: [...indices].sort((a, b) => a.periodo.localeCompare(b.periodo)) })),

    guardarPersona: (p) => mutar((db) => ({ ...db, personas: upsert(db.personas, p) })),
    guardarPropiedad: (p) => mutar((db) => ({ ...db, propiedades: upsert(db.propiedades, p) })),
    guardarOperacion: (o) => mutar((db) => ({ ...db, operaciones: upsert(db.operaciones, o) })),
    guardarGasto: (g) => mutar((db) => ({ ...db, gastos: upsert(db.gastos, g) })),
    guardarCuenta: (c) => mutar((db) => ({ ...db, cuentas: upsert(db.cuentas, c) })),
    guardarTarea: (t) => mutar((db) => ({ ...db, tareas: upsert(db.tareas, t) })),
    guardarAsiento: (a) => mutar((db) => ({ ...db, asientos: upsert(db.asientos, a) })),

    guardarContrato: (c) =>
      mutar((db) => {
        const propiedades = db.propiedades.map((p) =>
          p.id === c.propiedadId && c.estado === 'activo' ? { ...p, estado: 'alquilada' as const } : p,
        );
        return { ...db, contratos: upsert(db.contratos, c), propiedades };
      }),

    eliminar: (coleccion, id) =>
      mutar((db) => ({
        ...db,
        [coleccion]: (db[coleccion] as { id: ID }[]).filter((x) => x.id !== id),
      })),

    emitirCuotas: (hasta = periodoActual()) => {
      const db = get().db;
      const nuevas = generarCuotasFaltantes(db.contratos, db.cuotas, db.indices, hasta);
      if (nuevas.length) mutar((d) => ({ ...d, cuotas: [...d.cuotas, ...nuevas] }));
      return nuevas.length;
    },

    anularCuota: (cuotaId) =>
      mutar((db) => ({
        ...db,
        cuotas: db.cuotas.map((c) => (c.id === cuotaId ? { ...c, estado: 'anulada' as Cuota['estado'] } : c)),
        pagos: db.pagos.filter((p) => p.cuotaId !== cuotaId),
      })),

    registrarPago: (pago) =>
      mutar((db) => ({ ...db, pagos: [...db.pagos, { ...pago, id: nuevoId('pag') }] })),

    eliminarPago: (pagoId) => mutar((db) => ({ ...db, pagos: db.pagos.filter((p) => p.id !== pagoId) })),

    generarLiquidaciones: (periodo) => {
      const db = get().db;
      const propietarios = [...new Set(db.propiedades.map((p) => p.propietarioId))];

      // No se saltea a los propietarios que ya tienen liquidación del período:
      // una cobranza que entró tarde tiene que poder liquidarse igual, en una
      // liquidación complementaria. `armarLiquidacion` solo toma cuotas y gastos
      // todavía sin liquidar, así que la operación es idempotente.
      const nuevas: Liquidacion[] = [];
      let n = db.liquidaciones.length + 1;
      for (const propietarioId of propietarios) {
        const liq = armarLiquidacion(
          propietarioId,
          periodo,
          db,
          `LIQ-${periodo.replace('-', '')}-${String(n).padStart(3, '0')}`,
        );
        if (liq) {
          nuevas.push(liq);
          n += 1;
        }
      }
      if (!nuevas.length) return 0;

      mutar((d) => {
        const referencias = new Map<ID, ID>();
        for (const liq of nuevas) {
          for (const item of liq.items) {
            if (item.referenciaId) referencias.set(item.referenciaId, liq.id);
          }
        }
        return {
          ...d,
          liquidaciones: [...d.liquidaciones, ...nuevas],
          // El vínculo apunta a la primera liquidación donde apareció la cuota;
          // una complementaria posterior no lo pisa.
          cuotas: d.cuotas.map((c) =>
            referencias.has(c.id) && !c.liquidacionId
              ? { ...c, liquidacionId: referencias.get(c.id) }
              : c,
          ),
          gastos: d.gastos.map((g) =>
            referencias.has(g.id) ? { ...g, liquidacionId: referencias.get(g.id) } : g,
          ),
        };
      });
      return nuevas.length;
    },

    cambiarEstadoLiquidacion: (id, estado, cuentaId) =>
      mutar((db) => ({
        ...db,
        liquidaciones: db.liquidaciones.map((l) =>
          l.id === id
            ? {
                ...l,
                estado,
                cuentaId: cuentaId ?? l.cuentaId,
                fechaPago: estado === 'pagada' ? (l.fechaPago ?? hoy()) : undefined,
              }
            : l,
        ),
      })),

    eliminarLiquidacion: (id) =>
      mutar((db) => ({
        ...db,
        liquidaciones: db.liquidaciones.filter((l) => l.id !== id),
        cuotas: db.cuotas.map((c) => (c.liquidacionId === id ? { ...c, liquidacionId: undefined } : c)),
        gastos: db.gastos.map((g) => (g.liquidacionId === id ? { ...g, liquidacionId: undefined } : g)),
      })),

    alternarTarea: (id) =>
      mutar((db) => ({
        ...db,
        tareas: db.tareas.map((t) => (t.id === id ? { ...t, completada: !t.completada } : t)),
      })),
  };
});

/** Selector cómodo: la base entera. */
export const useDb = () => useApp((e) => e.db);

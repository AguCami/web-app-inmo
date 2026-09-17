import { create } from 'zustand';
import type {
  BaseDatos,
  Contrato,
  Cuota,
  Gasto,
  ID,
  Liquidacion,
  Pago,
  Periodo,
  Persona,
  Propiedad,
  ValorIndice,
} from '../domain/types';
import { generarCuotasFaltantes } from '../domain/cobranzas';
import { armarLiquidacion } from '../domain/liquidaciones';
import { sanear, type ColeccionBorrable } from '../domain/integridad';
import { hoy, nuevoId, periodoActual } from '../domain/util';
import { cargarBase, guardarBase } from './db';
import { baseVacia, crearBaseDemo } from './seed';
import { combinarIndices, traerIndicesPublicados } from './indices';


interface EstadoApp {
  db: BaseDatos;
  /** Última vez que se sincronizó la serie publicada de índices. */
  indicesSincronizados: 'pendiente' | 'ok' | 'sin_archivo';

  reemplazarBase: (db: BaseDatos) => void;
  cargarDemo: () => void;
  vaciar: () => void;
  actualizarConfiguracion: (cambios: Partial<BaseDatos['configuracion']>) => void;
  guardarIndices: (indices: ValorIndice[]) => void;
  sincronizarIndices: () => Promise<void>;

  guardarPersona: (p: Persona) => void;
  guardarPropiedad: (p: Propiedad) => void;
  guardarContrato: (c: Contrato) => void;
  guardarGasto: (g: Gasto) => void;
  eliminar: (coleccion: ColeccionBorrable, id: ID) => void;

  emitirCuotas: (hasta?: Periodo) => number;
  anularCuota: (cuotaId: ID) => void;
  registrarPago: (pago: Omit<Pago, 'id'>) => void;
  eliminarPago: (pagoId: ID) => void;

  generarLiquidaciones: (periodo: Periodo) => number;
  cambiarEstadoLiquidacion: (id: ID, estado: Liquidacion['estado']) => void;
  eliminarLiquidacion: (id: ID) => void;
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
    indicesSincronizados: 'pendiente',

    reemplazarBase: (db) => mutar(() => db),
    cargarDemo: () => mutar(() => crearBaseDemo()),
    vaciar: () => mutar(() => baseVacia()),

    actualizarConfiguracion: (cambios) =>
      mutar((db) => ({ ...db, configuracion: { ...db.configuracion, ...cambios } })),

    guardarIndices: (indices) =>
      mutar((db) => ({
        ...db,
        indices: [...indices].sort((a, b) => a.periodo.localeCompare(b.periodo)),
      })),

    /** Trae la serie que publica la tarea programada y la mezcla con la local. */
    sincronizarIndices: async () => {
      const publicados = await traerIndicesPublicados();
      if (!publicados) {
        set({ indicesSincronizados: 'sin_archivo' });
        return;
      }
      mutar((db) => ({ ...db, indices: combinarIndices(db.indices, publicados) }));
      set({ indicesSincronizados: 'ok' });
    },

    guardarPersona: (p) => mutar((db) => ({ ...db, personas: upsert(db.personas, p) })),
    guardarPropiedad: (p) => mutar((db) => ({ ...db, propiedades: upsert(db.propiedades, p) })),
    guardarGasto: (g) => mutar((db) => ({ ...db, gastos: upsert(db.gastos, g) })),

    guardarContrato: (c) =>
      mutar((db) => ({
        ...db,
        contratos: upsert(db.contratos, c),
        // Una propiedad con contrato activo está alquilada, y al terminar vuelve a estar libre.
        propiedades: db.propiedades.map((p) =>
          p.id === c.propiedadId
            ? { ...p, estado: c.estado === 'activo' ? 'alquilada' : 'disponible' }
            : p,
        ),
      })),

    /**
     * Borra y arrastra lo que dependía de eso: sin esto, las cuotas de un
     * contrato borrado quedaban contando en Cobranzas para siempre.
     */
    eliminar: (coleccion, id) =>
      mutar((db) => {
        const sinEso = {
          ...db,
          [coleccion]: (db[coleccion] as { id: ID }[]).filter((x) => x.id !== id),
        } as BaseDatos;

        // Una unidad sin contrato activo vuelve a estar disponible.
        const { db: saneada } = sanear(sinEso);
        return {
          ...saneada,
          propiedades: saneada.propiedades.map((p) =>
            p.estado === 'alquilada' &&
            !saneada.contratos.some((c) => c.propiedadId === p.id && c.estado === 'activo')
              ? { ...p, estado: 'disponible' as const }
              : p,
          ),
        };
      }),

    emitirCuotas: (hasta = periodoActual()) => {
      const db = get().db;
      const nuevas = generarCuotasFaltantes(db.contratos, db.cuotas, db.indices, hasta);
      if (nuevas.length) mutar((d) => ({ ...d, cuotas: [...d.cuotas, ...nuevas] }));
      return nuevas.length;
    },

    anularCuota: (cuotaId) =>
      mutar((db) => ({
        ...db,
        cuotas: db.cuotas.map((c) =>
          c.id === cuotaId ? { ...c, estado: 'anulada' as Cuota['estado'] } : c,
        ),
        pagos: db.pagos.filter((p) => p.cuotaId !== cuotaId),
      })),

    registrarPago: (pago) =>
      mutar((db) => ({ ...db, pagos: [...db.pagos, { ...pago, id: nuevoId('pa') }] })),

    eliminarPago: (pagoId) =>
      mutar((db) => ({ ...db, pagos: db.pagos.filter((p) => p.id !== pagoId) })),

    generarLiquidaciones: (periodo) => {
      const db = get().db;
      const propietarios = [...new Set(db.propiedades.map((p) => p.propietarioId))];

      // No se saltea a los propietarios que ya tienen liquidación del período:
      // una cobranza tardía tiene que poder rendirse en una complementaria.
      // `armarLiquidacion` solo toma lo que falta rendir, así que es idempotente.
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
          // El vínculo apunta a la primera liquidación donde apareció la cuota.
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

    cambiarEstadoLiquidacion: (id, estado) =>
      mutar((db) => ({
        ...db,
        liquidaciones: db.liquidaciones.map((l) =>
          l.id === id
            ? { ...l, estado, fechaPago: estado === 'pagada' ? (l.fechaPago ?? hoy()) : undefined }
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
  };
});

export const useDb = () => useApp((e) => e.db);

import { create } from 'zustand';
import type {
  Adjunto,
  BaseDatos,
  Contrato,
  Cuota,
  Gasto,
  ID,
  Liquidacion,
  Novedad,
  Pago,
  Periodo,
  Persona,
  Propiedad,
  ValorIndice,
} from '../domain/types';
import { generarCuotasFaltantes, siguienteNumeroRecibo } from '../domain/cobranzas';
import { armarLiquidacion } from '../domain/liquidaciones';
import { sanear, type ColeccionBorrable } from '../domain/integridad';
import { hoy, nuevoId, periodoActual } from '../domain/util';
import { borrarArchivos, guardarArchivo, MAXIMO_POR_ARCHIVO, usarServidorParaArchivos } from './archivos';
import { cargarBase, conRecibos, guardarBase } from './db';
import { aplicarCambios, calcularCambios, cargarDesdeServidor } from './remoto';
import { HAY_SERVIDOR, ingresar, salir, sesionActual, type Sesion } from './servidor';
import { Sincronizador, type EstadoSincronizacion } from './sincronizador';
import { baseVacia, crearBaseDemo } from './seed';
import { combinarIndices, traerIndicesPublicados } from './indices';


interface EstadoApp {
  db: BaseDatos;

  /* ── Cuentas y servidor. En modo demo todo esto queda en su valor neutro. ── */
  /** El build trae las claves de Supabase: hay login y los datos son online. */
  modoServidor: boolean;
  /** Todavía no se sabe si hay sesión: no mostrar ni la app ni el login. */
  verificandoSesion: boolean;
  sesion: Sesion | null;
  sincronizacion: EstadoSincronizacion;
  errorSincronizacion?: string;

  iniciarSesion: (email: string, clave: string) => Promise<string | null>;
  cerrarSesion: () => Promise<void>;
  reintentarSincronizacion: () => void;
  /** Sube al servidor la base que está abierta. Para mudar lo cargado local. */
  subirBaseAlServidor: () => Promise<string | null>;

  /** Última vez que se sincronizó la serie publicada de índices. */
  indicesSincronizados: 'pendiente' | 'ok' | 'sin_archivo';

  reemplazarBase: (db: BaseDatos) => void;
  cargarDemo: () => void;
  /** Deja constancia de que se bajó una copia, para dejar de avisar. */
  registrarRespaldo: () => void;
  vaciar: () => void;
  actualizarConfiguracion: (cambios: Partial<BaseDatos['configuracion']>) => void;
  guardarIndices: (indices: ValorIndice[]) => void;
  sincronizarIndices: () => Promise<void>;

  guardarPersona: (p: Persona) => void;
  guardarNovedad: (n: Novedad) => void;
  eliminarNovedad: (id: ID) => void;
  /** Sube un archivo y lo cuelga del contrato, o de una novedad suya. */
  adjuntar: (contratoId: ID, archivo: File, opciones?: { novedadId?: ID; descripcion?: string }) => Promise<void>;
  eliminarAdjunto: (id: ID) => void;
  guardarPropiedad: (p: Propiedad) => void;
  guardarContrato: (c: Contrato) => void;
  /** Finaliza el contrato que vence y da de alta el que sigue, en un solo paso. */
  renovarContrato: (viejoId: ID, nuevo: Contrato) => void;
  guardarGasto: (g: Gasto) => void;
  eliminar: (coleccion: ColeccionBorrable, id: ID) => void;

  emitirCuotas: (hasta?: Periodo) => number;
  anularCuota: (cuotaId: ID) => void;
  /** Devuelve el pago ya creado, con su número de recibo, para poder emitirlo. */
  registrarPago: (pago: Omit<Pago, 'id' | 'recibo'>) => Pago;
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
  let sincronizador: Sincronizador | null = null;

  const anotarEstado = (estado: EstadoSincronizacion, error?: string) =>
    set({ sincronizacion: estado, errorSincronizacion: error });

  /**
   * Toda mutación pasa por acá: muta el estado y lo persiste en un solo
   * lugar. Con servidor NO se escribe en el navegador: así la cartera de la
   * inmobiliaria no queda tirada en el disco de una máquina compartida
   * después de cerrar sesión. Se pierden, como mucho, los últimos segundos.
   */
  const mutar = (fn: (db: BaseDatos) => BaseDatos) =>
    set((estado) => {
      const db = fn(estado.db);
      if (sincronizador) sincronizador.encolar(db);
      else guardarBase(db);
      return { db };
    });

  /** Trae la base del servidor y deja el sincronizador listo para esa sesión. */
  const abrirSesion = async (sesion: Sesion) => {
    set({ verificandoSesion: false, sesion, sincronizacion: 'guardando' });
    usarServidorParaArchivos(sesion.organizacionId);
    try {
      const db = conRecibos(await cargarDesdeServidor());
      sincronizador = new Sincronizador(sesion.organizacionId, db, anotarEstado);
      set({ db, sincronizacion: 'al_dia', errorSincronizacion: undefined });
    } catch (e) {
      set({
        sincronizacion: 'error',
        errorSincronizacion: e instanceof Error ? e.message : String(e),
      });
    }
  };

  // Con servidor, la base no sale del navegador: se espera a saber si hay
  // sesión antes de mostrar nada.
  if (HAY_SERVIDOR) {
    void sesionActual().then((s) => (s ? abrirSesion(s) : set({ verificandoSesion: false })));
  }

  return {
    db: HAY_SERVIDOR ? baseVacia() : cargarBase(),
    indicesSincronizados: 'pendiente',

    modoServidor: HAY_SERVIDOR,
    verificandoSesion: HAY_SERVIDOR,
    sesion: null,
    sincronizacion: 'al_dia',

    iniciarSesion: async (email, clave) => {
      const error = await ingresar(email, clave);
      if (error) return error;
      const s = await sesionActual();
      if (!s) return 'Entraste, pero tu usuario no está asignado a ninguna inmobiliaria.';
      await abrirSesion(s);
      return null;
    },

    cerrarSesion: async () => {
      // Lo pendiente se manda antes de soltar la sesión, o se pierde.
      await sincronizador?.vaciarCola();
      sincronizador = null;
      usarServidorParaArchivos(null);
      await salir();
      set({ sesion: null, db: baseVacia(), sincronizacion: 'al_dia' });
    },

    reintentarSincronizacion: () => sincronizador?.reintentar(),

    subirBaseAlServidor: async () => {
      const { db, sesion } = get();
      if (!sesion) return 'No hay sesión abierta.';
      try {
        anotarEstado('guardando');
        await aplicarCambios(calcularCambios(baseVacia(), db), sesion.organizacionId);
        sincronizador = new Sincronizador(sesion.organizacionId, db, anotarEstado);
        anotarEstado('al_dia');
        return null;
      } catch (e) {
        const texto = e instanceof Error ? e.message : String(e);
        anotarEstado('error', texto);
        return texto;
      }
    },


    reemplazarBase: (db) => mutar(() => db),
    cargarDemo: () => mutar(() => conRecibos(crearBaseDemo())),

    registrarRespaldo: () =>
      mutar((db) => ({ ...db, configuracion: { ...db.configuracion, ultimoRespaldo: hoy() } })),
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

    guardarNovedad: (n) => mutar((db) => ({ ...db, novedades: upsert(db.novedades, n) })),

    /** Borrar la novedad se lleva sus archivos: los deja `sanear`, acá se purga el binario. */
    eliminarNovedad: (id) =>
      mutar((db) => {
        const archivos = db.adjuntos.filter((a) => a.novedadId === id).map((a) => a.id);
        void borrarArchivos(archivos);
        return {
          ...db,
          novedades: db.novedades.filter((n) => n.id !== id),
          adjuntos: db.adjuntos.filter((a) => a.novedadId !== id),
        };
      }),

    adjuntar: async (contratoId, archivo, opciones) => {
      if (archivo.size > MAXIMO_POR_ARCHIVO) {
        throw new Error(
          `«${archivo.name}» pesa demasiado. El máximo por archivo es 20 MB.`,
        );
      }

      const id = nuevoId('adj');
      // Primero el binario: si la subida falla, no queda una ficha sin archivo.
      await guardarArchivo(id, archivo);

      const adjunto: Adjunto = {
        id,
        contratoId,
        novedadId: opciones?.novedadId,
        nombre: archivo.name,
        tipo: archivo.type || 'application/octet-stream',
        tamano: archivo.size,
        fecha: hoy(),
        descripcion: opciones?.descripcion,
      };
      mutar((db) => ({ ...db, adjuntos: [...db.adjuntos, adjunto] }));
    },

    eliminarAdjunto: (id) =>
      mutar((db) => {
        void borrarArchivos([id]);
        return { ...db, adjuntos: db.adjuntos.filter((a) => a.id !== id) };
      }),
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

    renovarContrato: (viejoId, nuevo) =>
      mutar((db) => ({
        ...db,
        contratos: upsert(
          db.contratos.map((c) => (c.id === viejoId ? { ...c, estado: 'finalizado' } : c)),
          nuevo,
        ),
        // Los dos pasos van juntos a propósito: si se guardaran por separado,
        // entre uno y otro la propiedad quedaría marcada como disponible.
        propiedades: db.propiedades.map((p) =>
          p.id === nuevo.propiedadId ? { ...p, estado: 'alquilada' } : p,
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
        const { db: saneada, archivosHuerfanos } = sanear(sinEso);
        void borrarArchivos(archivosHuerfanos);
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

    registrarPago: (pago) => {
      const nuevo: Pago = {
        ...pago,
        id: nuevoId('pa'),
        recibo: siguienteNumeroRecibo(get().db.pagos),
      };
      mutar((db) => ({ ...db, pagos: [...db.pagos, nuevo] }));
      return nuevo;
    },

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

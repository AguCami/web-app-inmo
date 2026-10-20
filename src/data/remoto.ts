/**
 * Leer y escribir la base en Supabase.
 *
 * La app trabaja en memoria sobre un `BaseDatos` entero y toda mutación pasa
 * por `mutar()`. En vez de reescribir cada acción para que haga su propio
 * INSERT, acá se compara el estado anterior con el nuevo y se manda solo lo
 * que cambió. Dos ventajas: las acciones no se tocan, y una entidad nueva no
 * necesita código de escritura propio, solo entrar en la lista de abajo.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { BaseDatos, Configuracion, ValorIndice } from '../domain/types';
import { obtenerCliente } from './servidor';
import { baseVacia } from './seed';

/**
 * Colección de la app ↔ tabla, en orden de dependencia: los padres primero.
 * Al borrar se recorre al revés.
 */
const TABLAS = [
  ['personas', 'persona'],
  ['propiedades', 'propiedad'],
  ['contratos', 'contrato'],
  ['liquidaciones', 'liquidacion'],
  ['cuotas', 'cuota'],
  ['pagos', 'pago'],
  ['gastos', 'gasto'],
  ['novedades', 'novedad'],
  ['adjuntos', 'adjunto'],
] as const;

type Coleccion = (typeof TABLAS)[number][0];
type ConId = { id: string };

/** PostgREST devuelve 1000 filas por pedido; una cartera grande tiene más. */
const PAGINA = 1000;

async function traerTodas(sb: SupabaseClient, tabla: string): Promise<Record<string, unknown>[]> {
  const todas: Record<string, unknown>[] = [];
  for (let desde = 0; ; desde += PAGINA) {
    const { data, error } = await sb.from(tabla).select('*').range(desde, desde + PAGINA - 1);
    if (error) throw new Error(`Leyendo ${tabla}: ${error.message}`);
    todas.push(...(data ?? []));
    if (!data || data.length < PAGINA) return todas;
  }
}

/** La app no conoce `organizacion_id`: es cosa de la base. */
function sinOrganizacion<T>(filas: Record<string, unknown>[]): T[] {
  return filas.map((f) => {
    const { organizacion_id: _, ...resto } = f;
    return resto as T;
  });
}

export async function cargarDesdeServidor(): Promise<BaseDatos> {
  const sb = await obtenerCliente();
  const base = baseVacia();

  const leidas = await Promise.all(TABLAS.map(([, tabla]) => traerTodas(sb, tabla)));
  TABLAS.forEach(([coleccion], i) => {
    // @ts-expect-error cada colección tiene su tipo; el nombre los relaciona
    base[coleccion] = sinOrganizacion(leidas[i]);
  });

  base.indices = sinOrganizacion<ValorIndice>(await traerTodas(sb, 'indice'))
    .sort((a, b) => a.periodo.localeCompare(b.periodo));

  const config = sinOrganizacion<Configuracion>(await traerTodas(sb, 'configuracion'))[0];
  if (config) base.configuracion = { ...base.configuracion, ...config };

  return base;
}

/* ───────────────────────────── Sincronizar ────────────────────────────── */

export interface Cambios {
  guardar: Record<string, unknown[]>;
  borrar: Record<string, string[]>;
}

function igualesEnContenido(a: unknown, b: unknown): boolean {
  // La referencia alcanza casi siempre: las acciones copian el arreglo pero
  // reutilizan los objetos que no tocaron. El JSON es la red de contención.
  return a === b || JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Qué cambió entre dos bases. Es pura y no toca la red, así se puede probar
 * sin servidor.
 */
export function calcularCambios(antes: BaseDatos, despues: BaseDatos): Cambios {
  const cambios: Cambios = { guardar: {}, borrar: {} };

  for (const [coleccion, tabla] of TABLAS) {
    const previas = antes[coleccion as Coleccion] as unknown as ConId[];
    const nuevas = despues[coleccion as Coleccion] as unknown as ConId[];

    const porIdAntes = new Map(previas.map((x) => [x.id, x]));
    const idsDespues = new Set(nuevas.map((x) => x.id));

    const guardar = nuevas.filter((x) => !igualesEnContenido(porIdAntes.get(x.id), x));
    const borrar = previas.filter((x) => !idsDespues.has(x.id)).map((x) => x.id);

    if (guardar.length) cambios.guardar[tabla] = guardar;
    if (borrar.length) cambios.borrar[tabla] = borrar;
  }

  // Los índices se identifican por período, no por id.
  const indicesAntes = new Map(antes.indices.map((i) => [i.periodo, i]));
  const indices = despues.indices.filter((i) => !igualesEnContenido(indicesAntes.get(i.periodo), i));
  if (indices.length) cambios.guardar.indice = indices;

  const periodosNuevos = new Set(despues.indices.map((i) => i.periodo));
  const indicesBorrados = antes.indices.filter((i) => !periodosNuevos.has(i.periodo)).map((i) => i.periodo);
  if (indicesBorrados.length) cambios.borrar.indice = indicesBorrados;

  if (!igualesEnContenido(antes.configuracion, despues.configuracion)) {
    cambios.guardar.configuracion = [despues.configuracion];
  }

  return cambios;
}

export function hayCambios(c: Cambios): boolean {
  return Object.keys(c.guardar).length > 0 || Object.keys(c.borrar).length > 0;
}

export async function aplicarCambios(cambios: Cambios, organizacionId: string): Promise<void> {
  const sb = await obtenerCliente();
  const conOrg = (filas: unknown[]) =>
    filas.map((f) => ({ ...(f as object), organizacion_id: organizacionId }));

  // Borrar de las hojas hacia la raíz. La base igual cascadea, así que borrar
  // algo que ya se fue con su padre es un no-op; el orden es por claridad.
  for (const [, tabla] of [...TABLAS].reverse()) {
    const ids = cambios.borrar[tabla];
    if (!ids?.length) continue;
    const { error } = await sb.from(tabla).delete().in('id', ids);
    if (error) throw new Error(`Borrando de ${tabla}: ${error.message}`);
  }
  if (cambios.borrar.indice?.length) {
    const { error } = await sb.from('indice').delete().in('periodo', cambios.borrar.indice);
    if (error) throw new Error(`Borrando índices: ${error.message}`);
  }

  // Guardar de la raíz hacia las hojas, para que el padre exista antes que
  // el hijo que lo referencia.
  for (const [, tabla] of TABLAS) {
    const filas = cambios.guardar[tabla];
    if (!filas?.length) continue;
    const { error } = await sb
      .from(tabla)
      .upsert(conOrg(filas), { onConflict: 'organizacion_id,id' });
    if (error) throw new Error(`Guardando en ${tabla}: ${error.message}`);
  }
  if (cambios.guardar.indice?.length) {
    const { error } = await sb
      .from('indice')
      .upsert(conOrg(cambios.guardar.indice), { onConflict: 'organizacion_id,periodo' });
    if (error) throw new Error(`Guardando índices: ${error.message}`);
  }
  if (cambios.guardar.configuracion?.length) {
    const { error } = await sb
      .from('configuracion')
      .upsert(conOrg(cambios.guardar.configuracion), { onConflict: 'organizacion_id' });
    if (error) throw new Error(`Guardando la configuración: ${error.message}`);
  }
}

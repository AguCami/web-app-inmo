/**
 * Conexión con Supabase.
 *
 * La app funciona de dos maneras y esta es la que decide cuál:
 *
 *   · Modo demo — sin servidor. Los datos viven en el navegador, no hay que
 *     iniciar sesión y se puede mostrar la app a cualquiera. Es lo que se
 *     publica en GitHub Pages.
 *   · Modo cuenta — con servidor. Los datos viven en Supabase, hay login y
 *     varias personas de la misma oficina ven lo mismo.
 *
 * Se elige solo: si en el build están las variables de entorno, hay servidor.
 * No hay interruptor en la interfaz, porque un usuario no tendría cómo
 * decidir eso bien.
 *
 * El cliente se carga con import dinámico a propósito: pesa cerca de 100 kB y
 * el modo demo no lo necesita. Así la app que mostrás en una reunión no paga
 * el peso de algo que no usa.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

const URL_SERVIDOR = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const CLAVE_PUBLICA = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** Si esto es false, toda la app sigue andando contra el navegador. */
export const HAY_SERVIDOR = Boolean(URL_SERVIDOR && CLAVE_PUBLICA);

let cliente: SupabaseClient | null = null;
let cargando: Promise<SupabaseClient> | null = null;

export async function obtenerCliente(): Promise<SupabaseClient> {
  if (cliente) return cliente;
  if (!HAY_SERVIDOR) throw new Error('No hay servidor configurado');

  cargando ??= import('@supabase/supabase-js').then(({ createClient }) => {
    cliente = createClient(URL_SERVIDOR!, CLAVE_PUBLICA!, {
      auth: { persistSession: true, autoRefreshToken: true },
    });
    return cliente;
  });
  return cargando;
}

/* ──────────────────────────────── Sesión ──────────────────────────────── */

export interface Sesion {
  usuarioId: string;
  email: string;
  organizacionId: string;
  organizacion: string;
  rol: string;
}

/**
 * La sesión de Supabase dice quién sos, no de qué inmobiliaria. Eso sale de
 * `miembro`, y sin eso no se puede leer nada: todas las políticas filtran por
 * organización.
 */
export async function sesionActual(): Promise<Sesion | null> {
  if (!HAY_SERVIDOR) return null;
  const sb = await obtenerCliente();

  const { data } = await sb.auth.getSession();
  const usuario = data.session?.user;
  if (!usuario) return null;

  const { data: filas, error } = await sb
    .from('miembro')
    .select('organizacion_id, rol, organizacion(nombre)')
    .limit(1);
  if (error || !filas?.length) return null;

  const fila = filas[0] as unknown as {
    organizacion_id: string;
    rol: string;
    organizacion: { nombre: string } | { nombre: string }[] | null;
  };
  const org = Array.isArray(fila.organizacion) ? fila.organizacion[0] : fila.organizacion;

  return {
    usuarioId: usuario.id,
    email: usuario.email ?? '',
    organizacionId: fila.organizacion_id,
    organizacion: org?.nombre ?? 'Mi inmobiliaria',
    rol: fila.rol,
  };
}

export async function ingresar(email: string, clave: string): Promise<string | null> {
  const sb = await obtenerCliente();
  const { error } = await sb.auth.signInWithPassword({ email, password: clave });
  if (!error) return null;

  // Los mensajes de Supabase vienen en inglés y son crípticos para quien usa
  // la app; los dos casos que pasan de verdad se traducen.
  if (/invalid login credentials/i.test(error.message)) return 'Email o contraseña incorrectos.';
  if (/email not confirmed/i.test(error.message)) return 'Falta confirmar el email.';
  return error.message;
}

export async function salir(): Promise<void> {
  const sb = await obtenerCliente();
  await sb.auth.signOut();
}

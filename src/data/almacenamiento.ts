/**
 * Durabilidad del almacenamiento del navegador.
 *
 * Por defecto, lo que la app guarda en localStorage y en IndexedDB es
 * descartable: si al navegador le falta espacio, puede borrarlo sin avisar.
 * Para una demo da igual; para la cartera real de una inmobiliaria, no.
 *
 * `navigator.storage.persist()` le pide al navegador que lo marque como
 * persistente, y entonces solo se borra si la persona lo borra a mano. Chrome
 * lo concede solo, según cuánto se use el sitio; Firefox pregunta. No se pide
 * al abrir la app: se pide en el momento en que se empieza a cargar lo real,
 * que es cuando tiene sentido y hay un clic de por medio.
 */

export interface EstadoAlmacenamiento {
  /** El navegador soporta la API. Safari viejo y algunos móviles, no. */
  soportado: boolean;
  /** Los datos están protegidos contra el borrado automático. */
  persistente: boolean;
  usadoMB?: number;
  disponibleMB?: number;
}

const aMB = (bytes?: number) =>
  bytes === undefined ? undefined : Math.round((bytes / 1_048_576) * 10) / 10;

export async function estadoDeAlmacenamiento(): Promise<EstadoAlmacenamiento> {
  try {
    if (!navigator.storage?.persisted) return { soportado: false, persistente: false };
    const persistente = await navigator.storage.persisted();
    const cuota = navigator.storage.estimate ? await navigator.storage.estimate() : undefined;
    return {
      soportado: true,
      persistente,
      usadoMB: aMB(cuota?.usage),
      disponibleMB: aMB(cuota?.quota),
    };
  } catch {
    return { soportado: false, persistente: false };
  }
}

/** Devuelve si quedó persistente. Si el navegador no lo soporta, false. */
export async function pedirPersistencia(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

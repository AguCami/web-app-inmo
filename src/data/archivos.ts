/**
 * Depósito de archivos adjuntos.
 *
 * Los PDF y las fotos no pueden ir en `localStorage`: guarda solo texto y el
 * límite ronda los 5 MB para toda la base. Un único contrato escaneado ya lo
 * revienta. Por eso el contenido binario vive en IndexedDB, y en la base
 * principal queda nada más que la ficha del archivo (nombre, tipo, tamaño).
 *
 * Todo lo de acá es asíncrono y tolera fallar: en ventana privada o con el
 * almacenamiento bloqueado la app tiene que seguir andando, aunque sin adjuntos.
 */

const BASE = 'gestion-alquileres';
const ALMACEN = 'archivos';
const VERSION = 1;

/** Tamaño máximo por archivo. Un escaneo de contrato ronda 1 a 5 MB. */
export const MAXIMO_POR_ARCHIVO = 20 * 1024 * 1024;

let conexion: Promise<IDBDatabase> | null = null;

function abrir(): Promise<IDBDatabase> {
  if (conexion) return conexion;
  conexion = new Promise((resolver, rechazar) => {
    const pedido = indexedDB.open(BASE, VERSION);
    pedido.onupgradeneeded = () => {
      const db = pedido.result;
      if (!db.objectStoreNames.contains(ALMACEN)) db.createObjectStore(ALMACEN);
    };
    pedido.onsuccess = () => resolver(pedido.result);
    pedido.onerror = () => rechazar(pedido.error);
  });
  return conexion;
}

async function conAlmacen<T>(
  modo: IDBTransactionMode,
  fn: (almacen: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await abrir();
  return new Promise((resolver, rechazar) => {
    const tx = db.transaction(ALMACEN, modo);
    const pedido = fn(tx.objectStore(ALMACEN));
    pedido.onsuccess = () => resolver(pedido.result);
    pedido.onerror = () => rechazar(pedido.error);
  });
}

export async function guardarArchivo(id: string, contenido: Blob): Promise<void> {
  await conAlmacen('readwrite', (a) => a.put(contenido, id) as IDBRequest<IDBValidKey>);
}

export async function leerArchivo(id: string): Promise<Blob | null> {
  try {
    return (await conAlmacen<Blob | undefined>('readonly', (a) => a.get(id))) ?? null;
  } catch {
    return null;
  }
}

export async function borrarArchivos(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  try {
    const db = await abrir();
    await new Promise<void>((resolver, rechazar) => {
      const tx = db.transaction(ALMACEN, 'readwrite');
      const almacen = tx.objectStore(ALMACEN);
      for (const id of ids) almacen.delete(id);
      tx.oncomplete = () => resolver();
      tx.onerror = () => rechazar(tx.error);
    });
  } catch {
    /* si no se puede limpiar, quedan bytes huérfanos: molesto, no grave */
  }
}

/** Abre el archivo en una pestaña nueva, o lo baja si el navegador no lo puede mostrar. */
export async function abrirArchivo(id: string, nombre: string): Promise<boolean> {
  const contenido = await leerArchivo(id);
  if (!contenido) return false;

  const url = URL.createObjectURL(contenido);
  const a = document.createElement('a');
  a.href = url;
  // Los PDF y las imágenes se ven en el visor del navegador; el resto se baja.
  if (contenido.type === 'application/pdf' || contenido.type.startsWith('image/')) {
    a.target = '_blank';
    a.rel = 'noopener';
  } else {
    a.download = nombre;
  }
  a.click();
  // Se libera tarde: revocar enseguida cancela la descarga en algunos navegadores.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return true;
}

/* ─────────────────── Respaldo: pasar a texto y volver ─────────────── */

export async function aBase64(id: string): Promise<string | null> {
  const contenido = await leerArchivo(id);
  if (!contenido) return null;
  const buffer = await contenido.arrayBuffer();
  let binario = '';
  const bytes = new Uint8Array(buffer);
  // De a pedazos: pasarle el array entero a fromCharCode revienta con archivos grandes.
  for (let i = 0; i < bytes.length; i += 8192) {
    binario += String.fromCharCode(...bytes.subarray(i, i + 8192));
  }
  return btoa(binario);
}

export async function desdeBase64(id: string, base64: string, tipo: string): Promise<void> {
  const binario = atob(base64);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i += 1) bytes[i] = binario.charCodeAt(i);
  await guardarArchivo(id, new Blob([bytes], { type: tipo }));
}

/* ───────────────────────────── Formato ────────────────────────────── */

export function formatearTamano(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} kB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}

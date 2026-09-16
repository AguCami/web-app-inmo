import type { BaseDatos } from '../domain/types';
import { crearBaseDemo, VERSION_BD } from './seed';

const CLAVE = 'inmo-contable/db/v1';

/**
 * Persistencia local. Todo el estado vive en el navegador del usuario, así que
 * cada lectura y escritura va envuelta en try/catch: en ventana privada o con
 * el almacenamiento bloqueado, la app tiene que seguir funcionando en memoria.
 */
export function cargarBase(): BaseDatos {
  try {
    const crudo = localStorage.getItem(CLAVE);
    if (crudo) {
      const datos = JSON.parse(crudo) as BaseDatos;
      if (datos && datos.version === VERSION_BD) return datos;
    }
  } catch {
    /* almacenamiento ilegible: se arranca de la demo */
  }
  // Primera visita (o base de una versión vieja): se deja la demo ya persistida,
  // así lo que el usuario ve en pantalla es lo que queda guardado.
  const demo = crearBaseDemo();
  guardarBase(demo);
  return demo;
}

export function guardarBase(db: BaseDatos): void {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(db));
  } catch {
    /* sin almacenamiento disponible: se sigue trabajando en memoria */
  }
}

export function borrarBase(): void {
  try {
    localStorage.removeItem(CLAVE);
  } catch {
    /* ignorado */
  }
}

export function exportarJSON(db: BaseDatos): void {
  const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `respaldo-inmo-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function importarJSON(archivo: File): Promise<BaseDatos> {
  const texto = await archivo.text();
  const datos = JSON.parse(texto) as BaseDatos;
  if (!datos || !Array.isArray(datos.propiedades)) {
    throw new Error('El archivo no tiene el formato esperado.');
  }
  return { ...datos, version: VERSION_BD };
}

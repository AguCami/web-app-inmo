import type { BaseDatos } from '../domain/types';
import { crearBaseDemo, VERSION_BD } from './seed';

const CLAVE = 'gestion-alquileres/db/v2';

/**
 * Persistencia local. Todo vive en el navegador del usuario, así que cada
 * lectura y escritura va envuelta en try/catch: en ventana privada o con el
 * almacenamiento bloqueado, la app tiene que seguir andando en memoria.
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
  // Primera visita: se deja la demo ya guardada, así lo que se ve es lo que queda.
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

export function exportarJSON(db: BaseDatos): void {
  const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `respaldo-alquileres-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function importarJSON(archivo: File): Promise<BaseDatos> {
  const datos = JSON.parse(await archivo.text()) as BaseDatos;
  if (!datos || !Array.isArray(datos.propiedades) || !Array.isArray(datos.contratos)) {
    throw new Error('El archivo no tiene el formato esperado.');
  }
  return { ...datos, version: VERSION_BD };
}

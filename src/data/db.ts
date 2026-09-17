import type { BaseDatos } from '../domain/types';
import { sanear } from '../domain/integridad';
import { aBase64, borrarArchivos, desdeBase64 } from './archivos';
import { crearBaseDemo, VERSION_BD } from './seed';

const CLAVE = 'gestion-alquileres/db/v3';

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
      if (datos && datos.version === VERSION_BD) {
        // Repara bases que quedaron con huérfanos de versiones anteriores,
        // cuando borrar un contrato no arrastraba sus cuotas.
        const { db, huboCambios, archivosHuerfanos } = sanear(datos);
        if (huboCambios) {
          guardarBase(db);
          void borrarArchivos(archivosHuerfanos);
        }
        return db;
      }
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

/** El respaldo lleva los adjuntos adentro: si no, sería una copia incompleta. */
interface Respaldo extends BaseDatos {
  archivos?: Record<string, string>;
}

export async function exportarJSON(db: BaseDatos): Promise<void> {
  const archivos: Record<string, string> = {};
  for (const adjunto of db.adjuntos) {
    const contenido = await aBase64(adjunto.id);
    if (contenido) archivos[adjunto.id] = contenido;
  }

  const respaldo: Respaldo = { ...db, archivos };
  const blob = new Blob([JSON.stringify(respaldo, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `respaldo-alquileres-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function importarJSON(archivo: File): Promise<BaseDatos> {
  const datos = JSON.parse(await archivo.text()) as Respaldo;
  if (!datos || !Array.isArray(datos.propiedades) || !Array.isArray(datos.contratos)) {
    throw new Error('El archivo no tiene el formato esperado.');
  }

  const { archivos, ...base } = datos;
  const adjuntos = base.adjuntos ?? [];

  // Se reponen los binarios en IndexedDB antes de devolver la base.
  for (const adjunto of adjuntos) {
    const contenido = archivos?.[adjunto.id];
    if (contenido) await desdeBase64(adjunto.id, contenido, adjunto.tipo);
  }

  return {
    ...base,
    version: VERSION_BD,
    adjuntos,
    novedades: base.novedades ?? [],
  };
}

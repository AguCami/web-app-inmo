import type { Periodo } from '../domain/types';
import { problemaDeSerie, serieDeCSV, serieDeFilas, unirSeries } from '../domain/ipcCordoba';

/**
 * Trae el IPC de Córdoba directo del portal de Estadística y Censos, desde el
 * navegador de quien abre la app.
 *
 * Por qué desde el navegador: el portal no les contesta a los servidores de
 * afuera de Argentina (GitHub Actions corre en Estados Unidos y recibe 404),
 * pero sí a una compu en Córdoba. Y por qué JSONP: el API de CKAN no manda
 * permisos CORS, pero acepta `callback=` y devuelve el JSON envuelto en una
 * llamada, que el navegador sí deja cargar como script.
 */

const PORTAL = 'https://datosestadistica.cba.gov.ar';
/** El dataset «Índice de Precios al Consumidor», que existe desde 2017. */
const DATASET = 'indic';
const ESPERA_MS = 20_000;

interface Recurso {
  id: string;
  name?: string;
  description?: string;
  format?: string;
  url?: string;
  datastore_active?: boolean;
  position?: number;
}

let llamadas = 0;

/** Pide una acción del API de CKAN por JSONP. */
function pedirCKAN<T>(accion: string, parametros: Record<string, string>): Promise<T> {
  return new Promise((resolver, rechazar) => {
    const nombre = `__ipcCba${Date.now().toString(36)}${(llamadas++).toString(36)}`;
    const url = new URL(`/api/3/action/${accion}`, PORTAL);
    for (const [k, v] of Object.entries(parametros)) url.searchParams.set(k, v);
    url.searchParams.set('callback', nombre);

    const script = document.createElement('script');
    const global = window as unknown as Record<string, unknown>;
    const limpiar = () => {
      clearTimeout(reloj);
      delete global[nombre];
      script.remove();
    };
    const reloj = setTimeout(() => {
      limpiar();
      rechazar(new Error('El portal de Estadística no contestó a tiempo.'));
    }, ESPERA_MS);

    global[nombre] = (respuesta: { success?: boolean; result?: T; error?: unknown }) => {
      limpiar();
      if (respuesta?.success) resolver(respuesta.result as T);
      else rechazar(new Error('El portal de Estadística devolvió un error.'));
    };
    script.onerror = () => {
      limpiar();
      rechazar(new Error('No se pudo llegar al portal de Estadística.'));
    };
    script.src = url.toString();
    document.head.appendChild(script);
  });
}

/**
 * Las planillas del nivel general en la base vigente (jun-nov 2025 = 100).
 * Se dejan afuera las de base 2014 = 100: sus números son de otra escala y
 * mezclarlas rompería los ajustes. La serie empalmada va primero porque es
 * la que trae la historia larga; después, las mensuales.
 */
function planillasUtiles(recursos: Recurso[]): Recurso[] {
  const texto = (r: Recurso) => `${r.name ?? ''} ${r.description ?? ''}`.toLowerCase();
  return recursos
    .filter((r) => ['CSV', 'XLSX', 'XLS'].includes(String(r.format ?? '').toUpperCase()))
    .filter((r) => texto(r).includes('ipc'))
    .filter((r) => !/2014\s*=\s*100/.test(texto(r)))
    .sort((a, b) => {
      const empalme = (r: Recurso) => (texto(r).includes('empalme') ? 0 : 1);
      return empalme(a) - empalme(b) || (a.position ?? 0) - (b.position ?? 0);
    });
}

async function serieDelDatastore(recurso: Recurso): Promise<Map<Periodo, number>> {
  if (!recurso.datastore_active) return new Map();
  const r = await pedirCKAN<{ records?: Record<string, unknown>[] }>('datastore_search', {
    resource_id: recurso.id,
    limit: '20',
  });
  return serieDeFilas(r.records ?? []);
}

/**
 * El intermediario de Cloudflare (`cloudflare/proxy-ipc.js`). El portal no
 * manda permisos CORS, así que el navegador no deja leer sus archivos
 * directo: los baja el Worker y los pasa con el permiso puesto. Sin esta
 * variable, la app se arregla con la tabla del datastore.
 */
const PROXY = (import.meta.env.VITE_PROXY_IPC as string | undefined)?.replace(/\/$/, '');

/**
 * El archivo CSV completo. Suele estar más al día que la tabla del
 * datastore, que la Provincia no siempre refresca: en noviembre de 2026 la
 * tabla llegaba a julio y el archivo, a septiembre.
 */
async function serieDelArchivo(recurso: Recurso): Promise<Map<Periodo, number>> {
  if (!PROXY || String(recurso.format).toUpperCase() !== 'CSV' || !recurso.url) return new Map();
  try {
    const r = await fetch(`${PROXY}/?url=${encodeURIComponent(recurso.url)}`, { cache: 'no-cache' });
    if (!r.ok) return new Map();
    return serieDeCSV(await r.text());
  } catch {
    return new Map();
  }
}

export interface ResultadoIpcCordoba {
  serie: Map<Periodo, number>;
  ultimo: Periodo;
}

/** Trae, une y controla la serie. Si algo no cierra, falla con un mensaje claro. */
export async function traerIpcCordoba(): Promise<ResultadoIpcCordoba> {
  const paquete = await pedirCKAN<{ resources?: Recurso[] }>('package_show', { id: DATASET });
  const planillas = planillasUtiles(paquete.resources ?? []);
  if (planillas.length === 0) throw new Error('El portal ya no publica la planilla del IPC donde la buscamos.');

  const delDatastore = await Promise.all(
    planillas.map((p) => serieDelDatastore(p).catch(() => new Map<Periodo, number>())),
  );
  const deArchivos = await Promise.all(planillas.map(serieDelArchivo));

  // Primero lo del datastore, que siempre se puede leer; después los archivos,
  // que pueden traer los meses más nuevos.
  const { serie } = unirSeries([...delDatastore, ...deArchivos]);
  const problema = problemaDeSerie(serie);
  if (problema) throw new Error(`No usamos el IPC de Córdoba que bajamos: ${problema}`);

  const ultimo = [...serie.keys()].sort().pop()!;
  return { serie, ultimo };
}

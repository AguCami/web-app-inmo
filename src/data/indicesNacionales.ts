import type { Periodo } from '../domain/types';
import { problemaDeSerie } from '../domain/ipcCordoba';
import { serieICL, serieIPCNacional } from '../domain/indicesNacionales';
import { hoy } from '../domain/util';

/**
 * Trae el ICL del BCRA y el IPC nacional del INDEC. Pasan por el mismo
 * intermediario de Cloudflare que el IPC de Córdoba (`cloudflare/proxy-ipc.js`)
 * para no depender de que esas APIs den permisos CORS al navegador.
 */
const PROXY = (import.meta.env.VITE_PROXY_IPC as string | undefined)?.replace(/\/$/, '');

/** Desde cuándo se piden los datos: alcanza para el contrato más viejo. */
const DESDE = '2022-01-01';

/** Variable 40 del API de estadísticas del BCRA: ICL, Ley 27.551. */
const ICL_BCRA = 40;
/** IPC nivel general nacional, INDEC, base diciembre 2016 = 100. */
const IPC_INDEC = '148.3_INIVELNAL_DICI_M_26';

async function pedirJSON(destino: string): Promise<unknown> {
  if (!PROXY) throw new Error('Falta configurar el intermediario de Cloudflare.');
  const r = await fetch(`${PROXY}/?url=${encodeURIComponent(destino)}`, { cache: 'no-cache' });
  if (!r.ok) throw new Error(`La fuente respondió ${r.status}.`);
  return r.json();
}

function controlar(serie: Map<Periodo, number>, nombre: string) {
  const problema = problemaDeSerie(serie);
  if (problema) throw new Error(`No usamos el ${nombre} que bajamos: ${problema}`);
  return { serie, ultimo: [...serie.keys()].sort().pop()! };
}

export async function traerICL() {
  // El API cambió de versión más de una vez: se prueba la nueva y, si no
  // está, la anterior.
  let ultimoError: unknown;
  for (const version of ['v4.0', 'v3.0']) {
    try {
      const url = `https://api.bcra.gob.ar/estadisticas/${version}/monetarias/${ICL_BCRA}?desde=${DESDE}&hasta=${hoy()}&limit=3000`;
      const serie = serieICL(await pedirJSON(url));
      if (serie.size > 0) return controlar(serie, 'ICL');
    } catch (e) {
      ultimoError = e;
    }
  }
  throw ultimoError instanceof Error ? ultimoError : new Error('El BCRA no devolvió el ICL.');
}

export async function traerIPCNacional() {
  const url = `https://apis.datos.gob.ar/series/api/series/?ids=${IPC_INDEC}&format=json&limit=1000&start_date=${DESDE}`;
  return controlar(serieIPCNacional(await pedirJSON(url)), 'IPC nacional');
}

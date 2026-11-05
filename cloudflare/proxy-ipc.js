/**
 * Intermediario para bajar los índices de actualización de los alquileres.
 *
 * Ni el portal de Estadística de Córdoba ni las APIs nacionales le dan
 * permisos CORS a la app, así que el navegador no la deja leerlos. Este
 * Worker los baja y se los pasa con el permiso puesto.
 *
 * Solo acepta tres fuentes —la planilla del IPC de Córdoba, el ICL del BCRA y
 * el IPC nacional del INDEC— y solo responde a la app: no es un proxy abierto
 * que cualquiera pueda usar para otra cosa.
 *
 * Se instala pegándolo en Cloudflare → Workers (ver README, «El IPC de
 * Córdoba, actualizado solo»).
 */
const DATASET_IPC = 'fedc5285-5517-41aa-9095-bb62c6dbc485';
const PERMITIDOS = [
  // Planillas del IPC de Córdoba (Estadística y Censos).
  new RegExp(
    `^https://datosestadistica\\.cba\\.gov\\.ar/dataset/${DATASET_IPC}/resource/[0-9a-f-]+/download/[^/?#]+\\.(csv|xlsx)$`,
    'i',
  ),
  // ICL del BCRA (variable 40).
  /^https:\/\/api\.bcra\.gob\.ar\/estadisticas\/v[34]\.0\/monetarias\/40\?[\w=&.-]*$/,
  // IPC nacional del INDEC, en el API de series de tiempo.
  /^https:\/\/apis\.datos\.gob\.ar\/series\/api\/series\/\?ids=148\.3_INIVELNAL_DICI_M_26(&[\w=.-]*)*$/,
];
const ORIGENES = [
  'https://gestion.inversionesgeneralesmym.com.ar',
  'https://agucami.github.io',
  'http://localhost:5173',
  'http://127.0.0.1:4173',
];

export default {
  async fetch(request) {
    const origen = request.headers.get('Origin') ?? '';
    const cors = {
      'Access-Control-Allow-Origin': ORIGENES.includes(origen) ? origen : ORIGENES[0],
      Vary: 'Origin',
    };
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: { ...cors, 'Access-Control-Allow-Methods': 'GET' } });
    }
    if (request.method !== 'GET') {
      return new Response('Método no permitido', { status: 405, headers: cors });
    }

    const destino = new URL(request.url).searchParams.get('url') ?? '';
    if (!PERMITIDOS.some((r) => r.test(destino))) {
      return new Response('Este intermediario solo baja los índices de los alquileres.', {
        status: 400,
        headers: cors,
      });
    }

    try {
      // Cloudflare guarda la copia unas horas: los datos salen una vez por mes
      // (el ICL, una vez por día, y se usa el del primero de cada mes).
      const respuesta = await fetch(destino, {
        cf: { cacheTtl: 6 * 60 * 60, cacheEverything: true },
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; gestion-alquileres)' },
      });
      return new Response(respuesta.body, {
        status: respuesta.status,
        headers: {
          ...cors,
          'Content-Type': respuesta.headers.get('Content-Type') ?? 'application/octet-stream',
          'Cache-Control': 'public, max-age=3600',
        },
      });
    } catch (e) {
      return new Response(`No se pudo llegar al portal: ${e.message}`, { status: 502, headers: cors });
    }
  },
};

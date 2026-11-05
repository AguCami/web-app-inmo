/**
 * Intermediario para bajar las planillas del IPC de Córdoba.
 *
 * El portal de Estadística (datosestadistica.cba.gov.ar) no manda permisos
 * CORS, así que el navegador no deja que la app lea sus archivos. Este Worker
 * los baja y se los pasa a la app con el permiso puesto.
 *
 * Solo acepta archivos del dataset del IPC de Córdoba y solo responde a la
 * app: no es un proxy abierto que cualquiera pueda usar para otra cosa.
 *
 * Se instala pegándolo en Cloudflare → Workers (ver README, «El IPC de
 * Córdoba, actualizado solo»).
 */
const DATASET_IPC = 'fedc5285-5517-41aa-9095-bb62c6dbc485';
const PERMITIDO = new RegExp(
  `^https://datosestadistica\\.cba\\.gov\\.ar/dataset/${DATASET_IPC}/resource/[0-9a-f-]+/download/[^/?#]+\\.(csv|xlsx)$`,
  'i',
);
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
    if (!PERMITIDO.test(destino)) {
      return new Response('Este intermediario solo baja planillas del IPC de Córdoba.', {
        status: 400,
        headers: cors,
      });
    }

    try {
      // Cloudflare guarda la copia unas horas: el dato sale una vez por mes.
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

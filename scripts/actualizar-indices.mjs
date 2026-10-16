/**
 * Actualiza `public/indices.json` con el último IPC publicado por la Dirección
 * General de Estadística y Censos de la Provincia de Córdoba.
 *
 * Lo corre una tarea programada de GitHub Actions. La app lee ese archivo al
 * abrir y lo mezcla con la serie que tiene guardada, así los contratos que
 * ajustan por IPC Córdoba se actualizan solos cuando sale el dato del mes.
 *
 * ESTADO (oct 2026) — desde GitHub Actions no se llega a la fuente. El runner
 * sale por un datacenter de Microsoft en Estados Unidos y los sitios de la
 * Provincia responden distinto según de dónde les pregunten:
 *
 *   datosestadistica.cba.gov.ar  CKAN 2.11.5 vivo, pero 404 en todas las rutas,
 *                                la raíz incluida, con y sin user-agent de
 *                                navegador. El buscador sí tiene indexados sus
 *                                datasets, así que desde Argentina anda.
 *   estadistica.cba.gov.ar       CloudFront devuelve siempre la misma cáscara
 *                                de 1357 bytes, con "x-cache: Error from
 *                                cloudfront": el origen está fallando.
 *   prensa.cba.gov.ar            403 "Request blocked" del WAF.
 *   apis.datos.gob.ar            responde bien, pero no publica el IPC de
 *                                Córdoba (sí el de Tucumán, Santa Fe, Chaco
 *                                y CABA).
 *
 * Por eso el script distingue dos cosas que antes trataba igual:
 *
 *   · Si no se puede LLEGAR a la fuente —no resuelve, la bloquean, contesta
 *     404 o 5xx— avisa y termina bien. Es una condición de afuera y que la
 *     tarea quede en rojo todos los días no la arregla.
 *   · Si la fuente CONTESTA con datos y no se los puede interpretar, falla y
 *     deja la corrida en rojo, sin tocar el archivo. Eso sí hay que mirarlo:
 *     es la diferencia entre no actualizar y actualizar mal.
 *
 * Mientras tanto los índices se cargan a mano en Ajustes, que es donde siempre
 * se pueden corregir.
 *
 *   node scripts/actualizar-indices.mjs           # escribe si hay algo nuevo
 *   node scripts/actualizar-indices.mjs --dry-run # solo informa
 */
import { readFile, writeFile } from 'node:fs/promises';
import { appendFileSync, existsSync } from 'node:fs';

const ARCHIVO = new URL('../public/indices.json', import.meta.url);
const PORTAL = 'https://datosestadistica.cba.gov.ar';
const SOLO_INFORMAR = process.argv.includes('--dry-run');

/** Términos con los que se busca el dataset en el portal CKAN del organismo. */
const BUSQUEDA = 'indice precios al consumidor';

/*
 * En Actions, lo que el script imprime queda enterrado en el log del job, que
 * solo se puede leer entrando a la web. Lo importante va además como anotación
 * (`::notice::`, `::error::`): aparece arriba de todo en la corrida y se puede
 * consultar por API. GitHub acepta hasta diez por nivel y por paso.
 */
const EN_ACTIONS = Boolean(process.env.GITHUB_ACTIONS);
const bitacora = [];
let notas = 0;

function anotar(nivel, mensaje) {
  bitacora.push(mensaje);
  if (!EN_ACTIONS) return;
  if (nivel === 'notice' && notas++ >= 9) return;
  console.log(`::${nivel}::${mensaje.replace(/\r?\n/g, '%0A')}`);
}

function informar(mensaje) {
  console.log(mensaje);
  anotar('notice', mensaje);
}

/**
 * Deja el detalle en el resumen de la corrida, que es donde se lee cómodo.
 * Escribe sincrónico a propósito: `abortar` no debe devolver el control a
 * quien lo llamó, y con un await de por medio el código que sigue al llamado
 * se ejecutaría igual antes del exit.
 */
function volcarResumen(titulo) {
  const destino = process.env.GITHUB_STEP_SUMMARY;
  if (!destino) return;
  const cuerpo = bitacora.map((l) => `- ${l}`).join('\n');
  try {
    appendFileSync(destino, `## ${titulo}\n\n${cuerpo}\n`);
  } catch {
    /* el resumen es un lujo, no vale perder la corrida por él */
  }
}

/**
 * La fuente no se dejó consultar. No es culpa del script ni hay nada que
 * arreglar acá, así que se avisa y se termina bien: dejar la tarea en rojo
 * todos los días hasta que el organismo vuelva solo entrena a ignorarla.
 */
function rendirse(mensaje) {
  anotar('warning', mensaje);
  console.warn(`\n⚠ ${mensaje}\n`);
  console.warn('El archivo no se modificó. Los índices se cargan a mano en Ajustes.');
  volcarResumen('No se pudo consultar el IPC de Córdoba');
  process.exit(0);
}

/**
 * La fuente contestó con datos y no se los pudo interpretar. Esto sí hay que
 * mirarlo: es la diferencia entre no actualizar y actualizar mal.
 */
function abortar(mensaje) {
  anotar('error', mensaje);
  console.error(`\n✗ ${mensaje}\n`);
  console.error('El archivo no se modificó. Revisá la fuente y ajustá el parseo de este script.');
  volcarResumen('No se pudo actualizar el IPC de Córdoba');
  process.exit(1);
}

/** Trae y descifra una respuesta, contando con claridad cómo falló si falla. */
async function pedir(url, comoJSON) {
  let r;
  try {
    r = await fetch(url, { headers: comoJSON ? { accept: 'application/json' } : {} });
  } catch (e) {
    // El mensaje de fetch solo dice "fetch failed"; la causa está adentro.
    rendirse(`No pude conectarme a ${url} — ${e.cause?.message ?? e.message}`);
  }
  if (!r.ok) rendirse(`${url} respondió ${r.status} ${r.statusText}`);

  const texto = await r.text();
  if (!comoJSON) return texto;
  try {
    return JSON.parse(texto);
  } catch {
    // En vez del API contestó un portal de error o un muro de bot: tampoco se
    // pudo llegar a los datos, por más que el código HTTP diga 200.
    rendirse(
      `${url} no devolvió JSON sino ${r.headers.get('content-type') ?? '?'}: ${texto.slice(0, 180)}`,
    );
  }
}

const traerJSON = (url) => pedir(url, true);

/** Busca en el portal el recurso tabular de la serie del IPC. */
async function ubicarRecurso() {
  const busqueda = new URL('/api/3/action/package_search', PORTAL);
  busqueda.searchParams.set('q', BUSQUEDA);
  busqueda.searchParams.set('rows', '20');

  const datos = await traerJSON(busqueda);
  const paquetes = datos?.result?.results;
  if (!Array.isArray(paquetes) || paquetes.length === 0) {
    abortar(`El portal no devolvió datasets para "${BUSQUEDA}".`);
  }

  informar(`Datasets encontrados: ${paquetes.length}`);
  for (const p of paquetes.slice(0, 6)) informar(`· ${p.title ?? p.name}`);

  const formatosUtiles = ['CSV', 'XLSX', 'XLS', 'JSON'];
  for (const paquete of paquetes) {
    for (const recurso of paquete.resources ?? []) {
      const formato = String(recurso.format ?? '').toUpperCase();
      if (!formatosUtiles.includes(formato)) continue;
      const nombre = `${paquete.title ?? ''} ${recurso.name ?? ''}`.toLowerCase();
      if (!nombre.includes('ipc') && !nombre.includes('precios al consumidor')) continue;
      return {
        url: recurso.url,
        formato,
        id: recurso.id,
        nombre: `${paquete.title} — ${recurso.name}`,
      };
    }
  }
  abortar('Encontré datasets pero ninguno con un recurso CSV/XLSX del IPC.');
}

/**
 * Convierte el CSV en pares período → número índice.
 * Se acepta cualquier columna cuyo encabezado mencione el período y el índice,
 * porque el organismo cambió los nombres más de una vez.
 */
function parsearCSV(texto) {
  const lineas = texto.split(/\r?\n/).filter((l) => l.trim());
  if (lineas.length < 2) abortar('El CSV vino vacío.');

  const separador = lineas[0].includes(';') ? ';' : ',';
  const encabezados = lineas[0].split(separador).map((h) => h.trim().toLowerCase());

  const iPeriodo = encabezados.findIndex((h) => /periodo|período|mes|fecha/.test(h));
  const iValor = encabezados.findIndex((h) => /indice|índice|nivel general|valor/.test(h));
  if (iPeriodo === -1 || iValor === -1) {
    abortar(`No reconozco las columnas del CSV. Encabezados: ${encabezados.join(' | ')}`);
  }

  const serie = new Map();
  for (const linea of lineas.slice(1)) {
    const celdas = linea.split(separador);
    const periodo = normalizarPeriodo(celdas[iPeriodo]?.trim());
    const valor = Number(String(celdas[iValor] ?? '').trim().replace(/\./g, '').replace(',', '.'));
    if (!periodo || !Number.isFinite(valor) || valor <= 0) continue;
    serie.set(periodo, Math.round(valor * 100) / 100);
  }

  if (serie.size === 0) abortar('El CSV se leyó pero no salió ningún período válido.');
  return serie;
}

const MESES = {
  ene: '01', enero: '01', feb: '02', febrero: '02', mar: '03', marzo: '03',
  abr: '04', abril: '04', may: '05', mayo: '05', jun: '06', junio: '06',
  jul: '07', julio: '07', ago: '08', agosto: '08', sep: '09', septiembre: '09',
  oct: '10', octubre: '10', nov: '11', noviembre: '11', dic: '12', diciembre: '12',
};

/** Acepta 2026-09, 09/2026, "septiembre 2026" y variantes. */
function normalizarPeriodo(crudo) {
  if (!crudo) return null;
  const texto = crudo.toLowerCase().trim();

  let m = texto.match(/(\d{4})[-/](\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}`;

  m = texto.match(/(\d{1,2})[-/](\d{4})/);
  if (m) return `${m[2]}-${m[1].padStart(2, '0')}`;

  m = texto.match(/([a-záéíóú]+)[\s-]+(?:de\s+)?(\d{4})/);
  if (m && MESES[m[1]]) return `${m[2]}-${MESES[m[1]]}`;

  return null;
}

/* ─────────────────────────────── Corrida ─────────────────────────── */

const recurso = await ubicarRecurso();
informar(`Usando: ${recurso.nombre} — ${recurso.url}`);

/**
 * La última vez que se pudo ver el catálogo, la serie estaba publicada como
 * planilla. Antes de rendirse con eso: si el recurso está cargado en el
 * datastore de CKAN, el mismo contenido sale en JSON y no hace falta leer
 * XLSX. Es la vía preferida incluso para los CSV, porque ya viene en filas.
 */
async function traerDelDatastore(id) {
  if (!id) return null;
  const consulta = new URL('/api/3/action/datastore_search', PORTAL);
  consulta.searchParams.set('resource_id', id);
  consulta.searchParams.set('limit', '2000');

  const datos = await traerJSON(consulta);
  const filas = datos?.result?.records;
  if (!Array.isArray(filas) || filas.length === 0) return null;

  const columnas = Object.keys(filas[0]);
  const cPeriodo = columnas.find((c) => /periodo|período|mes|fecha/i.test(c));
  const cValor = columnas.find((c) => /indice|índice|nivel general|valor/i.test(c));
  if (!cPeriodo || !cValor) {
    abortar(`El datastore no tiene columnas reconocibles. Columnas: ${columnas.join(' | ')}`);
  }

  const serie = new Map();
  for (const fila of filas) {
    const periodo = normalizarPeriodo(String(fila[cPeriodo] ?? '').trim());
    const valor = Number(String(fila[cValor] ?? '').trim().replace(/\./g, '').replace(',', '.'));
    if (!periodo || !Number.isFinite(valor) || valor <= 0) continue;
    serie.set(periodo, Math.round(valor * 100) / 100);
  }
  if (serie.size === 0) abortar('El datastore se leyó pero no salió ningún período válido.');
  informar(`Leído del datastore de CKAN: ${serie.size} períodos.`);
  return serie;
}

let serieNueva = await traerDelDatastore(recurso.id);

if (!serieNueva) {
  if (recurso.formato !== 'CSV' && recurso.formato !== 'JSON') {
    abortar(
      `El recurso es ${recurso.formato}, no está en el datastore y este script no lee planillas. ` +
        'Agregá el parseo de XLSX o pedile al organismo el recurso en CSV.',
    );
  }
  serieNueva = parsearCSV(await pedir(recurso.url, false));
}

const periodos = [...serieNueva.keys()].sort();
informar(
  `Períodos leídos: ${periodos.length} (de ${periodos[0]} a ${periodos[periodos.length - 1]})`,
);

const previo = existsSync(ARCHIVO)
  ? JSON.parse(await readFile(ARCHIVO, 'utf8'))
  : { fuente: PORTAL, serie: [] };

const porPeriodo = new Map(previo.serie.map((f) => [f.periodo, f]));
let cambios = 0;
for (const [periodo, valor] of serieNueva) {
  const actual = porPeriodo.get(periodo);
  if (actual?.IPC_CBA === valor) continue;
  porPeriodo.set(periodo, { ...actual, periodo, IPC_CBA: valor, provisorio: false });
  cambios += 1;
}

if (cambios === 0) {
  informar('Sin novedades: la serie publicada ya estaba al día.');
  volcarResumen('IPC de Córdoba');
  process.exit(0);
}

const salida = {
  fuente: PORTAL,
  recurso: recurso.url,
  actualizado: new Date().toISOString(),
  serie: [...porPeriodo.values()].sort((a, b) => a.periodo.localeCompare(b.periodo)),
};

informar(`${cambios} períodos nuevos o corregidos.`);
if (SOLO_INFORMAR) {
  console.log('(--dry-run: no se escribió nada)');
  volcarResumen('IPC de Córdoba');
  process.exit(0);
}

await writeFile(ARCHIVO, `${JSON.stringify(salida, null, 2)}\n`);
informar('Escrito public/indices.json');
volcarResumen('IPC de Córdoba');

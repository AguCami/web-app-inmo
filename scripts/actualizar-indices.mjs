/**
 * Actualiza `public/indices.json` con el último IPC publicado por la Dirección
 * General de Estadística y Censos de la Provincia de Córdoba.
 *
 * Lo corre una tarea programada de GitHub Actions. La app lee ese archivo al
 * abrir y lo mezcla con la serie que tiene guardada, así los contratos que
 * ajustan por IPC Córdoba se actualizan solos cuando sale el dato del mes.
 *
 * IMPORTANTE — este script todavía no se probó contra la fuente real: el
 * entorno donde se escribió tiene bloqueado el dominio del organismo. Por eso
 * está hecho para fallar fuerte y claro en vez de publicar cualquier cosa: si
 * no encuentra la serie o no la puede interpretar, sale con error y NO toca el
 * archivo. La primera corrida en Actions va a decir exactamente qué devuelve
 * la fuente, y con eso se termina de ajustar el parseo.
 *
 *   node scripts/actualizar-indices.mjs           # escribe si hay algo nuevo
 *   node scripts/actualizar-indices.mjs --dry-run # solo informa
 */
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const ARCHIVO = new URL('../public/indices.json', import.meta.url);
const PORTAL = 'https://datosestadistica.cba.gov.ar';
const SOLO_INFORMAR = process.argv.includes('--dry-run');

/** Términos con los que se busca el dataset en el portal CKAN del organismo. */
const BUSQUEDA = 'indice precios al consumidor';

function abortar(mensaje) {
  console.error(`\n✗ ${mensaje}\n`);
  console.error('El archivo no se modificó. Revisá la fuente y ajustá el parseo de este script.');
  process.exit(1);
}

async function traerJSON(url) {
  const r = await fetch(url, { headers: { accept: 'application/json' } });
  if (!r.ok) abortar(`${url} respondió ${r.status}`);
  return r.json();
}

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

  console.log(`Datasets encontrados: ${paquetes.length}`);
  for (const p of paquetes) console.log(`  · ${p.title ?? p.name}`);

  const formatosUtiles = ['CSV', 'XLSX', 'XLS', 'JSON'];
  for (const paquete of paquetes) {
    for (const recurso of paquete.resources ?? []) {
      const formato = String(recurso.format ?? '').toUpperCase();
      if (!formatosUtiles.includes(formato)) continue;
      const nombre = `${paquete.title ?? ''} ${recurso.name ?? ''}`.toLowerCase();
      if (!nombre.includes('ipc') && !nombre.includes('precios al consumidor')) continue;
      return { url: recurso.url, formato, nombre: `${paquete.title} — ${recurso.name}` };
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
console.log(`\nUsando: ${recurso.nombre}\n  ${recurso.url}`);

if (recurso.formato !== 'CSV' && recurso.formato !== 'JSON') {
  abortar(
    `El recurso es ${recurso.formato} y este script solo lee CSV/JSON. ` +
      'Agregá el parseo de planilla o pedile al organismo el recurso en CSV.',
  );
}

const respuesta = await fetch(recurso.url);
if (!respuesta.ok) abortar(`La descarga respondió ${respuesta.status}`);
const serieNueva = parsearCSV(await respuesta.text());

const periodos = [...serieNueva.keys()].sort();
console.log(`Períodos leídos: ${periodos.length} (de ${periodos[0]} a ${periodos[periodos.length - 1]})`);

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
  console.log('\n✓ Sin novedades: la serie publicada ya estaba al día.');
  process.exit(0);
}

const salida = {
  fuente: PORTAL,
  recurso: recurso.url,
  actualizado: new Date().toISOString(),
  serie: [...porPeriodo.values()].sort((a, b) => a.periodo.localeCompare(b.periodo)),
};

console.log(`\n✓ ${cambios} períodos nuevos o corregidos.`);
if (SOLO_INFORMAR) {
  console.log('(--dry-run: no se escribió nada)');
  process.exit(0);
}

await writeFile(ARCHIVO, `${JSON.stringify(salida, null, 2)}\n`);
console.log('Escrito public/indices.json');

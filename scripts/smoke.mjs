/**
 * Verificación de humo sobre la app construida.
 *
 *   npm run build && npm run preview &
 *   npm run smoke
 */
import { chromium } from 'playwright';

const BASE = process.env.URL_BASE ?? 'http://127.0.0.1:4173';
const EJECUTABLE = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const RUTAS = [
  ['Cobranza', '/'],
  ['Cobranzas', '/cobranzas'],
  ['Contratos', '/contratos'],
  ['Propiedades', '/propiedades'],
  ['Liquidaciones', '/liquidaciones'],
  ['Gastos', '/gastos'],
  ['Personas', '/personas'],
  ['Ajustes', '/ajustes'],
];

let fallos = 0;
const comprobar = (nombre, ok, detalle = '') => {
  if (!ok) fallos += 1;
  console.log(`${ok ? '✓' : '✗'} ${nombre}${detalle ? ` — ${detalle}` : ''}`);
};

const navegador = await chromium.launch({ executablePath: EJECUTABLE });
const pagina = await navegador.newPage({ viewport: { width: 1440, height: 1000 } });

const errores = [];
pagina.on('pageerror', (e) => errores.push(`pageerror: ${e.message}`));
pagina.on('console', (m) => {
  // La tipografía se sirve de Google Fonts: si la red del CI la bloquea, la app
  // cae al stack del sistema y eso no es una falla de la app.
  const texto = m.text();
  if (m.type() === 'error' && !texto.includes('ERR_CERT') && !texto.includes('fonts.g')) {
    errores.push(`console: ${texto}`);
  }
});

/* ── 1. Todas las pantallas cargan ───────────────────────────────── */
for (const [titulo, ruta] of RUTAS) {
  await pagina.goto(`${BASE}/#${ruta}`, { waitUntil: 'networkidle' });
  const h1 = await pagina.locator('h1').first().textContent();
  const alto = await pagina.evaluate(() => document.documentElement.scrollHeight);
  comprobar(`carga ${titulo}`, h1?.includes(titulo) && alto < 6000, `${alto} px`);
}

/* ── 2. Cobrar baja la deuda y persiste ──────────────────────────── */
await pagina.goto(`${BASE}/#/cobranzas`, { waitUntil: 'networkidle' });
const vencido = () =>
  pagina.locator('.dato', { hasText: 'Vencido' }).locator('.dato__valor').first().textContent();
const antes = await vencido();
await pagina.locator('button', { hasText: 'Cobrar' }).first().click();
await pagina.waitForSelector('[role="dialog"]');
await pagina.locator('[role="dialog"] button', { hasText: 'Cobrar' }).click();
await pagina.waitForTimeout(400);
const despues = await vencido();
comprobar('cobrar baja el vencido', antes !== despues, `${antes?.trim()} → ${despues?.trim()}`);

await pagina.reload({ waitUntil: 'networkidle' });
await pagina.waitForTimeout(300);
comprobar('la cobranza persiste tras recargar', (await vencido()) === despues);

/* ── 3. La cobranza tardía se rinde en una complementaria ────────── */
await pagina.goto(`${BASE}/#/liquidaciones`, { waitUntil: 'networkidle' });
const filas = () => pagina.locator('.item').count();
const filasAntes = await filas();
await pagina.locator('button', { hasText: 'Generar' }).click();
await pagina.waitForTimeout(400);
comprobar('la cobranza tardía se liquida', (await filas()) > filasAntes);

const filasMedio = await filas();
await pagina.locator('button', { hasText: 'Generar' }).click();
await pagina.waitForTimeout(400);
comprobar('generar de nuevo no duplica', (await filas()) === filasMedio);

/* ── 4. El cronograma de ajustes se calcula ──────────────────────── */
await pagina.goto(`${BASE}/#/contratos`, { waitUntil: 'networkidle' });
await pagina.locator('.carta').first().click();
await pagina.waitForTimeout(300);
await pagina.locator('.segmentos button', { hasText: 'Actualizaciones' }).click();
await pagina.waitForTimeout(400);
const tramos = await pagina.locator('.tramo').count();
comprobar('el contrato muestra su cronograma', tramos >= 2, `${tramos} tramos`);
comprobar('marca cuál rige hoy', (await pagina.locator('.tramo--vigente').count()) === 1);

/* ── 5. Alta de persona ──────────────────────────────────────────── */
await pagina.goto(`${BASE}/#/personas`, { waitUntil: 'networkidle' });
await pagina.locator('button', { hasText: 'Nueva persona' }).click();
await pagina.waitForSelector('[role="dialog"]');
await pagina.locator('[role="dialog"] input').first().fill('Prueba Automatizada');
await pagina.locator('[role="dialog"] button', { hasText: 'Guardar' }).click();
await pagina.waitForTimeout(300);
await pagina.locator('.buscador input').fill('Prueba Automatizada');
await pagina.waitForTimeout(300);
comprobar('alta de persona', (await pagina.locator('.item').count()) === 1);

/* ── 6. Sin desborde horizontal en el celular ────────────────────── */
const movil = await navegador.newPage({ viewport: { width: 390, height: 844 } });
let desborda = false;
for (const [, ruta] of RUTAS) {
  await movil.goto(`${BASE}/#${ruta}`, { waitUntil: 'networkidle' });
  if (await movil.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)) {
    desborda = true;
  }
}
comprobar('sin desborde horizontal en 390 px', !desborda);

/* ── 7. Borrar arrastra lo que dependía, y pide confirmación ─────── */
const conteos = () =>
  pagina.evaluate(() => {
    const db = JSON.parse(localStorage.getItem('gestion-alquileres/db/v2'));
    return { propiedades: db.propiedades.length, contratos: db.contratos.length,
             cuotas: db.cuotas.length, pagos: db.pagos.length,
             liquidaciones: db.liquidaciones.length };
  });

await pagina.goto(`${BASE}/#/propiedades`, { waitUntil: 'networkidle' });
const antesDeBorrar = await conteos();

await pagina.locator('.carta').first().click();
await pagina.waitForSelector('[role="dialog"]');
await pagina.locator('[role="dialog"] button', { hasText: 'Eliminar' }).click();
await pagina.waitForTimeout(300);
comprobar(
  'borrar pide confirmación',
  (await pagina.locator('[role="dialog"] h2').textContent())?.startsWith('¿Borrar'),
);

await pagina.locator('[role="dialog"] button', { hasText: 'Cancelar' }).click();
await pagina.waitForTimeout(300);
comprobar(
  'cancelar no borra nada',
  JSON.stringify(await conteos()) === JSON.stringify(antesDeBorrar),
);

// Se borran todas las propiedades: no puede quedar ni una cuota huérfana.
for (let i = 0; i < 30; i += 1) {
  if ((await pagina.locator('.carta').count()) === 0) break;
  await pagina.locator('.carta').first().click();
  await pagina.waitForSelector('[role="dialog"]');
  await pagina.locator('[role="dialog"] button', { hasText: 'Eliminar' }).click();
  await pagina.waitForTimeout(150);
  await pagina.locator('[role="dialog"] button', { hasText: 'Sí, borrar' }).click();
  await pagina.waitForTimeout(200);
}
const vacia = await conteos();
comprobar(
  'borrar arrastra cuotas, pagos y liquidaciones',
  Object.values(vacia).every((v) => v === 0),
  JSON.stringify(vacia),
);
comprobar('el menú no deja pendientes fantasma', (await pagina.locator('.rail__conteo').count()) === 0);

/* ── 8. Una base inconsistente se repara sola al abrir ───────────── */
await pagina.evaluate(() => {
  const CLAVE = 'gestion-alquileres/db/v2';
  localStorage.removeItem(CLAVE);
});
await pagina.reload({ waitUntil: 'networkidle' });
await pagina.waitForTimeout(400);
await pagina.evaluate(() => {
  const CLAVE = 'gestion-alquileres/db/v2';
  const db = JSON.parse(localStorage.getItem(CLAVE));
  db.propiedades = [];
  db.contratos = [];
  localStorage.setItem(CLAVE, JSON.stringify(db));
});
await pagina.reload({ waitUntil: 'networkidle' });
await pagina.waitForTimeout(400);
const reparada = await conteos();
comprobar(
  'repara sola una base con huérfanos',
  Object.values(reparada).every((v) => v === 0),
  JSON.stringify(reparada),
);

await navegador.close();
comprobar('sin errores de consola', errores.length === 0, [...new Set(errores)].join(' / '));
console.log(fallos === 0 ? '\nTodo en orden.' : `\n${fallos} verificaciones fallaron.`);
process.exit(fallos === 0 ? 0 : 1);

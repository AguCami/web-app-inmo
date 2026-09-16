/**
 * Verificación de humo sobre la app construida.
 *
 * Recorre las pantallas, ejerce los flujos que tocan plata (cobranza,
 * liquidación, asiento manual) y controla la partida doble. No reemplaza a una
 * batería de tests unitarios: es el chequeo rápido de que nada quedó roto.
 *
 *   npm run build && npm run preview &
 *   npm run smoke
 */
import { chromium } from 'playwright';

const BASE = process.env.URL_BASE ?? 'http://127.0.0.1:4173';
const RUTAS = [
  ['Tablero', '/'],
  ['Propiedades', '/propiedades'],
  ['Personas', '/personas'],
  ['Agenda', '/agenda'],
  ['Contratos', '/contratos'],
  ['Cobranzas', '/cobranzas'],
  ['Liquidaciones', '/liquidaciones'],
  ['Operaciones', '/ventas'],
  ['Gastos', '/gastos'],
  ['Tesorería', '/tesoreria'],
  ['Libros', '/contabilidad'],
  ['Reportes', '/reportes'],
  ['Configuración', '/configuracion'],
];

const EJECUTABLE = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

let fallos = 0;
const comprobar = (nombre, condicion, detalle = '') => {
  if (!condicion) fallos += 1;
  console.log(`${condicion ? '✓' : '✗'} ${nombre}${detalle ? ` — ${detalle}` : ''}`);
};

const navegador = await chromium.launch({ executablePath: EJECUTABLE });
const pagina = await navegador.newPage({ viewport: { width: 1440, height: 1000 } });

const errores = [];
pagina.on('pageerror', (e) => errores.push(`pageerror: ${e.message}`));
pagina.on('console', (m) => m.type() === 'error' && errores.push(`console: ${m.text()}`));

/* ── 1. Todas las pantallas cargan y caben en pantalla ───────────── */
for (const [nombre, ruta] of RUTAS) {
  await pagina.goto(`${BASE}/#${ruta}`, { waitUntil: 'networkidle' });
  const titulo = await pagina.locator('h1').first().textContent();
  const alto = await pagina.evaluate(() => document.documentElement.scrollHeight);
  comprobar(`carga ${nombre}`, titulo?.includes(nombre.split(' ')[0]) && alto < 8000, `${alto} px`);
}

/* ── 2. Registrar una cobranza baja la deuda y persiste ──────────── */
await pagina.goto(`${BASE}/#/cobranzas`, { waitUntil: 'networkidle' });
const vencido = () => pagina.locator('.kpi', { hasText: 'Vencido' }).locator('.kpi__valor').textContent();
const antes = await vencido();
await pagina.locator('button', { hasText: 'Cobrar' }).first().click();
await pagina.waitForSelector('[role="dialog"]');
await pagina.locator('[role="dialog"] button', { hasText: 'Registrar' }).click();
await pagina.waitForTimeout(400);
const despues = await vencido();
comprobar('la cobranza baja el vencido', antes !== despues, `${antes.trim()} → ${despues.trim()}`);

await pagina.reload({ waitUntil: 'networkidle' });
await pagina.waitForTimeout(300);
comprobar('la cobranza persiste tras recargar', (await vencido()) === despues);

/* ── 3. La cobranza tardía genera liquidación complementaria ─────── */
await pagina.goto(`${BASE}/#/liquidaciones`, { waitUntil: 'networkidle' });
const filasAntes = await pagina.locator('table tbody tr').count();
await pagina.locator('button', { hasText: 'Generar liquidaciones' }).click();
await pagina.waitForTimeout(400);
comprobar(
  'la cobranza tardía se liquida',
  (await pagina.locator('table tbody tr').count()) > filasAntes,
  (await pagina.locator('.aviso').first().textContent())?.trim(),
);

await pagina.locator('button', { hasText: 'Generar liquidaciones' }).click();
await pagina.waitForTimeout(400);
comprobar(
  'generar de nuevo no duplica',
  (await pagina.locator('.aviso').first().textContent())?.includes('No quedan'),
);

/* ── 4. Partida doble: debe = haber ──────────────────────────────── */
await pagina.goto(`${BASE}/#/contabilidad`, { waitUntil: 'networkidle' });
await pagina.locator('input[type="date"]').first().fill('2000-01-01');
await pagina.locator('input[type="date"]').nth(1).fill('2099-12-31');
await pagina.locator('.pestanas button', { hasText: 'Sumas y saldos' }).click();
await pagina.waitForTimeout(500);
const totales = await pagina.locator('tfoot tr td').allTextContents();
comprobar('el balance cuadra', totales[1] === totales[2], `debe ${totales[1]} / haber ${totales[2]}`);
comprobar('los saldos cuadran', totales[3] === totales[4]);

/* ── 5. El asiento manual exige estar balanceado ─────────────────── */
await pagina.locator('button', { hasText: 'Asiento manual' }).click();
await pagina.waitForSelector('[role="dialog"]');
comprobar(
  'no deja guardar un asiento vacío',
  await pagina.locator('[role="dialog"] button', { hasText: 'Guardar asiento' }).isDisabled(),
);

/* ── 6. Cada gráfico tiene su gemelo en tabla ────────────────────── */
await pagina.goto(`${BASE}/#/`, { waitUntil: 'networkidle' });
const botones = pagina.locator('.interruptores button', { hasText: 'Tabla' });
const cantidad = await botones.count();
for (let i = 0; i < cantidad; i += 1) await botones.nth(i).click();
await pagina.waitForTimeout(400);
comprobar('todos los gráficos tienen vista de tabla', (await pagina.locator('table').count()) >= cantidad, `${cantidad} gráficos`);

/* ── 7. Responsivo: sin desborde horizontal ──────────────────────── */
const movil = await navegador.newPage({ viewport: { width: 390, height: 844 } });
let desborda = false;
for (const [, ruta] of RUTAS) {
  await movil.goto(`${BASE}/#${ruta}`, { waitUntil: 'networkidle' });
  if (await movil.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)) desborda = true;
}
comprobar('sin desborde horizontal en 390 px', !desborda);

await navegador.close();

comprobar('sin errores de consola', errores.length === 0, [...new Set(errores)].join(' / '));
console.log(fallos === 0 ? '\nTodo en orden.' : `\n${fallos} verificaciones fallaron.`);
process.exit(fallos === 0 ? 0 : 1);

/**
 * Verificación de humo sobre la app construida.
 *
 *   npm run build && npm run preview &
 *   npm run smoke
 */
import { readFile } from 'node:fs/promises';
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
const pagina = await navegador.newPage({
  viewport: { width: 1440, height: 1000 },
  acceptDownloads: true,
});

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

/* ── 6. Archivar una persona la saca de los desplegables ─────────── */
const inquilinosOfrecidos = async () => {
  await pagina.goto(`${BASE}/#/contratos`, { waitUntil: 'networkidle' });
  await pagina.locator('button', { hasText: 'Nuevo contrato' }).click();
  await pagina.waitForSelector('[role="dialog"]');
  // El segundo select del formulario es el de Inquilino.
  const opciones = await pagina.locator('[role="dialog"] select').nth(1).locator('option').allTextContents();
  await pagina.locator('[role="dialog"] button', { hasText: 'Cancelar' }).click();
  await pagina.waitForTimeout(200);
  return opciones;
};

const ofrecidosAntes = await inquilinosOfrecidos();
await pagina.goto(`${BASE}/#/personas`, { waitUntil: 'networkidle' });
await pagina.locator('.buscador input').fill('Guadalupe Sosa');
await pagina.waitForTimeout(300);
await pagina.locator('.item').first().click();
await pagina.waitForSelector('[role="dialog"]');
await pagina.locator('[role="dialog"] input[type="checkbox"]').last().uncheck();
await pagina.locator('[role="dialog"] button', { hasText: 'Guardar' }).click();
await pagina.waitForTimeout(300);
const ofrecidosDespues = await inquilinosOfrecidos();
comprobar(
  'archivar una persona la saca de los desplegables',
  !ofrecidosDespues.includes('Guadalupe Sosa') && ofrecidosDespues.length === ofrecidosAntes.length - 1,
  `${ofrecidosAntes.length - 1} → ${ofrecidosDespues.length - 1} inquilinos`,
);

/* ── 7. Archivos del contrato y bitácora ─────────────────────────── */
await pagina.goto(`${BASE}/#/contratos`, { waitUntil: 'networkidle' });
await pagina.locator('.carta').first().click();
await pagina.waitForTimeout(300);

await pagina.locator('.segmentos button', { hasText: 'Archivos' }).click();
await pagina.waitForTimeout(300);
await pagina.locator('input[type="file"]').first().setInputFiles({
  name: 'contrato-firmado.pdf',
  mimeType: 'application/pdf',
  buffer: Buffer.from('%PDF-1.4\ntrailer<</Root 1 0 R>>', 'utf8'),
});
await pagina.waitForTimeout(700);
comprobar(
  'se puede adjuntar un PDF al contrato',
  (await pagina.locator('.item', { hasText: 'contrato-firmado.pdf' }).count()) === 1,
);

// El binario tiene que ir a IndexedDB: en localStorage no entra.
const enIndexedDB = await pagina.evaluate(
  () =>
    new Promise((ok) => {
      const req = indexedDB.open('gestion-alquileres');
      req.onsuccess = () => {
        const tx = req.result.transaction('archivos', 'readonly');
        const todo = tx.objectStore('archivos').getAllKeys();
        todo.onsuccess = () => ok(todo.result.length);
      };
      req.onerror = () => ok(0);
    }),
);
comprobar('el archivo se guarda en IndexedDB, no en localStorage', enIndexedDB === 1);

await pagina.locator('.segmentos button', { hasText: 'Novedades' }).click();
await pagina.waitForTimeout(300);
const novedadesAntes = await pagina.locator('.novedad').count();
await pagina.locator('button', { hasText: 'Asentar novedad' }).click();
await pagina.waitForSelector('[role="dialog"]');
await pagina.locator('[role="dialog"] input').first().fill('Se filtra agua por la ventana');
await pagina.locator('[role="dialog"] button', { hasText: 'Guardar' }).click();
await pagina.waitForTimeout(400);
comprobar(
  'se puede asentar una novedad',
  (await pagina.locator('.novedad').count()) === novedadesAntes + 1,
);

await pagina.goto(`${BASE}/#/`, { waitUntil: 'networkidle' });
await pagina.waitForTimeout(400);
comprobar(
  'la novedad abierta sale en el inicio',
  (await pagina
    .locator('.panel', { hasText: 'Sin resolver' })
    .locator('.item', { hasText: 'Se filtra agua' })
    .count()) === 1,
);

/* ── 8. El recibo en PDF ─────────────────────────────────────────── */
await pagina.goto(`${BASE}/#/cobranzas`, { waitUntil: 'networkidle' });
await pagina.waitForTimeout(400);

const bajarPDF = async (accion) => {
  const espera = pagina.waitForEvent('download');
  await accion();
  const descarga = await espera;
  return { nombre: descarga.suggestedFilename(), bytes: await readFile(await descarga.path()) };
};

// Para cuando se llega acá ya se cobró lo que faltaba del mes corriente, así
// que se busca un período que todavía tenga deuda en vez de suponerlo.
const periodoConDeuda = await pagina.evaluate(() => {
  const db = JSON.parse(localStorage.getItem('gestion-alquileres/db/v3'));
  const cobrado = new Map();
  for (const p of db.pagos) cobrado.set(p.cuotaId, (cobrado.get(p.cuotaId) ?? 0) + p.monto);
  // La más vieja impaga: cualquier otra estaría frenada porque antes debe.
  const conSaldo = db.cuotas
    .filter((c) => c.estado !== 'anulada' && c.total - (cobrado.get(c.id) ?? 0) > 1)
    .sort((a, b) => a.periodo.localeCompare(b.periodo))[0];
  return conSaldo?.periodo ?? null;
});
comprobar('queda alguna cuota con saldo para cobrar', Boolean(periodoConDeuda), periodoConDeuda ?? '');
await pagina.selectOption('select[aria-label="Período"]', periodoConDeuda);
await pagina.waitForTimeout(400);

// Cobro parcial: es el caso que más importa que el recibo diga bien.
const reciboParcial = await bajarPDF(async () => {
  await pagina.locator('button', { hasText: 'Cobrar' }).first().click();
  await pagina.waitForSelector('[role="dialog"]');
  await pagina.locator('[role="dialog"] input.entrada-num').first().fill('50000');
  await pagina.locator('[role="dialog"] button', { hasText: 'Cobrar y dar recibo' }).click();
});

// El contenido va sin comprimir, así que el texto del recibo se puede leer
// directo de los bytes del archivo.
const pdf = reciboParcial.bytes.toString('latin1');
comprobar(
  'cobrar emite un PDF bien formado',
  pdf.startsWith('%PDF-1.4') && pdf.trimEnd().endsWith('%%EOF'),
  `${reciboParcial.bytes.length} bytes`,
);
comprobar(
  'el archivo se llama por su número y su inquilino',
  /^Recibo REC-\d{5} - .+\.pdf$/.test(reciboParcial.nombre),
  reciboParcial.nombre,
);
comprobar('el importe va también en letras', /Pesos .+ con \d\d\/100/.test(pdf));
comprobar('el recibo lleva el logo embebido', pdf.includes('/DCTDecode'));
comprobar(
  'un pago parcial avisa que la cuota no queda saldada',
  pdf.includes('Pago parcial: la cuota no queda cancelada'),
);

// Los recibos se reimprimen desde el contrato, no desde Cobranzas.
comprobar(
  'Cobranzas no ofrece recibos: eso vive en el contrato',
  (await pagina.locator('.item button', { hasText: 'Recibos' }).count()) === 0,
);

const ultimo = await pagina.evaluate(() => {
  const db = JSON.parse(localStorage.getItem('gestion-alquileres/db/v3'));
  const pago = [...db.pagos].sort((a, b) => (a.recibo ?? '').localeCompare(b.recibo ?? '')).pop();
  const cuota = db.cuotas.find((c) => c.id === pago.cuotaId);
  return { contratoId: cuota.contratoId, periodo: cuota.periodo };
});
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const etiqueta = `${MESES[Number(ultimo.periodo.slice(5)) - 1]} ${ultimo.periodo.slice(0, 4)}`;

await pagina.goto(`${BASE}/#/contratos/${ultimo.contratoId}`, { waitUntil: 'networkidle' });
await pagina.waitForTimeout(500);
await pagina.locator('.item', { hasText: etiqueta }).locator('button', { hasText: 'Recibos' }).click();
await pagina.waitForSelector('[role="dialog"]');

// Reimprimirlo tiene que devolver exactamente el mismo papel que se entregó.
const copia = await bajarPDF(() =>
  pagina.locator('[role="dialog"] button', { hasText: 'Descargar PDF' }).last().click(),
);
comprobar('reimprimir un recibo devuelve el mismo archivo', copia.bytes.equals(reciboParcial.bytes));
await pagina.locator('[role="dialog"] button', { hasText: 'Cerrar' }).click();
await pagina.waitForTimeout(300);

// Las filas no traen los mismos botones, así que la columna de acciones tiene
// ancho fijo: si se achicara con el contenido, los importes quedarían chuecos.
const bordesDeImporte = () =>
  pagina.evaluate(
    () => new Set(
      [...document.querySelectorAll('.item__monto')].map((e) =>
        Math.round(e.getBoundingClientRect().right),
      ),
    ).size,
  );
comprobar('en el contrato los importes quedan a plomo', (await bordesDeImporte()) === 1);
await pagina.goto(`${BASE}/#/cobranzas`, { waitUntil: 'networkidle' });
await pagina.waitForTimeout(400);
comprobar('en Cobranzas los importes quedan a plomo', (await bordesDeImporte()) === 1);

comprobar(
  'los pagos de la demo también tienen número de recibo',
  await pagina.evaluate(() => {
    const db = JSON.parse(localStorage.getItem('gestion-alquileres/db/v3'));
    const numeros = db.pagos.map((p) => p.recibo);
    return numeros.every(Boolean) && new Set(numeros).size === numeros.length;
  }),
);

/* ── 9. No se cobra un período si debe los anteriores ───────────── */
const conAtraso = await pagina.evaluate(() => {
  const db = JSON.parse(localStorage.getItem('gestion-alquileres/db/v3'));
  const cobrado = new Map();
  for (const x of db.pagos) cobrado.set(x.cuotaId, (cobrado.get(x.cuotaId) ?? 0) + x.monto);
  const impagas = db.cuotas.filter(
    (c) => c.estado !== 'anulada' && c.total - (cobrado.get(c.id) ?? 0) > 1,
  );
  for (const c of impagas.sort((a, b) => b.periodo.localeCompare(a.periodo))) {
    const antes = impagas.filter((o) => o.contratoId === c.contratoId && o.periodo < c.periodo);
    if (!antes.length) continue;
    const contrato = db.contratos.find((x) => x.id === c.contratoId);
    return {
      periodo: c.periodo,
      inquilino: db.personas.find((x) => x.id === contrato.inquilinoId).nombre,
      atrasos: antes.length,
    };
  }
  return null;
});
comprobar('hay un caso con períodos anteriores impagos', Boolean(conAtraso), conAtraso?.periodo ?? '');

await pagina.selectOption('select[aria-label="Período"]', conAtraso.periodo);
await pagina.waitForTimeout(300);
await pagina.locator('.buscador input').fill(conAtraso.inquilino);
await pagina.waitForTimeout(400);
await pagina.locator('button', { hasText: 'Cobrar' }).first().click();
await pagina.waitForSelector('[role="dialog"]');
await pagina.waitForTimeout(300);

const botonCobrar = pagina.locator('[role="dialog"] button', { hasText: 'Cobrar y dar recibo' });
comprobar('cobrar queda bloqueado si debe los anteriores', !(await botonCobrar.isEnabled()));
comprobar(
  'y dice cuáles son y por qué',
  /art\. 899/.test(await pagina.locator('[role="dialog"] .nota--critico').first().textContent()),
);

// El atajo lleva a cobrar la más vieja, que sí se puede.
await pagina.locator('[role="dialog"] button', { hasText: 'primero' }).click();
await pagina.waitForTimeout(400);
comprobar('ofrece saltar a la más vieja, que no está frenada', await botonCobrar.isEnabled());
await pagina.locator('[role="dialog"] button', { hasText: 'Cancelar' }).click();
await pagina.waitForTimeout(300);

// Se puede forzar, y entonces el recibo sale con la reserva.
await pagina.locator('button', { hasText: 'Cobrar' }).first().click();
await pagina.waitForSelector('[role="dialog"]');
await pagina.locator('[role="dialog"] input[type="checkbox"]').check();
await pagina.waitForTimeout(200);
comprobar('se puede forzar dejando constancia', await botonCobrar.isEnabled());
const reciboConReserva = await bajarPDF(() => botonCobrar.click());
comprobar(
  'el recibo forzado deja constancia de la deuda anterior',
  reciboConReserva.bytes.toString('latin1').includes('quedan períodos anteriores impagos'),
);

/* ── 10. La liquidación al propietario, en PDF ───────────────────── */
await pagina.goto(`${BASE}/#/liquidaciones`, { waitUntil: 'networkidle' });
await pagina.waitForTimeout(500);
await pagina.locator('.item').first().click();
await pagina.waitForSelector('[role="dialog"]');
await pagina.waitForTimeout(300);

const liquidacion = await bajarPDF(() =>
  pagina.locator('[role="dialog"] button', { hasText: 'Descargar PDF' }).click(),
);
const textoLiq = liquidacion.bytes.toString('latin1');
comprobar(
  'la liquidación se baja como PDF',
  textoLiq.startsWith('%PDF-1.4') && textoLiq.trimEnd().endsWith('%%EOF'),
  `${liquidacion.bytes.length} bytes`,
);
comprobar(
  'el archivo se llama por su número y su propietario',
  /^Liquidacion LIQ-[\d-]+ - .+\.pdf$/.test(liquidacion.nombre),
  liquidacion.nombre,
);
// Chrome descarta el nombre entero si tiene un solo carácter fuera de ASCII:
// el archivo se baja como "download", sin nombre ni extensión.
comprobar(
  'y no tiene acentos, que harían que el navegador lo descarte',
  /^[\x20-\x7E]+$/.test(liquidacion.nombre),
);
comprobar('dice el neto a transferir', textoLiq.includes('NETO A TRANSFERIR'));
comprobar(
  'y explica que se rinde lo cobrado, no lo facturado',
  textoLiq.includes('Se liquida lo efectivamente cobrado'),
);
await pagina.locator('[role="dialog"] button[aria-label], [role="dialog"] button').last().isVisible();
await pagina.keyboard.press('Escape');
await pagina.waitForTimeout(300);

/* ── 11. Sin desborde horizontal en el celular ───────────────────── */
const movil = await navegador.newPage({ viewport: { width: 390, height: 844 } });
let desborda = false;
for (const [, ruta] of RUTAS) {
  await movil.goto(`${BASE}/#${ruta}`, { waitUntil: 'networkidle' });
  if (await movil.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)) {
    desborda = true;
  }
}
comprobar('sin desborde horizontal en 390 px', !desborda);

/* ── 12. Borrar arrastra lo que dependía, y pide confirmación ────── */
const conteos = () =>
  pagina.evaluate(() => {
    const db = JSON.parse(localStorage.getItem('gestion-alquileres/db/v3'));
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

const archivosQueQuedan = await pagina.evaluate(
  () =>
    new Promise((ok) => {
      const req = indexedDB.open('gestion-alquileres');
      req.onsuccess = () => {
        const tx = req.result.transaction('archivos', 'readonly');
        const todo = tx.objectStore('archivos').getAllKeys();
        todo.onsuccess = () => ok(todo.result.length);
      };
      req.onerror = () => ok(-1);
    }),
);
comprobar('borrar también limpia los archivos de IndexedDB', archivosQueQuedan === 0, `${archivosQueQuedan} quedan`);

/* ── 13. Una base inconsistente se repara sola al abrir ─────────── */
await pagina.evaluate(() => {
  const CLAVE = 'gestion-alquileres/db/v3';
  localStorage.removeItem(CLAVE);
});
await pagina.reload({ waitUntil: 'networkidle' });
await pagina.waitForTimeout(400);
await pagina.evaluate(() => {
  const CLAVE = 'gestion-alquileres/db/v3';
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

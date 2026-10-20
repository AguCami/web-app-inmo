/**
 * Pruebas de las reglas puras del dominio: el importe en letras, el nombre
 * de los archivos y la renovación de contratos. No necesitan navegador ni
 * servidor, así que corren en un segundo.
 *
 *   npm run dominio
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const carpeta = mkdtempSync(join(tmpdir(), 'docs-'));
const empaquetar = (entrada, nombre) => {
  const salida = join(carpeta, nombre);
  execFileSync('npx', [
    'esbuild', entrada, '--bundle', '--format=esm', '--platform=node',
    `--outfile=${salida}`, '--log-level=error',
  ]);
  return import(salida);
};

const { montoEnLetras, numeroALetras } = await empaquetar('src/domain/letras.ts', 'letras.mjs');
const { nombreDeArchivo } = await empaquetar('src/domain/documento.ts', 'documento.mjs');
const { nombreArchivoRecibo } = await empaquetar('src/domain/recibo.ts', 'recibo.mjs');
const { nombreArchivoLiquidacion } = await empaquetar('src/domain/liquidacion-pdf.ts', 'liq.mjs');
const { contratoRenovado, mesesDeContrato, periodosDelContrato, siguienteNumeroContrato } =
  await empaquetar('src/domain/contratos.ts', 'contratos.mjs');

let fallos = 0;
const ok = (n, c, d = '') => { if (!c) fallos += 1; console.log(`${c ? '✓' : '✗'} ${n}${d ? ` — ${d}` : ''}`); };
const ASCII = /^[\x20-\x7E]+$/;

/* ── El importe en letras ── */
ok('cien se dice cien, no ciento', numeroALetras(100) === 'cien');
ok('el uno se apocopa delante de mil', numeroALetras(21000) === 'veintiún mil');
ok('mil no lleva un adelante', numeroALetras(1000) === 'mil');
ok('un millón va en singular', numeroALetras(1_000_000) === 'un millón');
ok('los millones en plural', numeroALetras(2_000_000) === 'dos millones');
ok(
  'los centavos se redondean sin desbordar',
  montoEnLetras(0.999) === 'peso uno con 00/100',
  montoEnLetras(0.999),
);
ok(
  'un importe real se escribe entero',
  montoEnLetras(737431.96) ===
    'pesos setecientos treinta y siete mil cuatrocientos treinta y uno con 96/100',
);
ok('los dólares se nombran dólares', montoEnLetras(2, 'USD') === 'dólares dos con 00/100');

/* ── El nombre del archivo ──
   Chrome descarta el atributo `download` entero si tiene un solo carácter
   fuera de ASCII: el archivo se baja como «download», sin nombre ni
   extensión. Es lo que pasaba con cualquier inquilino con tilde.            */
ok('el ayudante saca los acentos', nombreDeArchivo('Marta Suárez') === 'Marta Suarez');
ok('y la eñe', nombreDeArchivo('Niño') === 'Nino');
ok('y lo que Windows no acepta', nombreDeArchivo('a/b:c*d?e"f<g>h|i') === 'abcdefghi');

const conTilde = nombreArchivoRecibo('REC-00007', 'Julieta Mercedes Ávila');
ok('el recibo de alguien con tilde sale en ASCII', ASCII.test(conTilde), conTilde);
ok('y conserva el número y el nombre',
  conTilde === 'Recibo REC-00007 - Julieta Mercedes Avila.pdf');

const liq = nombreArchivoLiquidacion('LIQ-202610-003', 'Panadería La Esquina');
ok('la liquidación también', ASCII.test(liq), liq);
ok('incluida la palabra Liquidacion, que lleva tilde',
  liq === 'Liquidacion LIQ-202610-003 - Panaderia La Esquina.pdf');

ok('sin nombre de persona igual queda un archivo válido',
  nombreArchivoRecibo('REC-1') === 'Recibo REC-1.pdf');

/* ── La renovación del contrato ── */
const viejo = {
  id: 'c1', numero: 'LOC-2025-007', propiedadId: 'p1', inquilinoId: 'i1', garanteIds: ['g1'],
  fechaInicio: '2025-02-01', fechaFin: '2026-11-01', montoInicial: 780000, moneda: 'ARS',
  diaVencimiento: 10, indiceAjuste: 'SIN_AJUSTE', mesesAjuste: 6,
  comisionAdminPct: 10, punitorioDiarioPct: 0.15, estado: 'activo',
  conceptosFijos: [{ id: 'cf1', descripcion: 'Expensas', monto: 90000, aCuentaDelPropietario: false }],
  depositoGarantia: 780000,
};

const nuevo = contratoRenovado(viejo, [], 'LOC-2026-001');

// Lo caro de equivocarse: el anterior factura el mes de su vencimiento
// entero, así que si el nuevo arranca dentro de ese mes los dos emiten
// cuota de la misma unidad.
const mesesViejo = periodosDelContrato(viejo);
const mesesNuevo = periodosDelContrato(nuevo);
const pisados = mesesNuevo.filter((m) => mesesViejo.includes(m));
ok('el contrato nuevo no factura ningún mes del anterior', pisados.length === 0, pisados.join(', '));
ok('arranca el mes siguiente al último que factura el viejo',
  nuevo.fechaInicio === '2026-12-01', nuevo.fechaInicio);
ok('y no deja meses sin facturar en el medio',
  mesesNuevo[0] === '2026-12' && mesesViejo[mesesViejo.length - 1] === '2026-11');

ok('dura lo mismo que el anterior', mesesDeContrato(nuevo) === mesesDeContrato(viejo),
  `${mesesDeContrato(viejo)} → ${mesesDeContrato(nuevo)}`);
ok('es un contrato distinto, no el mismo editado', nuevo.id !== viejo.id);
ok('hereda inquilino, garantes, depósito y conceptos fijos',
  nuevo.inquilinoId === viejo.inquilinoId &&
  nuevo.garanteIds.length === 1 &&
  nuevo.depositoGarantia === viejo.depositoGarantia &&
  nuevo.conceptosFijos.length === 1);
ok('queda activo', nuevo.estado === 'activo');
ok('no toca el contrato anterior', viejo.estado === 'activo' && viejo.fechaFin === '2026-11-01');

// Sin ajustes el alquiler vigente es el inicial; con ajustes sería el último.
ok('arranca por el alquiler que regía al final, no por el original',
  nuevo.montoInicial === 780000);

ok('el número propuesto sigue al último del año',
  siguienteNumeroContrato([{ numero: 'LOC-2026-014' }, { numero: 'LOC-2025-099' }], 2026) ===
    'LOC-2026-015');
ok('y arranca en 001 si no hay ninguno de este año',
  siguienteNumeroContrato([{ numero: 'LOC-2025-099' }], 2026) === 'LOC-2026-001');

console.log(fallos === 0 ? '\nTodo en orden.' : `\n${fallos} fallaron.`);
process.exit(fallos ? 1 : 0);

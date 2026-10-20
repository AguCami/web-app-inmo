/**
 * Pruebas de las partes puras de los documentos: el importe en letras y el
 * nombre del archivo. No necesitan navegador ni servidor.
 *
 *   npm run documentos
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

console.log(fallos === 0 ? '\nTodo en orden.' : `\n${fallos} fallaron.`);
process.exit(fallos ? 1 : 0);

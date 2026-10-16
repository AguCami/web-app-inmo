/**
 * El importe escrito con todas las letras, como lo lleva cualquier recibo:
 * «pesos tres mil cuatrocientos veintiuno con 50/100».
 *
 * No es decoración: el renglón en letras es lo que evita que a un recibo le
 * agreguen un cero después de firmado.
 */
import type { Moneda } from './types';

const UNIDADES = [
  'cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve',
  'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete',
  'dieciocho', 'diecinueve', 'veinte', 'veintiuno', 'veintidós', 'veintitrés',
  'veinticuatro', 'veinticinco', 'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve',
];

const DECENAS = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];

const CENTENAS = [
  '', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos',
  'seiscientos', 'setecientos', 'ochocientos', 'novecientos',
];

/**
 * `apocope` es la diferencia entre «veintiuno» y «veintiún mil»: delante de un
 * sustantivo, el uno pierde la o.
 */
function hasta999(n: number, apocope: boolean): string {
  if (n === 100) return 'cien';

  const partes: string[] = [];
  const centena = Math.floor(n / 100);
  const resto = n % 100;
  if (centena > 0) partes.push(CENTENAS[centena]);

  if (resto > 0) {
    if (resto < 30) {
      if (apocope && resto === 1) partes.push('un');
      else if (apocope && resto === 21) partes.push('veintiún');
      else partes.push(UNIDADES[resto]);
    } else {
      const decena = DECENAS[Math.floor(resto / 10)];
      const unidad = resto % 10;
      if (unidad === 0) partes.push(decena);
      else partes.push(`${decena} y ${apocope && unidad === 1 ? 'un' : UNIDADES[unidad]}`);
    }
  }
  return partes.join(' ');
}

function hastaMillon(n: number, apocope: boolean): string {
  const miles = Math.floor(n / 1000);
  const resto = n % 1000;
  const partes: string[] = [];

  if (miles === 1) partes.push('mil'); // «mil», nunca «un mil»
  else if (miles > 1) partes.push(`${hasta999(miles, true)} mil`);
  if (resto > 0) partes.push(hasta999(resto, apocope));

  return partes.join(' ');
}

export function numeroALetras(entero: number): string {
  if (entero === 0) return 'cero';

  const millones = Math.floor(entero / 1_000_000);
  const resto = entero % 1_000_000;
  const partes: string[] = [];

  if (millones === 1) partes.push('un millón');
  else if (millones > 1) partes.push(`${hastaMillon(millones, true)} millones`);
  if (resto > 0) partes.push(hastaMillon(resto, false));

  return partes.join(' ');
}

/** «pesos tres mil cuatrocientos veintiuno con 50/100». */
export function montoEnLetras(monto: number, moneda: Moneda = 'ARS'): string {
  // Se pasa a centavos primero: con 0,999 el entero es 0 y los centavos 100,
  // y escribiría «cero con 100/100».
  const centavosTotales = Math.round(Math.abs(monto) * 100);
  const entero = Math.floor(centavosTotales / 100);
  const centavos = centavosTotales % 100;

  const unidad = moneda === 'USD'
    ? (entero === 1 ? 'dólar' : 'dólares')
    : (entero === 1 ? 'peso' : 'pesos');

  return `${unidad} ${numeroALetras(entero)} con ${String(centavos).padStart(2, '0')}/100`;
}

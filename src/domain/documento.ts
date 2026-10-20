/**
 * Lo que comparten los documentos que emite la app: el recibo al inquilino y
 * la liquidación al propietario.
 *
 * Tienen que parecerse entre sí —es papelería de la misma inmobiliaria— y el
 * membrete, los colores y los recortes de texto no deberían escribirse dos
 * veces.
 */
import { A4, Documento, type Color, type ImagenJPEG, anchoTexto } from './pdf';
import type { Configuracion } from './types';

export const TINTA: Color = [0.09, 0.12, 0.16];
export const TENUE: Color = [0.42, 0.47, 0.53];
export const ACENTO: Color = [0.043, 0.341, 0.71];
export const PANEL: Color = [0.937, 0.953, 0.976];
export const AVISO: Color = [0.996, 0.949, 0.863];
export const AVISO_TINTA: Color = [0.42, 0.29, 0.02];
export const NEGATIVO: Color = [0.68, 0.16, 0.16];
export const RAYA: Color = [0.84, 0.87, 0.9];

export const MARGEN = 48;
export const DERECHA = A4.ancho - MARGEN;
/** Más abajo de esto, el contenido pisa el pie: hay que pasar de página. */
export const PIE = A4.alto - 110;

/** Corta el texto para que entre en el ancho dado, con puntos suspensivos. */
export function recortar(texto: string, ancho: number, tam: number, negrita = false): string {
  if (anchoTexto(texto, tam, negrita) <= ancho) return texto;
  let corte = texto;
  while (corte.length > 1 && anchoTexto(`${corte}…`, tam, negrita) > ancho) {
    corte = corte.slice(0, -1);
  }
  return `${corte}…`;
}

/** Parte el texto en renglones que entren en el ancho dado. */
export function envolver(texto: string, ancho: number, tam: number): string[] {
  const lineas: string[] = [];
  let actual = '';
  for (const palabra of texto.split(' ')) {
    const tentativa = actual ? `${actual} ${palabra}` : palabra;
    if (anchoTexto(tentativa, tam) <= ancho || !actual) actual = tentativa;
    else {
      lineas.push(actual);
      actual = palabra;
    }
  }
  if (actual) lineas.push(actual);
  return lineas;
}

/** Un dato con su etiqueta arriba, que es como se leen los formularios. */
export function campo(
  doc: Documento,
  etiqueta: string,
  valor: string,
  x: number,
  y: number,
  ancho: number,
): void {
  doc.texto(etiqueta.toUpperCase(), x, y, { tam: 7.5, color: TENUE });
  doc.texto(recortar(valor, ancho, 11), x, y + 15, { tam: 11, color: TINTA });
}

/**
 * El membrete: logo, nombre y datos de contacto. Devuelve la `y` donde sigue
 * el contenido.
 */
export function membrete(doc: Documento, emisor: Configuracion, logo?: ImagenJPEG): number {
  const y = MARGEN;
  const textoX = logo ? MARGEN + 64 : MARGEN;
  if (logo) doc.ponerImagen(logo, MARGEN, y - 4, 52, 52);

  doc.texto(emisor.nombre || 'Administración de alquileres', textoX, y + 12, {
    tam: 15, negrita: true, color: TINTA,
  });

  const contacto = [emisor.cuit && `CUIT ${emisor.cuit}`, emisor.telefono, emisor.email]
    .filter(Boolean)
    .join('  ·  ');
  if (contacto) doc.texto(contacto, textoX, y + 28, { tam: 8.5, color: TENUE });
  doc.texto('Administración de alquileres', textoX, y + 41, { tam: 8.5, color: TENUE });

  const abajo = MARGEN + 62;
  doc.linea(MARGEN, abajo, DERECHA, abajo, RAYA, 1);
  return abajo;
}

/** Título del documento, con su número a la derecha. */
export function titulo(doc: Documento, texto: string, numero: string, y: number): number {
  doc.texto(texto, MARGEN, y, { tam: 14, negrita: true, color: ACENTO });
  doc.texto(`N° ${numero}`, DERECHA, y, { tam: 13, negrita: true, color: TINTA, alinear: 'der' });
  return y;
}

/** La línea de firma, siempre al pie de la última página. */
export function firma(doc: Documento, emisor: Configuracion, y: number): void {
  doc.linea(DERECHA - 190, y, DERECHA, y, RAYA, 1);
  doc.texto('Firma y sello', DERECHA - 95, y + 13, { tam: 8.5, color: TENUE, alinear: 'centro' });
  doc.texto(emisor.nombre, MARGEN, y + 13, { tam: 8.5, color: TENUE });
}

/**
 * Nombre de archivo que los navegadores respetan.
 *
 * Chrome descarta por completo el atributo `download` si tiene un solo
 * carácter fuera de ASCII: «Liquidación LIQ-1 - Ávila.pdf» se baja como
 * «download», sin nombre y sin extensión. Así que los acentos se quitan en
 * vez de perderse el nombre entero. De paso saca lo que Windows no acepta.
 */
export function nombreDeArchivo(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

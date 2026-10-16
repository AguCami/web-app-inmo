/**
 * Escritor de PDF mínimo, hecho a mano.
 *
 * El recibo es una hoja con texto, líneas, recuadros y el logo. Para eso no
 * hace falta una librería: jsPDF pesa más que toda esta app junta y acá se usa
 * una porción chica de lo que trae. Esto son 250 líneas, no tiene
 * dependencias y suma unos 3 kB al bundle.
 *
 * Qué soporta: una o más páginas A4, las fuentes base de PDF (Helvetica normal
 * y negrita, que todo lector trae y no hay que embeber), texto alineado a
 * izquierda, derecha o centro, líneas, recuadros rellenos y una imagen JPEG.
 * Qué no: otras tipografías, columnas, tablas automáticas, transparencias.
 *
 * Dos detalles que no son obvios:
 *
 * · El PDF mide la hoja desde abajo y crece hacia arriba. Acá las `y` se
 *   pasan desde el borde de ARRIBA, que es como se piensa una hoja, y la
 *   conversión queda adentro.
 * · El texto va en WinAnsi (Latin-1 con agregados). Alcanza de sobra para el
 *   español —acentos, ñ, ¿, ¡, °— y evita tener que embeber una tipografía.
 */

export const A4 = { ancho: 595.28, alto: 841.89 };

export type Color = [number, number, number];

/** Un JPEG ya decodificado lo suficiente como para meterlo en el PDF. */
export interface ImagenJPEG {
  datos: Uint8Array;
  ancho: number;
  alto: number;
}

export interface OpcionesTexto {
  tam?: number;
  negrita?: boolean;
  color?: Color;
  /** Dónde cae la `x` que se pasa: al inicio, al final o al medio del texto. */
  alinear?: 'izq' | 'der' | 'centro';
}

/* ─────────────────────── Anchos de los glifos ─────────────────────── */

// En milésimas del cuerpo, como los declara el AFM de cada fuente. Hacen
// falta para alinear a la derecha y para centrar: sin esto no se puede saber
// cuánto mide un texto antes de dibujarlo.
const ANCHOS_NORMAL = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
  1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
  333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556,
  556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
];

const ANCHOS_NEGRITA = [
  278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611,
  975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556,
  333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611,
  611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584,
];

/** Glifos fuera del ASCII que no se pueden deducir sacándoles el acento. */
const ANCHOS_EXTRA: Record<string, [number, number]> = {
  '°': [400, 400],
  '·': [278, 278],
  '–': [556, 556],
  '—': [1000, 1000],
  '¿': [611, 611],
  '¡': [333, 333],
  '«': [556, 556],
  '»': [556, 556],
  '€': [556, 556],
  '“': [333, 500],
  '”': [333, 500],
  '‘': [222, 278],
  '’': [222, 278],
  '…': [1000, 1000],
  '•': [350, 350],
};

function anchoGlifo(c: string, negrita: boolean): number {
  const tabla = negrita ? ANCHOS_NEGRITA : ANCHOS_NORMAL;
  const cod = c.charCodeAt(0);
  if (cod >= 32 && cod <= 126) return tabla[cod - 32];

  const extra = ANCHOS_EXTRA[c];
  if (extra) return extra[negrita ? 1 : 0];

  // Las vocales acentuadas y la ñ miden lo mismo que la letra pelada.
  const base = c.normalize('NFD').charCodeAt(0);
  if (base >= 32 && base <= 126) return tabla[base - 32];

  return tabla['n'.charCodeAt(0) - 32];
}

export function anchoTexto(texto: string, tam: number, negrita = false): number {
  let total = 0;
  for (const c of texto) total += anchoGlifo(c, negrita);
  return (total * tam) / 1000;
}

/* ───────────────────────── Bytes y escapes ────────────────────────── */

// Los únicos caracteres útiles que WinAnsi ubica fuera de Latin-1.
const WINANSI: Record<string, number> = {
  '€': 0x80, '…': 0x85, '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94,
  '•': 0x95, '–': 0x96, '—': 0x97,
};

/** Convierte a los bytes de una cadena literal de PDF, con los escapes. */
function bytesDeTexto(texto: string): number[] {
  const out: number[] = [];
  for (const c of texto) {
    const cod = WINANSI[c] ?? c.codePointAt(0) ?? 63;
    const byte = cod <= 0xff ? cod : 63; // lo que no entra, signo de pregunta
    if (byte === 0x28 || byte === 0x29 || byte === 0x5c) out.push(0x5c); // ( ) \
    out.push(byte);
  }
  return out;
}

function bytesDeASCII(s: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < s.length; i += 1) out.push(s.charCodeAt(i) & 0xff);
  return out;
}

/**
 * Agrega todos los bytes de `origen` al final de `destino`.
 * De a uno y no con `push(...origen)`: el spread pasa cada elemento como un
 * argumento y con el JPEG del logo, que son decenas de miles, revienta la
 * pila de llamadas.
 */
function empujar(destino: number[], origen: ArrayLike<number>): void {
  for (let i = 0; i < origen.length; i += 1) destino.push(origen[i]);
}

const num = (n: number) => (Math.round(n * 100) / 100).toString();
const col = (c: Color) => c.map((v) => num(v)).join(' ');

/* ──────────────────────────── Documento ───────────────────────────── */

interface Pagina {
  contenido: number[];
}

export class Documento {
  private paginas: Pagina[] = [];
  private actual: Pagina;
  /** JPEG del logo, si se cargó. Se comparte entre todas las páginas. */
  private imagen?: ImagenJPEG;

  constructor() {
    this.actual = { contenido: [] };
    this.paginas.push(this.actual);
  }

  nuevaPagina(): void {
    this.actual = { contenido: [] };
    this.paginas.push(this.actual);
  }

  private op(s: string): void {
    for (const b of bytesDeASCII(s)) this.actual.contenido.push(b);
  }

  texto(texto: string, x: number, yDesdeArriba: number, op: OpcionesTexto = {}): void {
    const tam = op.tam ?? 10;
    const negrita = op.negrita ?? false;
    const color = op.color ?? [0, 0, 0];

    let xFinal = x;
    if (op.alinear === 'der') xFinal = x - anchoTexto(texto, tam, negrita);
    if (op.alinear === 'centro') xFinal = x - anchoTexto(texto, tam, negrita) / 2;

    const y = A4.alto - yDesdeArriba;
    this.op(`BT /${negrita ? 'F2' : 'F1'} ${num(tam)} Tf ${col(color)} rg ${num(xFinal)} ${num(y)} Td (`);
    for (const b of bytesDeTexto(texto)) this.actual.contenido.push(b);
    this.op(') Tj ET\n');
  }

  linea(x1: number, y1: number, x2: number, y2: number, color: Color = [0.8, 0.8, 0.8], grosor = 0.7): void {
    this.op(
      `${col(color)} RG ${num(grosor)} w ${num(x1)} ${num(A4.alto - y1)} m ` +
        `${num(x2)} ${num(A4.alto - y2)} l S\n`,
    );
  }

  rect(x: number, y: number, ancho: number, alto: number, relleno: Color): void {
    this.op(`${col(relleno)} rg ${num(x)} ${num(A4.alto - y - alto)} ${num(ancho)} ${num(alto)} re f\n`);
  }

  /** Coloca el JPEG ya cargado. Un documento lleva una sola imagen: el logo. */
  ponerImagen(jpeg: ImagenJPEG, x: number, y: number, ancho: number, alto: number): void {
    this.imagen = jpeg;
    this.op(`q ${num(ancho)} 0 0 ${num(alto)} ${num(x)} ${num(A4.alto - y - alto)} cm /Im1 Do Q\n`);
  }

  /** Arma el archivo: objetos numerados, tabla de posiciones y tráiler. */
  aBytes(): Uint8Array {
    const objetos: number[][] = [];
    const agregar = (cuerpo: number[]) => {
      objetos.push(cuerpo);
    };

    // 1 catálogo, 2 árbol de páginas; después una por página, su contenido,
    // las dos fuentes y, si hay, la imagen.
    const idCatalogo = 1;
    const idPaginas = 2;
    const primeraPagina = 3;
    const idsPagina = this.paginas.map((_, i) => primeraPagina + i * 2);
    const idsContenido = this.paginas.map((_, i) => primeraPagina + i * 2 + 1);
    const idFuente1 = primeraPagina + this.paginas.length * 2;
    const idFuente2 = idFuente1 + 1;
    const idImagen = idFuente2 + 1;

    const recursos =
      `<< /Font << /F1 ${idFuente1} 0 R /F2 ${idFuente2} 0 R >>` +
      (this.imagen ? ` /XObject << /Im1 ${idImagen} 0 R >>` : '') +
      ' >>';

    agregar(bytesDeASCII(`<< /Type /Catalog /Pages ${idPaginas} 0 R >>`));
    agregar(
      bytesDeASCII(
        `<< /Type /Pages /Kids [${idsPagina.map((i) => `${i} 0 R`).join(' ')}] /Count ${this.paginas.length} >>`,
      ),
    );

    this.paginas.forEach((pagina, i) => {
      agregar(
        bytesDeASCII(
          `<< /Type /Page /Parent ${idPaginas} 0 R /MediaBox [0 0 ${num(A4.ancho)} ${num(A4.alto)}] ` +
            `/Resources ${recursos} /Contents ${idsContenido[i]} 0 R >>`,
        ),
      );
      const flujo: number[] = [];
      empujar(flujo, bytesDeASCII(`<< /Length ${pagina.contenido.length} >>\nstream\n`));
      empujar(flujo, pagina.contenido);
      empujar(flujo, bytesDeASCII('\nendstream'));
      agregar(flujo);
    });

    for (const fuente of ['Helvetica', 'Helvetica-Bold']) {
      agregar(
        bytesDeASCII(
          `<< /Type /Font /Subtype /Type1 /BaseFont /${fuente} /Encoding /WinAnsiEncoding >>`,
        ),
      );
    }

    if (this.imagen) {
      const flujo: number[] = [];
      empujar(
        flujo,
        bytesDeASCII(
          `<< /Type /XObject /Subtype /Image /Width ${this.imagen.ancho} /Height ${this.imagen.alto} ` +
            `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode ` +
            `/Length ${this.imagen.datos.length} >>\nstream\n`,
        ),
      );
      empujar(flujo, this.imagen.datos);
      empujar(flujo, bytesDeASCII('\nendstream'));
      agregar(flujo);
    }

    const salida: number[] = bytesDeASCII('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
    const posiciones: number[] = [];

    objetos.forEach((cuerpo, i) => {
      posiciones.push(salida.length);
      empujar(salida, bytesDeASCII(`${i + 1} 0 obj\n`));
      empujar(salida, cuerpo);
      empujar(salida, bytesDeASCII('\nendobj\n'));
    });

    const inicioXref = salida.length;
    empujar(salida, bytesDeASCII(`xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n`));
    for (const pos of posiciones) {
      empujar(salida, bytesDeASCII(`${String(pos).padStart(10, '0')} 00000 n \n`));
    }
    empujar(
      salida,
      bytesDeASCII(
        `trailer\n<< /Size ${objetos.length + 1} /Root ${idCatalogo} 0 R >>\n` +
          `startxref\n${inicioXref}\n%%EOF\n`,
      ),
    );

    return Uint8Array.from(salida);
  }
}

/** Baja el PDF como archivo. */
export function descargar(bytes: Uint8Array, nombre: string): void {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Darle tiempo al navegador a tomar el blob antes de soltarlo.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

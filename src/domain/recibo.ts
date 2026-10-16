/**
 * El recibo de alquiler, en PDF.
 *
 * Lo que tiene que decir un recibo para servir de prueba de pago: quién lo
 * emite, a quién, cuánto —en números y en letras—, por qué concepto y de qué
 * período, cómo se pagó, y si quedó algo sin pagar. Eso último es lo que más
 * se olvida y lo que más problemas trae: un recibo por un pago parcial que no
 * aclara el saldo parece cancelar la cuota entera.
 */
import { Documento, type Color, type ImagenJPEG, anchoTexto } from './pdf';
import { montoEnLetras } from './letras';
import { direccionCompleta } from './propiedades';
import type { Configuracion, Contrato, Cuota, MedioPago, Pago, Persona, Propiedad } from './types';
import { formatearFecha, formatearMoneda, formatearPeriodoLargo } from './util';

const MEDIOS: Record<MedioPago, string> = {
  transferencia: 'Transferencia bancaria',
  efectivo: 'Efectivo',
  debito_automatico: 'Débito automático',
  mercadopago: 'Mercado Pago',
};

const TINTA: Color = [0.09, 0.12, 0.16];
const TENUE: Color = [0.42, 0.47, 0.53];
const ACENTO: Color = [0.043, 0.341, 0.71];
const PANEL: Color = [0.937, 0.953, 0.976];
const AVISO: Color = [0.996, 0.949, 0.863];
const AVISO_TINTA: Color = [0.42, 0.29, 0.02];
const RAYA: Color = [0.84, 0.87, 0.9];

const MARGEN = 48;
const DERECHA = 595.28 - MARGEN;

export interface DatosRecibo {
  numero: string;
  emisor: Configuracion;
  pago: Pago;
  cuota: Cuota;
  contrato?: Contrato;
  propiedad?: Propiedad;
  inquilino?: Persona;
  /** Lo que queda debiendo de esta cuota después de este pago. */
  saldoPosterior: number;
  logo?: ImagenJPEG;
}

/** Corta el texto para que entre en el ancho dado, con puntos suspensivos. */
function recortar(texto: string, ancho: number, tam: number, negrita = false): string {
  if (anchoTexto(texto, tam, negrita) <= ancho) return texto;
  let corte = texto;
  while (corte.length > 1 && anchoTexto(`${corte}…`, tam, negrita) > ancho) {
    corte = corte.slice(0, -1);
  }
  return `${corte}…`;
}

/** Un dato con su etiqueta arriba, que es como se leen los formularios. */
function campo(doc: Documento, etiqueta: string, valor: string, x: number, y: number, ancho: number): void {
  doc.texto(etiqueta.toUpperCase(), x, y, { tam: 7.5, color: TENUE });
  doc.texto(recortar(valor, ancho, 11), x, y + 15, { tam: 11, color: TINTA });
}

export function construirRecibo(d: DatosRecibo): Uint8Array {
  const doc = new Documento();
  const { pago, cuota } = d;
  const punitorios = pago.punitorios ?? 0;
  const total = pago.monto + punitorios;

  /* ── Membrete ── */
  let y = MARGEN;
  const textoX = d.logo ? MARGEN + 64 : MARGEN;
  if (d.logo) doc.ponerImagen(d.logo, MARGEN, y - 4, 52, 52);

  doc.texto(d.emisor.nombre || 'Administración de alquileres', textoX, y + 12, { tam: 15, negrita: true, color: TINTA });
  const contacto = [
    d.emisor.cuit && `CUIT ${d.emisor.cuit}`,
    d.emisor.telefono,
    d.emisor.email,
  ].filter(Boolean).join('  ·  ');
  if (contacto) doc.texto(contacto, textoX, y + 28, { tam: 8.5, color: TENUE });
  doc.texto('Administración de alquileres', textoX, y + 41, { tam: 8.5, color: TENUE });

  y = MARGEN + 62;
  doc.linea(MARGEN, y, DERECHA, y, RAYA, 1);

  /* ── Título y numeración ── */
  y += 26;
  doc.texto('RECIBO DE ALQUILER', MARGEN, y, { tam: 14, negrita: true, color: ACENTO });
  doc.texto(`N° ${d.numero}`, DERECHA, y, { tam: 13, negrita: true, color: TINTA, alinear: 'der' });

  y += 16;
  doc.texto(`Emitido el ${formatearFecha(pago.fecha)}`, MARGEN, y, { tam: 9, color: TENUE });
  doc.texto(
    `Período ${formatearPeriodoLargo(cuota.periodo)}  ·  vencimiento ${formatearFecha(cuota.vencimiento)}`,
    DERECHA,
    y,
    { tam: 9, color: TENUE, alinear: 'der' },
  );

  y += 12;
  doc.linea(MARGEN, y, DERECHA, y, RAYA);

  /* ── A quién y por cuánto ── */
  y += 26;
  const documento = d.inquilino ? `${d.inquilino.tipoDoc} ${d.inquilino.documento}` : '';
  campo(doc, 'Recibí de', d.inquilino?.nombre ?? '—', MARGEN, y, 320);
  if (documento) doc.texto(documento, DERECHA, y + 15, { tam: 10, color: TENUE, alinear: 'der' });

  y += 42;
  doc.texto('LA CANTIDAD DE', MARGEN, y, { tam: 7.5, color: TENUE });
  const enLetras = montoEnLetras(total, cuota.moneda);
  doc.texto(
    recortar(enLetras.charAt(0).toUpperCase() + enLetras.slice(1), DERECHA - MARGEN, 11),
    MARGEN,
    y + 16,
    { tam: 11, color: TINTA },
  );
  doc.texto(formatearMoneda(total, cuota.moneda), DERECHA, y + 16, { tam: 15, negrita: true, color: TINTA, alinear: 'der' });

  y += 40;
  campo(
    doc,
    'En concepto de',
    `Alquiler de ${formatearPeriodoLargo(cuota.periodo)}${d.propiedad ? ` — ${d.propiedad.codigo} · ${direccionCompleta(d.propiedad)}` : ''}`,
    MARGEN,
    y,
    DERECHA - MARGEN,
  );
  if (d.contrato) {
    doc.texto(`Contrato ${d.contrato.numero}`, DERECHA, y, { tam: 8, color: TENUE, alinear: 'der' });
  }

  /* ── Cómo se compone ── */
  y += 48;
  const filas: [string, number][] = cuota.items.map((i) => [i.descripcion, i.monto]);
  // Alto exacto del recuadro: el encabezado, una línea por ítem, el total, la
  // fila de punitorios si la hay, el renglón de lo cobrado y el aire de abajo.
  const altoPanel = 38 + filas.length * 17 + 21 + (punitorios > 0 ? 17 : 0) + 14;
  doc.rect(MARGEN, y, DERECHA - MARGEN, altoPanel, PANEL);

  let fy = y + 20;
  doc.texto('DETALLE DE LA CUOTA', MARGEN + 16, fy, { tam: 7.5, color: TENUE });
  fy += 18;
  for (const [descripcion, monto] of filas) {
    doc.texto(recortar(descripcion, 300, 10), MARGEN + 16, fy, { tam: 10, color: TINTA });
    doc.texto(formatearMoneda(monto, cuota.moneda), DERECHA - 16, fy, { tam: 10, color: TINTA, alinear: 'der' });
    fy += 17;
  }

  doc.linea(MARGEN + 16, fy - 6, DERECHA - 16, fy - 6, RAYA);
  doc.texto('Total de la cuota', MARGEN + 16, fy + 6, { tam: 10, color: TENUE });
  doc.texto(formatearMoneda(cuota.total, cuota.moneda), DERECHA - 16, fy + 6, { tam: 10, color: TENUE, alinear: 'der' });

  fy += 21;
  if (punitorios > 0) {
    doc.texto('Intereses por mora', MARGEN + 16, fy, { tam: 10, color: TINTA });
    doc.texto(formatearMoneda(punitorios, cuota.moneda), DERECHA - 16, fy, { tam: 10, color: TINTA, alinear: 'der' });
    fy += 17;
  }
  doc.texto('Se cobra en este recibo', MARGEN + 16, fy, { tam: 11, negrita: true, color: TINTA });
  doc.texto(formatearMoneda(total, cuota.moneda), DERECHA - 16, fy, { tam: 11, negrita: true, color: TINTA, alinear: 'der' });

  y += altoPanel + 28;

  /* ── Forma de pago y saldo ── */
  campo(doc, 'Forma de pago', MEDIOS[pago.medio], MARGEN, y, 240);
  if (pago.comprobante) campo(doc, 'Comprobante', pago.comprobante, MARGEN + 260, y, 240);

  y += 42;
  if (d.saldoPosterior > 0.01) {
    doc.rect(MARGEN, y, DERECHA - MARGEN, 40, AVISO);
    doc.texto('Pago parcial: la cuota no queda cancelada', MARGEN + 16, y + 17, {
      tam: 10, negrita: true, color: AVISO_TINTA,
    });
    doc.texto(
      `Queda un saldo de ${formatearMoneda(d.saldoPosterior, cuota.moneda)} del período ${formatearPeriodoLargo(cuota.periodo)}.`,
      MARGEN + 16, y + 31, { tam: 9, color: AVISO_TINTA },
    );
    y += 56;
  } else {
    doc.texto(
      `Con este pago queda cancelada la cuota de ${formatearPeriodoLargo(cuota.periodo)}.`,
      MARGEN, y + 10, { tam: 10, color: TINTA },
    );
    y += 26;
  }

  /* ── Pie: salvedad y firma ── */
  doc.texto(
    'Este recibo acredita el pago detallado arriba y no implica conformidad con deudas de otros períodos.',
    MARGEN,
    y + 16,
    { tam: 8, color: TENUE },
  );

  // La firma va debajo del texto, no clavada al pie: un recibo corto no tiene
  // por qué dejar media hoja en blanco. Igual nunca sube más de cierto punto.
  const yFirma = Math.max(y + 76, 560);
  doc.linea(DERECHA - 190, yFirma, DERECHA, yFirma, RAYA, 1);
  doc.texto('Firma y sello', DERECHA - 95, yFirma + 13, { tam: 8.5, color: TENUE, alinear: 'centro' });
  doc.texto(d.emisor.nombre, MARGEN, yFirma + 13, { tam: 8.5, color: TENUE });

  return doc.aBytes();
}

/** «Recibo REC-00007 - Carolina Paz Medina.pdf» */
export function nombreArchivoRecibo(numero: string, inquilino?: string): string {
  const limpio = (inquilino ?? '').replace(/[\\/:*?"<>|]/g, '').trim();
  return `Recibo ${numero}${limpio ? ` - ${limpio}` : ''}.pdf`;
}

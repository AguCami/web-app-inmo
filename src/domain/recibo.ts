/**
 * El recibo de alquiler, en PDF.
 *
 * Lo que tiene que decir un recibo para servir de prueba de pago: quién lo
 * emite, a quién, cuánto —en números y en letras—, por qué concepto y de qué
 * período, cómo se pagó, y si quedó algo sin pagar. Eso último es lo que más
 * se olvida y lo que más problemas trae: un recibo por un pago parcial que no
 * aclara el saldo parece cancelar la cuota entera.
 */
import { Documento, type ImagenJPEG } from './pdf';
import {
  AVISO, AVISO_TINTA, DERECHA, MARGEN, PANEL, RAYA, TENUE, TINTA,
  campo, envolver, firma, membrete, nombreDeArchivo, recortar, titulo,
} from './documento';
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

export function construirRecibo(d: DatosRecibo): Uint8Array {
  const doc = new Documento();
  const { pago, cuota } = d;
  const punitorios = pago.punitorios ?? 0;
  const total = pago.monto + punitorios;

  let y = membrete(doc, d.emisor, d.logo);

  /* ── Título y numeración ── */
  y += 26;
  titulo(doc, 'RECIBO DE ALQUILER', d.numero, y);

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
  doc.texto(formatearMoneda(total, cuota.moneda), DERECHA, y + 3, {
    tam: 15, negrita: true, color: TINTA, alinear: 'der',
  });

  // El importe en letras va en su propio renglón y a todo el ancho: al lado
  // del número se pisaban apenas el monto pasaba el millón. Si no entra en
  // uno, se parte en dos, que alcanza para cualquier importe real.
  const enLetras = montoEnLetras(total, cuota.moneda);
  const renglones = envolver(
    enLetras.charAt(0).toUpperCase() + enLetras.slice(1),
    DERECHA - MARGEN,
    11,
  );
  let yLetras = y + 20;
  for (const renglon of renglones.slice(0, 2)) {
    doc.texto(renglon, MARGEN, yLetras, { tam: 11, color: TINTA });
    yLetras += 14;
  }

  y = yLetras + 10;
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

  // Reserva del art. 898 CCyC. Sin esto, dar recibo por un período hace
  // presumir que los anteriores están pagados (art. 899 inc. b).
  const adeudados = pago.periodosAdeudados ?? [];
  if (adeudados.length > 0) {
    const alto = 54;
    doc.rect(MARGEN, y, DERECHA - MARGEN, alto, AVISO);
    doc.texto('Se deja constancia de que quedan períodos anteriores impagos', MARGEN + 16, y + 17, {
      tam: 10, negrita: true, color: AVISO_TINTA,
    });
    doc.texto(
      recortar(
        adeudados.map((p) => formatearPeriodoLargo(p)).join(' · '),
        DERECHA - MARGEN - 32,
        9,
      ),
      MARGEN + 16, y + 31, { tam: 9, color: AVISO_TINTA },
    );
    doc.texto(
      'Este recibo no cancela esos períodos ni implica conformidad con ellos.',
      MARGEN + 16, y + 44, { tam: 8.5, color: AVISO_TINTA },
    );
    y += alto + 16;
  }

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
  firma(doc, d.emisor, Math.max(y + 76, 560));

  return doc.aBytes();
}

/** «Recibo REC-00007 - Carolina Paz Medina.pdf» */
export function nombreArchivoRecibo(numero: string, inquilino?: string): string {
  const limpio = nombreDeArchivo(inquilino ?? '');
  return nombreDeArchivo(`Recibo ${numero}${limpio ? ` - ${limpio}` : ''}`) + '.pdf';
}

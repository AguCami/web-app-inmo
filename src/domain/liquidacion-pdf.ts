/**
 * La liquidación al propietario, en PDF.
 *
 * Es el documento que justifica la comisión: el propietario quiere ver, de
 * una ojeada, cuánto entró por cada unidad, qué se le descontó y cuánto le
 * queda. Y quiere saber por qué el número no es el alquiler completo, así que
 * el criterio —se rinde lo cobrado, no lo facturado— va escrito en el papel y
 * no queda para una llamada telefónica.
 */
import { Documento, type ImagenJPEG } from './pdf';
import {
  DERECHA, MARGEN, NEGATIVO, PANEL, PIE, RAYA, TENUE, TINTA,
  campo, envolver, firma, membrete, nombreDeArchivo, recortar, titulo,
} from './documento';
import { montoEnLetras } from './letras';
import type { Configuracion, ItemLiquidacion, Liquidacion, Persona } from './types';
import { formatearFecha, formatearMoneda, formatearPeriodoLargo, redondear, sumar } from './util';

const ESTADOS: Record<Liquidacion['estado'], string> = {
  borrador: 'Borrador — todavía no aprobada',
  aprobada: 'Aprobada — pendiente de transferir',
  pagada: 'Transferida',
};

export interface DatosLiquidacion {
  liquidacion: Liquidacion;
  emisor: Configuracion;
  propietario?: Persona;
  logo?: ImagenJPEG;
}

const totalDe = (items: ItemLiquidacion[], tipo: ItemLiquidacion['tipo']) =>
  redondear(sumar(items.filter((i) => i.tipo === tipo), (i) => i.monto));

export function construirLiquidacion(d: DatosLiquidacion): Uint8Array {
  const doc = new Documento();
  const { liquidacion: liq } = d;
  const moneda = liq.moneda;

  let y = membrete(doc, d.emisor, d.logo);

  y += 26;
  titulo(doc, 'LIQUIDACIÓN AL PROPIETARIO', liq.numero, y);

  y += 16;
  doc.texto(`Emitida el ${formatearFecha(liq.fecha)}`, MARGEN, y, { tam: 9, color: TENUE });
  doc.texto(`Período ${formatearPeriodoLargo(liq.periodo)}`, DERECHA, y, {
    tam: 9, color: TENUE, alinear: 'der',
  });

  y += 12;
  doc.linea(MARGEN, y, DERECHA, y, RAYA);

  /* ── A quién ── */
  y += 26;
  campo(doc, 'Liquidamos a', d.propietario?.nombre ?? '—', MARGEN, y, 320);
  if (d.propietario) {
    doc.texto(`${d.propietario.tipoDoc} ${d.propietario.documento}`, DERECHA, y + 15, {
      tam: 10, color: TENUE, alinear: 'der',
    });
  }
  if (d.propietario?.cbu) {
    y += 34;
    doc.texto('CBU / CVU', MARGEN, y, { tam: 7.5, color: TENUE });
    doc.texto(d.propietario.cbu, MARGEN, y + 14, { tam: 10, color: TINTA });
  }

  /* ── El detalle, que puede pasar de página ── */
  y += 48;
  const encabezadoDetalle = () => {
    doc.texto('DETALLE', MARGEN, y, { tam: 7.5, color: TENUE });
    doc.texto('IMPORTE', DERECHA, y, { tam: 7.5, color: TENUE, alinear: 'der' });
    y += 8;
    doc.linea(MARGEN, y, DERECHA, y, RAYA);
    y += 14;
  };
  encabezadoDetalle();

  for (const item of liq.items) {
    if (y + 18 > PIE) {
      doc.nuevaPagina();
      y = MARGEN + 10;
      doc.texto(`${liq.numero} — continuación`, MARGEN, y, { tam: 8, color: TENUE });
      y += 22;
      encabezadoDetalle();
    }
    const resta = item.monto < 0;
    doc.texto(recortar(item.descripcion, 360, 10), MARGEN + (resta ? 12 : 0), y, {
      tam: 10, color: resta ? TENUE : TINTA,
    });
    doc.texto(formatearMoneda(item.monto, moneda), DERECHA, y, {
      tam: 10, color: resta ? NEGATIVO : TINTA, alinear: 'der',
    });
    y += 17;
  }

  /* ── Los subtotales y el neto ── */
  const cobrado = totalDe(liq.items, 'alquiler_cobrado');
  const honorarios = totalDe(liq.items, 'comision_admin');
  const gastos = totalDe(liq.items, 'gasto');
  const ajustes = totalDe(liq.items, 'ajuste');

  const resumen: [string, number][] = [
    ['Alquileres cobrados en el período', cobrado],
    ['Honorarios de administración', honorarios],
    ['Gastos reintegrados', gastos],
    ['Ajustes', ajustes],
  ].filter(([, monto]) => monto !== 0) as [string, number][];

  const altoPanel = 22 + resumen.length * 17 + 44;
  if (y + altoPanel > PIE) {
    doc.nuevaPagina();
    y = MARGEN + 10;
  } else {
    y += 10;
  }

  doc.rect(MARGEN, y, DERECHA - MARGEN, altoPanel, PANEL);
  let fy = y + 22;
  for (const [etiqueta, monto] of resumen) {
    doc.texto(etiqueta, MARGEN + 16, fy, { tam: 10, color: TENUE });
    doc.texto(formatearMoneda(monto, moneda), DERECHA - 16, fy, {
      tam: 10, color: monto < 0 ? NEGATIVO : TINTA, alinear: 'der',
    });
    fy += 17;
  }
  doc.linea(MARGEN + 16, fy - 4, DERECHA - 16, fy - 4, RAYA);
  fy += 16;
  doc.texto('NETO A TRANSFERIR', MARGEN + 16, fy, { tam: 11, negrita: true, color: TINTA });
  doc.texto(formatearMoneda(liq.neto, moneda), DERECHA - 16, fy, {
    tam: 15, negrita: true, color: TINTA, alinear: 'der',
  });

  y += altoPanel + 20;

  // El neto también en letras, igual que en el recibo.
  const enLetras = montoEnLetras(liq.neto, moneda);
  for (const renglon of envolver(
    enLetras.charAt(0).toUpperCase() + enLetras.slice(1),
    DERECHA - MARGEN,
    10,
  ).slice(0, 2)) {
    doc.texto(renglon, MARGEN, y, { tam: 10, color: TENUE });
    y += 13;
  }

  /* ── Estado y criterio ── */
  y += 12;
  doc.texto(ESTADOS[liq.estado], MARGEN, y, { tam: 10, negrita: true, color: TINTA });
  if (liq.estado === 'pagada' && liq.fechaPago) {
    doc.texto(`Transferida el ${formatearFecha(liq.fechaPago)}`, DERECHA, y, {
      tam: 10, color: TENUE, alinear: 'der',
    });
  }

  y += 20;
  for (const renglon of envolver(
    'Se liquida lo efectivamente cobrado al inquilino, no lo facturado. Si una cuota se ' +
      'cobró en parte, acá figura solo esa parte; el resto se rinde en la liquidación ' +
      'siguiente, cuando entre. Los honorarios se calculan sobre el alquiler cobrado, sin ' +
      'incluir expensas ni servicios.',
    DERECHA - MARGEN,
    8.5,
  )) {
    doc.texto(renglon, MARGEN, y, { tam: 8.5, color: TENUE });
    y += 11;
  }

  if (liq.notas) {
    y += 8;
    for (const renglon of envolver(liq.notas, DERECHA - MARGEN, 9).slice(0, 4)) {
      doc.texto(renglon, MARGEN, y, { tam: 9, color: TINTA });
      y += 12;
    }
  }

  firma(doc, d.emisor, Math.max(y + 60, 600));
  return doc.aBytes();
}

/** «Liquidacion LIQ-202610-003 - Marta Suarez.pdf» */
export function nombreArchivoLiquidacion(numero: string, propietario?: string): string {
  const limpio = nombreDeArchivo(propietario ?? '');
  return nombreDeArchivo(`Liquidacion ${numero}${limpio ? ` - ${limpio}` : ''}`) + '.pdf';
}

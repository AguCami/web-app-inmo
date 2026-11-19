/**
 * Emitir los documentos que la inmobiliaria entrega: el recibo al inquilino y
 * la liquidación al propietario. Junta los datos, arma el PDF y lo baja.
 *
 * Vive acá y no en `domain/` porque toca el navegador —el canvas para el logo
 * y la descarga del archivo—. El armado de cada documento sí es puro y está
 * en `domain/recibo.ts` y `domain/liquidacion-pdf.ts`.
 */
import { saldoTrasPago } from '../domain/cobranzas';
import { descargar } from '../domain/pdf';
import {
  construirLiquidacion,
  construirReciboLiquidacion,
  nombreArchivoLiquidacion,
  nombreArchivoReciboLiquidacion,
} from '../domain/liquidacion-pdf';
import { construirRecibo, nombreArchivoRecibo } from '../domain/recibo';
import type { BaseDatos, Liquidacion, Pago } from '../domain/types';
import { logoParaPdf, selloParaPdf } from './logoPdf';

export async function emitirRecibo(db: BaseDatos, pago: Pago): Promise<boolean> {
  const cuota = db.cuotas.find((c) => c.id === pago.cuotaId);
  if (!cuota) return false;

  const contrato = db.contratos.find((c) => c.id === cuota.contratoId);
  const propiedad = db.propiedades.find((p) => p.id === contrato?.propiedadId);
  const inquilino = db.personas.find((p) => p.id === contrato?.inquilinoId);
  const numero = pago.recibo ?? 'SIN NÚMERO';

  const pdf = construirRecibo({
    numero,
    emisor: db.configuracion,
    pago,
    cuota,
    contrato,
    propiedad,
    inquilino,
    saldoPosterior: saldoTrasPago(cuota, db.pagos, pago.id),
    logo: await logoParaPdf(),
    sello: await selloParaPdf(),
  });

  descargar(pdf, nombreArchivoRecibo(numero, inquilino?.nombre));
  return true;
}

export async function emitirLiquidacion(db: BaseDatos, liquidacion: Liquidacion): Promise<void> {
  const propietario = db.personas.find((p) => p.id === liquidacion.propietarioId);

  const pdf = construirLiquidacion({
    liquidacion,
    emisor: db.configuracion,
    propietario,
    logo: await logoParaPdf(),
    sello: await selloParaPdf(),
  });

  descargar(pdf, nombreArchivoLiquidacion(liquidacion.numero, propietario?.nombre));
}

/** El recibo de la liquidación: lo firma el dueño o la inmobiliaria, según para dónde va la plata. */
export async function emitirReciboLiquidacion(db: BaseDatos, liquidacion: Liquidacion): Promise<void> {
  const propietario = db.personas.find((p) => p.id === liquidacion.propietarioId);
  const pdf = construirReciboLiquidacion({
    liquidacion,
    emisor: db.configuracion,
    propietario,
    logo: await logoParaPdf(),
    sello: await selloParaPdf(),
  });
  descargar(pdf, nombreArchivoReciboLiquidacion(liquidacion.numero, propietario?.nombre));
}

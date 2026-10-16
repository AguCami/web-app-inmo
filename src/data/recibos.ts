/**
 * Emitir el recibo de un pago: junta los datos, arma el PDF y lo baja.
 *
 * Vive acá y no en `domain/` porque toca el navegador —el canvas para el logo
 * y la descarga del archivo—. El armado del documento sí es puro y está en
 * `domain/recibo.ts`.
 */
import { saldoTrasPago } from '../domain/cobranzas';
import { descargar } from '../domain/pdf';
import { construirRecibo, nombreArchivoRecibo } from '../domain/recibo';
import type { BaseDatos, Pago } from '../domain/types';
import { logoParaPdf } from './logoPdf';

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
  });

  descargar(pdf, nombreArchivoRecibo(numero, inquilino?.nombre));
  return true;
}

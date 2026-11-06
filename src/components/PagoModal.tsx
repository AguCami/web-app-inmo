import { useState } from 'react';
import { Campo, Modal, Nota } from './ui';
import { emitirRecibo } from '../data/documentos';
import { useApp, useDb } from '../data/store';
import { cuotasAdeudadasAntes, punitoriosDeCuota, saldoDeCuota } from '../domain/cobranzas';
import type { Cuota, MedioPago } from '../domain/types';
import {
  formatearFecha,
  formatearMoneda,
  formatearPeriodo,
  hoy,
  plural,
  sumar,
} from '../domain/util';

const MEDIOS: { id: MedioPago; texto: string }[] = [
  { id: 'transferencia', texto: 'Transferencia' },
  { id: 'efectivo', texto: 'Efectivo' },
  { id: 'debito_automatico', texto: 'Débito automático' },
  { id: 'mercadopago', texto: 'Mercado Pago' },
];

/** Alta de cobranza sobre una cuota, con los punitorios ya calculados. */
export function PagoModal({
  cuota,
  onCerrar,
  onIrACuota,
}: {
  cuota: Cuota;
  onCerrar: () => void;
  /** Para saltar a cobrar la cuota más vieja sin cerrar y volver a buscarla. */
  onIrACuota?: (c: Cuota) => void;
}) {
  const db = useDb();
  const registrar = useApp((e) => e.registrarPago);
  const completarCuota = useApp((e) => e.completarCuota);

  const contrato = db.contratos.find((c) => c.id === cuota.contratoId);
  const inquilino = db.personas.find((p) => p.id === contrato?.inquilinoId);
  const saldo = saldoDeCuota(cuota, db.pagos);
  const punitoriosSugeridos = punitoriosDeCuota(cuota, contrato, db.pagos);
  const diasMora = cuota.vencimiento < hoy() && saldo > 0
    ? Math.round((new Date(hoy()).getTime() - new Date(cuota.vencimiento).getTime()) / 86_400_000)
    : 0;

  // Los servicios que se cargan al cobrar (luz, agua, expensas del mes):
  // sus importes son obligatorios y se suman a lo que hay que cobrar.
  const aCompletar = cuota.items
    .map((item, indice) => ({ item, indice }))
    .filter(({ item }) => item.aCompletar);
  const [servicios, setServicios] = useState<Record<number, string>>({});
  const faltanServicios = aCompletar.some(({ indice }) => (servicios[indice] ?? '').trim() === '' || Number(servicios[indice]) < 0);
  const totalServicios = sumar(aCompletar, ({ indice }) => Number(servicios[indice]) || 0);
  const saldoConServicios = saldo + totalServicios;

  const [fecha, setFecha] = useState(hoy());
  // El monto acompaña a los servicios mientras no se lo toque a mano.
  const [montoManual, setMontoManual] = useState<string | null>(null);
  const monto = montoManual ?? String(saldoConServicios);
  const setMonto = (v: string) => setMontoManual(v);
  const [punitorios, setPunitorios] = useState(String(punitoriosSugeridos));
  const [medio, setMedio] = useState<MedioPago>('transferencia');
  const [comprobante, setComprobante] = useState('');
  const [emitiendo, setEmitiendo] = useState(false);
  const [saltearOrden, setSaltearOrden] = useState(false);

  // Cobrar un período dejando otro anterior impago hace presumir que el
  // anterior está pagado (art. 899 inc. b CCyC). Se frena, y si se hace
  // igual el recibo sale con la reserva.
  const atrasadas = cuotasAdeudadasAntes(cuota, db.cuotas, db.pagos);
  const deudaAnterior = sumar(atrasadas, (c) => saldoDeCuota(c, db.pagos));
  const frenado = atrasadas.length > 0 && !saltearOrden;

  const montoNum = Number(monto) || 0;
  const punitoriosNum = Number(punitorios) || 0;
  const total = montoNum + punitoriosNum;
  const quedaSaldo = saldoConServicios - montoNum;

  return (
    <Modal
      titulo="Registrar cobranza"
      subtitulo={`${inquilino?.nombre ?? ''} · ${formatearPeriodo(cuota.periodo, true)}`}
      onCerrar={onCerrar}
      pie={
        <>
          <button className="btn btn--fantasma" onClick={onCerrar}>Cancelar</button>
          <button
            className="btn btn--primario"
            disabled={montoNum <= 0 || emitiendo || frenado || faltanServicios}
            onClick={async () => {
              setEmitiendo(true);
              if (aCompletar.length) {
                completarCuota(
                  cuota.id,
                  new Map(aCompletar.map(({ indice }) => [indice, Number(servicios[indice]) || 0])),
                );
              }
              const pago = registrar({
                cuotaId: cuota.id,
                fecha,
                monto: montoNum,
                moneda: cuota.moneda,
                medio,
                comprobante: comprobante || undefined,
                punitorios: punitoriosNum || undefined,
                periodosAdeudados: atrasadas.length
                  ? atrasadas.map((c) => c.periodo)
                  : undefined,
              });
              // El cobro ya quedó guardado; el recibo se arma sobre la base
              // recién mutada, así sale con este pago adentro.
              await emitirRecibo(useApp.getState().db, pago);
              onCerrar();
            }}
          >
            {emitiendo ? 'Armando el recibo…' : `Cobrar y dar recibo · ${formatearMoneda(total, cuota.moneda)}`}
          </button>
        </>
      }
    >
      {atrasadas.length > 0 && (
        <Nota tono="critico" titulo={`Antes debe ${plural(atrasadas.length, 'período', 'períodos')}`}>
          <span>
            Adeuda {formatearMoneda(deudaAnterior, cuota.moneda)} de{' '}
            {atrasadas.map((c) => formatearPeriodo(c.periodo, true)).join(', ')}. Dar el recibo de{' '}
            {formatearPeriodo(cuota.periodo, true)} hace presumir que esos períodos están pagados
            (art. 899 inc. b del Código Civil y Comercial).
          </span>
          {onIrACuota && (
            <div className="fila" style={{ marginTop: 10 }}>
              <button className="btn btn--chico" onClick={() => onIrACuota(atrasadas[0])}>
                Cobrar {formatearPeriodo(atrasadas[0].periodo, true)} primero
              </button>
            </div>
          )}
          <label className="fila" style={{ gap: 8, marginTop: 10, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={saltearOrden}
              onChange={(e) => setSaltearOrden(e.target.checked)}
            />
            <span>
              Cobrar {formatearPeriodo(cuota.periodo, true)} igual. El recibo va a dejar constancia
              de la deuda anterior.
            </span>
          </label>
        </Nota>
      )}

      <Nota tono={diasMora > 0 ? 'alerta' : 'neutro'}>
        <strong>
          Saldo de la cuota: {formatearMoneda(saldoConServicios, cuota.moneda)}
        </strong>
        <span className="mini">
          Venció el {formatearFecha(cuota.vencimiento)}
          {diasMora > 0 ? ` · ${plural(diasMora, 'día', 'días')} de atraso` : ' · todavía en término'}
          {' · '}total facturado {formatearMoneda(cuota.total + totalServicios, cuota.moneda)}
        </span>
      </Nota>

      {aCompletar.length > 0 && (
        <div className="pago__servicios">
          <h3>Servicios de {formatearPeriodo(cuota.periodo, true)}</h3>
          <p className="mini tenue">Obligatorios: poné el importe de la factura de este mes. Si no corresponde, poné 0.</p>
          <div className="grid grid--form">
            {aCompletar.map(({ item, indice }) => {
              const valor = servicios[indice] ?? '';
              return (
                <Campo key={indice} etiqueta={item.descripcion}>
                  <input
                    className="entrada-num"
                    type="number"
                    min={0}
                    step="0.01"
                    required
                    aria-required="true"
                    aria-invalid={valor.trim() === '' || undefined}
                    value={valor}
                    placeholder="Importe"
                    onChange={(e) => setServicios((s) => ({ ...s, [indice]: e.target.value }))}
                  />
                </Campo>
              );
            })}
          </div>
          {faltanServicios && (
            <p className="mini" style={{ color: 'var(--critico)', marginTop: 8 }}>
              Completá {aCompletar.length === 1 ? 'el importe del servicio' : 'los importes de todos los servicios'} para poder cobrar.
            </p>
          )}
        </div>
      )}

      <div className="grid grid--form">
        <Campo etiqueta="Fecha del pago">
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </Campo>
        <Campo
          etiqueta="Monto"
          ayuda={
            quedaSaldo > 0.01
              ? `Quedarían ${formatearMoneda(quedaSaldo, cuota.moneda)} sin cobrar`
              : 'Cancela la cuota'
          }
        >
          <input className="entrada-num" type="number" value={monto} onChange={(e) => setMonto(e.target.value)} />
        </Campo>
        <Campo
          etiqueta="Punitorios"
          ayuda={
            punitoriosSugeridos > 0
              ? `Sugerido por mora: ${formatearMoneda(punitoriosSugeridos, cuota.moneda)}`
              : 'Sin mora, no corresponden'
          }
        >
          <input
            className="entrada-num"
            type="number"
            value={punitorios}
            onChange={(e) => setPunitorios(e.target.value)}
          />
        </Campo>
        <Campo
          etiqueta="Medio"
          ayuda={
            medio === 'efectivo'
              ? 'Lo cobra la inmobiliaria: al dueño se le transfiere menos los honorarios.'
              : 'Va directo al dueño: después se le cobran los honorarios.'
          }
        >
          <select value={medio} onChange={(e) => setMedio(e.target.value as MedioPago)}>
            {MEDIOS.map((m) => (
              <option key={m.id} value={m.id}>{m.texto}</option>
            ))}
          </select>
        </Campo>
      </div>

      <Campo
        etiqueta="Comprobante del inquilino"
        ayuda="Opcional: número de la transferencia o del depósito. El recibo lo numera la app."
      >
        <input value={comprobante} onChange={(e) => setComprobante(e.target.value)} placeholder="1234567890" />
      </Campo>
    </Modal>
  );
}

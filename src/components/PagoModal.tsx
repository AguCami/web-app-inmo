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

  const contrato = db.contratos.find((c) => c.id === cuota.contratoId);
  const inquilino = db.personas.find((p) => p.id === contrato?.inquilinoId);
  const saldo = saldoDeCuota(cuota, db.pagos);
  const punitoriosSugeridos = punitoriosDeCuota(cuota, contrato, db.pagos);
  const diasMora = cuota.vencimiento < hoy() && saldo > 0
    ? Math.round((new Date(hoy()).getTime() - new Date(cuota.vencimiento).getTime()) / 86_400_000)
    : 0;

  const [fecha, setFecha] = useState(hoy());
  const [monto, setMonto] = useState(String(saldo));
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
  const quedaSaldo = saldo - montoNum;

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
            disabled={montoNum <= 0 || emitiendo || frenado}
            onClick={async () => {
              setEmitiendo(true);
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
          Saldo de la cuota: {formatearMoneda(saldo, cuota.moneda)}
        </strong>
        <span className="mini">
          Venció el {formatearFecha(cuota.vencimiento)}
          {diasMora > 0 ? ` · ${plural(diasMora, 'día', 'días')} de atraso` : ' · todavía en término'}
          {' · '}total facturado {formatearMoneda(cuota.total, cuota.moneda)}
        </span>
      </Nota>

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
        <Campo etiqueta="Medio">
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

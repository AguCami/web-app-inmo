import { useState } from 'react';
import { Campo, Modal, Nota } from './ui';
import { useApp, useDb } from '../data/store';
import { punitoriosDeCuota, saldoDeCuota } from '../domain/cobranzas';
import type { Cuota, MedioPago } from '../domain/types';
import { formatearFecha, formatearMoneda, formatearPeriodo, hoy, plural } from '../domain/util';

const MEDIOS: { id: MedioPago; texto: string }[] = [
  { id: 'transferencia', texto: 'Transferencia' },
  { id: 'efectivo', texto: 'Efectivo' },
  { id: 'debito_automatico', texto: 'Débito automático' },
  { id: 'mercadopago', texto: 'Mercado Pago' },
];

/** Alta de cobranza sobre una cuota, con los punitorios ya calculados. */
export function PagoModal({ cuota, onCerrar }: { cuota: Cuota; onCerrar: () => void }) {
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
            disabled={montoNum <= 0}
            onClick={() => {
              registrar({
                cuotaId: cuota.id,
                fecha,
                monto: montoNum,
                moneda: cuota.moneda,
                medio,
                comprobante: comprobante || undefined,
                punitorios: punitoriosNum || undefined,
              });
              onCerrar();
            }}
          >
            Cobrar {formatearMoneda(total, cuota.moneda)}
          </button>
        </>
      }
    >
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

      <Campo etiqueta="Comprobante" ayuda="Opcional: número de recibo o de transferencia.">
        <input value={comprobante} onChange={(e) => setComprobante(e.target.value)} placeholder="REC-0001" />
      </Campo>
    </Modal>
  );
}

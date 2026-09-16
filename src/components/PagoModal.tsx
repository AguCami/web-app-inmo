import { useState } from 'react';
import { Campo, Modal } from './ui';
import { useApp, useDb } from '../data/store';
import { punitoriosDeCuota, saldoDeCuota } from '../domain/cobranzas';
import type { Cuota, MedioPago } from '../domain/types';
import { formatearFecha, formatearMoneda, formatearPeriodo, hoy } from '../domain/util';

const MEDIOS: { id: MedioPago; etiqueta: string }[] = [
  { id: 'transferencia', etiqueta: 'Transferencia' },
  { id: 'efectivo', etiqueta: 'Efectivo' },
  { id: 'cheque', etiqueta: 'Cheque' },
  { id: 'debito_automatico', etiqueta: 'Débito automático' },
  { id: 'mercadopago', etiqueta: 'Mercado Pago' },
];

/** Alta de cobranza sobre una cuota, con los punitorios ya calculados. */
export function PagoModal({ cuota, onCerrar }: { cuota: Cuota; onCerrar: () => void }) {
  const db = useDb();
  const registrar = useApp((e) => e.registrarPago);

  const contrato = db.contratos.find((c) => c.id === cuota.contratoId);
  const saldo = saldoDeCuota(cuota, db.pagos);
  const punitoriosSugeridos = punitoriosDeCuota(cuota, contrato, db.pagos);

  const [fecha, setFecha] = useState(hoy());
  const [monto, setMonto] = useState(String(saldo));
  const [punitorios, setPunitorios] = useState(String(punitoriosSugeridos));
  const [medio, setMedio] = useState<MedioPago>('transferencia');
  const [cuentaId, setCuentaId] = useState(db.cuentas.find((c) => c.moneda === cuota.moneda)?.id ?? db.cuentas[0]?.id ?? '');
  const [comprobante, setComprobante] = useState('');

  const montoNum = Number(monto) || 0;
  const punitoriosNum = Number(punitorios) || 0;
  const valido = montoNum > 0 && cuentaId;

  return (
    <Modal
      titulo={`Registrar cobranza · ${formatearPeriodo(cuota.periodo, true)}`}
      onCerrar={onCerrar}
      pie={
        <>
          <button className="btn" onClick={onCerrar}>Cancelar</button>
          <button
            className="btn btn--primario"
            disabled={!valido}
            onClick={() => {
              registrar({
                cuotaId: cuota.id,
                fecha,
                monto: montoNum,
                moneda: cuota.moneda,
                medio,
                cuentaId,
                comprobante: comprobante || undefined,
                punitorios: punitoriosNum || undefined,
              });
              onCerrar();
            }}
          >
            Registrar {formatearMoneda(montoNum + punitoriosNum, cuota.moneda)}
          </button>
        </>
      }
    >
      <div className="aviso">
        <span aria-hidden="true">🧾</span>
        <div>
          <strong>Cuota {formatearPeriodo(cuota.periodo, true)} · contrato {contrato?.numero}</strong>
          <span className="mini">
            Vence el {formatearFecha(cuota.vencimiento)} · total {formatearMoneda(cuota.total, cuota.moneda)} ·{' '}
            saldo {formatearMoneda(saldo, cuota.moneda)}
          </span>
        </div>
      </div>

      <div className="grid grid--form">
        <Campo etiqueta="Fecha de pago">
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </Campo>
        <Campo etiqueta="Monto imputado">
          <input className="entrada-num" type="number" value={monto} onChange={(e) => setMonto(e.target.value)} />
        </Campo>
        <Campo
          etiqueta="Punitorios"
          ayuda={punitoriosSugeridos > 0 ? `Sugerido: ${formatearMoneda(punitoriosSugeridos, cuota.moneda)}` : 'Sin mora'}
        >
          <input className="entrada-num" type="number" value={punitorios} onChange={(e) => setPunitorios(e.target.value)} />
        </Campo>
        <Campo etiqueta="Medio">
          <select value={medio} onChange={(e) => setMedio(e.target.value as MedioPago)}>
            {MEDIOS.map((m) => (
              <option key={m.id} value={m.id}>{m.etiqueta}</option>
            ))}
          </select>
        </Campo>
        <Campo etiqueta="Cuenta de destino">
          <select value={cuentaId} onChange={(e) => setCuentaId(e.target.value)}>
            {db.cuentas.filter((c) => c.activa).map((c) => (
              <option key={c.id} value={c.id}>{c.nombre} ({c.moneda})</option>
            ))}
          </select>
        </Campo>
        <Campo etiqueta="Comprobante">
          <input value={comprobante} onChange={(e) => setComprobante(e.target.value)} placeholder="REC-0001" />
        </Campo>
      </div>
    </Modal>
  );
}

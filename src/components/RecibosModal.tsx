import { useState } from 'react';
import { Item, Modal, Vacio } from './ui';
import { useDb } from '../data/store';
import { emitirRecibo } from '../data/recibos';
import { pagosOrdenados } from '../domain/cobranzas';
import type { Cuota } from '../domain/types';
import { formatearFecha, formatearMoneda, formatearPeriodo } from '../domain/util';

const MEDIOS: Record<string, string> = {
  transferencia: 'Transferencia',
  efectivo: 'Efectivo',
  debito_automatico: 'Débito automático',
  mercadopago: 'Mercado Pago',
};

/** Los recibos ya emitidos de una cuota, para volver a bajarlos. */
export function RecibosModal({ cuota, onCerrar }: { cuota: Cuota; onCerrar: () => void }) {
  const db = useDb();
  const [bajando, setBajando] = useState('');

  const pagos = pagosOrdenados(db.pagos, cuota.id);

  return (
    <Modal
      titulo="Recibos de la cuota"
      subtitulo={formatearPeriodo(cuota.periodo, true)}
      onCerrar={onCerrar}
      pie={<button className="btn btn--fantasma" onClick={onCerrar}>Cerrar</button>}
    >
      {pagos.length === 0 ? (
        <Vacio titulo="Todavía no se cobró nada de esta cuota" detalle="Cuando registres el cobro se emite el recibo." />
      ) : (
        <div className="panel__lista" style={{ padding: 0 }}>
          {pagos.map((p) => (
            <Item
              key={p.id}
              titulo={p.recibo ?? 'Sin número'}
              sub={
                <>
                  {formatearFecha(p.fecha)} · {MEDIOS[p.medio] ?? p.medio}
                  {p.comprobante && ` · ${p.comprobante}`}
                  {p.punitorios ? ` · incluye ${formatearMoneda(p.punitorios, p.moneda)} de punitorios` : ''}
                </>
              }
              monto={formatearMoneda(p.monto + (p.punitorios ?? 0), p.moneda)}
              fin={
                <button
                  className="btn btn--chico"
                  disabled={bajando === p.id}
                  onClick={async () => {
                    setBajando(p.id);
                    await emitirRecibo(db, p);
                    setBajando('');
                  }}
                >
                  {bajando === p.id ? 'Armando…' : 'Descargar PDF'}
                </button>
              }
            />
          ))}
        </div>
      )}
    </Modal>
  );
}

import { useMemo, useState } from 'react';
import { Encabezado } from '../components/Encabezado';
import { SelectorPeriodo } from '../components/SelectorPeriodo';
import { Avatar, Dato, Item, Modal, Panel, Pastilla, Segmentos, Vacio } from '../components/ui';
import { emitirLiquidacion } from '../data/documentos';
import { IconoLiquidaciones } from '../components/iconos';
import { useApp, useDb } from '../data/store';
import { ETIQUETA_ITEM_LIQUIDACION, sentidoLiquidacion } from '../domain/liquidaciones';
import type { EstadoLiquidacion, Liquidacion } from '../domain/types';
import {
  formatearFecha,
  formatearMoneda,
  formatearPeriodo,
  periodoActual,
  plural,
  sumar,
  ultimosPeriodos,
} from '../domain/util';

const TONO: Record<EstadoLiquidacion, 'alerta' | 'acento' | 'ok'> = {
  borrador: 'alerta',
  aprobada: 'acento',
  pagada: 'ok',
};

/** El texto del estado depende de para qué lado va la plata. */
const textoEstado = (l: Liquidacion) =>
  l.estado === 'borrador'
    ? 'Borrador'
    : sentidoLiquidacion(l.neto) === 'cobrar'
      ? l.estado === 'pagada' ? 'Cobrada' : 'Lista para cobrar'
      : l.estado === 'pagada' ? 'Transferida' : 'Lista para pagar';

export default function Liquidaciones() {
  const db = useDb();
  const generar = useApp((e) => e.generarLiquidaciones);
  const cambiarEstado = useApp((e) => e.cambiarEstadoLiquidacion);
  const eliminarLiq = useApp((e) => e.eliminarLiquidacion);

  const [periodo, setPeriodo] = useState(periodoActual());
  const [filtro, setFiltro] = useState<'todas' | 'pendientes'>('todas');
  const [detalle, setDetalle] = useState<Liquidacion | null>(null);
  const [aviso, setAviso] = useState('');

  const personaDe = (id: string) => db.personas.find((p) => p.id === id);

  const lista = useMemo(
    () =>
      db.liquidaciones
        .filter((l) => l.periodo === periodo)
        .filter((l) => filtro === 'todas' || l.estado !== 'pagada')
        .sort((a, b) => a.numero.localeCompare(b.numero)),
    [db.liquidaciones, periodo, filtro],
  );

  const delPeriodo = db.liquidaciones.filter((l) => l.periodo === periodo);
  // Positivo: se le transfiere al dueño (cobró la inmobiliaria en efectivo).
  // Negativo: se le cobra al dueño (el inquilino le transfirió a él).
  const aTransferir = sumar(delPeriodo.filter((l) => l.neto > 0), (l) => l.neto);
  const aCobrar = -sumar(delPeriodo.filter((l) => l.neto < 0), (l) => l.neto);
  const honorarios = sumar(delPeriodo, (l) => l.comisionTotal);
  const pendientes = delPeriodo.filter((l) => l.estado !== 'pagada');

  return (
    <>
      <Encabezado
        titulo="Liquidaciones"
        bajada="Lo que hay que rendirle a cada propietario de lo que se cobró"
      >
        <SelectorPeriodo valor={periodo} opciones={ultimosPeriodos(periodoActual(), 18).reverse()} onCambio={setPeriodo} />
        <button
          className="btn btn--primario no-imprimir"
          onClick={() => {
            const n = generar(periodo);
            setAviso(
              n
                ? `Se generó ${plural(n, 'liquidación', 'liquidaciones')}.`
                : 'No quedan cobranzas sin rendir en este mes.',
            );
          }}
        >
          Generar
        </button>
      </Encabezado>

      <div className="contenido">
        {aviso && <div className="nota nota--ok"><span>{aviso}</span></div>}

        <div className="grid grid--resumen">
          <Dato
            etiqueta="A transferir a dueños"
            valor={formatearMoneda(aTransferir)}
            pie="cobrado en efectivo, menos honorarios"
          />
          <Dato
            etiqueta="A cobrar a dueños"
            valor={formatearMoneda(aCobrar)}
            pie="honorarios de lo que se les transfirió"
          />
          <Dato etiqueta="Tus honorarios" valor={formatearMoneda(honorarios)} tono="acento" pie="del mes" />
          <Dato
            etiqueta="Sin cerrar"
            valor={String(pendientes.length)}
            tono={pendientes.length ? 'alerta' : 'ok'}
            pie={pendientes.length ? plural(pendientes.length, 'liquidación', 'liquidaciones') : 'todo rendido'}
          />
        </div>

        <div className="fila no-imprimir">
          <Segmentos
            etiqueta="Filtrar liquidaciones"
            valor={filtro}
            onCambio={setFiltro}
            opciones={[
              { id: 'todas', texto: `Todas (${delPeriodo.length})` },
              { id: 'pendientes', texto: `Sin cerrar (${pendientes.length})` },
            ]}
          />
        </div>

        <Panel comoLista>
          {lista.length === 0 ? (
            <Vacio
              icono={<IconoLiquidaciones tam={24} />}
              titulo="No hay liquidaciones de este mes"
              detalle="Generalas cuando hayas registrado las cobranzas."
            />
          ) : (
            lista.map((l) => {
              const cobrado = sumar(l.items.filter((i) => i.tipo === 'alquiler_cobrado'), (i) => i.monto);
              const gastos = sumar(l.items.filter((i) => i.tipo === 'gasto'), (i) => i.monto);
              return (
                <Item
                  key={l.id}
                  onClick={() => setDetalle(l)}
                  avatar={<Avatar nombre={personaDe(l.propietarioId)?.nombre ?? '—'} />}
                  titulo={
                    <>
                      {personaDe(l.propietarioId)?.nombre ?? '—'}
                      <Pastilla tono={TONO[l.estado]}>{textoEstado(l)}</Pastilla>
                    </>
                  }
                  sub={
                    <>
                      {l.numero} · cobrado {formatearMoneda(cobrado, l.moneda)} · honorarios{' '}
                      {formatearMoneda(l.comisionTotal, l.moneda)}
                      {gastos < 0 && ` · gastos ${formatearMoneda(gastos, l.moneda)}`}
                    </>
                  }
                  monto={formatearMoneda(Math.abs(l.neto), l.moneda)}
                  montoPie={
                    sentidoLiquidacion(l.neto) === 'cobrar'
                      ? l.fechaPago ? `cobrada ${formatearFecha(l.fechaPago)}` : 'a cobrarle'
                      : l.fechaPago ? `pagada ${formatearFecha(l.fechaPago)}` : 'a transferir'
                  }
                />
              );
            })
          )}
        </Panel>
      </div>

      {detalle && (
        <DetalleLiquidacion
          liquidacion={detalle}
          onCerrar={() => setDetalle(null)}
          onCambiarEstado={(estado) => {
            cambiarEstado(detalle.id, estado);
            setDetalle(null);
          }}
          onEliminar={() => {
            eliminarLiq(detalle.id);
            setDetalle(null);
          }}
        />
      )}
    </>
  );
}

function DetalleLiquidacion({
  liquidacion,
  onCerrar,
  onCambiarEstado,
  onEliminar,
}: {
  liquidacion: Liquidacion;
  onCerrar: () => void;
  onCambiarEstado: (estado: EstadoLiquidacion) => void;
  onEliminar: () => void;
}) {
  const db = useDb();
  const propietario = db.personas.find((p) => p.id === liquidacion.propietarioId);
  const [bajando, setBajando] = useState(false);
  const cobrar = sentidoLiquidacion(liquidacion.neto) === 'cobrar';
  const importe = formatearMoneda(Math.abs(liquidacion.neto), liquidacion.moneda);

  return (
    <Modal
      titulo={propietario?.nombre ?? 'Liquidación'}
      subtitulo={`${liquidacion.numero} · ${formatearPeriodo(liquidacion.periodo, true)}`}
      onCerrar={onCerrar}
      ancho
      pie={
        <>
          {liquidacion.estado === 'borrador' && (
            <button className="btn btn--peligro" onClick={onEliminar} style={{ marginRight: 'auto' }}>
              Eliminar
            </button>
          )}
          <button
            className="btn"
            disabled={bajando}
            onClick={async () => {
              setBajando(true);
              await emitirLiquidacion(db, liquidacion);
              setBajando(false);
            }}
          >
            {bajando ? 'Armando el PDF…' : 'Descargar PDF'}
          </button>
          {liquidacion.estado === 'borrador' && (
            <button className="btn btn--primario" onClick={() => onCambiarEstado('aprobada')}>
              Aprobar
            </button>
          )}
          {liquidacion.estado === 'aprobada' && (
            <button className="btn btn--primario" onClick={() => onCambiarEstado('pagada')}>
              {cobrar ? 'Marcar como cobrada' : 'Marcar como transferida'}
            </button>
          )}
          {liquidacion.estado === 'pagada' && (
            <button className="btn" onClick={() => onCambiarEstado('aprobada')}>Deshacer</button>
          )}
        </>
      }
    >
      <div className="nota">
        <div>
          {cobrar ? (
            <>
              <strong>Cobrarle {importe} al propietario</strong>
              <span className="mini">El inquilino le transfirió a él: falta cobrarle los honorarios y los gastos.</span>
            </>
          ) : (
            <>
              <strong>Transferir {importe}</strong>
              <span className="mini">
                {propietario?.cbu ? `CBU ${propietario.cbu}` : 'Este propietario no tiene CBU cargado.'}
              </span>
            </>
          )}
        </div>
      </div>

      <div className="pila" style={{ gap: 2 }}>
        {liquidacion.items.map((i, idx) => (
          <div
            className="fila"
            key={idx}
            style={{
              justifyContent: 'space-between',
              gap: 14,
              padding: '9px 2px',
              borderBottom: '1px solid var(--borde)',
            }}
          >
            <span className="crece">
              <span style={{ fontSize: 13.8 }}>{i.descripcion}</span>
              <span className="mini tenue" style={{ display: 'block' }}>
                {ETIQUETA_ITEM_LIQUIDACION[i.tipo]}
              </span>
            </span>
            <strong className={`num ${i.monto < 0 ? 'neg' : ''}`} style={{ fontSize: 14 }}>
              {formatearMoneda(i.monto, liquidacion.moneda)}
            </strong>
          </div>
        ))}
        <div className="fila" style={{ justifyContent: 'space-between', paddingTop: 12, gap: 14 }}>
          <strong>{cobrar ? 'A cobrarle al propietario' : 'Neto a transferir'}</strong>
          <strong
            className="num"
            style={{ fontFamily: 'var(--fuente-titulo)', fontSize: 19 }}
          >
            {importe}
          </strong>
        </div>
      </div>

      <p className="mini tenue">
        Se liquida lo que entró, no lo que se facturó. Si después entra una cobranza tardía, «Generar» arma una
        liquidación complementaria por la diferencia.
      </p>
    </Modal>
  );
}

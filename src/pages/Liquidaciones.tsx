import { useMemo, useState } from 'react';
import { Encabezado } from '../components/Encabezado';
import { Chip, Kpi, Modal, Paginador, Tabla, Tarjeta, usePaginado, Vacio, type TonoChip } from '../components/ui';
import { useApp, useDb } from '../data/store';
import { ETIQUETA_ITEM_LIQUIDACION } from '../domain/liquidaciones';
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

const TONO: Record<EstadoLiquidacion, TonoChip> = {
  borrador: 'alerta',
  aprobada: 'info',
  pagada: 'ok',
};

const ETIQUETA: Record<EstadoLiquidacion, string> = {
  borrador: 'Borrador',
  aprobada: 'Aprobada',
  pagada: 'Pagada',
};

export default function Liquidaciones() {
  const db = useDb();
  const generar = useApp((e) => e.generarLiquidaciones);
  const cambiarEstado = useApp((e) => e.cambiarEstadoLiquidacion);
  const eliminarLiq = useApp((e) => e.eliminarLiquidacion);

  const [periodo, setPeriodo] = useState(periodoActual());
  const [verTodas, setVerTodas] = useState(false);
  const [detalle, setDetalle] = useState<Liquidacion | null>(null);
  const [mensaje, setMensaje] = useState('');

  const personaDe = (id: string) => db.personas.find((p) => p.id === id);

  const listadas = useMemo(
    () =>
      db.liquidaciones
        .filter((l) => verTodas || l.periodo === periodo)
        .sort((a, b) => (a.periodo === b.periodo ? a.numero.localeCompare(b.numero) : b.periodo.localeCompare(a.periodo))),
    [db.liquidaciones, periodo, verTodas],
  );

  const totalNeto = sumar(listadas, (l) => l.neto);
  const totalComision = sumar(listadas, (l) => l.comisionTotal);
  const pendientes = listadas.filter((l) => l.estado !== 'pagada');
  const pag = usePaginado(listadas, 50);

  return (
    <>
      <Encabezado
        titulo="Liquidaciones a propietarios"
        bajada="Se liquida lo efectivamente cobrado; sobre eso se descuentan honorarios y gastos"
      >
        <button
          className="btn btn--primario no-imprimir"
          onClick={() => {
            const n = generar(periodo);
            setMensaje(
              n
                ? `Se generó ${plural(n, 'liquidación', 'liquidaciones')} de ${formatearPeriodo(periodo, true)}.`
                : 'No quedan cobranzas sin rendir en ese período.',
            );
          }}
        >
          Generar liquidaciones
        </button>
      </Encabezado>

      <div className="contenido pila">
        {mensaje && <div className="aviso aviso--ok"><span aria-hidden="true">✅</span><div>{mensaje}</div></div>}

        <div className="fila no-imprimir">
          <select
            value={periodo}
            onChange={(e) => {
              setPeriodo(e.target.value);
              setVerTodas(false);
            }}
            style={{ width: 'auto' }}
            aria-label="Período"
            disabled={verTodas}
          >
            {ultimosPeriodos(periodoActual(), 18)
              .reverse()
              .map((p) => (
                <option key={p} value={p}>{formatearPeriodo(p, true)}</option>
              ))}
          </select>
          <label className="fila" style={{ gap: 6 }}>
            <input type="checkbox" checked={verTodas} onChange={(e) => setVerTodas(e.target.checked)} />
            Todos los períodos
          </label>
        </div>

        <div className="grid grid--kpis">
          <Kpi etiqueta="A pagar a propietarios" valor={formatearMoneda(totalNeto)} pie={`${listadas.length} liquidaciones`} />
          <Kpi etiqueta="Honorarios de la inmobiliaria" valor={formatearMoneda(totalComision)} tono="ok" pie="administración devengada" />
          <Kpi
            etiqueta="Pendientes de pago"
            valor={formatearMoneda(sumar(pendientes, (l) => l.neto))}
            tono={pendientes.length ? 'alerta' : 'ok'}
            pie={`${pendientes.length} sin transferir`}
          />
        </div>

        <Tarjeta ajustado>
          {listadas.length === 0 ? (
            <Vacio
              icono="📤"
              titulo="No hay liquidaciones en este período"
              detalle="Generalas cuando hayas registrado las cobranzas del mes."
            />
          ) : (
            <Tabla>
              <thead>
                <tr>
                  <th>Número</th>
                  <th>Propietario</th>
                  <th>Período</th>
                  <th className="num">Cobrado</th>
                  <th className="num">Honorarios</th>
                  <th className="num">Gastos</th>
                  <th className="num">Neto a pagar</th>
                  <th>Estado</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {pag.visibles.map((l) => {
                  const cobrado = sumar(l.items.filter((i) => i.tipo === 'alquiler_cobrado'), (i) => i.monto);
                  const gastos = sumar(l.items.filter((i) => i.tipo === 'gasto'), (i) => i.monto);
                  return (
                    <tr key={l.id} className="fila-clic" onClick={() => setDetalle(l)}>
                      <td className="principal-celda">{l.numero}</td>
                      <td>{personaDe(l.propietarioId)?.nombre ?? '—'}</td>
                      <td>{formatearPeriodo(l.periodo, true)}</td>
                      <td className="num">{formatearMoneda(cobrado, l.moneda)}</td>
                      <td className="num neg">{formatearMoneda(l.comisionTotal * -1, l.moneda)}</td>
                      <td className="num">{gastos ? formatearMoneda(gastos, l.moneda) : '—'}</td>
                      <td className="num principal-celda">{formatearMoneda(l.neto, l.moneda)}</td>
                      <td>
                        <Chip tono={TONO[l.estado]}>{ETIQUETA[l.estado]}</Chip>
                        {l.fechaPago && <span className="tabla__sub">{formatearFecha(l.fechaPago)}</span>}
                      </td>
                      <td className="num no-imprimir">
                        <button className="btn btn--chico btn--fantasma" onClick={(e) => { e.stopPropagation(); setDetalle(l); }}>
                          Ver
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={4}>Totales</td>
                  <td className="num neg">{formatearMoneda(totalComision * -1)}</td>
                  <td />
                  <td className="num">{formatearMoneda(totalNeto)}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </Tabla>
          )}
          <Paginador
            pagina={pag.pagina}
            paginas={pag.paginas}
            desde={pag.desde}
            hasta={pag.hasta}
            total={pag.total}
            etiqueta="liquidaciones"
            onCambio={pag.setPagina}
          />
        </Tarjeta>
      </div>

      {detalle && (
        <DetalleLiquidacion
          liquidacion={detalle}
          onCerrar={() => setDetalle(null)}
          onCambiarEstado={(estado, cuentaId) => {
            cambiarEstado(detalle.id, estado, cuentaId);
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
  onCambiarEstado: (estado: EstadoLiquidacion, cuentaId?: string) => void;
  onEliminar: () => void;
}) {
  const db = useDb();
  const propietario = db.personas.find((p) => p.id === liquidacion.propietarioId);
  const [cuentaId, setCuentaId] = useState(liquidacion.cuentaId ?? db.cuentas[0]?.id ?? '');

  return (
    <Modal
      titulo={`Liquidación ${liquidacion.numero}`}
      onCerrar={onCerrar}
      ancho
      pie={
        <>
          {liquidacion.estado === 'borrador' && (
            <button className="btn btn--peligro" onClick={onEliminar} style={{ marginRight: 'auto' }}>
              Eliminar
            </button>
          )}
          <button className="btn" onClick={() => window.print()}>Imprimir</button>
          {liquidacion.estado === 'borrador' && (
            <button className="btn btn--primario" onClick={() => onCambiarEstado('aprobada')}>Aprobar</button>
          )}
          {liquidacion.estado === 'aprobada' && (
            <button className="btn btn--primario" onClick={() => onCambiarEstado('pagada', cuentaId)}>
              Marcar como pagada
            </button>
          )}
          {liquidacion.estado === 'pagada' && (
            <button className="btn" onClick={() => onCambiarEstado('aprobada')}>Revertir pago</button>
          )}
        </>
      }
    >
      <div className="datos">
        <div>
          <div className="dato__et">Propietario</div>
          <div className="dato__val">{propietario?.nombre}</div>
        </div>
        <div>
          <div className="dato__et">CUIT / DNI</div>
          <div className="dato__val">{propietario?.documento ?? '—'}</div>
        </div>
        <div>
          <div className="dato__et">Período</div>
          <div className="dato__val">{formatearPeriodo(liquidacion.periodo, true)}</div>
        </div>
        <div>
          <div className="dato__et">CBU</div>
          <div className="dato__val mini">{propietario?.cbu ?? '—'}</div>
        </div>
      </div>

      <Tabla compacta>
        <thead>
          <tr>
            <th>Concepto</th>
            <th>Tipo</th>
            <th className="num">Importe</th>
          </tr>
        </thead>
        <tbody>
          {liquidacion.items.map((i, idx) => (
            <tr key={idx}>
              <td>{i.descripcion}</td>
              <td className="mini tenue">{ETIQUETA_ITEM_LIQUIDACION[i.tipo]}</td>
              <td className={`num ${i.monto < 0 ? 'neg' : ''}`}>{formatearMoneda(i.monto, liquidacion.moneda)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={2}>Neto a transferir</td>
            <td className="num">{formatearMoneda(liquidacion.neto, liquidacion.moneda)}</td>
          </tr>
        </tfoot>
      </Tabla>

      {liquidacion.estado === 'aprobada' && (
        <label className="campo no-imprimir">
          <span className="campo__et">Cuenta desde la que se paga</span>
          <select value={cuentaId} onChange={(e) => setCuentaId(e.target.value)}>
            {db.cuentas.filter((c) => c.activa).map((c) => (
              <option key={c.id} value={c.id}>{c.nombre} ({c.moneda})</option>
            ))}
          </select>
        </label>
      )}

      <p className="mini tenue">
        Los honorarios de administración se reconocen como ingreso al aprobar la liquidación; el pago al propietario
        cancela la deuda de la cuenta «Propietarios cuenta liquidación».
      </p>
    </Modal>
  );
}

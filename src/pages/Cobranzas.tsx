import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Encabezado } from '../components/Encabezado';
import { Chip, Kpi, Paginador, Progreso, Tabla, Tarjeta, usePaginado, Vacio } from '../components/ui';
import { PagoModal } from '../components/PagoModal';
import { ETIQUETA_CUOTA, TONO_CUOTA } from './ContratoDetalle';
import { useApp, useDb } from '../data/store';
import {
  cobradoDeCuota,
  diasDeMora,
  estadoDeCuota,
  punitoriosDeCuota,
  resumenCobranza,
  saldoDeCuota,
} from '../domain/cobranzas';
import type { Cuota, EstadoCuota } from '../domain/types';
import {
  formatearFecha,
  formatearMoneda,
  formatearPeriodo,
  formatearPorcentaje,
  incluyeTexto,
  periodoActual,
  plural,
  ultimosPeriodos,
} from '../domain/util';

type FiltroEstado = EstadoCuota | 'todas' | 'con_saldo';

export default function Cobranzas() {
  const db = useDb();
  const emitir = useApp((e) => e.emitirCuotas);

  const [periodo, setPeriodo] = useState<string>(periodoActual());
  const [verTodos, setVerTodos] = useState(false);
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>('todas');
  const [busqueda, setBusqueda] = useState('');
  const [cobrando, setCobrando] = useState<Cuota | null>(null);
  const [mensaje, setMensaje] = useState('');

  const contratoDe = (id: string) => db.contratos.find((c) => c.id === id);
  const propiedadDe = (id?: string) => db.propiedades.find((p) => p.id === id);
  const personaDe = (id?: string) => db.personas.find((p) => p.id === id);

  const periodosDisponibles = useMemo(() => {
    const set = new Set(db.cuotas.map((c) => c.periodo));
    ultimosPeriodos(periodoActual(), 12).forEach((p) => set.add(p));
    return [...set].sort((a, b) => b.localeCompare(a));
  }, [db.cuotas]);

  const cuotasPeriodo = useMemo(
    () => (verTodos ? db.cuotas : db.cuotas.filter((c) => c.periodo === periodo)),
    [db.cuotas, periodo, verTodos],
  );

  const filtradas = useMemo(
    () =>
      cuotasPeriodo
        .filter((c) => {
          if (filtroEstado === 'todas') return true;
          if (filtroEstado === 'con_saldo') return saldoDeCuota(c, db.pagos) > 0.01 && c.estado !== 'anulada';
          return estadoDeCuota(c, db.pagos) === filtroEstado;
        })
        .filter((c) => {
          const contrato = contratoDe(c.contratoId);
          return incluyeTexto(
            [
              contrato?.numero,
              propiedadDe(contrato?.propiedadId)?.codigo,
              propiedadDe(contrato?.propiedadId)?.calle,
              personaDe(contrato?.inquilinoId)?.nombre,
            ],
            busqueda,
          );
        })
        .sort((a, b) => (a.periodo === b.periodo ? a.vencimiento.localeCompare(b.vencimiento) : b.periodo.localeCompare(a.periodo))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cuotasPeriodo, filtroEstado, busqueda, db.pagos, db.contratos, db.propiedades, db.personas],
  );

  const resumen = useMemo(
    () => resumenCobranza(cuotasPeriodo, db.contratos, db.pagos),
    [cuotasPeriodo, db.contratos, db.pagos],
  );
  // El pie de la tabla totaliza lo que se está viendo, no el período entero.
  const resumenFiltrado = useMemo(
    () => resumenCobranza(filtradas, db.contratos, db.pagos),
    [filtradas, db.contratos, db.pagos],
  );
  const pag = usePaginado(filtradas, 50);

  return (
    <>
      <Encabezado
        titulo="Cobranzas"
        bajada={verTodos ? 'Todas las cuotas emitidas' : `Cuotas de ${formatearPeriodo(periodo, true)}`}
      >
        <button
          className="btn btn--primario no-imprimir"
          onClick={() => {
            const n = emitir(periodo);
            setMensaje(
              n
                ? `Se emitió ${plural(n, 'cuota nueva', 'cuotas nuevas')}.`
                : 'No quedaban cuotas por emitir para ese período.',
            );
          }}
        >
          Emitir cuotas
        </button>
      </Encabezado>

      <div className="contenido pila">
        {mensaje && <div className="aviso aviso--ok"><span aria-hidden="true">✅</span><div>{mensaje}</div></div>}

        <div className="fila no-imprimir">
          <select
            value={periodo}
            onChange={(e) => {
              setPeriodo(e.target.value);
              setVerTodos(false);
            }}
            style={{ width: 'auto' }}
            aria-label="Período"
            disabled={verTodos}
          >
            {periodosDisponibles.map((p) => (
              <option key={p} value={p}>{formatearPeriodo(p, true)}</option>
            ))}
          </select>
          <label className="fila" style={{ gap: 6 }}>
            <input type="checkbox" checked={verTodos} onChange={(e) => setVerTodos(e.target.checked)} />
            Todos los períodos
          </label>
          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value as FiltroEstado)}
            style={{ width: 'auto' }}
            aria-label="Estado"
          >
            <option value="todas">Todos los estados</option>
            <option value="con_saldo">Con saldo pendiente</option>
            <option value="pagada">Pagadas</option>
            <option value="vencida">Vencidas</option>
            <option value="parcial">Pago parcial</option>
            <option value="pendiente">Pendientes</option>
          </select>
          <div className="buscador">
            <input
              type="search"
              placeholder="Buscar por inquilino, propiedad o contrato"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              aria-label="Buscar cuotas"
            />
          </div>
        </div>

        <div className="grid grid--kpis">
          <Kpi etiqueta="Emitido" valor={formatearMoneda(resumen.emitido)} pie={`${resumen.cantidadCuotas} cuotas`} />
          <Kpi etiqueta="Cobrado" valor={formatearMoneda(resumen.cobrado)} tono="ok" pie={formatearPorcentaje(resumen.tasaCobranza)} />
          <Kpi
            etiqueta="Pendiente"
            valor={formatearMoneda(resumen.pendiente)}
            tono={resumen.pendiente > 0 ? 'alerta' : 'ok'}
            pie="incluye cuotas a vencer"
          />
          <Kpi
            etiqueta="Vencido"
            valor={formatearMoneda(resumen.vencido)}
            tono={resumen.vencido > 0 ? 'critico' : 'ok'}
            pie={`${resumen.cuotasVencidas} cuotas · punitorios ${formatearMoneda(resumen.punitorios)}`}
          />
        </div>

        <Tarjeta
          titulo="Detalle de cuotas"
          subtitulo={`${filtradas.length} cuotas`}
          acciones={
            <div className="fila no-imprimir" style={{ minWidth: 160 }}>
              <Progreso valor={resumen.tasaCobranza} tono={resumen.tasaCobranza >= 85 ? 'var(--ok)' : 'var(--serie-4)'} />
              <span className="mini tenue num">{formatearPorcentaje(resumen.tasaCobranza)}</span>
            </div>
          }
          ajustado
        >
          {filtradas.length === 0 ? (
            <Vacio icono="💸" titulo="No hay cuotas para mostrar" detalle="Cambiá el período o emitilas desde el botón de arriba." />
          ) : (
            <Tabla>
              <thead>
                <tr>
                  <th>Período</th>
                  <th>Inquilino</th>
                  <th>Propiedad</th>
                  <th>Vence</th>
                  <th className="num">Total</th>
                  <th className="num">Cobrado</th>
                  <th className="num">Saldo</th>
                  <th>Estado</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {pag.visibles.map((c) => {
                  const contrato = contratoDe(c.contratoId);
                  const prop = propiedadDe(contrato?.propiedadId);
                  const estado = estadoDeCuota(c, db.pagos);
                  const saldo = saldoDeCuota(c, db.pagos);
                  const mora = diasDeMora(c, db.pagos);
                  return (
                    <tr key={c.id}>
                      <td className="principal-celda">
                        {formatearPeriodo(c.periodo, true)}
                        <span className="tabla__sub">
                          <Link to={`/contratos/${c.contratoId}`}>{contrato?.numero}</Link>
                        </span>
                      </td>
                      <td>{personaDe(contrato?.inquilinoId)?.nombre ?? '—'}</td>
                      <td>
                        {prop?.codigo ?? '—'}
                        <span className="tabla__sub">{prop ? `${prop.calle} ${prop.numero}` : ''}</span>
                      </td>
                      <td>{formatearFecha(c.vencimiento)}</td>
                      <td className="num">{formatearMoneda(c.total, c.moneda)}</td>
                      <td className="num">{formatearMoneda(cobradoDeCuota(c, db.pagos), c.moneda)}</td>
                      <td className={`num ${saldo > 0 ? 'neg' : ''}`}>{formatearMoneda(saldo, c.moneda)}</td>
                      <td>
                        <Chip tono={TONO_CUOTA[estado]}>{ETIQUETA_CUOTA[estado]}</Chip>
                        {mora > 0 && (
                          <span className="tabla__sub">
                            {plural(mora, 'día', 'días')} · {formatearMoneda(punitoriosDeCuota(c, contrato, db.pagos), c.moneda)} punitorios
                          </span>
                        )}
                      </td>
                      <td className="num no-imprimir">
                        {saldo > 0.01 && estado !== 'anulada' && (
                          <button className="btn btn--chico btn--primario" onClick={() => setCobrando(c)}>Cobrar</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={4}>Totales del listado</td>
                  <td className="num">{formatearMoneda(resumenFiltrado.emitido)}</td>
                  <td className="num">{formatearMoneda(resumenFiltrado.cobrado)}</td>
                  <td className="num">{formatearMoneda(resumenFiltrado.pendiente)}</td>
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
            etiqueta="cuotas"
            onCambio={pag.setPagina}
          />
        </Tarjeta>
      </div>

      {cobrando && <PagoModal cuota={cobrando} onCerrar={() => setCobrando(null)} />}
    </>
  );
}

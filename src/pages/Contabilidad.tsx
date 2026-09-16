import { useMemo, useState } from 'react';
import { Encabezado } from '../components/Encabezado';
import { Aviso, Campo, Chip, Kpi, Modal, Paginador, Pestanas, Tabla, Tarjeta, usePaginado, Vacio } from '../components/ui';
import { useApp, useDb } from '../data/store';
import {
  asientosDesbalanceados,
  balanceSumasYSaldos,
  estadoDeResultados,
  libroDiario,
  mayorDeCuenta,
} from '../domain/contabilidad';
import { nombreCuenta, PLAN_CUENTAS } from '../domain/planCuentas';
import type { Asiento, LineaAsiento } from '../domain/types';
import {
  formatearFecha,
  formatearMoneda,
  formatearPorcentaje,
  hoy,
  incluyeTexto,
  nuevoId,
  periodoActual,
  redondear,
  sumar,
} from '../domain/util';

type Vista = 'diario' | 'mayor' | 'balance' | 'resultados' | 'plan';

const IMPUTABLES = PLAN_CUENTAS.filter((c) => c.imputable);

export default function Contabilidad() {
  const db = useDb();
  const guardarAsiento = useApp((e) => e.guardarAsiento);
  const eliminar = useApp((e) => e.eliminar);

  const [vista, setVista] = useState<Vista>('diario');
  const [desde, setDesde] = useState(`${periodoActual().slice(0, 4)}-01-01`);
  const [hasta, setHasta] = useState(hoy());
  const [cuentaMayor, setCuentaMayor] = useState('1.2.01');
  const [busqueda, setBusqueda] = useState('');
  const [nuevoAsiento, setNuevoAsiento] = useState<Asiento | null>(null);

  const diario = useMemo(() => libroDiario(db), [db]);
  const enRango = useMemo(() => diario.filter((a) => a.fecha >= desde && a.fecha <= hasta), [diario, desde, hasta]);
  const balance = useMemo(() => balanceSumasYSaldos(enRango), [enRango]);
  const resultados = useMemo(() => estadoDeResultados(diario, desde, hasta), [diario, desde, hasta]);
  const mayor = useMemo(() => mayorDeCuenta(enRango, cuentaMayor), [enRango, cuentaMayor]);
  const descuadrados = useMemo(() => asientosDesbalanceados(enRango), [enRango]);

  const diarioFiltrado = useMemo(
    () => enRango.filter((a) => incluyeTexto([a.descripcion, ...a.lineas.map((l) => nombreCuenta(l.cuenta))], busqueda)),
    [enRango, busqueda],
  );

  const pagDiario = usePaginado(diarioFiltrado, 40);
  const pagMayor = usePaginado(mayor, 60);

  const totalDebe = sumar(balance, (b) => b.debe);
  const totalHaber = sumar(balance, (b) => b.haber);

  return (
    <>
      <Encabezado titulo="Libros contables" bajada="Partida doble generada desde las operaciones, más asientos manuales">
        <button className="btn no-imprimir" onClick={() => window.print()}>Imprimir</button>
        <button
          className="btn btn--primario no-imprimir"
          onClick={() =>
            setNuevoAsiento({
              id: nuevoId('asi'),
              numero: 0,
              fecha: hoy(),
              descripcion: '',
              lineas: [
                { cuenta: '1.1.01', debe: 0, haber: 0 },
                { cuenta: '4.1.04', debe: 0, haber: 0 },
              ],
              automatico: false,
            })
          }
        >
          + Asiento manual
        </button>
      </Encabezado>

      <div className="contenido pila">
        <div className="fila no-imprimir">
          <label className="fila mini" style={{ gap: 6 }}>
            Desde
            <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} style={{ width: 'auto' }} />
          </label>
          <label className="fila mini" style={{ gap: 6 }}>
            Hasta
            <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} style={{ width: 'auto' }} />
          </label>
          {vista === 'diario' && (
            <div className="buscador">
              <input
                type="search"
                placeholder="Buscar en el diario"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                aria-label="Buscar asientos"
              />
            </div>
          )}
          {vista === 'mayor' && (
            <select value={cuentaMayor} onChange={(e) => setCuentaMayor(e.target.value)} style={{ width: 'auto', maxWidth: 320 }} aria-label="Cuenta del mayor">
              {IMPUTABLES.map((c) => (
                <option key={c.codigo} value={c.codigo}>{c.codigo} — {c.nombre}</option>
              ))}
            </select>
          )}
        </div>

        {descuadrados.length > 0 && (
          <Aviso tono="critico" titulo={`${descuadrados.length} asientos descuadrados`}>
            <span className="mini">Revisá los asientos manuales: el debe y el haber tienen que coincidir.</span>
          </Aviso>
        )}

        <div className="grid grid--kpis">
          <Kpi etiqueta="Ingresos del período" valor={formatearMoneda(resultados.totalIngresos)} tono="ok" pie={`${resultados.ingresos.length} rubros`} />
          <Kpi etiqueta="Egresos del período" valor={formatearMoneda(resultados.totalEgresos)} tono="critico" pie={`${resultados.egresos.length} rubros`} />
          <Kpi
            etiqueta="Resultado"
            valor={formatearMoneda(resultados.resultado)}
            tono={resultados.resultado >= 0 ? 'ok' : 'critico'}
            pie={`margen ${formatearPorcentaje(resultados.margen)}`}
          />
          <Kpi etiqueta="Asientos en el período" valor={enRango.length} pie={`${enRango.filter((a) => !a.automatico).length} manuales`} />
        </div>

        <Pestanas
          valor={vista}
          onCambio={setVista}
          opciones={[
            { id: 'diario', etiqueta: 'Libro diario' },
            { id: 'mayor', etiqueta: 'Mayor' },
            { id: 'balance', etiqueta: 'Sumas y saldos' },
            { id: 'resultados', etiqueta: 'Estado de resultados' },
            { id: 'plan', etiqueta: 'Plan de cuentas' },
          ]}
        />

        {vista === 'diario' && (
          <Tarjeta ajustado>
            {diarioFiltrado.length === 0 ? (
              <Vacio icono="📚" titulo="Sin asientos en el período" />
            ) : (
              <Tabla compacta>
                <thead>
                  <tr>
                    <th>N.º</th>
                    <th>Fecha</th>
                    <th>Detalle</th>
                    <th>Cuenta</th>
                    <th className="num">Debe</th>
                    <th className="num">Haber</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {pagDiario.visibles.map((a) =>
                    a.lineas.map((l, i) => (
                      <tr key={`${a.id}_${i}`}>
                        <td className="num tenue">{i === 0 ? a.numero : ''}</td>
                        <td>{i === 0 ? formatearFecha(a.fecha) : ''}</td>
                        <td>
                          {i === 0 ? a.descripcion : ''}
                          {i === 0 && !a.automatico && <span className="tabla__sub">asiento manual</span>}
                        </td>
                        <td className="mini">
                          {l.debe > 0 ? '' : '    '}
                          {l.cuenta} — {nombreCuenta(l.cuenta)}
                        </td>
                        <td className="num">{l.debe ? formatearMoneda(l.debe) : ''}</td>
                        <td className="num">{l.haber ? formatearMoneda(l.haber) : ''}</td>
                        <td className="num no-imprimir">
                          {i === 0 && !a.automatico && (
                            <button className="btn btn--chico btn--fantasma" onClick={() => eliminar('asientos', a.id)}>
                              ✕
                            </button>
                          )}
                        </td>
                      </tr>
                    )),
                  )}
                </tbody>
              </Tabla>
            )}
            <Paginador
              pagina={pagDiario.pagina}
              paginas={pagDiario.paginas}
              desde={pagDiario.desde}
              hasta={pagDiario.hasta}
              total={pagDiario.total}
              etiqueta="asientos"
              onCambio={pagDiario.setPagina}
            />
          </Tarjeta>
        )}

        {vista === 'mayor' && (
          <Tarjeta titulo={`${cuentaMayor} — ${nombreCuenta(cuentaMayor)}`} subtitulo={`${mayor.length} movimientos en el período`} ajustado>
            {mayor.length === 0 ? (
              <Vacio icono="📖" titulo="La cuenta no tuvo movimientos" />
            ) : (
              <Tabla compacta>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Asiento</th>
                    <th>Detalle</th>
                    <th className="num">Debe</th>
                    <th className="num">Haber</th>
                    <th className="num">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {pagMayor.visibles.map((l, i) => (
                    <tr key={i}>
                      <td>{formatearFecha(l.fecha)}</td>
                      <td className="num tenue">{l.asientoNumero}</td>
                      <td>{l.descripcion}</td>
                      <td className="num">{l.debe ? formatearMoneda(l.debe) : ''}</td>
                      <td className="num">{l.haber ? formatearMoneda(l.haber) : ''}</td>
                      <td className={`num principal-celda ${l.saldo < 0 ? 'neg' : ''}`}>{formatearMoneda(l.saldo)}</td>
                    </tr>
                  ))}
                </tbody>
              </Tabla>
            )}
            <Paginador
              pagina={pagMayor.pagina}
              paginas={pagMayor.paginas}
              desde={pagMayor.desde}
              hasta={pagMayor.hasta}
              total={pagMayor.total}
              etiqueta="movimientos"
              onCambio={pagMayor.setPagina}
            />
          </Tarjeta>
        )}

        {vista === 'balance' && (
          <Tarjeta titulo="Balance de sumas y saldos" subtitulo={`Del ${formatearFecha(desde)} al ${formatearFecha(hasta)}`} ajustado>
            <Tabla compacta>
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Cuenta</th>
                  <th>Tipo</th>
                  <th className="num">Debe</th>
                  <th className="num">Haber</th>
                  <th className="num">Saldo deudor</th>
                  <th className="num">Saldo acreedor</th>
                </tr>
              </thead>
              <tbody>
                {balance.map((b) => (
                  <tr key={b.codigo}>
                    <td className="num tenue">{b.codigo}</td>
                    <td className="principal-celda">{b.nombre}</td>
                    <td className="mini tenue">{b.tipo}</td>
                    <td className="num">{formatearMoneda(b.debe)}</td>
                    <td className="num">{formatearMoneda(b.haber)}</td>
                    <td className="num">{b.saldoDeudor ? formatearMoneda(b.saldoDeudor) : ''}</td>
                    <td className="num">{b.saldoAcreedor ? formatearMoneda(b.saldoAcreedor) : ''}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3}>Totales</td>
                  <td className="num">{formatearMoneda(totalDebe)}</td>
                  <td className="num">{formatearMoneda(totalHaber)}</td>
                  <td className="num">{formatearMoneda(sumar(balance, (b) => b.saldoDeudor))}</td>
                  <td className="num">{formatearMoneda(sumar(balance, (b) => b.saldoAcreedor))}</td>
                </tr>
              </tfoot>
            </Tabla>
            <p className="grafico__nota" style={{ padding: '0 16px 12px' }}>
              {Math.abs(totalDebe - totalHaber) < 0.5 ? (
                <Chip tono="ok">Debe y haber coinciden</Chip>
              ) : (
                <Chip tono="critico">Diferencia de {formatearMoneda(redondear(totalDebe - totalHaber))}</Chip>
              )}
            </p>
          </Tarjeta>
        )}

        {vista === 'resultados' && (
          <div className="grid grid--2">
            <Tarjeta titulo="Ingresos" ajustado>
              <Tabla compacta>
                <tbody>
                  {resultados.ingresos.map((r) => (
                    <tr key={r.codigo}>
                      <td>{r.nombre}</td>
                      <td className="num">{formatearMoneda(r.monto)}</td>
                      <td className="num tenue">
                        {formatearPorcentaje(resultados.totalIngresos ? (r.monto / resultados.totalIngresos) * 100 : 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td>Total de ingresos</td>
                    <td className="num">{formatearMoneda(resultados.totalIngresos)}</td>
                    <td />
                  </tr>
                </tfoot>
              </Tabla>
            </Tarjeta>
            <Tarjeta titulo="Egresos" ajustado>
              <Tabla compacta>
                <tbody>
                  {resultados.egresos.map((r) => (
                    <tr key={r.codigo}>
                      <td>{r.nombre}</td>
                      <td className="num">{formatearMoneda(r.monto)}</td>
                      <td className="num tenue">
                        {formatearPorcentaje(resultados.totalEgresos ? (r.monto / resultados.totalEgresos) * 100 : 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td>Total de egresos</td>
                    <td className="num">{formatearMoneda(resultados.totalEgresos)}</td>
                    <td />
                  </tr>
                </tfoot>
              </Tabla>
            </Tarjeta>
          </div>
        )}

        {vista === 'plan' && (
          <Tarjeta titulo="Plan de cuentas" subtitulo="Las cuentas de agrupación no reciben imputaciones" ajustado>
            <Tabla compacta>
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Cuenta</th>
                  <th>Tipo</th>
                  <th>Imputable</th>
                </tr>
              </thead>
              <tbody>
                {PLAN_CUENTAS.map((c) => (
                  <tr key={c.codigo}>
                    <td className="num tenue">{c.codigo}</td>
                    <td className={c.imputable ? '' : 'principal-celda'}>{c.nombre}</td>
                    <td className="mini tenue">{c.tipo}</td>
                    <td>{c.imputable ? <Chip tono="ok">Sí</Chip> : <Chip>Agrupa</Chip>}</td>
                  </tr>
                ))}
              </tbody>
            </Tabla>
          </Tarjeta>
        )}
      </div>

      {nuevoAsiento && (
        <FormularioAsiento
          asiento={nuevoAsiento}
          onCerrar={() => setNuevoAsiento(null)}
          onGuardar={(a) => { guardarAsiento(a); setNuevoAsiento(null); }}
        />
      )}
    </>
  );
}

function FormularioAsiento({
  asiento,
  onGuardar,
  onCerrar,
}: {
  asiento: Asiento;
  onGuardar: (a: Asiento) => void;
  onCerrar: () => void;
}) {
  const [f, setF] = useState<Asiento>(asiento);
  const setLinea = (i: number, cambios: Partial<LineaAsiento>) =>
    setF((x) => {
      const lineas = [...x.lineas];
      lineas[i] = { ...lineas[i], ...cambios };
      return { ...x, lineas };
    });

  const totalDebe = sumar(f.lineas, (l) => l.debe);
  const totalHaber = sumar(f.lineas, (l) => l.haber);
  const balanceado = Math.abs(totalDebe - totalHaber) < 0.01 && totalDebe > 0;

  return (
    <Modal
      titulo="Nuevo asiento manual"
      onCerrar={onCerrar}
      ancho
      pie={
        <>
          <button className="btn" onClick={onCerrar}>Cancelar</button>
          <button className="btn btn--primario" disabled={!balanceado || !f.descripcion.trim()} onClick={() => onGuardar(f)}>
            Guardar asiento
          </button>
        </>
      }
    >
      <div className="grid grid--form">
        <Campo etiqueta="Fecha">
          <input type="date" value={f.fecha} onChange={(e) => setF((x) => ({ ...x, fecha: e.target.value }))} />
        </Campo>
        <Campo etiqueta="Descripción">
          <input value={f.descripcion} onChange={(e) => setF((x) => ({ ...x, descripcion: e.target.value }))} />
        </Campo>
      </div>

      <Tabla compacta>
        <thead>
          <tr>
            <th>Cuenta</th>
            <th className="num">Debe</th>
            <th className="num">Haber</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {f.lineas.map((l, i) => (
            <tr key={i}>
              <td>
                <select value={l.cuenta} onChange={(e) => setLinea(i, { cuenta: e.target.value })}>
                  {IMPUTABLES.map((c) => (
                    <option key={c.codigo} value={c.codigo}>{c.codigo} — {c.nombre}</option>
                  ))}
                </select>
              </td>
              <td className="num" style={{ width: 140 }}>
                <input className="entrada-num" type="number" value={l.debe || ''} onChange={(e) => setLinea(i, { debe: Number(e.target.value), haber: 0 })} />
              </td>
              <td className="num" style={{ width: 140 }}>
                <input className="entrada-num" type="number" value={l.haber || ''} onChange={(e) => setLinea(i, { haber: Number(e.target.value), debe: 0 })} />
              </td>
              <td className="num">
                <button
                  className="btn btn--chico btn--fantasma"
                  disabled={f.lineas.length <= 2}
                  onClick={() => setF((x) => ({ ...x, lineas: x.lineas.filter((_, j) => j !== i) }))}
                >
                  ✕
                </button>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td>Totales</td>
            <td className="num">{formatearMoneda(totalDebe)}</td>
            <td className="num">{formatearMoneda(totalHaber)}</td>
            <td />
          </tr>
        </tfoot>
      </Tabla>

      <div className="fila">
        <button
          className="btn btn--chico"
          onClick={() => setF((x) => ({ ...x, lineas: [...x.lineas, { cuenta: '1.1.01', debe: 0, haber: 0 }] }))}
        >
          + Agregar línea
        </button>
        {balanceado ? <Chip tono="ok">Asiento balanceado</Chip> : <Chip tono="alerta">Debe y haber no coinciden</Chip>}
      </div>
    </Modal>
  );
}

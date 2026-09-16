import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Encabezado } from '../components/Encabezado';
import { Aviso, Chip, Kpi, Tabla, Tarjeta, Vacio } from '../components/ui';
import {
  GraficoBarrasHorizontales,
  GraficoCobranza,
  GraficoResultado,
  PanelGrafico,
  RAMPA_MORA,
  RAMPA_ORDINAL,
} from '../components/graficos';
import { useDb } from '../data/store';
import { antiguedadDeuda } from '../domain/cobranzas';
import { proximoAjuste, vigenciaContrato } from '../domain/contratos';
import {
  composicionIngresos,
  kpisDashboard,
  serieCobranza,
  serieResultadoMensual,
} from '../domain/reportes';
import { embudoVentas } from '../domain/ventas';
import {
  formatearFecha,
  formatearMoneda,
  formatearPeriodo,
  formatearPorcentaje,
  hoy,
  periodoActual,
  sumarPeriodos,
  ultimosPeriodos,
} from '../domain/util';

export default function Tablero() {
  const db = useDb();
  const [meses, setMeses] = useState(12);
  const periodo = periodoActual();

  const periodos = useMemo(() => ultimosPeriodos(periodo, meses), [periodo, meses]);
  const kpis = useMemo(() => kpisDashboard(db, periodo), [db, periodo]);
  const serieResultado = useMemo(() => serieResultadoMensual(db, periodos), [db, periodos]);
  const serieCob = useMemo(() => serieCobranza(db, periodos), [db, periodos]);
  const composicion = useMemo(
    () => composicionIngresos(db, `${periodos[0]}-01`, `${periodo}-31`),
    [db, periodos, periodo],
  );
  const mora = useMemo(() => antiguedadDeuda(db.cuotas, db.pagos), [db]);
  // Solo lo que está en curso: las escrituradas ya no son embudo, son historia.
  const embudo = useMemo(
    () => embudoVentas(db.operaciones, ['captacion', 'reserva', 'boleto']),
    [db.operaciones],
  );
  const resultadoAcumulado = useMemo(
    () => serieResultado.reduce((a, p) => a + p.resultado, 0),
    [serieResultado],
  );

  const deltaIngresos =
    kpis.ingresosMesAnterior > 0
      ? ((kpis.ingresosMes - kpis.ingresosMesAnterior) / kpis.ingresosMesAnterior) * 100
      : null;

  const porVencer = db.contratos
    .filter((c) => c.estado === 'activo' && vigenciaContrato(c) === 'por_vencer')
    .sort((a, b) => a.fechaFin.localeCompare(b.fechaFin));

  const ajustes = db.contratos
    .filter((c) => c.estado === 'activo')
    .map((c) => ({ contrato: c, ajuste: proximoAjuste(c, db.indices) }))
    .filter((x) => x.ajuste && x.ajuste.periodo <= sumarPeriodos(periodo, 1))
    .sort((a, b) => (a.ajuste!.periodo < b.ajuste!.periodo ? -1 : 1));

  const proximasTareas = db.tareas
    .filter((t) => !t.completada)
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .slice(0, 6);

  const propiedadDe = (id: string) => db.propiedades.find((p) => p.id === id);
  const personaDe = (id: string) => db.personas.find((p) => p.id === id);

  return (
    <>
      <Encabezado
        titulo="Tablero"
        bajada={`${db.configuracion.razonSocial} · ${formatearPeriodo(periodo, true)}`}
      >
        {/* Una sola fila de filtros, arriba de todo lo que alcanza. */}
        <div className="interruptores no-imprimir">
          {[6, 12, 24].map((m) => (
            <button key={m} aria-pressed={meses === m} onClick={() => setMeses(m)}>
              {m} meses
            </button>
          ))}
        </div>
      </Encabezado>

      <div className="contenido pila">
        <div className="grid grid--kpis">
          <Kpi
            etiqueta="Ingresos del mes"
            valor={formatearMoneda(kpis.ingresosMes)}
            delta={deltaIngresos}
            pie="honorarios devengados"
          />
          <Kpi
            etiqueta="Resultado del mes"
            valor={formatearMoneda(kpis.resultadoMes)}
            tono={kpis.resultadoMes >= 0 ? 'ok' : 'critico'}
            pie={`acumulado ${meses} meses: ${formatearMoneda(resultadoAcumulado)}`}
          />
          <Kpi
            etiqueta="Cobranza del mes"
            valor={formatearPorcentaje(kpis.tasaCobranza)}
            tono={kpis.tasaCobranza >= 85 ? 'ok' : kpis.tasaCobranza >= 65 ? 'alerta' : 'critico'}
            pie={`${formatearMoneda(kpis.cobradoMes)} de ${formatearMoneda(kpis.emitidoMes)}`}
          />
          <Kpi
            etiqueta="Deuda de inquilinos"
            valor={formatearMoneda(kpis.deudaTotal)}
            tono={kpis.deudaTotal > 0 ? 'critico' : 'ok'}
            pie={`${kpis.cuotasVencidas} cuotas vencidas`}
          />
          <Kpi
            etiqueta="Ocupación de cartera"
            valor={formatearPorcentaje(kpis.ocupacion)}
            pie={`${kpis.propiedadesAlquiladas} alquiladas · ${kpis.propiedadesDisponibles} disponibles`}
          />
          <Kpi
            etiqueta="Pipeline de ventas"
            valor={formatearMoneda(kpis.pipelinePonderado, 'USD')}
            chico
            pie={`ponderado sobre ${formatearMoneda(kpis.pipelineHonorarios, 'USD')} en honorarios`}
          />
        </div>

        {(porVencer.length > 0 || ajustes.length > 0 || kpis.aRendirPropietarios > 0) && (
          <div className="grid grid--3">
            {ajustes.length > 0 && (
              <Aviso
                tono="alerta"
                titulo={
                  ajustes.length === 1
                    ? '1 contrato con ajuste próximo'
                    : `${ajustes.length} contratos con ajuste próximo`
                }
              >
                <span className="mini">
                  {ajustes
                    .slice(0, 3)
                    .map((a) => `${a.contrato.numero} (${formatearPeriodo(a.ajuste!.periodo)})`)
                    .join(' · ')}
                </span>
              </Aviso>
            )}
            {porVencer.length > 0 && (
              <Aviso
                tono="alerta"
                titulo={
                  porVencer.length === 1
                    ? '1 contrato vence en los próximos 90 días'
                    : `${porVencer.length} contratos vencen en los próximos 90 días`
                }
              >
                <span className="mini">
                  {porVencer.slice(0, 3).map((c) => `${c.numero} (${formatearFecha(c.fechaFin)})`).join(' · ')}
                </span>
              </Aviso>
            )}
            {kpis.aRendirPropietarios > 0 && (
              <Aviso titulo="Pendiente de rendir a propietarios">
                <span className="mini">
                  {formatearMoneda(kpis.aRendirPropietarios)} en liquidaciones sin pagar ·{' '}
                  <Link to="/liquidaciones">ver liquidaciones</Link>
                </span>
              </Aviso>
            )}
          </div>
        )}

        <PanelGrafico
          titulo="Resultado mensual"
          subtitulo={`Ingresos, egresos y resultado de los últimos ${meses} meses, en pesos`}
          grafico={<GraficoResultado datos={serieResultado} />}
          nota="Los honorarios de administración se reconocen al liquidar al propietario; los de venta, al escriturar."
          tabla={
            <Tabla compacta>
              <thead>
                <tr>
                  <th>Período</th>
                  <th className="num">Ingresos</th>
                  <th className="num">Egresos</th>
                  <th className="num">Resultado</th>
                </tr>
              </thead>
              <tbody>
                {[...serieResultado].reverse().map((f) => (
                  <tr key={f.periodo}>
                    <td>{formatearPeriodo(f.periodo, true)}</td>
                    <td className="num">{formatearMoneda(f.ingresos)}</td>
                    <td className="num">{formatearMoneda(f.egresos)}</td>
                    <td className={`num ${f.resultado < 0 ? 'neg' : 'pos'}`}>{formatearMoneda(f.resultado)}</td>
                  </tr>
                ))}
              </tbody>
            </Tabla>
          }
        />

        <div className="grid grid--2">
          <PanelGrafico
            titulo="Cobranza de alquileres"
            subtitulo="Emitido contra efectivamente cobrado, por período"
            grafico={<GraficoCobranza datos={serieCob} />}
            tabla={
              <Tabla compacta>
                <thead>
                  <tr>
                    <th>Período</th>
                    <th className="num">Emitido</th>
                    <th className="num">Cobrado</th>
                    <th className="num">Tasa</th>
                  </tr>
                </thead>
                <tbody>
                  {[...serieCob].reverse().map((f) => (
                    <tr key={f.periodo}>
                      <td>{formatearPeriodo(f.periodo, true)}</td>
                      <td className="num">{formatearMoneda(f.emitido)}</td>
                      <td className="num">{formatearMoneda(f.cobrado)}</td>
                      <td className="num">{formatearPorcentaje(f.tasa)}</td>
                    </tr>
                  ))}
                </tbody>
              </Tabla>
            }
          />

          <PanelGrafico
            titulo="Composición de ingresos"
            subtitulo={`Acumulado de ${meses} meses por concepto`}
            grafico={
              composicion.length ? (
                <GraficoBarrasHorizontales
                  datos={composicion.map((c) => ({ etiqueta: c.nombre, valor: c.monto }))}
                  alto={220}
                />
              ) : (
                <Vacio titulo="Todavía no hay ingresos registrados" icono="📉" />
              )
            }
            tabla={
              <Tabla compacta>
                <thead>
                  <tr>
                    <th>Concepto</th>
                    <th className="num">Monto</th>
                    <th className="num">Participación</th>
                  </tr>
                </thead>
                <tbody>
                  {composicion.map((c) => {
                    const total = composicion.reduce((a, x) => a + x.monto, 0);
                    return (
                      <tr key={c.nombre}>
                        <td>{c.nombre}</td>
                        <td className="num">{formatearMoneda(c.monto)}</td>
                        <td className="num">{formatearPorcentaje(total ? (c.monto / total) * 100 : 0)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </Tabla>
            }
          />
        </div>

        <div className="grid grid--2">
          <PanelGrafico
            titulo="Antigüedad de la deuda"
            subtitulo="Saldo impago de inquilinos por tramo de mora"
            grafico={
              <GraficoBarrasHorizontales
                datos={mora.map((m) => ({ etiqueta: m.etiqueta, valor: m.monto }))}
                alto={200}
                rampa={RAMPA_MORA}
              />
            }
            nota="La rampa va de claro a oscuro con la antigüedad: cuanto más oscuro, más vieja la deuda."
            tabla={
              <Tabla compacta>
                <thead>
                  <tr>
                    <th>Tramo</th>
                    <th className="num">Cuotas</th>
                    <th className="num">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {mora.map((m) => (
                    <tr key={m.etiqueta}>
                      <td>{m.etiqueta}</td>
                      <td className="num">{m.cantidad}</td>
                      <td className="num">{formatearMoneda(m.monto)}</td>
                    </tr>
                  ))}
                </tbody>
              </Tabla>
            }
          />

          <PanelGrafico
            titulo="Pipeline de ventas"
            subtitulo="Honorarios potenciales de las operaciones en curso, en dólares"
            grafico={
              <GraficoBarrasHorizontales
                datos={embudo.map((e) => ({ etiqueta: e.etiqueta, valor: e.honorarios }))}
                alto={200}
                rampa={RAMPA_ORDINAL}
                formato={(v) => formatearMoneda(v, 'USD')}
              />
            }
            tabla={
              <Tabla compacta>
                <thead>
                  <tr>
                    <th>Etapa</th>
                    <th className="num">Ops.</th>
                    <th className="num">Volumen</th>
                    <th className="num">Honorarios</th>
                    <th className="num">Ponderado</th>
                  </tr>
                </thead>
                <tbody>
                  {embudo.map((e) => (
                    <tr key={e.estado}>
                      <td>{e.etiqueta}</td>
                      <td className="num">{e.cantidad}</td>
                      <td className="num">{formatearMoneda(e.volumen, 'USD')}</td>
                      <td className="num">{formatearMoneda(e.honorarios, 'USD')}</td>
                      <td className="num">{formatearMoneda(e.ponderado, 'USD')}</td>
                    </tr>
                  ))}
                </tbody>
              </Tabla>
            }
          />
        </div>

        <div className="grid grid--2">
          <Tarjeta titulo="Próximos ajustes de alquiler" ajustado>
            {ajustes.length === 0 ? (
              <Vacio titulo="Sin ajustes en los próximos dos meses" icono="📌" />
            ) : (
              <Tabla compacta>
                <thead>
                  <tr>
                    <th>Contrato</th>
                    <th>Propiedad</th>
                    <th>Desde</th>
                    <th className="num">Nuevo alquiler</th>
                    <th className="num">Var.</th>
                  </tr>
                </thead>
                <tbody>
                  {ajustes.map(({ contrato, ajuste }) => (
                    <tr key={contrato.id}>
                      <td className="principal-celda">
                        <Link to={`/contratos/${contrato.id}`}>{contrato.numero}</Link>
                      </td>
                      <td>
                        {propiedadDe(contrato.propiedadId)?.codigo}
                        <span className="tabla__sub">{personaDe(contrato.inquilinoId)?.nombre}</span>
                      </td>
                      <td>{formatearPeriodo(ajuste!.periodo, true)}</td>
                      <td className="num">{formatearMoneda(ajuste!.montoNuevo, contrato.moneda)}</td>
                      <td className="num">
                        <Chip tono="info">+{ajuste!.variacionPct.toFixed(1).replace('.', ',')} %</Chip>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Tabla>
            )}
          </Tarjeta>

          <Tarjeta titulo="Agenda" subtitulo="Lo que hay que hacer primero" ajustado>
            {proximasTareas.length === 0 ? (
              <Vacio titulo="Nada pendiente" icono="✅" />
            ) : (
              <Tabla compacta>
                <tbody>
                  {proximasTareas.map((t) => (
                    <tr key={t.id}>
                      <td>
                        {t.titulo}
                        <span className="tabla__sub">{formatearFecha(t.fecha)}</span>
                      </td>
                      <td className="num">
                        {t.fecha < hoy() ? (
                          <Chip tono="critico">Atrasada</Chip>
                        ) : t.fecha === hoy() ? (
                          <Chip tono="alerta">Hoy</Chip>
                        ) : (
                          <Chip>Programada</Chip>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Tabla>
            )}
          </Tarjeta>
        </div>
      </div>
    </>
  );
}

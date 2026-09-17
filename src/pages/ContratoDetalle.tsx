import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Encabezado } from '../components/Encabezado';
import {
  Avatar,
  Dato,
  Item,
  Panel,
  Pastilla,
  Progreso,
  Segmentos,
  Vacio,
} from '../components/ui';
import { IconoContratos, IconoVolver } from '../components/iconos';
import { PagoModal } from '../components/PagoModal';
import { FormularioContrato, TEXTO_VIGENCIA, TONO_VIGENCIA } from './Contratos';
import { TEXTO_CUOTA, TONO_CUOTA } from './Cobranzas';
import { useApp, useDb } from '../data/store';
import {
  cobradoDeCuota,
  diasDeMora,
  estadoDeCuota,
  punitoriosDeCuota,
  resumenCobranza,
  saldoDeCuota,
} from '../domain/cobranzas';
import { cronogramaAjustes, ETIQUETA_INDICE, montoVigente, vigenciaContrato } from '../domain/contratos';
import { direccionDe } from '../domain/propiedades';
import type { Cuota } from '../domain/types';
import {
  formatearFecha,
  formatearMoneda,
  formatearPeriodo,
  formatearPorcentaje,
  periodoActual,
  plural,
} from '../domain/util';

type Vista = 'cuotas' | 'ajustes' | 'ficha';

export default function ContratoDetalle() {
  const { id } = useParams();
  const db = useDb();
  const navegar = useNavigate();
  const guardar = useApp((e) => e.guardarContrato);
  const eliminar = useApp((e) => e.eliminar);
  const anular = useApp((e) => e.anularCuota);

  const [vista, setVista] = useState<Vista>('cuotas');
  const [editando, setEditando] = useState(false);
  const [cobrando, setCobrando] = useState<Cuota | null>(null);

  const contrato = db.contratos.find((c) => c.id === id);

  const cuotas = useMemo(
    () => db.cuotas.filter((c) => c.contratoId === id).sort((a, b) => b.periodo.localeCompare(a.periodo)),
    [db.cuotas, id],
  );
  const cronograma = useMemo(
    () => (contrato ? cronogramaAjustes(contrato, db.indices) : []),
    [contrato, db.indices],
  );
  const resumen = useMemo(
    () => resumenCobranza(cuotas, db.contratos, db.pagos),
    [cuotas, db.contratos, db.pagos],
  );

  if (!contrato) {
    return (
      <>
        <Encabezado titulo="Contrato" />
        <div className="contenido">
          <div className="panel">
            <Vacio
              icono={<IconoContratos tam={24} />}
              titulo="No encontramos ese contrato"
              accion={<Link to="/contratos" className="btn">Volver al listado</Link>}
            />
          </div>
        </div>
      </>
    );
  }

  const propiedad = db.propiedades.find((p) => p.id === contrato.propiedadId);
  const inquilino = db.personas.find((p) => p.id === contrato.inquilinoId);
  const propietario = db.personas.find((p) => p.id === propiedad?.propietarioId);
  const vig = vigenciaContrato(contrato);

  return (
    <>
      <Encabezado
        titulo={inquilino?.nombre ?? 'Contrato'}
        bajada={`${contrato.numero} · ${propiedad?.codigo ?? ''} ${propiedad ? direccionDe(propiedad) : ''}`}
      >
        <button className="btn btn--fantasma no-imprimir" onClick={() => navegar('/contratos')}>
          <IconoVolver tam={17} />
          Volver
        </button>
        <button className="btn no-imprimir" onClick={() => window.print()}>Imprimir</button>
        <button className="btn btn--primario no-imprimir" onClick={() => setEditando(true)}>Editar</button>
      </Encabezado>

      <div className="contenido">
        <div className="grid grid--resumen">
          <Dato
            etiqueta="Alquiler de este mes"
            valor={formatearMoneda(montoVigente(contrato, periodoActual(), db.indices), contrato.moneda)}
            pie={`${ETIQUETA_INDICE[contrato.indiceAjuste]} · cada ${contrato.mesesAjuste} meses`}
          />
          <Dato
            etiqueta="Cobrado del contrato"
            valor={formatearPorcentaje(resumen.tasaCobranza)}
            tono={resumen.tasaCobranza >= 95 ? 'ok' : resumen.tasaCobranza >= 75 ? 'alerta' : 'critico'}
            pie={`${formatearMoneda(resumen.cobrado, contrato.moneda)} de ${formatearMoneda(resumen.emitido, contrato.moneda)}`}
          >
            <Progreso valor={resumen.tasaCobranza} etiqueta="Cobrado del contrato" />
          </Dato>
          <Dato
            etiqueta="Deuda vencida"
            valor={formatearMoneda(resumen.vencido, contrato.moneda)}
            tono={resumen.vencido > 0 ? 'critico' : 'ok'}
            pie={
              resumen.vencido > 0
                ? `${plural(resumen.cuotasVencidas, 'cuota', 'cuotas')} · ${formatearMoneda(resumen.punitorios, contrato.moneda)} de punitorios`
                : 'sin atrasos'
            }
          />
          <Dato
            etiqueta="Vigencia"
            valor={<Pastilla tono={TONO_VIGENCIA[vig]}>{TEXTO_VIGENCIA[vig]}</Pastilla>}
            pie={`${formatearFecha(contrato.fechaInicio)} → ${formatearFecha(contrato.fechaFin)}`}
          />
        </div>

        <div className="fila no-imprimir">
          <Segmentos
            etiqueta="Ver"
            valor={vista}
            onCambio={setVista}
            opciones={[
              { id: 'cuotas', texto: `Cuotas (${cuotas.length})` },
              { id: 'ajustes', texto: `Actualizaciones (${cronograma.length})` },
              { id: 'ficha', texto: 'Datos' },
            ]}
          />
        </div>

        {vista === 'cuotas' && (
          <Panel comoLista>
            {cuotas.length === 0 ? (
              <Vacio titulo="Todavía no hay cuotas emitidas" detalle="Emitilas desde la pantalla de Cobranzas." />
            ) : (
              cuotas.map((c) => {
                const estado = estadoDeCuota(c, db.pagos);
                const saldo = saldoDeCuota(c, db.pagos);
                const mora = diasDeMora(c, db.pagos);
                return (
                  <Item
                    key={c.id}
                    titulo={
                      <>
                        {formatearPeriodo(c.periodo, true)}
                        <Pastilla tono={TONO_CUOTA[estado]}>{TEXTO_CUOTA[estado]}</Pastilla>
                      </>
                    }
                    sub={
                      <>
                        Vence {formatearFecha(c.vencimiento)} ·{' '}
                        {c.items.map((i) => `${i.descripcion} ${formatearMoneda(i.monto, c.moneda)}`).join(' + ')}
                        {mora > 0 &&
                          ` · ${plural(mora, 'día', 'días')}, ${formatearMoneda(punitoriosDeCuota(c, contrato, db.pagos), c.moneda)} de punitorios`}
                      </>
                    }
                    monto={
                      saldo > 0.01 ? (
                        <span className="neg">{formatearMoneda(saldo, c.moneda)}</span>
                      ) : (
                        <span className="tenue">{formatearMoneda(c.total, c.moneda)}</span>
                      )
                    }
                    montoPie={saldo > 0.01 ? 'saldo' : `cobrado ${formatearMoneda(cobradoDeCuota(c, db.pagos), c.moneda)}`}
                    fin={
                      <div className="fila no-imprimir" style={{ gap: 6 }}>
                        {saldo > 0.01 && estado !== 'anulada' && (
                          <button className="btn btn--primario btn--chico" onClick={() => setCobrando(c)}>
                            Cobrar
                          </button>
                        )}
                        {estado !== 'anulada' && cobradoDeCuota(c, db.pagos) === 0 && (
                          <button className="btn btn--fantasma btn--chico" onClick={() => anular(c.id)}>
                            Anular
                          </button>
                        )}
                      </div>
                    }
                  />
                );
              })
            )}
          </Panel>
        )}

        {vista === 'ajustes' && (
          <Panel
            titulo="Cómo se actualiza el alquiler"
            subtitulo={`${ETIQUETA_INDICE[contrato.indiceAjuste]} · cada tramo encadena el coeficiente con el anterior`}
          >
            <div className="linea">
              {cronograma.map((t, i) => {
                const hoyPeriodo = periodoActual();
                const vigente = t.periodoDesde <= hoyPeriodo && hoyPeriodo <= t.periodoHasta;
                const futuro = t.periodoDesde > hoyPeriodo;
                return (
                  <div
                    key={t.periodoDesde}
                    className={`tramo${vigente ? ' tramo--vigente' : futuro ? ' tramo--futuro' : ''}`}
                  >
                    <div className="tramo__eje">
                      <span className="tramo__punto" />
                      <span className="tramo__linea" />
                    </div>
                    <div className="tramo__cuerpo">
                      <div className="fila" style={{ gap: 8 }}>
                        <strong style={{ fontFamily: 'var(--fuente-titulo)', fontSize: 16 }}>
                          {formatearMoneda(t.monto, contrato.moneda)}
                        </strong>
                        {i > 0 && (
                          <Pastilla tono="acento">+{t.variacionPct.toFixed(2).replace('.', ',')} %</Pastilla>
                        )}
                        {vigente && <Pastilla tono="ok">Rige ahora</Pastilla>}
                        {futuro && <Pastilla>Proyectado</Pastilla>}
                      </div>
                      <div className="mini tenue" style={{ marginTop: 2 }}>
                        {formatearPeriodo(t.periodoDesde, true)} a {formatearPeriodo(t.periodoHasta, true)}
                        {i > 0 && ` · coeficiente ${t.coeficiente.toFixed(4).replace('.', ',')}`}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="mini tenue" style={{ marginTop: 14 }}>
              Los tramos futuros se proyectan con el último índice publicado y se recalculan solos en cuanto entra
              el dato definitivo.
            </p>
          </Panel>
        )}

        {vista === 'ficha' && (
          <div className="grid grid--2">
            <Panel titulo="Quiénes son" comoLista>
              <Item
                avatar={<Avatar nombre={inquilino?.nombre ?? '—'} />}
                titulo={inquilino?.nombre ?? '—'}
                sub={`Inquilino · ${inquilino?.tipoDoc ?? ''} ${inquilino?.documento ?? ''}`}
                fin={<span className="mini tenue">{inquilino?.telefono ?? inquilino?.email ?? ''}</span>}
              />
              <Item
                avatar={<Avatar nombre={propietario?.nombre ?? '—'} />}
                titulo={propietario?.nombre ?? '—'}
                sub={`Propietario · ${propietario?.cbu ? `CBU ${propietario.cbu}` : 'sin CBU cargado'}`}
                fin={<span className="mini tenue">{propietario?.telefono ?? ''}</span>}
              />
              {propiedad && (
                <Item
                  avatar={<Avatar nombre={propiedad.codigo} />}
                  titulo={`${propiedad.codigo} · ${direccionDe(propiedad)}`}
                  sub={`${propiedad.barrio}${propiedad.m2 ? ` · ${propiedad.m2} m²` : ''}`}
                />
              )}
            </Panel>

            <Panel titulo="Condiciones">
              <div className="pila" style={{ gap: 10 }}>
                {[
                  ['Alquiler inicial', formatearMoneda(contrato.montoInicial, contrato.moneda)],
                  ['Actualización', `${ETIQUETA_INDICE[contrato.indiceAjuste]}, cada ${contrato.mesesAjuste} meses`],
                  ['Tus honorarios', `${contrato.comisionAdminPct} % del alquiler cobrado`],
                  ['Punitorio', `${contrato.punitorioDiarioPct} % por día de atraso`],
                  ['Depósito', formatearMoneda(contrato.depositoGarantia, contrato.moneda)],
                  ['Vence', `el día ${contrato.diaVencimiento} de cada mes`],
                ].map(([et, val]) => (
                  <div className="fila" key={et} style={{ justifyContent: 'space-between', gap: 12 }}>
                    <span className="tenue mini">{et}</span>
                    <strong style={{ fontSize: 13.5 }}>{val}</strong>
                  </div>
                ))}
              </div>

              {contrato.conceptosFijos.length > 0 && (
                <>
                  <h3 style={{ marginTop: 18, marginBottom: 8 }}>Además del alquiler</h3>
                  <div className="pila" style={{ gap: 8 }}>
                    {contrato.conceptosFijos.map((cf) => (
                      <div className="fila" key={cf.id} style={{ justifyContent: 'space-between' }}>
                        <span className="mini">
                          {cf.descripcion}
                          <span className="tenue">
                            {' '}
                            — {cf.aCuentaDelPropietario ? 'se le rinde al propietario' : 'a cargo del inquilino'}
                          </span>
                        </span>
                        <strong style={{ fontSize: 13.5 }}>{formatearMoneda(cf.monto, contrato.moneda)}</strong>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {contrato.notas && <p className="mini tenue" style={{ marginTop: 16 }}>{contrato.notas}</p>}
            </Panel>
          </div>
        )}
      </div>

      {editando && (
        <FormularioContrato
          contrato={contrato}
          onCerrar={() => setEditando(false)}
          onGuardar={(c) => {
            guardar(c);
            setEditando(false);
          }}
          onEliminar={() => {
            eliminar('contratos', contrato.id);
            navegar('/contratos');
          }}
        />
      )}

      {cobrando && <PagoModal cuota={cobrando} onCerrar={() => setCobrando(null)} />}
    </>
  );
}

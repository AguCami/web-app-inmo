import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Encabezado } from '../components/Encabezado';
import { Chip, Datos, Kpi, Pestanas, Tabla, Tarjeta, Vacio, type TonoChip } from '../components/ui';
import { PagoModal } from '../components/PagoModal';
import { ETIQUETA_VIGENCIA, FormularioContrato, TONO_VIGENCIA } from './Contratos';
import { useApp, useDb } from '../data/store';
import {
  cobradoDeCuota,
  diasDeMora,
  estadoDeCuota,
  punitoriosDeCuota,
  resumenCobranza,
  saldoDeCuota,
} from '../domain/cobranzas';
import {
  cronogramaAjustes,
  ETIQUETA_INDICE,
  montoVigente,
  vigenciaContrato,
} from '../domain/contratos';
import type { Cuota, EstadoCuota } from '../domain/types';
import {
  formatearFecha,
  formatearMoneda,
  formatearPeriodo,
  formatearPorcentaje,
  periodoActual,
  plural,
} from '../domain/util';

export const TONO_CUOTA: Record<EstadoCuota, TonoChip> = {
  pagada: 'ok',
  pendiente: 'info',
  parcial: 'alerta',
  vencida: 'critico',
  anulada: 'neutro',
};

export const ETIQUETA_CUOTA: Record<EstadoCuota, string> = {
  pagada: 'Pagada',
  pendiente: 'Pendiente',
  parcial: 'Pago parcial',
  vencida: 'Vencida',
  anulada: 'Anulada',
};

export default function ContratoDetalle() {
  const { id } = useParams();
  const db = useDb();
  const navegar = useNavigate();
  const guardar = useApp((e) => e.guardarContrato);
  const eliminar = useApp((e) => e.eliminar);
  const anular = useApp((e) => e.anularCuota);

  const [pestana, setPestana] = useState<'cuotas' | 'cronograma' | 'ficha'>('cuotas');
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
          <Vacio icono="🔍" titulo="No encontramos ese contrato" accion={<Link to="/contratos">Volver al listado</Link>} />
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
        titulo={`Contrato ${contrato.numero}`}
        bajada={`${propiedad?.codigo ?? ''} · ${propiedad?.calle ?? ''} ${propiedad?.numero ?? ''} · ${inquilino?.nombre ?? ''}`}
      >
        <button className="btn no-imprimir" onClick={() => window.print()}>Imprimir</button>
        <button className="btn btn--primario no-imprimir" onClick={() => setEditando(true)}>Editar</button>
      </Encabezado>

      <div className="contenido pila">
        <div className="grid grid--kpis">
          <Kpi
            etiqueta="Alquiler vigente"
            valor={formatearMoneda(montoVigente(contrato, periodoActual(), db.indices), contrato.moneda)}
            pie={`ajusta por ${ETIQUETA_INDICE[contrato.indiceAjuste]} cada ${contrato.mesesAjuste} meses`}
          />
          <Kpi
            etiqueta="Cobrado sobre emitido"
            valor={formatearPorcentaje(resumen.tasaCobranza)}
            tono={resumen.tasaCobranza >= 90 ? 'ok' : resumen.tasaCobranza >= 70 ? 'alerta' : 'critico'}
            pie={`${formatearMoneda(resumen.cobrado, contrato.moneda)} de ${formatearMoneda(resumen.emitido, contrato.moneda)}`}
          />
          <Kpi
            etiqueta="Deuda vencida"
            valor={formatearMoneda(resumen.vencido, contrato.moneda)}
            tono={resumen.vencido > 0 ? 'critico' : 'ok'}
            pie={`${resumen.cuotasVencidas} cuotas · punitorios ${formatearMoneda(resumen.punitorios, contrato.moneda)}`}
          />
          <Kpi
            etiqueta="Vigencia"
            valor={<Chip tono={TONO_VIGENCIA[vig]}>{ETIQUETA_VIGENCIA[vig]}</Chip>}
            chico
            pie={`${formatearFecha(contrato.fechaInicio)} → ${formatearFecha(contrato.fechaFin)}`}
          />
        </div>

        <Pestanas
          valor={pestana}
          onCambio={setPestana}
          opciones={[
            { id: 'cuotas', etiqueta: 'Cuotas', pastilla: cuotas.length },
            { id: 'cronograma', etiqueta: 'Cronograma de ajustes', pastilla: cronograma.length },
            { id: 'ficha', etiqueta: 'Ficha del contrato' },
          ]}
        />

        {pestana === 'cuotas' && (
          <Tarjeta ajustado>
            {cuotas.length === 0 ? (
              <Vacio icono="🧾" titulo="Todavía no se emitieron cuotas" detalle="Usá «Emitir cuotas del período» en el listado de contratos." />
            ) : (
              <Tabla>
                <thead>
                  <tr>
                    <th>Período</th>
                    <th>Vencimiento</th>
                    <th>Detalle</th>
                    <th className="num">Total</th>
                    <th className="num">Cobrado</th>
                    <th className="num">Saldo</th>
                    <th>Estado</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {cuotas.map((c) => {
                    const estado = estadoDeCuota(c, db.pagos);
                    const saldo = saldoDeCuota(c, db.pagos);
                    const mora = diasDeMora(c, db.pagos);
                    return (
                      <tr key={c.id}>
                        <td className="principal-celda">{formatearPeriodo(c.periodo, true)}</td>
                        <td>{formatearFecha(c.vencimiento)}</td>
                        <td className="mini tenue">
                          {c.items.map((i) => `${i.descripcion} ${formatearMoneda(i.monto, c.moneda)}`).join(' · ')}
                        </td>
                        <td className="num">{formatearMoneda(c.total, c.moneda)}</td>
                        <td className="num">{formatearMoneda(cobradoDeCuota(c, db.pagos), c.moneda)}</td>
                        <td className={`num ${saldo > 0 ? 'neg' : ''}`}>{formatearMoneda(saldo, c.moneda)}</td>
                        <td>
                          <Chip tono={TONO_CUOTA[estado]}>{ETIQUETA_CUOTA[estado]}</Chip>
                          {mora > 0 && (
                            <span className="tabla__sub">
                              {plural(mora, 'día', 'días')} · punitorios{' '}
                              {formatearMoneda(punitoriosDeCuota(c, contrato, db.pagos), c.moneda)}
                            </span>
                          )}
                        </td>
                        <td className="num no-imprimir">
                          {saldo > 0.01 && estado !== 'anulada' && (
                            <button className="btn btn--chico" onClick={() => setCobrando(c)}>Cobrar</button>
                          )}
                          {estado !== 'anulada' && cobradoDeCuota(c, db.pagos) === 0 && (
                            <button className="btn btn--chico btn--fantasma" onClick={() => anular(c.id)}>Anular</button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Tabla>
            )}
          </Tarjeta>
        )}

        {pestana === 'cronograma' && (
          <Tarjeta
            titulo="Cronograma de actualizaciones"
            subtitulo={`Índice ${ETIQUETA_INDICE[contrato.indiceAjuste]} · el coeficiente encadena cada tramo con el anterior`}
            ajustado
          >
            <Tabla>
              <thead>
                <tr>
                  <th>Tramo</th>
                  <th>Desde</th>
                  <th>Hasta</th>
                  <th className="num">Coeficiente</th>
                  <th className="num">Variación</th>
                  <th className="num">Alquiler</th>
                  <th>Situación</th>
                </tr>
              </thead>
              <tbody>
                {cronograma.map((t, i) => {
                  const actual = t.periodoDesde <= periodoActual() && periodoActual() <= t.periodoHasta;
                  const futuro = t.periodoDesde > periodoActual();
                  return (
                    <tr key={t.periodoDesde}>
                      <td className="principal-celda">#{i + 1}</td>
                      <td>{formatearPeriodo(t.periodoDesde, true)}</td>
                      <td>{formatearPeriodo(t.periodoHasta, true)}</td>
                      <td className="num">{i === 0 ? '—' : t.coeficiente.toFixed(4).replace('.', ',')}</td>
                      <td className="num">{i === 0 ? '—' : `+${t.variacionPct.toFixed(2).replace('.', ',')} %`}</td>
                      <td className="num principal-celda">{formatearMoneda(t.monto, contrato.moneda)}</td>
                      <td>
                        {actual ? <Chip tono="ok">Vigente</Chip> : futuro ? <Chip tono="info">Proyectado</Chip> : <Chip>Cumplido</Chip>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Tabla>
            <p className="grafico__nota" style={{ padding: '0 16px 12px' }}>
              Los tramos futuros se proyectan con el último índice publicado; se recalculan solos cuando cargás el dato
              definitivo en Configuración.
            </p>
          </Tarjeta>
        )}

        {pestana === 'ficha' && (
          <div className="grid grid--2">
            <Tarjeta titulo="Partes">
              <Datos
                items={[
                  { et: 'Inquilino', val: inquilino?.nombre ?? '—' },
                  { et: 'Documento', val: `${inquilino?.tipoDoc ?? ''} ${inquilino?.documento ?? ''}` },
                  { et: 'Contacto', val: inquilino?.telefono ?? inquilino?.email ?? '—' },
                  { et: 'Propietario', val: propietario?.nombre ?? '—' },
                  { et: 'CBU del propietario', val: propietario?.cbu ?? '—' },
                  { et: 'Propiedad', val: propiedad ? `${propiedad.codigo} — ${propiedad.calle} ${propiedad.numero}` : '—' },
                ]}
              />
            </Tarjeta>
            <Tarjeta titulo="Condiciones">
              <Datos
                items={[
                  { et: 'Alquiler inicial', val: formatearMoneda(contrato.montoInicial, contrato.moneda) },
                  { et: 'Actualización', val: `${ETIQUETA_INDICE[contrato.indiceAjuste]} cada ${contrato.mesesAjuste} meses` },
                  { et: 'Honorarios de administración', val: `${contrato.comisionAdminPct} %` },
                  { et: 'Punitorio diario', val: `${contrato.punitorioDiarioPct} %` },
                  { et: 'Depósito en garantía', val: formatearMoneda(contrato.depositoGarantia, contrato.moneda) },
                  { et: 'Día de vencimiento', val: `día ${contrato.diaVencimiento} de cada mes` },
                ]}
              />
              {contrato.conceptosFijos.length > 0 && (
                <>
                  <h3 style={{ marginTop: 16, marginBottom: 6 }}>Conceptos adicionales</h3>
                  <Tabla compacta>
                    <tbody>
                      {contrato.conceptosFijos.map((cf) => (
                        <tr key={cf.id}>
                          <td>{cf.descripcion}</td>
                          <td className="num">{formatearMoneda(cf.monto, contrato.moneda)}</td>
                          <td className="mini tenue">
                            {cf.aCuentaDelPropietario ? 'se rinde al propietario' : 'a cargo del inquilino'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Tabla>
                </>
              )}
              {contrato.notas && <p className="mini tenue" style={{ marginTop: 12 }}>{contrato.notas}</p>}
            </Tarjeta>
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

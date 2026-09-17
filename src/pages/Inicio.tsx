import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Encabezado } from '../components/Encabezado';
import { Avatar, Dato, Item, Panel, Pastilla, Progreso, Serie, Vacio } from '../components/ui';
import {
  IconoAlerta,
  IconoContratos,
  IconoFlechaDer,
  IconoPropiedades,
  IconoTendencia,
} from '../components/iconos';
import { MarcaNovedad } from '../components/NovedadModal';
import { useDb } from '../data/store';
import { alertas, deudores, resumenDelMes, serieCobranza } from '../domain/resumen';
import { direccionDe } from '../domain/propiedades';
import {
  formatearFecha,
  formatearMoneda,
  formatearPeriodo,
  formatearPorcentaje,
  periodoActual,
  plural,
  ultimosPeriodos,
} from '../domain/util';

export default function Inicio() {
  const db = useDb();
  const navegar = useNavigate();
  const periodo = periodoActual();

  const mes = useMemo(() => resumenDelMes(db, periodo), [db, periodo]);
  const serie = useMemo(() => serieCobranza(db, ultimosPeriodos(periodo, 6)), [db, periodo]);
  const alerta = useMemo(() => alertas(db), [db]);
  const conDeuda = useMemo(() => deudores(db).slice(0, 5), [db]);
  // Lo que quedó abierto en la bitácora de cualquier contrato: filtraciones sin
  // arreglar, reclamos sin cerrar. Es lo primero que se olvida.
  const sinResolver = useMemo(
    () =>
      db.novedades
        .filter((n) => !n.resuelta)
        .sort((a, b) => a.fecha.localeCompare(b.fecha))
        .slice(0, 5),
    [db.novedades],
  );

  const propiedadDe = (id: string) => db.propiedades.find((p) => p.id === id);
  const personaDe = (id: string) => db.personas.find((p) => p.id === id);

  const vacias = db.propiedades.filter((p) => p.estado === 'disponible');

  return (
    <>
      <Encabezado
        titulo={`Cobranza de ${formatearPeriodo(periodo, true)}`}
        bajada={`${db.contratos.filter((c) => c.estado === 'activo').length} contratos activos · ${db.propiedades.length} unidades`}
      >
        <Link to="/cobranzas" className="btn btn--primario no-imprimir">
          Ir a cobrar
          <IconoFlechaDer tam={16} />
        </Link>
      </Encabezado>

      <div className="contenido">
        <div className="grid grid--resumen">
          <Dato
            etiqueta="Cobrado este mes"
            valor={formatearMoneda(mes.cobrado)}
            tono="ok"
            pie={`${formatearPorcentaje(mes.tasaCobranza)} de ${formatearMoneda(mes.emitido)}`}
          >
            <Progreso valor={mes.tasaCobranza} etiqueta="Cobrado del mes" />
          </Dato>
          <Dato
            etiqueta="Falta cobrar"
            valor={formatearMoneda(mes.pendiente)}
            pie={mes.pendiente > 0 ? 'de las cuotas de este mes' : 'no queda nada del mes'}
          />
          <Dato
            etiqueta="Deuda atrasada"
            valor={formatearMoneda(alerta.deudaTotal)}
            tono={alerta.deudaTotal > 0 ? 'critico' : 'ok'}
            pie={
              alerta.cuotasVencidas > 0
                ? `${plural(alerta.cuotasVencidas, 'cuota vencida', 'cuotas vencidas')}, de todos los meses`
                : 'al día'
            }
          />
          <Dato
            etiqueta="Tus honorarios"
            valor={formatearMoneda(mes.honorarios)}
            tono="acento"
            pie="sobre el alquiler ya cobrado"
          />
        </div>

        <div className="grid grid--2">
          <Panel
            titulo="Cómo viene la cobranza"
            subtitulo="Emitido y cobrado de los últimos 6 meses"
            acciones={<IconoTendencia tam={18} style={{ color: 'var(--tinta-3)' }} />}
          >
            <Serie
              datos={serie.map((s) => ({
                etiqueta: formatearPeriodo(s.periodo),
                titulo: formatearPeriodo(s.periodo, true),
                total: s.emitido,
                parte: s.cobrado,
              }))}
              formato={(v) => formatearMoneda(v)}
            />
            <p className="mini tenue" style={{ marginTop: 12 }}>
              La barra entera es lo emitido y la parte llena lo cobrado: el hueco es lo que quedó sin entrar. El mes
              anterior cerró en {formatearPorcentaje(serie[serie.length - 2]?.tasaCobranza ?? 0)}.
            </p>
          </Panel>

          <Panel
            titulo="Actualizaciones que vienen"
            subtitulo="Contratos que ajustan en los próximos 60 días"
            comoLista
          >
            {alerta.ajustesProximos.length === 0 ? (
              <Vacio titulo="Ningún contrato ajusta pronto" detalle="Te avisamos con 60 días de anticipación." />
            ) : (
              alerta.ajustesProximos.slice(0, 4).map(({ contrato, ajuste }) => {
                const prop = propiedadDe(contrato.propiedadId);
                return (
                  <Item
                    key={contrato.id}
                    onClick={() => navegar(`/contratos/${contrato.id}`)}
                    avatar={<Avatar nombre={personaDe(contrato.inquilinoId)?.nombre ?? '—'} />}
                    titulo={
                      <>
                        {personaDe(contrato.inquilinoId)?.nombre}
                        <Pastilla tono="acento">+{ajuste.variacionPct.toFixed(1).replace('.', ',')} %</Pastilla>
                      </>
                    }
                    sub={`${prop?.codigo} · desde ${formatearPeriodo(ajuste.periodo, true)}`}
                    monto={formatearMoneda(ajuste.montoNuevo, contrato.moneda)}
                    montoPie={`antes ${formatearMoneda(ajuste.montoAnterior, contrato.moneda)}`}
                  />
                );
              })
            )}
          </Panel>
        </div>

        <Panel
          titulo="Quién debe"
          subtitulo={
            conDeuda.length
              ? 'Ordenado por saldo. Tocá para ir al contrato.'
              : 'Nadie tiene cuotas atrasadas'
          }
          acciones={
            conDeuda.length > 0 && (
              <Link to="/cobranzas" className="btn btn--suave btn--chico no-imprimir">
                Ver todas
              </Link>
            )
          }
          comoLista
        >
          {conDeuda.length === 0 ? (
            <Vacio titulo="Toda la cartera al día" detalle="No hay ninguna cuota vencida sin cobrar." />
          ) : (
            conDeuda.map((d) => (
              <Item
                key={d.inquilinoId}
                onClick={() => navegar(`/contratos/${d.contratoId}`)}
                avatar={<Avatar nombre={d.nombre} />}
                titulo={d.nombre}
                sub={`${plural(d.cuotas, 'cuota impaga', 'cuotas impagas')} · ${plural(d.diasMora, 'día', 'días')} de atraso`}
                monto={<span className="neg">{formatearMoneda(d.saldo)}</span>}
                fin={
                  <Pastilla tono={d.diasMora > 60 ? 'critico' : d.diasMora > 30 ? 'alerta' : 'neutro'}>
                    {d.diasMora > 60 ? 'Intimar' : d.diasMora > 30 ? 'Reclamar' : 'Avisar'}
                  </Pastilla>
                }
              />
            ))
          )}
        </Panel>

        <div className="grid grid--2">
          <Panel
            titulo="Sin resolver"
            subtitulo={sinResolver.length ? 'Asentado en la bitácora y todavía abierto' : undefined}
            comoLista
          >
            {sinResolver.length === 0 ? (
              <Vacio titulo="Nada pendiente" detalle="No quedó ninguna novedad abierta en los contratos." />
            ) : (
              sinResolver.map((n) => {
                const contrato = db.contratos.find((c) => c.id === n.contratoId);
                const prop = contrato ? propiedadDe(contrato.propiedadId) : undefined;
                return (
                  <Item
                    key={n.id}
                    onClick={() => navegar(`/contratos/${n.contratoId}`)}
                    avatar={<MarcaNovedad tipo={n.tipo} />}
                    titulo={n.titulo}
                    sub={`${prop?.codigo ?? ''} · desde el ${formatearFecha(n.fecha)}`}
                  />
                );
              })
            )}
          </Panel>

          <Panel titulo="Contratos por vencer" subtitulo="Dentro de los próximos 90 días" comoLista>
            {alerta.contratosPorVencer.length === 0 ? (
              <Vacio
                icono={<IconoContratos tam={24} />}
                titulo="Ninguno vence pronto"
                detalle="Todos los contratos tienen más de 90 días por delante."
              />
            ) : (
              alerta.contratosPorVencer.map((c) => {
                const prop = propiedadDe(c.propiedadId);
                return (
                  <Item
                    key={c.id}
                    onClick={() => navegar(`/contratos/${c.id}`)}
                    avatar={<Avatar nombre={personaDe(c.inquilinoId)?.nombre ?? '—'} />}
                    titulo={personaDe(c.inquilinoId)?.nombre ?? '—'}
                    sub={`${prop?.codigo} · ${prop ? direccionDe(prop) : ''}`}
                    fin={<Pastilla tono="alerta">Vence {formatearFecha(c.fechaFin)}</Pastilla>}
                  />
                );
              })
            )}
          </Panel>

          <Panel
            titulo="Unidades sin alquilar"
            subtitulo={vacias.length ? 'No generan honorarios hasta que se alquilen' : undefined}
            comoLista
          >
            {vacias.length === 0 ? (
              <Vacio
                icono={<IconoPropiedades tam={24} />}
                titulo="Cartera completa"
                detalle="Todas las unidades están alquiladas."
              />
            ) : (
              vacias.map((p) => (
                <Item
                  key={p.id}
                  onClick={() => navegar('/propiedades')}
                  avatar={<Avatar nombre={p.codigo} />}
                  titulo={`${p.codigo} · ${direccionDe(p)}`}
                  sub={`${p.barrio}${p.notas ? ` — ${p.notas}` : ''}`}
                  monto={p.alquilerSugerido ? formatearMoneda(p.alquilerSugerido) : undefined}
                  montoPie={p.alquilerSugerido ? 'sugerido' : undefined}
                />
              ))
            )}
          </Panel>
        </div>

        {alerta.montoSinRendir > 0 && (
          <Panel comoLista>
            <Item
              onClick={() => navegar('/liquidaciones')}
              avatar={
                <span className="avatar avatar--t4" aria-hidden="true">
                  <IconoAlerta tam={18} />
                </span>
              }
              titulo="Hay plata sin rendir a los propietarios"
              sub={`${plural(alerta.liquidacionesSinPagar, 'liquidación aprobada', 'liquidaciones aprobadas')} sin transferir`}
              monto={formatearMoneda(alerta.montoSinRendir)}
              fin={<IconoFlechaDer tam={18} style={{ color: 'var(--tinta-3)' }} />}
            />
          </Panel>
        )}
      </div>
    </>
  );
}

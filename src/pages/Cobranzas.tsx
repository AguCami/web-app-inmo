import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Encabezado } from '../components/Encabezado';
import {
  Avatar,
  Dato,
  Item,
  Paginador,
  Panel,
  Pastilla,
  Progreso,
  Segmentos,
  usePaginado,
  Vacio,
} from '../components/ui';
import { IconoBuscar, IconoCobranzas } from '../components/iconos';
import { PagoModal } from '../components/PagoModal';
import { useApp, useDb } from '../data/store';
import {
  cobradoDeCuota,
  diasDeMora,
  estadoDeCuota,
  punitoriosDeCuota,
  saldoDeCuota,
} from '../domain/cobranzas';
import { resumenDelMes } from '../domain/resumen';
import { direccionDe } from '../domain/propiedades';
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

type Filtro = 'todas' | 'debe' | 'cobradas';

export const TONO_CUOTA: Record<EstadoCuota, 'ok' | 'alerta' | 'critico' | 'neutro' | 'acento'> = {
  pagada: 'ok',
  parcial: 'alerta',
  vencida: 'critico',
  pendiente: 'acento',
  anulada: 'neutro',
};

export const TEXTO_CUOTA: Record<EstadoCuota, string> = {
  pagada: 'Cobrada',
  parcial: 'Cobro parcial',
  vencida: 'Vencida',
  pendiente: 'A vencer',
  anulada: 'Anulada',
};

export default function Cobranzas() {
  const db = useDb();
  const navegar = useNavigate();
  const emitir = useApp((e) => e.emitirCuotas);

  const [periodo, setPeriodo] = useState(periodoActual());
  const [filtro, setFiltro] = useState<Filtro>('todas');
  const [busqueda, setBusqueda] = useState('');
  const [cobrando, setCobrando] = useState<Cuota | null>(null);
  const [aviso, setAviso] = useState('');

  const contratoDe = (id: string) => db.contratos.find((c) => c.id === id);
  const propiedadDe = (id?: string) => db.propiedades.find((p) => p.id === id);
  const personaDe = (id?: string) => db.personas.find((p) => p.id === id);

  const periodos = useMemo(() => {
    const set = new Set(db.cuotas.map((c) => c.periodo));
    ultimosPeriodos(periodoActual(), 12).forEach((p) => set.add(p));
    return [...set].sort((a, b) => b.localeCompare(a));
  }, [db.cuotas]);

  const delPeriodo = useMemo(
    () => db.cuotas.filter((c) => c.periodo === periodo && c.estado !== 'anulada'),
    [db.cuotas, periodo],
  );

  const filtradas = useMemo(
    () =>
      delPeriodo
        .filter((c) => {
          const saldo = saldoDeCuota(c, db.pagos);
          if (filtro === 'debe') return saldo > 0.01;
          if (filtro === 'cobradas') return saldo <= 0.01;
          return true;
        })
        .filter((c) => {
          const contrato = contratoDe(c.contratoId);
          const prop = propiedadDe(contrato?.propiedadId);
          return incluyeTexto(
            [personaDe(contrato?.inquilinoId)?.nombre, prop?.codigo, prop?.calle, prop?.barrio, contrato?.numero],
            busqueda,
          );
        })
        // Primero lo que hay que cobrar, y dentro de eso lo más atrasado.
        .sort((a, b) => {
          const sa = saldoDeCuota(a, db.pagos) > 0.01 ? 0 : 1;
          const sb = saldoDeCuota(b, db.pagos) > 0.01 ? 0 : 1;
          return sa !== sb ? sa - sb : a.vencimiento.localeCompare(b.vencimiento);
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [delPeriodo, filtro, busqueda, db.pagos, db.contratos, db.propiedades, db.personas],
  );

  const pag = usePaginado(filtradas, 25);
  const mes = useMemo(() => resumenDelMes(db, periodo), [db, periodo]);
  const cuentaDebe = delPeriodo.filter((c) => saldoDeCuota(c, db.pagos) > 0.01).length;

  return (
    <>
      <Encabezado titulo="Cobranzas" bajada={`Cuotas de ${formatearPeriodo(periodo, true)}`}>
        <select
          className="suelto no-imprimir"
          value={periodo}
          onChange={(e) => setPeriodo(e.target.value)}
          aria-label="Período"
        >
          {periodos.map((p) => (
            <option key={p} value={p}>{formatearPeriodo(p, true)}</option>
          ))}
        </select>
        <button
          className="btn no-imprimir"
          onClick={() => {
            const n = emitir(periodo);
            setAviso(
              n
                ? `Se emitió ${plural(n, 'cuota nueva', 'cuotas nuevas')}.`
                : 'Ya estaban emitidas todas las cuotas del período.',
            );
          }}
        >
          Emitir cuotas
        </button>
      </Encabezado>

      <div className="contenido">
        {aviso && <div className="nota nota--ok"><span>{aviso}</span></div>}

        <div className="grid grid--resumen">
          <Dato
            etiqueta="Cobrado"
            valor={formatearMoneda(mes.cobrado)}
            tono="ok"
            pie={`${formatearPorcentaje(mes.tasaCobranza)} de lo emitido`}
          >
            <Progreso valor={mes.tasaCobranza} etiqueta="Cobrado del mes" />
          </Dato>
          <Dato etiqueta="Falta cobrar" valor={formatearMoneda(mes.pendiente)} pie={plural(cuentaDebe, 'cuota', 'cuotas')} />
          <Dato
            etiqueta="Vencido"
            valor={formatearMoneda(mes.vencido)}
            tono={mes.vencido > 0 ? 'critico' : 'ok'}
            pie={mes.punitorios > 0 ? `+ ${formatearMoneda(mes.punitorios)} de punitorios` : 'sin punitorios'}
          />
          <Dato etiqueta="Tus honorarios" valor={formatearMoneda(mes.honorarios)} tono="acento" pie="sobre lo cobrado" />
        </div>

        <div className="fila no-imprimir">
          <Segmentos
            etiqueta="Filtrar cuotas"
            valor={filtro}
            onCambio={setFiltro}
            opciones={[
              { id: 'todas', texto: `Todas (${delPeriodo.length})` },
              { id: 'debe', texto: `Deben (${cuentaDebe})` },
              { id: 'cobradas', texto: `Cobradas (${delPeriodo.length - cuentaDebe})` },
            ]}
          />
          <div className="buscador">
            <IconoBuscar tam={17} />
            <input
              type="search"
              placeholder="Buscar inquilino o propiedad"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              aria-label="Buscar cuotas"
            />
          </div>
        </div>

        <Panel comoLista>
          {filtradas.length === 0 ? (
            <Vacio
              icono={<IconoCobranzas tam={24} />}
              titulo="No hay cuotas para mostrar"
              detalle="Probá con otro mes o emití las cuotas del período."
            />
          ) : (
            <>
              {pag.visibles.map((c) => {
                const contrato = contratoDe(c.contratoId);
                const prop = propiedadDe(contrato?.propiedadId);
                const inquilino = personaDe(contrato?.inquilinoId);
                const estado = estadoDeCuota(c, db.pagos);
                const saldo = saldoDeCuota(c, db.pagos);
                const mora = diasDeMora(c, db.pagos);
                const cobrado = cobradoDeCuota(c, db.pagos);

                return (
                  <Item
                    key={c.id}
                    avatar={<Avatar nombre={inquilino?.nombre ?? '—'} />}
                    titulo={
                      <>
                        {inquilino?.nombre ?? '—'}
                        <Pastilla tono={TONO_CUOTA[estado]}>{TEXTO_CUOTA[estado]}</Pastilla>
                      </>
                    }
                    sub={
                      <>
                        {prop?.codigo} · {prop ? direccionDe(prop) : ''} · vence{' '}
                        {formatearFecha(c.vencimiento)}
                        {mora > 0 && ` · ${plural(mora, 'día', 'días')} de atraso`}
                        {estado === 'parcial' && ` · cobrado ${formatearMoneda(cobrado, c.moneda)}`}
                      </>
                    }
                    monto={
                      saldo > 0.01 ? (
                        <span className={mora > 0 ? 'neg' : undefined}>{formatearMoneda(saldo, c.moneda)}</span>
                      ) : (
                        <span className="tenue">{formatearMoneda(c.total, c.moneda)}</span>
                      )
                    }
                    montoPie={
                      saldo > 0.01
                        ? mora > 0
                          ? `+ ${formatearMoneda(punitoriosDeCuota(c, contrato, db.pagos), c.moneda)} punitorios`
                          : 'a cobrar'
                        : 'cobrada'
                    }
                    fin={
                      <div className="fila no-imprimir" style={{ gap: 6 }}>
                        {saldo > 0.01 && (
                          <button className="btn btn--primario btn--chico" onClick={() => setCobrando(c)}>
                            Cobrar
                          </button>
                        )}
                        <button
                          className="btn btn--fantasma btn--chico"
                          onClick={() => navegar(`/contratos/${c.contratoId}`)}
                        >
                          Ver
                        </button>
                      </div>
                    }
                  />
                );
              })}
              <Paginador
                pagina={pag.pagina}
                paginas={pag.paginas}
                desde={pag.desde}
                hasta={pag.hasta}
                total={pag.total}
                etiqueta="cuotas"
                onCambio={pag.setPagina}
              />
            </>
          )}
        </Panel>
      </div>

      {cobrando && <PagoModal cuota={cobrando} onCerrar={() => setCobrando(null)} />}
    </>
  );
}

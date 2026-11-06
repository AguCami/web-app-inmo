import { useMemo, useRef, useState } from 'react';
import { VisorArchivo } from '../components/VisorArchivo';
import { descargarArchivo, formatearTamano } from '../data/archivos';
import { useNavigate } from 'react-router-dom';
import { Encabezado } from '../components/Encabezado';
import { Avatar, Campo, Modal, Pastilla, Segmentos, Vacio } from '../components/ui';
import { IconoBuscar, IconoContratos, IconoMas } from '../components/iconos';
import { useApp, useDb } from '../data/store';
import {
  ETIQUETA_INDICE,
  montoVigente,
  proximoAjuste,
  siguienteNumeroContrato,
  vigenciaContrato,
  type VigenciaContrato,
} from '../domain/contratos';
import { direccionDe } from '../domain/propiedades';
import type { Adjunto, Contrato, IndiceAjuste } from '../domain/types';
import {
  formatearFecha,
  formatearMoneda,
  formatearPeriodo,
  incluyeTexto,
  nuevoId,
  periodoActual,
  sumarMeses,
} from '../domain/util';

export const TONO_VIGENCIA: Record<VigenciaContrato, 'ok' | 'alerta' | 'critico' | 'acento'> = {
  vigente: 'ok',
  por_vencer: 'alerta',
  vencido: 'critico',
  no_iniciado: 'acento',
};

export const TEXTO_VIGENCIA: Record<VigenciaContrato, string> = {
  vigente: 'Vigente',
  por_vencer: 'Por vencer',
  vencido: 'Vencido',
  no_iniciado: 'Por empezar',
};

export function contratoNuevo(comision: number, punitorio: number, numero: string): Contrato {
  const inicio = `${periodoActual()}-01`;
  return {
    id: nuevoId('c'),
    numero,
    propiedadId: '',
    inquilinoId: '',
    garanteIds: [],
    fechaInicio: inicio,
    fechaFin: sumarMeses(inicio, 35),
    montoInicial: 0,
    moneda: 'ARS',
    diaVencimiento: 10,
    indiceAjuste: 'IPC_CBA',
    mesesAjuste: 3,
    comisionAdminPct: comision,
    punitorioDiarioPct: punitorio,
    depositoGarantia: 0,
    conceptosFijos: [],
    estado: 'activo',
  };
}

export default function Contratos() {
  const db = useDb();
  const navegar = useNavigate();
  const guardar = useApp((e) => e.guardarContrato);

  const [busqueda, setBusqueda] = useState('');
  const [filtro, setFiltro] = useState<'activos' | 'todos'>('activos');
  const [editando, setEditando] = useState<Contrato | null>(null);

  const propiedadDe = (id: string) => db.propiedades.find((p) => p.id === id);
  const personaDe = (id: string) => db.personas.find((p) => p.id === id);

  const lista = useMemo(
    () =>
      db.contratos
        .filter((c) => filtro === 'todos' || c.estado === 'activo')
        .filter((c) => {
          const prop = propiedadDe(c.propiedadId);
          return incluyeTexto(
            [c.numero, prop?.codigo, prop?.calle, prop?.barrio, personaDe(c.inquilinoId)?.nombre],
            busqueda,
          );
        })
        .sort((a, b) => a.fechaFin.localeCompare(b.fechaFin)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [db.contratos, db.propiedades, db.personas, filtro, busqueda],
  );

  const activos = db.contratos.filter((c) => c.estado === 'activo').length;

  return (
    <>
      <Encabezado titulo="Contratos" bajada={`${activos} activos de ${db.contratos.length} en total`}>
        <button
          className="btn btn--primario no-imprimir"
          onClick={() =>
            setEditando(
              contratoNuevo(
                db.configuracion.comisionAdminPctDefault,
                db.configuracion.punitorioDiarioPctDefault,
                siguienteNumeroContrato(db.contratos),
              ),
            )
          }
        >
          <IconoMas tam={17} />
          Nuevo contrato
        </button>
      </Encabezado>

      <div className="contenido">
        <div className="fila no-imprimir">
          <Segmentos
            etiqueta="Filtrar contratos"
            valor={filtro}
            onCambio={setFiltro}
            opciones={[
              { id: 'activos', texto: 'Activos' },
              { id: 'todos', texto: 'Todos' },
            ]}
          />
          <div className="buscador">
            <IconoBuscar tam={17} />
            <input
              type="search"
              placeholder="Buscar por inquilino, propiedad o número"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              aria-label="Buscar contratos"
            />
          </div>
        </div>

        {lista.length === 0 ? (
          <div className="panel">
            <Vacio
              icono={<IconoContratos tam={24} />}
              titulo="No hay contratos"
              detalle="Cargá el primero para empezar a emitir cuotas."
            />
          </div>
        ) : (
          <div className="grid grid--cartas">
            {lista.map((c) => {
              const prop = propiedadDe(c.propiedadId);
              const inquilino = personaDe(c.inquilinoId);
              const vig = vigenciaContrato(c);
              const ajuste = proximoAjuste(c, db.indices);

              return (
                <button key={c.id} className="carta" onClick={() => navegar(`/contratos/${c.id}`)}>
                  <div className="carta__cab">
                    <Avatar nombre={inquilino?.nombre ?? '—'} />
                    <div className="crece">
                      <div className="carta__titulo">{inquilino?.nombre ?? 'Sin inquilino'}</div>
                      <div className="carta__sub">
                        {prop?.codigo} · {prop ? direccionDe(prop) : '—'}
                      </div>
                    </div>
                  </div>

                  <div className="carta__rasgos">
                    <Pastilla tono={TONO_VIGENCIA[vig]}>{TEXTO_VIGENCIA[vig]}</Pastilla>
                    <span className="rasgo">{ETIQUETA_INDICE[c.indiceAjuste]}</span>
                    <span className="rasgo">cada {c.mesesAjuste} m.</span>
                    <span className="rasgo">vence {formatearFecha(c.fechaFin)}</span>
                  </div>

                  <div className="carta__pie">
                    <div className="carta__monto">
                      {formatearMoneda(montoVigente(c, periodoActual(), db.indices), c.moneda)}
                      <small>alquiler de este mes</small>
                    </div>
                    {ajuste && (
                      <div style={{ textAlign: 'right' }}>
                        <Pastilla tono="acento">
                          +{ajuste.variacionPct.toFixed(1).replace('.', ',')} %
                        </Pastilla>
                        <div className="mini tenue" style={{ marginTop: 3 }}>
                          {formatearPeriodo(ajuste.periodo, true)}
                        </div>
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {editando && (
        <FormularioContrato
          contrato={editando}
          onCerrar={() => setEditando(null)}
          onGuardar={(c) => {
            guardar(c);
            setEditando(null);
            navegar(`/contratos/${c.id}`);
          }}
        />
      )}
    </>
  );
}

/* ─────────────────────── Formulario de contrato ──────────────────── */

/** Así se marca, entre los archivos del contrato, la copia firmada. */
const COPIA_FIRMADA = 'Contrato firmado';

export function FormularioContrato({
  contrato,
  onGuardar,
  onCerrar,
  onEliminar,
}: {
  contrato: Contrato;
  onGuardar: (c: Contrato) => void;
  onCerrar: () => void;
  onEliminar?: () => void;
}) {
  const db = useDb();
  const [f, setF] = useState<Contrato>(contrato);
  const set = <K extends keyof Contrato>(k: K, v: Contrato[K]) => setF((x) => ({ ...x, [k]: v }));

  const propiedades = db.propiedades.filter(
    (p) => p.estado !== 'alquilada' || p.id === contrato.propiedadId,
  );
  // Solo se ofrecen las personas activas, más la ya elegida en este contrato:
  // si no, editar un contrato viejo perdería a su inquilino archivado.
  const inquilinos = db.personas.filter(
    (p) => p.roles.includes('inquilino') && (p.activo || p.id === contrato.inquilinoId),
  );
  const valido =
    f.numero.trim() &&
    f.propiedadId &&
    f.inquilinoId &&
    f.montoInicial > 0 &&
    f.conceptosFijos.every((cf) => cf.descripcion.trim());
  // Un contrato que todavía no está guardado (nuevo o renovación) arranca
  // activo: el estado solo se elige al editar uno existente.
  const esNuevo = !db.contratos.some((c) => c.id === contrato.id);

  // La copia firmada del contrato, en PDF. En uno nuevo se elige acá y se
  // sube recién al guardar: antes el contrato no existe y el archivo
  // quedaría colgado de nada.
  const adjuntar = useApp((e) => e.adjuntar);
  const eliminarAdjunto = useApp((e) => e.eliminarAdjunto);
  const copias = db.adjuntos.filter(
    (a) => a.contratoId === contrato.id && !a.novedadId && a.descripcion === COPIA_FIRMADA,
  );
  const selectorCopia = useRef<HTMLInputElement>(null);
  const [copiaPendiente, setCopiaPendiente] = useState<File | null>(null);
  const [subiendoCopia, setSubiendoCopia] = useState(false);
  const [errorCopia, setErrorCopia] = useState('');
  const [viendo, setViendo] = useState<Adjunto | null>(null);

  const elegirCopia = async (archivo: File | undefined) => {
    if (!archivo) return;
    setErrorCopia('');
    if (archivo.type !== 'application/pdf') {
      setErrorCopia('Tiene que ser un PDF.');
      return;
    }
    if (esNuevo) {
      setCopiaPendiente(archivo);
      return;
    }
    setSubiendoCopia(true);
    try {
      await adjuntar(contrato.id, archivo, { descripcion: COPIA_FIRMADA });
    } catch (e) {
      setErrorCopia(e instanceof Error ? e.message : 'No se pudo subir el PDF.');
    } finally {
      setSubiendoCopia(false);
    }
  };

  const guardar = () => {
    // El número se vuelve a calcular al guardar: si mientras tanto se cargó
    // otro contrato, este toma el siguiente y no se repite.
    const final = esNuevo ? { ...f, numero: siguienteNumeroContrato(db.contratos) } : f;
    onGuardar(final);
    if (copiaPendiente) {
      void adjuntar(final.id, copiaPendiente, { descripcion: COPIA_FIRMADA }).catch((e) =>
        window.alert(e instanceof Error ? e.message : 'No se pudo subir la copia del contrato.'),
      );
    }
  };

  return (
    <Modal
      titulo={contrato.propiedadId ? `Contrato ${contrato.numero}` : 'Nuevo contrato'}
      onCerrar={onCerrar}
      ancho
      pie={
        <>
          {onEliminar && (
            <button className="btn btn--peligro" onClick={onEliminar} style={{ marginRight: 'auto' }}>
              Eliminar
            </button>
          )}
          <button className="btn btn--fantasma" onClick={onCerrar}>Cancelar</button>
          <button className="btn btn--primario" disabled={!valido} onClick={guardar}>
            Guardar
          </button>
        </>
      }
    >
      <div className="grid grid--form">
        {esNuevo ? (
          <Campo etiqueta="Número" ayuda="Se asigna solo.">
            <input value={f.numero} readOnly aria-readonly="true" tabIndex={-1} className="entrada-fija" />
          </Campo>
        ) : (
          <Campo etiqueta="Número">
            <input value={f.numero} onChange={(e) => set('numero', e.target.value)} />
          </Campo>
        )}
        <Campo etiqueta="Propiedad">
          <select value={f.propiedadId} onChange={(e) => set('propiedadId', e.target.value)}>
            <option value="">Elegir…</option>
            {propiedades.map((p) => (
              <option key={p.id} value={p.id}>{p.codigo} — {direccionDe(p)}</option>
            ))}
          </select>
        </Campo>
        <Campo etiqueta="Inquilino">
          <select value={f.inquilinoId} onChange={(e) => set('inquilinoId', e.target.value)}>
            <option value="">Elegir…</option>
            {inquilinos.map((p) => (
              <option key={p.id} value={p.id}>{p.nombre}</option>
            ))}
          </select>
        </Campo>
        {!esNuevo && (
          <Campo etiqueta="Estado">
            <select value={f.estado} onChange={(e) => set('estado', e.target.value as Contrato['estado'])}>
              <option value="activo">Activo</option>
              <option value="finalizado">Finalizado</option>
              <option value="rescindido">Rescindido</option>
            </select>
          </Campo>
        )}
      </div>

      <div className="grid grid--form">
        <Campo etiqueta="Empieza">
          <input type="date" value={f.fechaInicio} onChange={(e) => set('fechaInicio', e.target.value)} />
        </Campo>
        <Campo etiqueta="Termina">
          <input type="date" value={f.fechaFin} onChange={(e) => set('fechaFin', e.target.value)} />
        </Campo>
        <Campo etiqueta="Alquiler inicial">
          <input
            className="entrada-num"
            type="number"
            value={f.montoInicial || ''}
            onChange={(e) => set('montoInicial', Number(e.target.value))}
          />
        </Campo>
        <Campo etiqueta="Vence el día">
          <input
            className="entrada-num"
            type="number"
            min={1}
            max={31}
            value={f.diaVencimiento}
            onChange={(e) => set('diaVencimiento', Number(e.target.value))}
          />
        </Campo>
      </div>

      <div className="grid grid--form">
        <Campo etiqueta="Se actualiza por" ayuda="Tiene que ser el índice que dice el contrato firmado.">
          <select value={f.indiceAjuste} onChange={(e) => set('indiceAjuste', e.target.value as IndiceAjuste)}>
            {(Object.keys(ETIQUETA_INDICE) as IndiceAjuste[]).map((i) => (
              <option key={i} value={i}>{ETIQUETA_INDICE[i]}</option>
            ))}
          </select>
        </Campo>
        <Campo etiqueta="Cada cuántos meses">
          <input
            className="entrada-num"
            type="number"
            min={1}
            max={12}
            value={f.mesesAjuste}
            onChange={(e) => set('mesesAjuste', Number(e.target.value))}
          />
        </Campo>
        {f.indiceAjuste === 'PORCENTAJE_FIJO' && (
          <Campo etiqueta="Porcentaje por ajuste">
            <input
              className="entrada-num"
              type="number"
              value={f.porcentajeFijo ?? 0}
              onChange={(e) => set('porcentajeFijo', Number(e.target.value))}
            />
          </Campo>
        )}
        <Campo etiqueta="Tus honorarios (%)">
          <input
            className="entrada-num"
            type="number"
            step="0.5"
            value={f.comisionAdminPct}
            onChange={(e) => set('comisionAdminPct', Number(e.target.value))}
          />
        </Campo>
        <Campo etiqueta="Punitorio por día (%)">
          <input
            className="entrada-num"
            type="number"
            step="0.01"
            value={f.punitorioDiarioPct}
            onChange={(e) => set('punitorioDiarioPct', Number(e.target.value))}
          />
        </Campo>
        <Campo etiqueta="Depósito en garantía">
          <input
            className="entrada-num"
            type="number"
            value={f.depositoGarantia || ''}
            onChange={(e) => set('depositoGarantia', Number(e.target.value))}
          />
        </Campo>
      </div>

      <div>
        <div className="fila" style={{ marginBottom: 8 }}>
          <strong className="crece">Se cobra junto con el alquiler</strong>
          <button
            className="btn btn--suave btn--chico"
            onClick={() =>
              set('conceptosFijos', [
                ...f.conceptosFijos,
                { id: nuevoId('cf'), descripcion: '', monto: 0, aCuentaDelPropietario: false },
              ])
            }
          >
            <IconoMas tam={15} />
            Agregar
          </button>
        </div>
        {f.conceptosFijos.length === 0 ? (
          <p className="mini tenue">Nada más que el alquiler. Lo habitual acá son la luz, el agua, las expensas o el ABL.</p>
        ) : (
          <div className="pila" style={{ gap: 8 }}>
            <p className="mini tenue">El importe de cada uno se pide al cobrar, con lo que dice la factura de ese mes.</p>
            {f.conceptosFijos.map((cf, i) => (
              <div className="fila" key={cf.id} style={{ gap: 8 }}>
                <input
                  className="crece"
                  value={cf.descripcion}
                  placeholder="Luz, agua, expensas…"
                  aria-label="Descripción del concepto"
                  aria-invalid={!cf.descripcion.trim() || undefined}
                  onChange={(e) => {
                    const copia = [...f.conceptosFijos];
                    copia[i] = { ...cf, descripcion: e.target.value };
                    set('conceptosFijos', copia);
                  }}
                />
                <label className="mini tenue fila" style={{ gap: 6, flex: 'none' }}>
                  <input
                    type="checkbox"
                    checked={cf.aCuentaDelPropietario}
                    onChange={(e) => {
                      const copia = [...f.conceptosFijos];
                      copia[i] = { ...cf, aCuentaDelPropietario: e.target.checked };
                      set('conceptosFijos', copia);
                    }}
                  />
                  se le rinde
                </label>
                <button
                  className="btn btn--fantasma btn--chico"
                  aria-label="Quitar concepto"
                  onClick={() => set('conceptosFijos', f.conceptosFijos.filter((x) => x.id !== cf.id))}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="copia-contrato">
        <div className="fila" style={{ marginBottom: 8 }}>
          <strong className="crece">Contrato firmado (PDF)</strong>
          <button
            className="btn btn--suave btn--chico"
            onClick={() => selectorCopia.current?.click()}
            disabled={subiendoCopia}
          >
            <IconoMas tam={15} />
            {subiendoCopia ? 'Subiendo…' : copias.length || copiaPendiente ? 'Subir otra' : 'Subir PDF'}
          </button>
          <input
            ref={selectorCopia}
            type="file"
            accept="application/pdf"
            hidden
            onChange={(e) => {
              void elegirCopia(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </div>
        {copias.length === 0 && !copiaPendiente && (
          <p className="mini tenue">Todavía no se subió la copia firmada. Se puede leer acá mismo o descargar cuando haga falta.</p>
        )}
        {copiaPendiente && (
          <div className="fila copia-contrato__fila">
            <span className="crece mini">{copiaPendiente.name} · {formatearTamano(copiaPendiente.size)} · se sube al guardar</span>
            <button className="btn btn--fantasma btn--chico" onClick={() => setCopiaPendiente(null)}>Quitar</button>
          </div>
        )}
        {copias.map((a) => (
          <div className="fila copia-contrato__fila" key={a.id}>
            <span className="crece mini">{a.nombre} · {formatearTamano(a.tamano)} · subido el {formatearFecha(a.fecha)}</span>
            <button className="btn btn--chico" onClick={() => setViendo(a)}>Ver</button>
            <button className="btn btn--chico" onClick={() => void descargarArchivo(a.id, a.nombre)}>Descargar</button>
            <button className="btn btn--fantasma btn--chico" onClick={() => eliminarAdjunto(a.id)}>Quitar</button>
          </div>
        ))}
        {errorCopia && <p className="mini" style={{ color: 'var(--critico)' }}>{errorCopia}</p>}
      </div>

      <Campo etiqueta="Notas">
        <textarea value={f.notas ?? ''} onChange={(e) => set('notas', e.target.value)} />
      </Campo>
      {viendo && <VisorArchivo adjunto={viendo} onCerrar={() => setViendo(null)} />}
    </Modal>
  );
}

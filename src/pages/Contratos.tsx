import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Encabezado } from '../components/Encabezado';
import { Avatar, Campo, Modal, Pastilla, Segmentos, Vacio } from '../components/ui';
import { IconoBuscar, IconoContratos, IconoMas } from '../components/iconos';
import { useApp, useDb } from '../data/store';
import {
  ETIQUETA_INDICE,
  montoVigente,
  proximoAjuste,
  vigenciaContrato,
  type VigenciaContrato,
} from '../domain/contratos';
import { direccionDe } from '../domain/propiedades';
import type { Contrato, IndiceAjuste } from '../domain/types';
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

export function contratoNuevo(comision: number, punitorio: number): Contrato {
  const inicio = `${periodoActual()}-01`;
  return {
    id: nuevoId('c'),
    numero: `LOC-${new Date().getFullYear()}-`,
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
  const valido = f.numero.trim() && f.propiedadId && f.inquilinoId && f.montoInicial > 0;

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
          <button className="btn btn--primario" disabled={!valido} onClick={() => onGuardar(f)}>
            Guardar
          </button>
        </>
      }
    >
      <div className="grid grid--form">
        <Campo etiqueta="Número">
          <input value={f.numero} onChange={(e) => set('numero', e.target.value)} />
        </Campo>
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
        <Campo etiqueta="Estado">
          <select value={f.estado} onChange={(e) => set('estado', e.target.value as Contrato['estado'])}>
            <option value="activo">Activo</option>
            <option value="finalizado">Finalizado</option>
            <option value="rescindido">Rescindido</option>
          </select>
        </Campo>
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
                { id: nuevoId('cf'), descripcion: 'Expensas', monto: 0, aCuentaDelPropietario: false },
              ])
            }
          >
            <IconoMas tam={15} />
            Agregar
          </button>
        </div>
        {f.conceptosFijos.length === 0 ? (
          <p className="mini tenue">Nada más que el alquiler. Lo habitual acá son las expensas o el ABL.</p>
        ) : (
          <div className="pila" style={{ gap: 8 }}>
            {f.conceptosFijos.map((cf, i) => (
              <div className="fila" key={cf.id} style={{ gap: 8 }}>
                <input
                  className="crece"
                  value={cf.descripcion}
                  aria-label="Descripción del concepto"
                  onChange={(e) => {
                    const copia = [...f.conceptosFijos];
                    copia[i] = { ...cf, descripcion: e.target.value };
                    set('conceptosFijos', copia);
                  }}
                />
                <input
                  className="entrada-num"
                  style={{ width: 130, flex: 'none' }}
                  type="number"
                  value={cf.monto || ''}
                  aria-label="Monto del concepto"
                  onChange={(e) => {
                    const copia = [...f.conceptosFijos];
                    copia[i] = { ...cf, monto: Number(e.target.value) };
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

      <Campo etiqueta="Notas">
        <textarea value={f.notas ?? ''} onChange={(e) => set('notas', e.target.value)} />
      </Campo>
    </Modal>
  );
}

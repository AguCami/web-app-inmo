import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Encabezado } from '../components/Encabezado';
import { Campo, Chip, Modal, Paginador, Tabla, Tarjeta, usePaginado, Vacio, type TonoChip } from '../components/ui';
import { useApp, useDb } from '../data/store';
import {
  ETIQUETA_INDICE,
  montoVigente,
  proximoAjuste,
  vigenciaContrato,
  type VigenciaContrato,
} from '../domain/contratos';
import type { Contrato, IndiceAjuste } from '../domain/types';
import {
  formatearFecha,
  formatearMoneda,
  formatearPeriodo,
  hoy,
  incluyeTexto,
  nuevoId,
  periodoActual,
  plural,
  sumarMeses,
} from '../domain/util';

export const TONO_VIGENCIA: Record<VigenciaContrato, TonoChip> = {
  vigente: 'ok',
  por_vencer: 'alerta',
  vencido: 'critico',
  no_iniciado: 'info',
};

export const ETIQUETA_VIGENCIA: Record<VigenciaContrato, string> = {
  vigente: 'Vigente',
  por_vencer: 'Por vencer',
  vencido: 'Vencido',
  no_iniciado: 'No iniciado',
};

export function contratoNuevo(comisionDefault: number, punitorioDefault: number): Contrato {
  const inicio = `${periodoActual()}-01`;
  return {
    id: nuevoId('con'),
    numero: `LOC-${new Date().getFullYear()}-`,
    propiedadId: '',
    inquilinoId: '',
    garanteIds: [],
    fechaInicio: inicio,
    fechaFin: sumarMeses(inicio, 35),
    montoInicial: 0,
    moneda: 'ARS',
    diaVencimiento: 10,
    indiceAjuste: 'ICL',
    mesesAjuste: 3,
    comisionAdminPct: comisionDefault,
    punitorioDiarioPct: punitorioDefault,
    depositoGarantia: 0,
    conceptosFijos: [],
    estado: 'activo',
  };
}

export default function Contratos() {
  const db = useDb();
  const guardar = useApp((e) => e.guardarContrato);
  const emitir = useApp((e) => e.emitirCuotas);
  const navegar = useNavigate();

  const [busqueda, setBusqueda] = useState('');
  const [soloActivos, setSoloActivos] = useState(true);
  const [editando, setEditando] = useState<Contrato | null>(null);
  const [mensaje, setMensaje] = useState('');

  const propiedadDe = (id: string) => db.propiedades.find((p) => p.id === id);
  const personaDe = (id: string) => db.personas.find((p) => p.id === id);

  const filtrados = useMemo(
    () =>
      db.contratos
        .filter((c) => !soloActivos || c.estado === 'activo')
        .filter((c) =>
          incluyeTexto(
            [c.numero, propiedadDe(c.propiedadId)?.codigo, propiedadDe(c.propiedadId)?.calle, personaDe(c.inquilinoId)?.nombre],
            busqueda,
          ),
        )
        .sort((a, b) => a.fechaFin.localeCompare(b.fechaFin)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [db.contratos, db.propiedades, db.personas, soloActivos, busqueda],
  );

  const pag = usePaginado(filtrados, 40);

  return (
    <>
      <Encabezado titulo="Contratos de alquiler" bajada={`${db.contratos.filter((c) => c.estado === 'activo').length} contratos activos`}>
        <button
          className="btn no-imprimir"
          onClick={() => {
            const n = emitir();
            setMensaje(
              n
                ? `Se emitió ${plural(n, 'cuota nueva', 'cuotas nuevas')}.`
                : 'No había cuotas pendientes de emitir.',
            );
          }}
        >
          Emitir cuotas del período
        </button>
        <button
          className="btn btn--primario no-imprimir"
          onClick={() =>
            setEditando(contratoNuevo(db.configuracion.comisionAdminPctDefault, db.configuracion.punitorioDiarioPctDefault))
          }
        >
          + Nuevo contrato
        </button>
      </Encabezado>

      <div className="contenido pila">
        {mensaje && <div className="aviso aviso--ok"><span aria-hidden="true">✅</span><div>{mensaje}</div></div>}

        <div className="fila no-imprimir">
          <div className="buscador">
            <input
              type="search"
              placeholder="Buscar por número, propiedad o inquilino"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              aria-label="Buscar contratos"
            />
          </div>
          <label className="fila" style={{ gap: 6 }}>
            <input type="checkbox" checked={soloActivos} onChange={(e) => setSoloActivos(e.target.checked)} />
            Solo activos
          </label>
        </div>

        <Tarjeta ajustado>
          {filtrados.length === 0 ? (
            <Vacio icono="📄" titulo="No hay contratos" detalle="Cargá un contrato para empezar a emitir cuotas." />
          ) : (
            <Tabla>
              <thead>
                <tr>
                  <th>Contrato</th>
                  <th>Propiedad</th>
                  <th>Inquilino</th>
                  <th>Vigencia</th>
                  <th>Ajuste</th>
                  <th className="num">Alquiler vigente</th>
                  <th className="num">Próximo ajuste</th>
                </tr>
              </thead>
              <tbody>
                {pag.visibles.map((c) => {
                  const prop = propiedadDe(c.propiedadId);
                  const vig = vigenciaContrato(c);
                  const ajuste = proximoAjuste(c, db.indices);
                  return (
                    <tr key={c.id} className="fila-clic" onClick={() => navegar(`/contratos/${c.id}`)}>
                      <td className="principal-celda">
                        <Link to={`/contratos/${c.id}`} onClick={(e) => e.stopPropagation()}>{c.numero}</Link>
                        <span className="tabla__sub">desde {formatearFecha(c.fechaInicio)}</span>
                      </td>
                      <td>
                        {prop?.codigo ?? '—'}
                        <span className="tabla__sub">{prop ? `${prop.calle} ${prop.numero}` : ''}</span>
                      </td>
                      <td>{personaDe(c.inquilinoId)?.nombre ?? '—'}</td>
                      <td>
                        <Chip tono={TONO_VIGENCIA[vig]}>{ETIQUETA_VIGENCIA[vig]}</Chip>
                        <span className="tabla__sub">hasta {formatearFecha(c.fechaFin)}</span>
                      </td>
                      <td className="mini">
                        {ETIQUETA_INDICE[c.indiceAjuste]}
                        <span className="tabla__sub">cada {c.mesesAjuste} meses</span>
                      </td>
                      <td className="num">{formatearMoneda(montoVigente(c, periodoActual(), db.indices), c.moneda)}</td>
                      <td className="num">
                        {ajuste ? (
                          <>
                            {formatearPeriodo(ajuste.periodo, true)}
                            <span className="tabla__sub">
                              {formatearMoneda(ajuste.montoNuevo, c.moneda)} (+{ajuste.variacionPct.toFixed(1).replace('.', ',')} %)
                            </span>
                          </>
                        ) : (
                          <span className="tenue">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Tabla>
          )}
          <Paginador
            pagina={pag.pagina}
            paginas={pag.paginas}
            desde={pag.desde}
            hasta={pag.hasta}
            total={pag.total}
            etiqueta="contratos"
            onCambio={pag.setPagina}
          />
        </Tarjeta>
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
    (p) => p.destino !== 'venta' && (p.estado !== 'alquilada' || p.id === contrato.propiedadId),
  );
  const inquilinos = db.personas.filter((p) => p.roles.includes('inquilino'));
  const valido = f.numero.trim() && f.propiedadId && f.inquilinoId && f.montoInicial > 0;

  const agregarConcepto = () =>
    set('conceptosFijos', [
      ...f.conceptosFijos,
      { id: nuevoId('cf'), descripcion: 'Expensas', monto: 0, aCuentaDelPropietario: false },
    ]);

  return (
    <Modal
      titulo={contrato.propiedadId ? `Contrato ${contrato.numero}` : 'Nuevo contrato'}
      onCerrar={onCerrar}
      ancho
      pie={
        <>
          {onEliminar && (
            <button className="btn btn--peligro" onClick={onEliminar} style={{ marginRight: 'auto' }}>Eliminar</button>
          )}
          <button className="btn" onClick={onCerrar}>Cancelar</button>
          <button className="btn btn--primario" disabled={!valido} onClick={() => onGuardar(f)}>Guardar</button>
        </>
      }
    >
      <div className="grid grid--form">
        <Campo etiqueta="Número">
          <input value={f.numero} onChange={(e) => set('numero', e.target.value)} />
        </Campo>
        <Campo etiqueta="Propiedad">
          <select value={f.propiedadId} onChange={(e) => set('propiedadId', e.target.value)}>
            <option value="">Seleccionar…</option>
            {propiedades.map((p) => (
              <option key={p.id} value={p.id}>{p.codigo} — {p.calle} {p.numero}</option>
            ))}
          </select>
        </Campo>
        <Campo etiqueta="Inquilino">
          <select value={f.inquilinoId} onChange={(e) => set('inquilinoId', e.target.value)}>
            <option value="">Seleccionar…</option>
            {inquilinos.map((p) => (
              <option key={p.id} value={p.id}>{p.nombre}</option>
            ))}
          </select>
        </Campo>
        <Campo etiqueta="Estado">
          <select value={f.estado} onChange={(e) => set('estado', e.target.value as Contrato['estado'])}>
            <option value="borrador">Borrador</option>
            <option value="activo">Activo</option>
            <option value="finalizado">Finalizado</option>
            <option value="rescindido">Rescindido</option>
          </select>
        </Campo>
      </div>

      <div className="grid grid--form">
        <Campo etiqueta="Inicio">
          <input type="date" value={f.fechaInicio} onChange={(e) => set('fechaInicio', e.target.value)} />
        </Campo>
        <Campo etiqueta="Fin">
          <input type="date" value={f.fechaFin} onChange={(e) => set('fechaFin', e.target.value)} />
        </Campo>
        <Campo etiqueta="Alquiler inicial">
          <input className="entrada-num" type="number" value={f.montoInicial || ''} onChange={(e) => set('montoInicial', Number(e.target.value))} />
        </Campo>
        <Campo etiqueta="Día de vencimiento">
          <input className="entrada-num" type="number" min={1} max={31} value={f.diaVencimiento} onChange={(e) => set('diaVencimiento', Number(e.target.value))} />
        </Campo>
      </div>

      <div className="grid grid--form">
        <Campo etiqueta="Índice de actualización">
          <select value={f.indiceAjuste} onChange={(e) => set('indiceAjuste', e.target.value as IndiceAjuste)}>
            {(Object.keys(ETIQUETA_INDICE) as IndiceAjuste[]).map((i) => (
              <option key={i} value={i}>{ETIQUETA_INDICE[i]}</option>
            ))}
          </select>
        </Campo>
        <Campo etiqueta="Ajusta cada (meses)">
          <input className="entrada-num" type="number" min={1} max={12} value={f.mesesAjuste} onChange={(e) => set('mesesAjuste', Number(e.target.value))} />
        </Campo>
        {f.indiceAjuste === 'PORCENTAJE_FIJO' && (
          <Campo etiqueta="% fijo por ajuste">
            <input className="entrada-num" type="number" value={f.porcentajeFijo ?? 0} onChange={(e) => set('porcentajeFijo', Number(e.target.value))} />
          </Campo>
        )}
        <Campo etiqueta="Honorarios de administración (%)">
          <input className="entrada-num" type="number" step="0.5" value={f.comisionAdminPct} onChange={(e) => set('comisionAdminPct', Number(e.target.value))} />
        </Campo>
        <Campo etiqueta="Punitorio diario (%)">
          <input className="entrada-num" type="number" step="0.01" value={f.punitorioDiarioPct} onChange={(e) => set('punitorioDiarioPct', Number(e.target.value))} />
        </Campo>
        <Campo etiqueta="Depósito en garantía">
          <input className="entrada-num" type="number" value={f.depositoGarantia || ''} onChange={(e) => set('depositoGarantia', Number(e.target.value))} />
        </Campo>
      </div>

      <div>
        <div className="fila" style={{ marginBottom: 6 }}>
          <strong className="crece">Conceptos que se facturan con el alquiler</strong>
          <button className="btn btn--chico" onClick={agregarConcepto}>+ Agregar</button>
        </div>
        {f.conceptosFijos.length === 0 ? (
          <p className="tenue mini">Sin conceptos adicionales. Típicamente: expensas, ABL o seguro.</p>
        ) : (
          <Tabla compacta>
            <thead>
              <tr>
                <th>Descripción</th>
                <th className="num">Monto</th>
                <th>A cuenta del propietario</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {f.conceptosFijos.map((cf, i) => (
                <tr key={cf.id}>
                  <td>
                    <input
                      value={cf.descripcion}
                      onChange={(e) => {
                        const copia = [...f.conceptosFijos];
                        copia[i] = { ...cf, descripcion: e.target.value };
                        set('conceptosFijos', copia);
                      }}
                    />
                  </td>
                  <td className="num">
                    <input
                      className="entrada-num"
                      type="number"
                      value={cf.monto || ''}
                      onChange={(e) => {
                        const copia = [...f.conceptosFijos];
                        copia[i] = { ...cf, monto: Number(e.target.value) };
                        set('conceptosFijos', copia);
                      }}
                    />
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      checked={cf.aCuentaDelPropietario}
                      onChange={(e) => {
                        const copia = [...f.conceptosFijos];
                        copia[i] = { ...cf, aCuentaDelPropietario: e.target.checked };
                        set('conceptosFijos', copia);
                      }}
                    />
                  </td>
                  <td className="num">
                    <button
                      className="btn btn--chico btn--fantasma"
                      onClick={() => set('conceptosFijos', f.conceptosFijos.filter((x) => x.id !== cf.id))}
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Tabla>
        )}
      </div>

      <Campo etiqueta="Notas">
        <textarea value={f.notas ?? ''} onChange={(e) => set('notas', e.target.value)} />
      </Campo>

      <p className="tenue mini">
        Fecha de referencia para los cálculos: {formatearFecha(hoy())}.
      </p>
    </Modal>
  );
}

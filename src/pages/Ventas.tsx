import { useMemo, useState } from 'react';
import { Encabezado } from '../components/Encabezado';
import { Campo, Chip, Kpi, Modal, Tabla, Tarjeta, Vacio, type TonoChip } from '../components/ui';
import { useApp, useDb } from '../data/store';
import {
  comisionesPorAgente,
  diasEnPipeline,
  embudoVentas,
  ETIQUETA_ESTADO_OPERACION,
  honorariosDeOperacion,
  ORDEN_ESTADOS,
  PROBABILIDAD_POR_ESTADO,
  valorPonderado,
} from '../domain/ventas';
import type { EstadoOperacion, Operacion } from '../domain/types';
import {
  formatearFecha,
  formatearMoneda,
  hoy,
  incluyeTexto,
  nuevoId,
  sumar,
} from '../domain/util';

const TONO: Record<EstadoOperacion, TonoChip> = {
  captacion: 'neutro',
  reserva: 'info',
  boleto: 'alerta',
  escriturada: 'ok',
  caida: 'critico',
};

function operacionNueva(honorariosDefault: number): Operacion {
  return {
    id: nuevoId('ope'),
    numero: `OP-${new Date().getFullYear()}-`,
    propiedadId: '',
    vendedorId: '',
    estado: 'captacion',
    fechaCaptacion: hoy(),
    precioPublicado: 0,
    moneda: 'USD',
    honorariosVendedorPct: honorariosDefault,
    honorariosCompradorPct: honorariosDefault,
    agentes: [],
  };
}

export default function Ventas() {
  const db = useDb();
  const guardar = useApp((e) => e.guardarOperacion);
  const eliminar = useApp((e) => e.eliminar);

  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<EstadoOperacion | 'abiertas' | 'todas'>('abiertas');
  const [editando, setEditando] = useState<Operacion | null>(null);

  const propiedadDe = (id: string) => db.propiedades.find((p) => p.id === id);
  const personaDe = (id?: string) => db.personas.find((p) => p.id === id);

  const filtradas = useMemo(
    () =>
      db.operaciones
        .filter((o) => {
          if (filtroEstado === 'todas') return true;
          if (filtroEstado === 'abiertas') return o.estado !== 'escriturada' && o.estado !== 'caida';
          return o.estado === filtroEstado;
        })
        .filter((o) =>
          incluyeTexto(
            [o.numero, propiedadDe(o.propiedadId)?.codigo, propiedadDe(o.propiedadId)?.titulo, personaDe(o.compradorId)?.nombre],
            busqueda,
          ),
        )
        .sort((a, b) => b.fechaCaptacion.localeCompare(a.fechaCaptacion)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [db.operaciones, db.propiedades, db.personas, filtroEstado, busqueda],
  );

  const embudo = useMemo(() => embudoVentas(db.operaciones), [db.operaciones]);
  const comisiones = useMemo(() => comisionesPorAgente(db.operaciones, db.personas), [db.operaciones, db.personas]);
  const abiertas = db.operaciones.filter((o) => o.estado !== 'escriturada' && o.estado !== 'caida');
  const cerradas = db.operaciones.filter((o) => o.estado === 'escriturada');

  return (
    <>
      <Encabezado titulo="Operaciones de venta" bajada="Del primer contacto a la escritura, con el reparto de honorarios">
        <button
          className="btn btn--primario no-imprimir"
          onClick={() => setEditando(operacionNueva(db.configuracion.honorariosVentaPctDefault))}
        >
          + Nueva operación
        </button>
      </Encabezado>

      <div className="contenido pila">
        <div className="grid grid--kpis">
          <Kpi etiqueta="Operaciones abiertas" valor={abiertas.length} pie={`${cerradas.length} escrituradas`} />
          <Kpi
            etiqueta="Honorarios en pipeline"
            valor={formatearMoneda(sumar(abiertas, (o) => honorariosDeOperacion(o).total), 'USD')}
            chico
            pie="si cerraran todas"
          />
          <Kpi
            etiqueta="Pipeline ponderado"
            valor={formatearMoneda(sumar(abiertas, valorPonderado), 'USD')}
            chico
            tono="ok"
            pie="ajustado por probabilidad de cierre"
          />
          <Kpi
            etiqueta="Honorarios cerrados"
            valor={formatearMoneda(sumar(cerradas, (o) => honorariosDeOperacion(o).total), 'USD')}
            chico
            pie="operaciones escrituradas"
          />
        </div>

        <Tarjeta titulo="Embudo" subtitulo="Cantidad y honorarios potenciales por etapa" ajustado>
          <Tabla compacta>
            <thead>
              <tr>
                <th>Etapa</th>
                <th className="num">Operaciones</th>
                <th className="num">Volumen</th>
                <th className="num">Honorarios</th>
                <th className="num">Ponderado</th>
              </tr>
            </thead>
            <tbody>
              {embudo.map((e) => (
                <tr key={e.estado}>
                  <td className="principal-celda">
                    <Chip tono={TONO[e.estado]}>{e.etiqueta}</Chip>
                  </td>
                  <td className="num">{e.cantidad}</td>
                  <td className="num">{formatearMoneda(e.volumen, 'USD')}</td>
                  <td className="num">{formatearMoneda(e.honorarios, 'USD')}</td>
                  <td className="num">{formatearMoneda(e.ponderado, 'USD')}</td>
                </tr>
              ))}
            </tbody>
          </Tabla>
        </Tarjeta>

        <div className="fila no-imprimir">
          <div className="buscador">
            <input
              type="search"
              placeholder="Buscar por número, propiedad o comprador"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              aria-label="Buscar operaciones"
            />
          </div>
          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value as EstadoOperacion | 'abiertas' | 'todas')}
            style={{ width: 'auto' }}
            aria-label="Filtrar por etapa"
          >
            <option value="abiertas">En curso</option>
            <option value="todas">Todas</option>
            {ORDEN_ESTADOS.map((e) => (
              <option key={e} value={e}>{ETIQUETA_ESTADO_OPERACION[e]}</option>
            ))}
            <option value="caida">Caídas</option>
          </select>
        </div>

        <Tarjeta ajustado>
          {filtradas.length === 0 ? (
            <Vacio icono="🤝" titulo="No hay operaciones" detalle="Cargá una captación para empezar a seguir el pipeline." />
          ) : (
            <Tabla>
              <thead>
                <tr>
                  <th>Operación</th>
                  <th>Propiedad</th>
                  <th>Partes</th>
                  <th>Etapa</th>
                  <th className="num">Precio</th>
                  <th className="num">Honorarios</th>
                  <th className="num">Días</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtradas.map((o) => {
                  const prop = propiedadDe(o.propiedadId);
                  const h = honorariosDeOperacion(o);
                  return (
                    <tr key={o.id} className="fila-clic" onClick={() => setEditando(o)}>
                      <td className="principal-celda">
                        {o.numero}
                        <span className="tabla__sub">captada {formatearFecha(o.fechaCaptacion)}</span>
                      </td>
                      <td>
                        {prop?.codigo ?? '—'}
                        <span className="tabla__sub">{prop?.titulo ?? ''}</span>
                      </td>
                      <td className="mini">
                        {personaDe(o.vendedorId)?.nombre ?? '—'}
                        <span className="tabla__sub">{personaDe(o.compradorId)?.nombre ?? 'sin comprador'}</span>
                      </td>
                      <td>
                        <Chip tono={TONO[o.estado]}>{ETIQUETA_ESTADO_OPERACION[o.estado]}</Chip>
                      </td>
                      <td className="num">
                        {formatearMoneda(o.precioAcordado ?? o.precioPublicado, o.moneda)}
                        {o.precioAcordado && o.precioAcordado !== o.precioPublicado && (
                          <span className="tabla__sub">publicado {formatearMoneda(o.precioPublicado, o.moneda)}</span>
                        )}
                      </td>
                      <td className="num">
                        {formatearMoneda(h.total, o.moneda)}
                        <span className="tabla__sub">
                          {o.honorariosVendedorPct} % + {o.honorariosCompradorPct} %
                        </span>
                      </td>
                      <td className="num">{diasEnPipeline(o, hoy())}</td>
                      <td className="num no-imprimir">
                        <button className="btn btn--chico btn--fantasma" onClick={(e) => { e.stopPropagation(); setEditando(o); }}>
                          Editar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Tabla>
          )}
        </Tarjeta>

        <Tarjeta titulo="Comisiones por agente" subtitulo="Reparto de los honorarios de la inmobiliaria" ajustado>
          {comisiones.length === 0 ? (
            <Vacio icono="🧮" titulo="Sin agentes asignados" />
          ) : (
            <Tabla compacta>
              <thead>
                <tr>
                  <th>Agente</th>
                  <th className="num">Operaciones</th>
                  <th className="num">Volumen intermediado</th>
                  <th className="num">Comisión cobrada</th>
                  <th className="num">Comisión en curso</th>
                </tr>
              </thead>
              <tbody>
                {comisiones.map((c) => (
                  <tr key={c.agenteId}>
                    <td className="principal-celda">{c.nombre}</td>
                    <td className="num">{c.operaciones}</td>
                    <td className="num">{formatearMoneda(c.volumen, 'USD')}</td>
                    <td className="num pos">{formatearMoneda(c.comision, 'USD')}</td>
                    <td className="num tenue">{formatearMoneda(c.comisionPendiente, 'USD')}</td>
                  </tr>
                ))}
              </tbody>
            </Tabla>
          )}
        </Tarjeta>
      </div>

      {editando && (
        <FormularioOperacion
          operacion={editando}
          onCerrar={() => setEditando(null)}
          onGuardar={(o) => {
            guardar(o);
            setEditando(null);
          }}
          onEliminar={
            db.operaciones.some((o) => o.id === editando.id)
              ? () => {
                  eliminar('operaciones', editando.id);
                  setEditando(null);
                }
              : undefined
          }
        />
      )}
    </>
  );
}

function FormularioOperacion({
  operacion,
  onGuardar,
  onCerrar,
  onEliminar,
}: {
  operacion: Operacion;
  onGuardar: (o: Operacion) => void;
  onCerrar: () => void;
  onEliminar?: () => void;
}) {
  const db = useDb();
  const [f, setF] = useState<Operacion>(operacion);
  const set = <K extends keyof Operacion>(k: K, v: Operacion[K]) => setF((x) => ({ ...x, [k]: v }));

  const propiedades = db.propiedades.filter((p) => p.destino !== 'alquiler' || p.id === operacion.propiedadId);
  const agentes = db.personas.filter((p) => p.roles.includes('agente'));
  const h = honorariosDeOperacion(f);
  const repartoTotal = sumar(f.agentes, (a) => a.porcentaje);
  const valido = f.numero.trim() && f.propiedadId && f.vendedorId && f.precioPublicado > 0;

  return (
    <Modal
      titulo={operacion.propiedadId ? `Operación ${operacion.numero}` : 'Nueva operación'}
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
          <select value={f.propiedadId} onChange={(e) => {
            const prop = db.propiedades.find((p) => p.id === e.target.value);
            setF((x) => ({
              ...x,
              propiedadId: e.target.value,
              vendedorId: prop?.propietarioId ?? x.vendedorId,
              precioPublicado: x.precioPublicado || prop?.precioVenta?.monto || 0,
            }));
          }}>
            <option value="">Seleccionar…</option>
            {propiedades.map((p) => (
              <option key={p.id} value={p.id}>{p.codigo} — {p.titulo}</option>
            ))}
          </select>
        </Campo>
        <Campo etiqueta="Etapa">
          <select
            value={f.estado}
            onChange={(e) => {
              const estado = e.target.value as EstadoOperacion;
              setF((x) => ({ ...x, estado, probabilidad: PROBABILIDAD_POR_ESTADO[estado] }));
            }}
          >
            {[...ORDEN_ESTADOS, 'caida' as const].map((e) => (
              <option key={e} value={e}>{ETIQUETA_ESTADO_OPERACION[e]}</option>
            ))}
          </select>
        </Campo>
        <Campo etiqueta="Probabilidad de cierre (%)">
          <input
            className="entrada-num"
            type="number"
            min={0}
            max={100}
            value={f.probabilidad ?? PROBABILIDAD_POR_ESTADO[f.estado]}
            onChange={(e) => set('probabilidad', Number(e.target.value))}
          />
        </Campo>
      </div>

      <div className="grid grid--form">
        <Campo etiqueta="Vendedor (propietario)">
          <select value={f.vendedorId} onChange={(e) => set('vendedorId', e.target.value)}>
            <option value="">Seleccionar…</option>
            {db.personas.filter((p) => p.roles.includes('propietario')).map((p) => (
              <option key={p.id} value={p.id}>{p.nombre}</option>
            ))}
          </select>
        </Campo>
        <Campo etiqueta="Comprador">
          <select value={f.compradorId ?? ''} onChange={(e) => set('compradorId', e.target.value || undefined)}>
            <option value="">Sin definir</option>
            {db.personas.filter((p) => p.roles.includes('comprador')).map((p) => (
              <option key={p.id} value={p.id}>{p.nombre}</option>
            ))}
          </select>
        </Campo>
      </div>

      <div className="grid grid--form">
        <Campo etiqueta="Precio publicado (USD)">
          <input className="entrada-num" type="number" value={f.precioPublicado || ''} onChange={(e) => set('precioPublicado', Number(e.target.value))} />
        </Campo>
        <Campo etiqueta="Precio acordado (USD)">
          <input className="entrada-num" type="number" value={f.precioAcordado ?? ''} onChange={(e) => set('precioAcordado', Number(e.target.value) || undefined)} />
        </Campo>
        <Campo etiqueta="Seña / reserva (USD)">
          <input className="entrada-num" type="number" value={f.senia ?? ''} onChange={(e) => set('senia', Number(e.target.value) || undefined)} />
        </Campo>
        <Campo etiqueta="Honorarios al vendedor (%)">
          <input className="entrada-num" type="number" step="0.5" value={f.honorariosVendedorPct} onChange={(e) => set('honorariosVendedorPct', Number(e.target.value))} />
        </Campo>
        <Campo etiqueta="Honorarios al comprador (%)">
          <input className="entrada-num" type="number" step="0.5" value={f.honorariosCompradorPct} onChange={(e) => set('honorariosCompradorPct', Number(e.target.value))} />
        </Campo>
      </div>

      <div className="grid grid--form">
        <Campo etiqueta="Captación">
          <input type="date" value={f.fechaCaptacion} onChange={(e) => set('fechaCaptacion', e.target.value)} />
        </Campo>
        <Campo etiqueta="Reserva">
          <input type="date" value={f.fechaReserva ?? ''} onChange={(e) => set('fechaReserva', e.target.value || undefined)} />
        </Campo>
        <Campo etiqueta="Boleto">
          <input type="date" value={f.fechaBoleto ?? ''} onChange={(e) => set('fechaBoleto', e.target.value || undefined)} />
        </Campo>
        <Campo etiqueta="Escritura">
          <input type="date" value={f.fechaEscritura ?? ''} onChange={(e) => set('fechaEscritura', e.target.value || undefined)} />
        </Campo>
      </div>

      <div>
        <div className="fila" style={{ marginBottom: 6 }}>
          <strong className="crece">Reparto entre agentes</strong>
          <span className={`mini ${repartoTotal > 100 ? 'neg' : 'tenue'}`}>{repartoTotal} % asignado</span>
          <button
            className="btn btn--chico"
            onClick={() => set('agentes', [...f.agentes, { agenteId: agentes[0]?.id ?? '', porcentaje: 100 - repartoTotal }])}
            disabled={agentes.length === 0}
          >
            + Agregar
          </button>
        </div>
        {f.agentes.length === 0 ? (
          <p className="tenue mini">Sin agentes asignados: los honorarios quedan enteros para la inmobiliaria.</p>
        ) : (
          <Tabla compacta>
            <tbody>
              {f.agentes.map((a, i) => (
                <tr key={i}>
                  <td>
                    <select
                      value={a.agenteId}
                      onChange={(e) => {
                        const copia = [...f.agentes];
                        copia[i] = { ...a, agenteId: e.target.value };
                        set('agentes', copia);
                      }}
                    >
                      {agentes.map((ag) => (
                        <option key={ag.id} value={ag.id}>{ag.nombre}</option>
                      ))}
                    </select>
                  </td>
                  <td className="num" style={{ width: 110 }}>
                    <input
                      className="entrada-num"
                      type="number"
                      value={a.porcentaje}
                      onChange={(e) => {
                        const copia = [...f.agentes];
                        copia[i] = { ...a, porcentaje: Number(e.target.value) };
                        set('agentes', copia);
                      }}
                    />
                  </td>
                  <td className="num mini tenue">{formatearMoneda((h.total * a.porcentaje) / 100, f.moneda)}</td>
                  <td className="num">
                    <button className="btn btn--chico btn--fantasma" onClick={() => set('agentes', f.agentes.filter((_, j) => j !== i))}>✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Tabla>
        )}
      </div>

      <div className="aviso">
        <span aria-hidden="true">💰</span>
        <div>
          <strong>Honorarios de la operación: {formatearMoneda(h.total, f.moneda)}</strong>
          <span className="mini">
            Vendedor {formatearMoneda(h.vendedor, f.moneda)} · comprador {formatearMoneda(h.comprador, f.moneda)} ·
            base {formatearMoneda(h.base, f.moneda)}
          </span>
        </div>
      </div>

      {f.estado === 'caida' && (
        <Campo etiqueta="Motivo de la caída">
          <textarea value={f.motivoCaida ?? ''} onChange={(e) => set('motivoCaida', e.target.value)} />
        </Campo>
      )}
    </Modal>
  );
}

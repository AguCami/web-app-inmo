import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Encabezado } from '../components/Encabezado';
import { Campo, Chip, Modal, Paginador, Tabla, Tarjeta, usePaginado, Vacio, type TonoChip } from '../components/ui';
import { useApp, useDb } from '../data/store';
import type { DestinoPropiedad, EstadoPropiedad, Propiedad, TipoPropiedad } from '../domain/types';
import { direccionDe } from '../domain/propiedades';
import { formatearMoneda, incluyeTexto, nuevoId } from '../domain/util';

const TIPOS: TipoPropiedad[] = ['departamento', 'casa', 'ph', 'local', 'oficina', 'galpon', 'terreno', 'cochera'];
const ESTADOS: EstadoPropiedad[] = ['disponible', 'alquilada', 'reservada', 'vendida', 'fuera_de_mercado'];

export const ETIQUETA_ESTADO_PROPIEDAD: Record<EstadoPropiedad, string> = {
  disponible: 'Disponible',
  alquilada: 'Alquilada',
  reservada: 'Reservada',
  vendida: 'Vendida',
  fuera_de_mercado: 'Fuera de mercado',
};

const TONO_ESTADO: Record<EstadoPropiedad, TonoChip> = {
  disponible: 'info',
  alquilada: 'ok',
  reservada: 'alerta',
  vendida: 'neutro',
  fuera_de_mercado: 'neutro',
};

function propiedadNueva(): Propiedad {
  return {
    id: nuevoId('pro'),
    codigo: '',
    titulo: '',
    tipo: 'departamento',
    propietarioId: '',
    calle: '',
    numero: '',
    localidad: '',
    provincia: 'CABA',
    cochera: false,
    destino: 'alquiler',
    estado: 'disponible',
  };
}

export default function Propiedades() {
  const db = useDb();
  const guardar = useApp((e) => e.guardarPropiedad);
  const eliminar = useApp((e) => e.eliminar);

  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<EstadoPropiedad | 'todas'>('todas');
  const [filtroDestino, setFiltroDestino] = useState<DestinoPropiedad | 'todos'>('todos');
  const [editando, setEditando] = useState<Propiedad | null>(null);

  const propietarios = db.personas.filter((p) => p.roles.includes('propietario'));
  const nombreDe = (id: string) => db.personas.find((p) => p.id === id)?.nombre ?? '—';

  const filtradas = useMemo(
    () =>
      db.propiedades
        .filter((p) => filtroEstado === 'todas' || p.estado === filtroEstado)
        .filter((p) => filtroDestino === 'todos' || p.destino === filtroDestino || p.destino === 'ambos')
        .filter((p) => incluyeTexto([p.codigo, p.titulo, p.calle, p.localidad, nombreDe(p.propietarioId)], busqueda))
        .sort((a, b) => a.codigo.localeCompare(b.codigo)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [db.propiedades, db.personas, filtroEstado, filtroDestino, busqueda],
  );

  const contratoActivoDe = (propiedadId: string) =>
    db.contratos.find((c) => c.propiedadId === propiedadId && c.estado === 'activo');

  const pag = usePaginado(filtradas, 40);

  return (
    <>
      <Encabezado titulo="Propiedades" bajada={`${db.propiedades.length} unidades en cartera`}>
        <button className="btn btn--primario no-imprimir" onClick={() => setEditando(propiedadNueva())}>
          + Nueva propiedad
        </button>
      </Encabezado>

      <div className="contenido pila">
        <div className="fila no-imprimir">
          <div className="buscador">
            <input
              type="search"
              placeholder="Buscar por código, dirección o propietario"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              aria-label="Buscar propiedades"
            />
          </div>
          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value as EstadoPropiedad | 'todas')}
            style={{ width: 'auto' }}
            aria-label="Filtrar por estado"
          >
            <option value="todas">Todos los estados</option>
            {ESTADOS.map((e) => (
              <option key={e} value={e}>{ETIQUETA_ESTADO_PROPIEDAD[e]}</option>
            ))}
          </select>
          <select
            value={filtroDestino}
            onChange={(e) => setFiltroDestino(e.target.value as DestinoPropiedad | 'todos')}
            style={{ width: 'auto' }}
            aria-label="Filtrar por destino"
          >
            <option value="todos">Alquiler y venta</option>
            <option value="alquiler">Alquiler</option>
            <option value="venta">Venta</option>
          </select>
        </div>

        <Tarjeta ajustado>
          {filtradas.length === 0 ? (
            <Vacio icono="🏚" titulo="No hay propiedades que coincidan" detalle="Probá con otros filtros o cargá una nueva." />
          ) : (
            <Tabla>
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Propiedad</th>
                  <th>Propietario</th>
                  <th>Estado</th>
                  <th className="num">Alquiler</th>
                  <th className="num">Venta</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {pag.visibles.map((p) => {
                  const contrato = contratoActivoDe(p.id);
                  return (
                    <tr key={p.id}>
                      <td className="principal-celda">{p.codigo}</td>
                      <td>
                        {p.titulo}
                        <span className="tabla__sub">
                          {direccionDe(p)} · {p.localidad}
                        </span>
                      </td>
                      <td>{nombreDe(p.propietarioId)}</td>
                      <td>
                        <Chip tono={TONO_ESTADO[p.estado]}>{ETIQUETA_ESTADO_PROPIEDAD[p.estado]}</Chip>
                        {contrato && (
                          <span className="tabla__sub">
                            <Link to={`/contratos/${contrato.id}`}>{contrato.numero}</Link>
                          </span>
                        )}
                      </td>
                      <td className="num">
                        {p.precioAlquiler ? formatearMoneda(p.precioAlquiler.monto, p.precioAlquiler.moneda) : '—'}
                      </td>
                      <td className="num">
                        {p.precioVenta ? formatearMoneda(p.precioVenta.monto, p.precioVenta.moneda) : '—'}
                      </td>
                      <td className="num no-imprimir">
                        <button className="btn btn--chico btn--fantasma" onClick={() => setEditando(p)}>
                          Editar
                        </button>
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
            etiqueta="propiedades"
            onCambio={pag.setPagina}
          />
        </Tarjeta>
      </div>

      {editando && (
        <FormularioPropiedad
          propiedad={editando}
          propietarios={propietarios}
          onCerrar={() => setEditando(null)}
          onGuardar={(p) => {
            guardar(p);
            setEditando(null);
          }}
          onEliminar={
            db.propiedades.some((p) => p.id === editando.id)
              ? () => {
                  eliminar('propiedades', editando.id);
                  setEditando(null);
                }
              : undefined
          }
        />
      )}
    </>
  );
}

function FormularioPropiedad({
  propiedad,
  propietarios,
  onGuardar,
  onCerrar,
  onEliminar,
}: {
  propiedad: Propiedad;
  propietarios: { id: string; nombre: string }[];
  onGuardar: (p: Propiedad) => void;
  onCerrar: () => void;
  onEliminar?: () => void;
}) {
  const [f, setF] = useState<Propiedad>(propiedad);
  const set = <K extends keyof Propiedad>(k: K, v: Propiedad[K]) => setF((x) => ({ ...x, [k]: v }));
  const valido = f.codigo.trim() && f.calle.trim() && f.propietarioId;

  return (
    <Modal
      titulo={propiedad.codigo ? `Editar ${propiedad.codigo}` : 'Nueva propiedad'}
      onCerrar={onCerrar}
      ancho
      pie={
        <>
          {onEliminar && (
            <button className="btn btn--peligro" onClick={onEliminar} style={{ marginRight: 'auto' }}>
              Eliminar
            </button>
          )}
          <button className="btn" onClick={onCerrar}>Cancelar</button>
          <button className="btn btn--primario" disabled={!valido} onClick={() => onGuardar(f)}>
            Guardar
          </button>
        </>
      }
    >
      <div className="grid grid--form">
        <Campo etiqueta="Código">
          <input value={f.codigo} onChange={(e) => set('codigo', e.target.value)} placeholder="PA-009" />
        </Campo>
        <Campo etiqueta="Tipo">
          <select value={f.tipo} onChange={(e) => set('tipo', e.target.value as TipoPropiedad)}>
            {TIPOS.map((t) => (
              <option key={t} value={t}>{t.replace('_', ' ')}</option>
            ))}
          </select>
        </Campo>
        <Campo etiqueta="Propietario">
          <select value={f.propietarioId} onChange={(e) => set('propietarioId', e.target.value)}>
            <option value="">Seleccionar…</option>
            {propietarios.map((p) => (
              <option key={p.id} value={p.id}>{p.nombre}</option>
            ))}
          </select>
        </Campo>
        <Campo etiqueta="Estado">
          <select value={f.estado} onChange={(e) => set('estado', e.target.value as EstadoPropiedad)}>
            {ESTADOS.map((e) => (
              <option key={e} value={e}>{ETIQUETA_ESTADO_PROPIEDAD[e]}</option>
            ))}
          </select>
        </Campo>
      </div>

      <Campo etiqueta="Título de la publicación">
        <input value={f.titulo} onChange={(e) => set('titulo', e.target.value)} placeholder="Depto 2 amb. con balcón — Palermo" />
      </Campo>

      <div className="grid grid--form">
        <Campo etiqueta="Calle">
          <input value={f.calle} onChange={(e) => set('calle', e.target.value)} />
        </Campo>
        <Campo etiqueta="Número">
          <input value={f.numero} onChange={(e) => set('numero', e.target.value)} />
        </Campo>
        <Campo etiqueta="Piso">
          <input value={f.piso ?? ''} onChange={(e) => set('piso', e.target.value)} />
        </Campo>
        <Campo etiqueta="Depto">
          <input value={f.depto ?? ''} onChange={(e) => set('depto', e.target.value)} />
        </Campo>
        <Campo etiqueta="Localidad">
          <input value={f.localidad} onChange={(e) => set('localidad', e.target.value)} />
        </Campo>
        <Campo etiqueta="Provincia">
          <input value={f.provincia} onChange={(e) => set('provincia', e.target.value)} />
        </Campo>
      </div>

      <div className="grid grid--form">
        <Campo etiqueta="Ambientes">
          <input className="entrada-num" type="number" value={f.ambientes ?? ''} onChange={(e) => set('ambientes', Number(e.target.value) || undefined)} />
        </Campo>
        <Campo etiqueta="Dormitorios">
          <input className="entrada-num" type="number" value={f.dormitorios ?? ''} onChange={(e) => set('dormitorios', Number(e.target.value) || undefined)} />
        </Campo>
        <Campo etiqueta="m² cubiertos">
          <input className="entrada-num" type="number" value={f.m2Cubiertos ?? ''} onChange={(e) => set('m2Cubiertos', Number(e.target.value) || undefined)} />
        </Campo>
        <Campo etiqueta="Expensas estimadas">
          <input className="entrada-num" type="number" value={f.expensasEstimadas ?? ''} onChange={(e) => set('expensasEstimadas', Number(e.target.value) || undefined)} />
        </Campo>
      </div>

      <div className="grid grid--form">
        <Campo etiqueta="Destino">
          <select value={f.destino} onChange={(e) => set('destino', e.target.value as DestinoPropiedad)}>
            <option value="alquiler">Alquiler</option>
            <option value="venta">Venta</option>
            <option value="ambos">Alquiler y venta</option>
          </select>
        </Campo>
        <Campo etiqueta="Alquiler mensual (ARS)">
          <input
            className="entrada-num"
            type="number"
            value={f.precioAlquiler?.monto ?? ''}
            onChange={(e) =>
              set('precioAlquiler', e.target.value ? { monto: Number(e.target.value), moneda: 'ARS' } : undefined)
            }
          />
        </Campo>
        <Campo etiqueta="Precio de venta (USD)">
          <input
            className="entrada-num"
            type="number"
            value={f.precioVenta?.monto ?? ''}
            onChange={(e) =>
              set('precioVenta', e.target.value ? { monto: Number(e.target.value), moneda: 'USD' } : undefined)
            }
          />
        </Campo>
        <Campo etiqueta="Partida inmobiliaria">
          <input value={f.partidaInmobiliaria ?? ''} onChange={(e) => set('partidaInmobiliaria', e.target.value)} />
        </Campo>
      </div>

      <Campo etiqueta="Notas">
        <textarea value={f.notas ?? ''} onChange={(e) => set('notas', e.target.value)} />
      </Campo>
    </Modal>
  );
}

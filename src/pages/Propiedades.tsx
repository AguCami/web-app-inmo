import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Encabezado } from '../components/Encabezado';
import { Avatar, Campo, Modal, Nota, Pastilla, Segmentos, Vacio } from '../components/ui';
import { ConfirmarBorrado } from '../components/Confirmar';
import { IconoBuscar, IconoMas, IconoPropiedades } from '../components/iconos';
import { useApp, useDb } from '../data/store';
import { montoVigente } from '../domain/contratos';
import { direccionDe } from '../domain/propiedades';
import type { EstadoPropiedad, Propiedad, TipoPropiedad } from '../domain/types';
import { formatearMoneda, incluyeTexto, nuevoId, periodoActual } from '../domain/util';

const TIPOS: TipoPropiedad[] = ['departamento', 'casa', 'ph', 'local', 'oficina', 'galpon', 'cochera'];

export const NOMBRE_TIPO: Record<TipoPropiedad, string> = {
  departamento: 'Departamento',
  casa: 'Casa',
  ph: 'PH',
  local: 'Local',
  oficina: 'Oficina',
  galpon: 'Galpón',
  cochera: 'Cochera',
};

const TEXTO_ESTADO: Record<EstadoPropiedad, string> = {
  alquilada: 'Alquilada',
  disponible: 'Disponible',
  fuera_de_servicio: 'Fuera de servicio',
};

const TONO_ESTADO: Record<EstadoPropiedad, 'ok' | 'alerta' | 'neutro'> = {
  alquilada: 'ok',
  disponible: 'alerta',
  fuera_de_servicio: 'neutro',
};

function propiedadNueva(): Propiedad {
  return {
    id: nuevoId('p'),
    codigo: '',
    tipo: 'departamento',
    propietarioId: '',
    calle: '',
    numero: '',
    barrio: '',
    cochera: false,
    estado: 'disponible',
  };
}

export default function Propiedades() {
  const db = useDb();
  const navegar = useNavigate();
  const guardar = useApp((e) => e.guardarPropiedad);
  const eliminar = useApp((e) => e.eliminar);

  const [busqueda, setBusqueda] = useState('');
  const [filtro, setFiltro] = useState<'todas' | EstadoPropiedad>('todas');
  const [editando, setEditando] = useState<Propiedad | null>(null);
  const [aBorrar, setABorrar] = useState<Propiedad | null>(null);

  const nombreDe = (id: string) => db.personas.find((p) => p.id === id)?.nombre ?? '—';
  const contratoDe = (propiedadId: string) =>
    db.contratos.find((c) => c.propiedadId === propiedadId && c.estado === 'activo');

  const lista = useMemo(
    () =>
      db.propiedades
        .filter((p) => filtro === 'todas' || p.estado === filtro)
        .filter((p) => incluyeTexto([p.codigo, p.calle, p.barrio, nombreDe(p.propietarioId)], busqueda))
        .sort((a, b) => a.codigo.localeCompare(b.codigo)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [db.propiedades, db.personas, filtro, busqueda],
  );

  const alquiladas = db.propiedades.filter((p) => p.estado === 'alquilada').length;
  const libres = db.propiedades.filter((p) => p.estado === 'disponible').length;

  return (
    <>
      <Encabezado
        titulo="Propiedades"
        bajada={`${alquiladas} alquiladas · ${libres} sin alquilar`}
      >
        <button className="btn btn--primario no-imprimir" onClick={() => setEditando(propiedadNueva())}>
          <IconoMas tam={17} />
          Nueva propiedad
        </button>
      </Encabezado>

      <div className="contenido">
        <div className="fila no-imprimir">
          <Segmentos
            etiqueta="Filtrar propiedades"
            valor={filtro}
            onCambio={setFiltro}
            opciones={[
              { id: 'todas', texto: `Todas (${db.propiedades.length})` },
              { id: 'alquilada', texto: `Alquiladas (${alquiladas})` },
              { id: 'disponible', texto: `Libres (${libres})` },
            ]}
          />
          <div className="buscador">
            <IconoBuscar tam={17} />
            <input
              type="search"
              placeholder="Buscar por código, calle, barrio o propietario"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              aria-label="Buscar propiedades"
            />
          </div>
        </div>

        {lista.length === 0 ? (
          <div className="panel">
            <Vacio
              icono={<IconoPropiedades tam={24} />}
              titulo="No hay propiedades"
              detalle="Cargá la primera para poder armar un contrato."
            />
          </div>
        ) : (
          <div className="grid grid--cartas">
            {lista.map((p) => {
              const contrato = contratoDe(p.id);
              const rasgos = [
                p.ambientes ? `${p.ambientes} amb.` : null,
                p.dormitorios ? `${p.dormitorios} dorm.` : null,
                p.m2 ? `${p.m2} m²` : null,
                p.cochera ? 'cochera' : null,
              ].filter(Boolean) as string[];

              return (
                <button key={p.id} className="carta" onClick={() => setEditando(p)}>
                  <div className="carta__cab">
                    <Avatar nombre={p.codigo} />
                    <div className="crece">
                      <div className="carta__titulo">{direccionDe(p)}</div>
                      <div className="carta__sub">
                        {p.codigo} · {NOMBRE_TIPO[p.tipo]} · {p.barrio}
                      </div>
                    </div>
                  </div>

                  <div className="carta__rasgos">
                    <Pastilla tono={TONO_ESTADO[p.estado]}>{TEXTO_ESTADO[p.estado]}</Pastilla>
                    {rasgos.map((r) => (
                      <span className="rasgo" key={r}>{r}</span>
                    ))}
                  </div>

                  <div className="carta__pie">
                    <div className="carta__monto">
                      {contrato
                        ? formatearMoneda(montoVigente(contrato, periodoActual(), db.indices), contrato.moneda)
                        : p.alquilerSugerido
                          ? formatearMoneda(p.alquilerSugerido)
                          : '—'}
                      <small>{contrato ? 'alquiler vigente' : 'valor sugerido'}</small>
                    </div>
                    <div className="mini tenue" style={{ textAlign: 'right' }}>
                      {nombreDe(p.propietarioId)}
                      <br />
                      <span>propietario</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {editando && (
        <FormularioPropiedad
          propiedad={editando}
          contratoActivoId={contratoDe(editando.id)?.id}
          onVerContrato={(id) => navegar(`/contratos/${id}`)}
          onCerrar={() => setEditando(null)}
          onGuardar={(p) => {
            guardar(p);
            setEditando(null);
          }}
          onEliminar={
            db.propiedades.some((p) => p.id === editando.id)
              ? () => {
                  setABorrar(editando);
                  setEditando(null);
                }
              : undefined
          }
        />
      )}

      {aBorrar && (
        <ConfirmarBorrado
          coleccion="propiedades"
          id={aBorrar.id}
          nombre={`${aBorrar.codigo} · ${direccionDe(aBorrar)}`}
          queEs="la propiedad"
          onConfirmar={() => eliminar('propiedades', aBorrar.id)}
          onCerrar={() => setABorrar(null)}
        />
      )}
    </>
  );
}

function FormularioPropiedad({
  propiedad,
  contratoActivoId,
  onVerContrato,
  onGuardar,
  onCerrar,
  onEliminar,
}: {
  propiedad: Propiedad;
  contratoActivoId?: string;
  onVerContrato: (id: string) => void;
  onGuardar: (p: Propiedad) => void;
  onCerrar: () => void;
  onEliminar?: () => void;
}) {
  const db = useDb();
  const [f, setF] = useState<Propiedad>(propiedad);
  const set = <K extends keyof Propiedad>(k: K, v: Propiedad[K]) => setF((x) => ({ ...x, [k]: v }));
  const propietarios = db.personas.filter((p) => p.roles.includes('propietario'));
  const valido = f.codigo.trim() && f.calle.trim() && f.propietarioId;

  return (
    <Modal
      titulo={propiedad.codigo ? `${propiedad.codigo} · ${direccionDe(propiedad)}` : 'Nueva propiedad'}
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
      {contratoActivoId && (
        <Nota titulo="Esta unidad está alquilada">
          <button
            className="btn btn--suave btn--chico"
            style={{ marginTop: 8 }}
            onClick={() => onVerContrato(contratoActivoId)}
          >
            Ver el contrato
          </button>
        </Nota>
      )}

      <div className="grid grid--form">
        <Campo etiqueta="Código">
          <input value={f.codigo} onChange={(e) => set('codigo', e.target.value)} placeholder="NC-15" />
        </Campo>
        <Campo etiqueta="Tipo">
          <select value={f.tipo} onChange={(e) => set('tipo', e.target.value as TipoPropiedad)}>
            {TIPOS.map((t) => (
              <option key={t} value={t}>{NOMBRE_TIPO[t]}</option>
            ))}
          </select>
        </Campo>
        <Campo etiqueta="Propietario">
          <select value={f.propietarioId} onChange={(e) => set('propietarioId', e.target.value)}>
            <option value="">Elegir…</option>
            {propietarios.map((p) => (
              <option key={p.id} value={p.id}>{p.nombre}</option>
            ))}
          </select>
        </Campo>
        <Campo etiqueta="Estado">
          <select value={f.estado} onChange={(e) => set('estado', e.target.value as EstadoPropiedad)}>
            <option value="disponible">Disponible</option>
            <option value="alquilada">Alquilada</option>
            <option value="fuera_de_servicio">Fuera de servicio</option>
          </select>
        </Campo>
      </div>

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
        <Campo etiqueta="Barrio">
          <input value={f.barrio} onChange={(e) => set('barrio', e.target.value)} />
        </Campo>
      </div>

      <div className="grid grid--form">
        <Campo etiqueta="Ambientes">
          <input
            className="entrada-num"
            type="number"
            value={f.ambientes ?? ''}
            onChange={(e) => set('ambientes', Number(e.target.value) || undefined)}
          />
        </Campo>
        <Campo etiqueta="Dormitorios">
          <input
            className="entrada-num"
            type="number"
            value={f.dormitorios ?? ''}
            onChange={(e) => set('dormitorios', Number(e.target.value) || undefined)}
          />
        </Campo>
        <Campo etiqueta="Baños">
          <input
            className="entrada-num"
            type="number"
            value={f.banos ?? ''}
            onChange={(e) => set('banos', Number(e.target.value) || undefined)}
          />
        </Campo>
        <Campo etiqueta="Metros cuadrados">
          <input
            className="entrada-num"
            type="number"
            value={f.m2 ?? ''}
            onChange={(e) => set('m2', Number(e.target.value) || undefined)}
          />
        </Campo>
        <Campo etiqueta="Expensas">
          <input
            className="entrada-num"
            type="number"
            value={f.expensas ?? ''}
            onChange={(e) => set('expensas', Number(e.target.value) || undefined)}
          />
        </Campo>
        <Campo etiqueta="Alquiler sugerido" ayuda="Para cuando quede libre.">
          <input
            className="entrada-num"
            type="number"
            value={f.alquilerSugerido ?? ''}
            onChange={(e) => set('alquilerSugerido', Number(e.target.value) || undefined)}
          />
        </Campo>
      </div>

      <label className="fila" style={{ gap: 8 }}>
        <input type="checkbox" checked={f.cochera} onChange={(e) => set('cochera', e.target.checked)} />
        Tiene cochera
      </label>

      <Campo etiqueta="Notas">
        <textarea value={f.notas ?? ''} onChange={(e) => set('notas', e.target.value)} />
      </Campo>
    </Modal>
  );
}

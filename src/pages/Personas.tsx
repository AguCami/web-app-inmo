import { useMemo, useState } from 'react';
import { Encabezado } from '../components/Encabezado';
import { Campo, Chip, Modal, Paginador, Tabla, Tarjeta, usePaginado, Vacio } from '../components/ui';
import { useApp, useDb } from '../data/store';
import type { CondicionIVA, Persona, RolPersona } from '../domain/types';
import { incluyeTexto, nuevoId } from '../domain/util';

const ROLES: RolPersona[] = ['propietario', 'inquilino', 'comprador', 'garante', 'agente', 'proveedor'];

export const ETIQUETA_ROL: Record<RolPersona, string> = {
  propietario: 'Propietario',
  inquilino: 'Inquilino',
  comprador: 'Comprador',
  garante: 'Garante',
  agente: 'Agente',
  proveedor: 'Proveedor',
};

export const ETIQUETA_IVA: Record<CondicionIVA, string> = {
  responsable_inscripto: 'Responsable inscripto',
  monotributo: 'Monotributo',
  exento: 'Exento',
  consumidor_final: 'Consumidor final',
};

function personaNueva(): Persona {
  return {
    id: nuevoId('per'),
    nombre: '',
    roles: ['inquilino'],
    tipoDoc: 'DNI',
    documento: '',
    condicionIVA: 'consumidor_final',
    activo: true,
  };
}

export default function Personas() {
  const db = useDb();
  const guardar = useApp((e) => e.guardarPersona);
  const eliminar = useApp((e) => e.eliminar);

  const [busqueda, setBusqueda] = useState('');
  const [filtroRol, setFiltroRol] = useState<RolPersona | 'todos'>('todos');
  const [editando, setEditando] = useState<Persona | null>(null);

  const filtradas = useMemo(
    () =>
      db.personas
        .filter((p) => filtroRol === 'todos' || p.roles.includes(filtroRol))
        .filter((p) => incluyeTexto([p.nombre, p.documento, p.email, p.telefono], busqueda))
        .sort((a, b) => a.nombre.localeCompare(b.nombre)),
    [db.personas, filtroRol, busqueda],
  );

  const pag = usePaginado(filtradas, 40);

  /** Cuántas propiedades o contratos tiene atrás cada persona. */
  const vinculos = (p: Persona) => {
    const props = db.propiedades.filter((x) => x.propietarioId === p.id).length;
    const contratos = db.contratos.filter((x) => x.inquilinoId === p.id).length;
    const ops = db.operaciones.filter((x) => x.compradorId === p.id || x.vendedorId === p.id).length;
    const partes: string[] = [];
    if (props) partes.push(`${props} propiedad${props > 1 ? 'es' : ''}`);
    if (contratos) partes.push(`${contratos} contrato${contratos > 1 ? 's' : ''}`);
    if (ops) partes.push(`${ops} operación${ops > 1 ? 'es' : ''}`);
    return partes.join(' · ') || '—';
  };

  return (
    <>
      <Encabezado titulo="Personas" bajada="Propietarios, inquilinos, compradores, agentes y proveedores">
        <button className="btn btn--primario no-imprimir" onClick={() => setEditando(personaNueva())}>
          + Nueva persona
        </button>
      </Encabezado>

      <div className="contenido pila">
        <div className="fila no-imprimir">
          <div className="buscador">
            <input
              type="search"
              placeholder="Buscar por nombre, documento o contacto"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              aria-label="Buscar personas"
            />
          </div>
          <select
            value={filtroRol}
            onChange={(e) => setFiltroRol(e.target.value as RolPersona | 'todos')}
            style={{ width: 'auto' }}
            aria-label="Filtrar por rol"
          >
            <option value="todos">Todos los roles</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>{ETIQUETA_ROL[r]}</option>
            ))}
          </select>
        </div>

        <Tarjeta ajustado>
          {filtradas.length === 0 ? (
            <Vacio icono="👤" titulo="No hay personas cargadas" detalle="Cargá propietarios e inquilinos para poder armar contratos." />
          ) : (
            <Tabla>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Roles</th>
                  <th>Documento</th>
                  <th>Contacto</th>
                  <th>Condición IVA</th>
                  <th>Vínculos</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {pag.visibles.map((p) => (
                  <tr key={p.id}>
                    <td className="principal-celda">
                      {p.nombre}
                      {!p.activo && <span className="tabla__sub">inactivo</span>}
                    </td>
                    <td>
                      <span className="fila" style={{ gap: 4 }}>
                        {p.roles.map((r) => (
                          <Chip key={r} tono={r === 'agente' ? 'info' : 'neutro'}>{ETIQUETA_ROL[r]}</Chip>
                        ))}
                      </span>
                    </td>
                    <td className="num">
                      {p.tipoDoc} {p.documento}
                    </td>
                    <td>
                      {p.email ?? '—'}
                      {p.telefono && <span className="tabla__sub">{p.telefono}</span>}
                    </td>
                    <td>{ETIQUETA_IVA[p.condicionIVA]}</td>
                    <td className="tenue mini">{vinculos(p)}</td>
                    <td className="num no-imprimir">
                      <button className="btn btn--chico btn--fantasma" onClick={() => setEditando(p)}>Editar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Tabla>
          )}
          <Paginador
            pagina={pag.pagina}
            paginas={pag.paginas}
            desde={pag.desde}
            hasta={pag.hasta}
            total={pag.total}
            etiqueta="personas"
            onCambio={pag.setPagina}
          />
        </Tarjeta>
      </div>

      {editando && (
        <FormularioPersona
          persona={editando}
          onCerrar={() => setEditando(null)}
          onGuardar={(p) => {
            guardar(p);
            setEditando(null);
          }}
          onEliminar={
            db.personas.some((p) => p.id === editando.id)
              ? () => {
                  eliminar('personas', editando.id);
                  setEditando(null);
                }
              : undefined
          }
        />
      )}
    </>
  );
}

function FormularioPersona({
  persona,
  onGuardar,
  onCerrar,
  onEliminar,
}: {
  persona: Persona;
  onGuardar: (p: Persona) => void;
  onCerrar: () => void;
  onEliminar?: () => void;
}) {
  const [f, setF] = useState<Persona>(persona);
  const set = <K extends keyof Persona>(k: K, v: Persona[K]) => setF((x) => ({ ...x, [k]: v }));

  const alternarRol = (rol: RolPersona) =>
    set('roles', f.roles.includes(rol) ? f.roles.filter((r) => r !== rol) : [...f.roles, rol]);

  return (
    <Modal
      titulo={persona.nombre || 'Nueva persona'}
      onCerrar={onCerrar}
      pie={
        <>
          {onEliminar && (
            <button className="btn btn--peligro" onClick={onEliminar} style={{ marginRight: 'auto' }}>Eliminar</button>
          )}
          <button className="btn" onClick={onCerrar}>Cancelar</button>
          <button
            className="btn btn--primario"
            disabled={!f.nombre.trim() || f.roles.length === 0}
            onClick={() => onGuardar(f)}
          >
            Guardar
          </button>
        </>
      }
    >
      <Campo etiqueta="Nombre o razón social">
        <input value={f.nombre} onChange={(e) => set('nombre', e.target.value)} />
      </Campo>

      <Campo etiqueta="Roles" ayuda="Una misma persona puede ser propietario e inquilino a la vez.">
        <div className="fila">
          {ROLES.map((r) => (
            <label key={r} className="chip" style={{ cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={f.roles.includes(r)}
                onChange={() => alternarRol(r)}
                style={{ marginRight: 4 }}
              />
              {ETIQUETA_ROL[r]}
            </label>
          ))}
        </div>
      </Campo>

      <div className="grid grid--form">
        <Campo etiqueta="Tipo de documento">
          <select value={f.tipoDoc} onChange={(e) => set('tipoDoc', e.target.value as Persona['tipoDoc'])}>
            <option value="DNI">DNI</option>
            <option value="CUIT">CUIT</option>
            <option value="CUIL">CUIL</option>
            <option value="PAS">Pasaporte</option>
          </select>
        </Campo>
        <Campo etiqueta="Número">
          <input value={f.documento} onChange={(e) => set('documento', e.target.value)} />
        </Campo>
        <Campo etiqueta="Condición frente al IVA">
          <select value={f.condicionIVA} onChange={(e) => set('condicionIVA', e.target.value as CondicionIVA)}>
            {(Object.keys(ETIQUETA_IVA) as CondicionIVA[]).map((c) => (
              <option key={c} value={c}>{ETIQUETA_IVA[c]}</option>
            ))}
          </select>
        </Campo>
        <Campo etiqueta="Teléfono">
          <input value={f.telefono ?? ''} onChange={(e) => set('telefono', e.target.value)} />
        </Campo>
        <Campo etiqueta="Email">
          <input type="email" value={f.email ?? ''} onChange={(e) => set('email', e.target.value)} />
        </Campo>
        <Campo etiqueta="CBU / CVU" ayuda="Se usa para pagar las liquidaciones.">
          <input value={f.cbu ?? ''} onChange={(e) => set('cbu', e.target.value)} />
        </Campo>
      </div>

      <Campo etiqueta="Domicilio">
        <input value={f.domicilio ?? ''} onChange={(e) => set('domicilio', e.target.value)} />
      </Campo>

      {f.roles.includes('agente') && (
        <Campo etiqueta="% de comisión del agente" ayuda="Parte de los honorarios de venta que le corresponde por defecto.">
          <input
            className="entrada-num"
            type="number"
            value={f.comisionAgentePct ?? 30}
            onChange={(e) => set('comisionAgentePct', Number(e.target.value))}
          />
        </Campo>
      )}

      <label className="fila" style={{ gap: 6 }}>
        <input type="checkbox" checked={f.activo} onChange={(e) => set('activo', e.target.checked)} />
        Activo
      </label>
    </Modal>
  );
}

import { useMemo, useState } from 'react';
import { Encabezado } from '../components/Encabezado';
import { Avatar, Campo, Item, Modal, Paginador, Panel, Pastilla, Segmentos, usePaginado, Vacio } from '../components/ui';
import { IconoBuscar, IconoMas, IconoPersonas } from '../components/iconos';
import { ConfirmarBorrado } from '../components/Confirmar';
import { useApp, useDb } from '../data/store';
import type { CondicionIVA, Persona, RolPersona } from '../domain/types';
import { incluyeTexto, nuevoId, plural } from '../domain/util';

const ROLES: RolPersona[] = ['propietario', 'inquilino', 'garante'];

export const NOMBRE_ROL: Record<RolPersona, string> = {
  propietario: 'Propietario',
  inquilino: 'Inquilino',
  garante: 'Garante',
};

export const NOMBRE_IVA: Record<CondicionIVA, string> = {
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
  const [filtro, setFiltro] = useState<'todos' | RolPersona>('todos');
  const [editando, setEditando] = useState<Persona | null>(null);
  const [aBorrar, setABorrar] = useState<Persona | null>(null);

  const lista = useMemo(
    () =>
      db.personas
        .filter((p) => filtro === 'todos' || p.roles.includes(filtro))
        .filter((p) => incluyeTexto([p.nombre, p.documento, p.email, p.telefono], busqueda))
        .sort((a, b) => a.nombre.localeCompare(b.nombre)),
    [db.personas, filtro, busqueda],
  );
  const pag = usePaginado(lista, 30);

  /** Qué tiene atrás cada persona, para no borrar algo que está en uso. */
  const vinculos = (p: Persona) => {
    const props = db.propiedades.filter((x) => x.propietarioId === p.id).length;
    const contratos = db.contratos.filter((x) => x.inquilinoId === p.id).length;
    const partes: string[] = [];
    if (props) partes.push(plural(props, 'propiedad', 'propiedades'));
    if (contratos) partes.push(plural(contratos, 'contrato', 'contratos'));
    return partes.join(' · ');
  };

  const cuenta = (rol: RolPersona) => db.personas.filter((p) => p.roles.includes(rol)).length;

  return (
    <>
      <Encabezado titulo="Personas" bajada="Propietarios, inquilinos y garantes">
        <button className="btn btn--primario no-imprimir" onClick={() => setEditando(personaNueva())}>
          <IconoMas tam={17} />
          Nueva persona
        </button>
      </Encabezado>

      <div className="contenido">
        <div className="fila no-imprimir">
          <Segmentos
            etiqueta="Filtrar personas"
            valor={filtro}
            onCambio={setFiltro}
            opciones={[
              { id: 'todos', texto: `Todas (${db.personas.length})` },
              { id: 'propietario', texto: `Propietarios (${cuenta('propietario')})` },
              { id: 'inquilino', texto: `Inquilinos (${cuenta('inquilino')})` },
            ]}
          />
          <div className="buscador">
            <IconoBuscar tam={17} />
            <input
              type="search"
              placeholder="Buscar por nombre, documento o contacto"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              aria-label="Buscar personas"
            />
          </div>
        </div>

        <Panel comoLista>
          {lista.length === 0 ? (
            <Vacio
              icono={<IconoPersonas tam={24} />}
              titulo="No hay personas cargadas"
              detalle="Cargá propietarios e inquilinos para poder armar contratos."
            />
          ) : (
            <>
              {pag.visibles.map((p) => (
                <Item
                  key={p.id}
                  onClick={() => setEditando(p)}
                  avatar={<Avatar nombre={p.nombre} />}
                  titulo={
                    <>
                      {p.nombre}
                      {p.roles.map((r) => (
                        <Pastilla key={r} tono={r === 'propietario' ? 'acento' : 'neutro'}>
                          {NOMBRE_ROL[r]}
                        </Pastilla>
                      ))}
                    </>
                  }
                  sub={
                    <>
                      {p.tipoDoc} {p.documento}
                      {p.telefono && ` · ${p.telefono}`}
                      {p.email && ` · ${p.email}`}
                    </>
                  }
                  fin={<span className="mini tenue">{vinculos(p)}</span>}
                />
              ))}
              <Paginador
                pagina={pag.pagina}
                paginas={pag.paginas}
                desde={pag.desde}
                hasta={pag.hasta}
                total={pag.total}
                etiqueta="personas"
                onCambio={pag.setPagina}
              />
            </>
          )}
        </Panel>
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
            db.personas.some((p) => p.id === editando.id) && !vinculos(editando)
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
          coleccion="personas"
          id={aBorrar.id}
          nombre={aBorrar.nombre}
          queEs="la persona"
          onConfirmar={() => eliminar('personas', aBorrar.id)}
          onCerrar={() => setABorrar(null)}
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
            <button className="btn btn--peligro" onClick={onEliminar} style={{ marginRight: 'auto' }}>
              Eliminar
            </button>
          )}
          <button className="btn btn--fantasma" onClick={onCerrar}>Cancelar</button>
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

      <Campo etiqueta="Qué es" ayuda="Una misma persona puede ser propietaria de una unidad e inquilina de otra.">
        <div className="fila" style={{ gap: 8 }}>
          {ROLES.map((r) => (
            <label key={r} className="pastilla" style={{ cursor: 'pointer', gap: 7, padding: '6px 12px' }}>
              <input type="checkbox" checked={f.roles.includes(r)} onChange={() => alternarRol(r)} />
              {NOMBRE_ROL[r]}
            </label>
          ))}
        </div>
      </Campo>

      <div className="grid grid--form">
        <Campo etiqueta="Documento">
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
        <Campo etiqueta="Teléfono">
          <input value={f.telefono ?? ''} onChange={(e) => set('telefono', e.target.value)} />
        </Campo>
        <Campo etiqueta="Email">
          <input type="email" value={f.email ?? ''} onChange={(e) => set('email', e.target.value)} />
        </Campo>
        <Campo etiqueta="Condición frente al IVA">
          <select value={f.condicionIVA} onChange={(e) => set('condicionIVA', e.target.value as CondicionIVA)}>
            {(Object.keys(NOMBRE_IVA) as CondicionIVA[]).map((c) => (
              <option key={c} value={c}>{NOMBRE_IVA[c]}</option>
            ))}
          </select>
        </Campo>
        <Campo etiqueta="CBU o alias" ayuda="Para transferirle la liquidación.">
          <input value={f.cbu ?? ''} onChange={(e) => set('cbu', e.target.value)} />
        </Campo>
      </div>

      <Campo etiqueta="Domicilio">
        <input value={f.domicilio ?? ''} onChange={(e) => set('domicilio', e.target.value)} />
      </Campo>

      <label className="fila" style={{ gap: 8 }}>
        <input type="checkbox" checked={f.activo} onChange={(e) => set('activo', e.target.checked)} />
        Activa
      </label>
    </Modal>
  );
}

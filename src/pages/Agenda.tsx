import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Encabezado } from '../components/Encabezado';
import { Campo, Chip, Kpi, Modal, Tabla, Tarjeta, Vacio, type TonoChip } from '../components/ui';
import { useApp, useDb } from '../data/store';
import { proximoAjuste, vigenciaContrato } from '../domain/contratos';
import type { Tarea, TipoTarea } from '../domain/types';
import { formatearFecha, formatearPeriodo, hoy, nuevoId } from '../domain/util';

const TIPOS: TipoTarea[] = ['visita', 'vencimiento', 'cobranza', 'firma', 'mantenimiento', 'otro'];

const ETIQUETA_TIPO: Record<TipoTarea, string> = {
  visita: 'Visita',
  vencimiento: 'Vencimiento',
  cobranza: 'Cobranza',
  firma: 'Firma',
  mantenimiento: 'Mantenimiento',
  otro: 'Otro',
};

const TONO_TIPO: Record<TipoTarea, TonoChip> = {
  visita: 'info',
  vencimiento: 'alerta',
  cobranza: 'critico',
  firma: 'ok',
  mantenimiento: 'serio',
  otro: 'neutro',
};

export default function Agenda() {
  const db = useDb();
  const guardar = useApp((e) => e.guardarTarea);
  const alternar = useApp((e) => e.alternarTarea);
  const eliminar = useApp((e) => e.eliminar);

  const [verCompletadas, setVerCompletadas] = useState(false);
  const [editando, setEditando] = useState<Tarea | null>(null);

  const tareas = useMemo(
    () =>
      db.tareas
        .filter((t) => verCompletadas || !t.completada)
        .sort((a, b) => a.fecha.localeCompare(b.fecha)),
    [db.tareas, verCompletadas],
  );

  /** Vencimientos que salen solos de los datos: no hay que cargarlos a mano. */
  const automaticos = useMemo(() => {
    const items: { id: string; fecha: string; texto: string; enlace?: string; tono: TonoChip }[] = [];
    for (const c of db.contratos) {
      if (c.estado !== 'activo') continue;
      if (vigenciaContrato(c) === 'por_vencer') {
        items.push({
          id: `fin_${c.id}`,
          fecha: c.fechaFin,
          texto: `Vence el contrato ${c.numero}`,
          enlace: `/contratos/${c.id}`,
          tono: 'alerta',
        });
      }
      const aj = proximoAjuste(c, db.indices);
      if (aj && aj.diasRestantes <= 60) {
        items.push({
          id: `aj_${c.id}`,
          fecha: `${aj.periodo}-01`,
          texto: `Ajuste de ${c.numero} desde ${formatearPeriodo(aj.periodo, true)} (+${aj.variacionPct.toFixed(1).replace('.', ',')} %)`,
          enlace: `/contratos/${c.id}`,
          tono: 'info',
        });
      }
    }
    return items.sort((a, b) => a.fecha.localeCompare(b.fecha));
  }, [db.contratos, db.indices]);

  const atrasadas = db.tareas.filter((t) => !t.completada && t.fecha < hoy()).length;
  const deHoy = db.tareas.filter((t) => !t.completada && t.fecha === hoy()).length;

  return (
    <>
      <Encabezado titulo="Agenda" bajada="Visitas, firmas, reclamos y vencimientos">
        <button
          className="btn btn--primario no-imprimir"
          onClick={() =>
            setEditando({ id: nuevoId('tar'), titulo: '', tipo: 'visita', fecha: hoy(), completada: false })
          }
        >
          + Nueva tarea
        </button>
      </Encabezado>

      <div className="contenido pila">
        <div className="grid grid--kpis">
          <Kpi etiqueta="Atrasadas" valor={atrasadas} tono={atrasadas ? 'critico' : 'ok'} pie="vencieron sin completarse" />
          <Kpi etiqueta="Para hoy" valor={deHoy} tono={deHoy ? 'alerta' : 'ok'} pie={formatearFecha(hoy())} />
          <Kpi etiqueta="Vencimientos automáticos" valor={automaticos.length} pie="ajustes y fines de contrato" />
        </div>

        <div className="grid grid--2">
          <Tarjeta
            titulo="Tareas"
            acciones={
              <label className="fila mini no-imprimir" style={{ gap: 6 }}>
                <input type="checkbox" checked={verCompletadas} onChange={(e) => setVerCompletadas(e.target.checked)} />
                Ver completadas
              </label>
            }
            ajustado
          >
            {tareas.length === 0 ? (
              <Vacio icono="✅" titulo="Nada pendiente" />
            ) : (
              <Tabla compacta>
                <tbody>
                  {tareas.map((t) => (
                    <tr key={t.id}>
                      <td style={{ width: 28 }}>
                        <input
                          type="checkbox"
                          checked={t.completada}
                          onChange={() => alternar(t.id)}
                          aria-label={`Marcar «${t.titulo}»`}
                        />
                      </td>
                      <td>
                        <span style={{ textDecoration: t.completada ? 'line-through' : undefined }}>{t.titulo}</span>
                        <span className="tabla__sub">
                          {formatearFecha(t.fecha)}
                          {t.contratoId && (
                            <>
                              {' · '}
                              <Link to={`/contratos/${t.contratoId}`}>ver contrato</Link>
                            </>
                          )}
                        </span>
                      </td>
                      <td>
                        <Chip tono={TONO_TIPO[t.tipo]}>{ETIQUETA_TIPO[t.tipo]}</Chip>
                      </td>
                      <td className="num">
                        {!t.completada && t.fecha < hoy() && <Chip tono="critico">Atrasada</Chip>}
                      </td>
                      <td className="num no-imprimir">
                        <button className="btn btn--chico btn--fantasma" onClick={() => setEditando(t)}>Editar</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Tabla>
            )}
          </Tarjeta>

          <Tarjeta titulo="Vencimientos del sistema" subtitulo="Salen de los contratos: no hace falta cargarlos" ajustado>
            {automaticos.length === 0 ? (
              <Vacio icono="📆" titulo="Sin vencimientos próximos" />
            ) : (
              <Tabla compacta>
                <tbody>
                  {automaticos.map((a) => (
                    <tr key={a.id}>
                      <td>
                        {a.enlace ? <Link to={a.enlace}>{a.texto}</Link> : a.texto}
                        <span className="tabla__sub">{formatearFecha(a.fecha)}</span>
                      </td>
                      <td className="num">
                        <Chip tono={a.tono}>{a.fecha < hoy() ? 'Vencido' : 'Próximo'}</Chip>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Tabla>
            )}
          </Tarjeta>
        </div>
      </div>

      {editando && (
        <FormularioTarea
          tarea={editando}
          onCerrar={() => setEditando(null)}
          onGuardar={(t) => { guardar(t); setEditando(null); }}
          onEliminar={
            db.tareas.some((t) => t.id === editando.id)
              ? () => { eliminar('tareas', editando.id); setEditando(null); }
              : undefined
          }
        />
      )}
    </>
  );
}

function FormularioTarea({
  tarea,
  onGuardar,
  onCerrar,
  onEliminar,
}: {
  tarea: Tarea;
  onGuardar: (t: Tarea) => void;
  onCerrar: () => void;
  onEliminar?: () => void;
}) {
  const db = useDb();
  const [f, setF] = useState<Tarea>(tarea);
  const set = <K extends keyof Tarea>(k: K, v: Tarea[K]) => setF((x) => ({ ...x, [k]: v }));

  return (
    <Modal
      titulo={tarea.titulo || 'Nueva tarea'}
      onCerrar={onCerrar}
      pie={
        <>
          {onEliminar && <button className="btn btn--peligro" onClick={onEliminar} style={{ marginRight: 'auto' }}>Eliminar</button>}
          <button className="btn" onClick={onCerrar}>Cancelar</button>
          <button className="btn btn--primario" disabled={!f.titulo.trim()} onClick={() => onGuardar(f)}>Guardar</button>
        </>
      }
    >
      <Campo etiqueta="Título">
        <input value={f.titulo} onChange={(e) => set('titulo', e.target.value)} />
      </Campo>
      <div className="grid grid--form">
        <Campo etiqueta="Tipo">
          <select value={f.tipo} onChange={(e) => set('tipo', e.target.value as TipoTarea)}>
            {TIPOS.map((t) => (
              <option key={t} value={t}>{ETIQUETA_TIPO[t]}</option>
            ))}
          </select>
        </Campo>
        <Campo etiqueta="Fecha">
          <input type="date" value={f.fecha} onChange={(e) => set('fecha', e.target.value)} />
        </Campo>
        <Campo etiqueta="Responsable">
          <select value={f.responsableId ?? ''} onChange={(e) => set('responsableId', e.target.value || undefined)}>
            <option value="">Sin asignar</option>
            {db.personas.filter((p) => p.roles.includes('agente')).map((p) => (
              <option key={p.id} value={p.id}>{p.nombre}</option>
            ))}
          </select>
        </Campo>
        <Campo etiqueta="Contrato relacionado">
          <select value={f.contratoId ?? ''} onChange={(e) => set('contratoId', e.target.value || undefined)}>
            <option value="">Ninguno</option>
            {db.contratos.map((c) => (
              <option key={c.id} value={c.id}>{c.numero}</option>
            ))}
          </select>
        </Campo>
      </div>
      <Campo etiqueta="Notas">
        <textarea value={f.notas ?? ''} onChange={(e) => set('notas', e.target.value)} />
      </Campo>
    </Modal>
  );
}

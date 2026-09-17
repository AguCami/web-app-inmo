import { useMemo, useState } from 'react';
import { Encabezado } from '../components/Encabezado';
import { Avatar, Campo, Dato, Item, Modal, Panel, Pastilla, Segmentos, Vacio } from '../components/ui';
import { IconoGastos, IconoMas } from '../components/iconos';
import { ConfirmarBorrado } from '../components/Confirmar';
import { useApp, useDb } from '../data/store';
import { direccionDe } from '../domain/propiedades';
import type { CategoriaGasto, Gasto } from '../domain/types';
import {
  formatearFecha,
  formatearMoneda,
  formatearPeriodo,
  hoy,
  nuevoId,
  periodoActual,
  plural,
  sumar,
  ultimosPeriodos,
} from '../domain/util';

const CATEGORIAS: CategoriaGasto[] = ['mantenimiento', 'expensas', 'impuestos', 'servicios', 'otros'];

const NOMBRE_CATEGORIA: Record<CategoriaGasto, string> = {
  mantenimiento: 'Mantenimiento',
  expensas: 'Expensas',
  impuestos: 'Impuestos',
  servicios: 'Servicios',
  otros: 'Otros',
};

function gastoNuevo(): Gasto {
  return {
    id: nuevoId('g'),
    fecha: hoy(),
    descripcion: '',
    categoria: 'mantenimiento',
    propiedadId: '',
    monto: 0,
    moneda: 'ARS',
    seLeDescuentaAlPropietario: true,
  };
}

export default function Gastos() {
  const db = useDb();
  const guardar = useApp((e) => e.guardarGasto);
  const eliminar = useApp((e) => e.eliminar);

  const [periodo, setPeriodo] = useState(periodoActual());
  const [filtro, setFiltro] = useState<'todos' | 'sin_rendir'>('todos');
  const [editando, setEditando] = useState<Gasto | null>(null);
  const [aBorrar, setABorrar] = useState<Gasto | null>(null);

  const propiedadDe = (id: string) => db.propiedades.find((p) => p.id === id);

  const lista = useMemo(
    () =>
      db.gastos
        .filter((g) => g.fecha.slice(0, 7) === periodo)
        .filter((g) => filtro === 'todos' || (!g.liquidacionId && g.seLeDescuentaAlPropietario))
        .sort((a, b) => b.fecha.localeCompare(a.fecha)),
    [db.gastos, periodo, filtro],
  );

  const delMes = db.gastos.filter((g) => g.fecha.slice(0, 7) === periodo);
  const sinRendir = delMes.filter((g) => g.seLeDescuentaAlPropietario && !g.liquidacionId);

  return (
    <>
      <Encabezado
        titulo="Gastos"
        bajada="Arreglos y servicios de las unidades, para descontarlos de la liquidación"
      >
        <select
          className="suelto no-imprimir"
          value={periodo}
          onChange={(e) => setPeriodo(e.target.value)}
          aria-label="Período"
        >
          {ultimosPeriodos(periodoActual(), 18)
            .reverse()
            .map((p) => (
              <option key={p} value={p}>{formatearPeriodo(p, true)}</option>
            ))}
        </select>
        <button className="btn btn--primario no-imprimir" onClick={() => setEditando(gastoNuevo())}>
          <IconoMas tam={17} />
          Nuevo gasto
        </button>
      </Encabezado>

      <div className="contenido">
        <div className="grid grid--resumen">
          <Dato
            etiqueta="Gastado en el mes"
            valor={formatearMoneda(sumar(delMes, (g) => g.monto))}
            pie={plural(delMes.length, 'comprobante', 'comprobantes')}
          />
          <Dato
            etiqueta="Falta descontar"
            valor={formatearMoneda(sumar(sinRendir, (g) => g.monto))}
            tono={sinRendir.length ? 'alerta' : 'ok'}
            pie={
              sinRendir.length
                ? 'entra en la próxima liquidación'
                : 'todo descontado a los propietarios'
            }
          />
        </div>

        <div className="fila no-imprimir">
          <Segmentos
            etiqueta="Filtrar gastos"
            valor={filtro}
            onCambio={setFiltro}
            opciones={[
              { id: 'todos', texto: `Todos (${delMes.length})` },
              { id: 'sin_rendir', texto: `Sin descontar (${sinRendir.length})` },
            ]}
          />
        </div>

        <Panel comoLista>
          {lista.length === 0 ? (
            <Vacio
              icono={<IconoGastos tam={24} />}
              titulo="Sin gastos en este mes"
              detalle="Cargá los arreglos para que se le descuenten al propietario."
            />
          ) : (
            lista.map((g) => {
              const prop = propiedadDe(g.propiedadId);
              return (
                <Item
                  key={g.id}
                  onClick={() => setEditando(g)}
                  avatar={<Avatar nombre={prop?.codigo ?? '??'} />}
                  titulo={
                    <>
                      {g.descripcion}
                      {g.liquidacionId ? (
                        <Pastilla tono="ok">Descontado</Pastilla>
                      ) : g.seLeDescuentaAlPropietario ? (
                        <Pastilla tono="alerta">A descontar</Pastilla>
                      ) : (
                        <Pastilla>Lo absorbés vos</Pastilla>
                      )}
                    </>
                  }
                  sub={
                    <>
                      {formatearFecha(g.fecha)} · {NOMBRE_CATEGORIA[g.categoria]} ·{' '}
                      {prop ? `${prop.codigo} ${direccionDe(prop)}` : 'sin propiedad'}
                    </>
                  }
                  monto={formatearMoneda(g.monto, g.moneda)}
                />
              );
            })
          )}
        </Panel>
      </div>

      {editando && (
        <FormularioGasto
          gasto={editando}
          onCerrar={() => setEditando(null)}
          onGuardar={(g) => {
            guardar(g);
            setEditando(null);
          }}
          onEliminar={
            db.gastos.some((g) => g.id === editando.id) && !editando.liquidacionId
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
          coleccion="gastos"
          id={aBorrar.id}
          nombre={aBorrar.descripcion}
          queEs="el gasto"
          onConfirmar={() => eliminar('gastos', aBorrar.id)}
          onCerrar={() => setABorrar(null)}
        />
      )}
    </>
  );
}

function FormularioGasto({
  gasto,
  onGuardar,
  onCerrar,
  onEliminar,
}: {
  gasto: Gasto;
  onGuardar: (g: Gasto) => void;
  onCerrar: () => void;
  onEliminar?: () => void;
}) {
  const db = useDb();
  const [f, setF] = useState<Gasto>(gasto);
  const set = <K extends keyof Gasto>(k: K, v: Gasto[K]) => setF((x) => ({ ...x, [k]: v }));
  const bloqueado = Boolean(gasto.liquidacionId);

  return (
    <Modal
      titulo={gasto.descripcion || 'Nuevo gasto'}
      subtitulo={bloqueado ? 'Ya se descontó en una liquidación, no se puede modificar.' : undefined}
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
            disabled={bloqueado || !f.descripcion.trim() || f.monto <= 0 || !f.propiedadId}
            onClick={() => onGuardar(f)}
          >
            Guardar
          </button>
        </>
      }
    >
      <Campo etiqueta="Qué se hizo">
        <input
          value={f.descripcion}
          disabled={bloqueado}
          onChange={(e) => set('descripcion', e.target.value)}
          placeholder="Reparación de termotanque"
        />
      </Campo>

      <div className="grid grid--form">
        <Campo etiqueta="Fecha">
          <input type="date" value={f.fecha} disabled={bloqueado} onChange={(e) => set('fecha', e.target.value)} />
        </Campo>
        <Campo etiqueta="Monto">
          <input
            className="entrada-num"
            type="number"
            value={f.monto || ''}
            disabled={bloqueado}
            onChange={(e) => set('monto', Number(e.target.value))}
          />
        </Campo>
        <Campo etiqueta="Categoría">
          <select
            value={f.categoria}
            disabled={bloqueado}
            onChange={(e) => set('categoria', e.target.value as CategoriaGasto)}
          >
            {CATEGORIAS.map((c) => (
              <option key={c} value={c}>{NOMBRE_CATEGORIA[c]}</option>
            ))}
          </select>
        </Campo>
        <Campo etiqueta="Propiedad">
          <select
            value={f.propiedadId}
            disabled={bloqueado}
            onChange={(e) => set('propiedadId', e.target.value)}
          >
            <option value="">Elegir…</option>
            {db.propiedades.map((p) => (
              <option key={p.id} value={p.id}>{p.codigo} — {direccionDe(p)}</option>
            ))}
          </select>
        </Campo>
      </div>

      <label className="fila" style={{ gap: 8 }}>
        <input
          type="checkbox"
          checked={f.seLeDescuentaAlPropietario}
          disabled={bloqueado}
          onChange={(e) => set('seLeDescuentaAlPropietario', e.target.checked)}
        />
        Descontárselo al propietario en su liquidación
      </label>

      <Campo etiqueta="Comprobante">
        <input
          value={f.comprobante ?? ''}
          disabled={bloqueado}
          onChange={(e) => set('comprobante', e.target.value)}
          placeholder="Factura 0003-00012345"
        />
      </Campo>
    </Modal>
  );
}

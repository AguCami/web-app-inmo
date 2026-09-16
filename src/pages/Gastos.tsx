import { useMemo, useState } from 'react';
import { Encabezado } from '../components/Encabezado';
import { Campo, Chip, Kpi, Modal, Paginador, Tabla, Tarjeta, usePaginado, Vacio } from '../components/ui';
import { useApp, useDb } from '../data/store';
import type { CategoriaGasto, Gasto } from '../domain/types';
import {
  formatearFecha,
  formatearMoneda,
  formatearPeriodo,
  hoy,
  incluyeTexto,
  nuevoId,
  periodoActual,
  redondear,
  sumar,
  ultimosPeriodos,
} from '../domain/util';

const CATEGORIAS: CategoriaGasto[] = [
  'mantenimiento', 'expensas', 'impuestos', 'servicios', 'sueldos',
  'marketing', 'alquiler_oficina', 'honorarios', 'comisiones', 'bancarios', 'otros',
];

export const ETIQUETA_CATEGORIA: Record<CategoriaGasto, string> = {
  mantenimiento: 'Mantenimiento',
  expensas: 'Expensas',
  impuestos: 'Impuestos y tasas',
  servicios: 'Servicios',
  sueldos: 'Sueldos',
  marketing: 'Marketing',
  alquiler_oficina: 'Alquiler de oficina',
  honorarios: 'Honorarios profesionales',
  comisiones: 'Comisiones a agentes',
  bancarios: 'Gastos bancarios',
  otros: 'Otros',
};

function gastoNuevo(ivaDefault: number): Gasto {
  return {
    id: nuevoId('gas'),
    fecha: hoy(),
    descripcion: '',
    categoria: 'otros',
    reintegrablePorPropietario: false,
    neto: 0,
    ivaPct: ivaDefault,
    total: 0,
    moneda: 'ARS',
    estado: 'pendiente',
  };
}

export default function Gastos() {
  const db = useDb();
  const guardar = useApp((e) => e.guardarGasto);
  const eliminar = useApp((e) => e.eliminar);
  const registrarPago = useApp((e) => e.registrarPago);

  const [periodo, setPeriodo] = useState(periodoActual());
  const [verTodos, setVerTodos] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [editando, setEditando] = useState<Gasto | null>(null);

  const propiedadDe = (id?: string) => db.propiedades.find((p) => p.id === id);

  const filtrados = useMemo(
    () =>
      db.gastos
        .filter((g) => verTodos || g.fecha.slice(0, 7) === periodo)
        .filter((g) => incluyeTexto([g.descripcion, ETIQUETA_CATEGORIA[g.categoria], propiedadDe(g.propiedadId)?.codigo], busqueda))
        .sort((a, b) => b.fecha.localeCompare(a.fecha)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [db.gastos, db.propiedades, periodo, verTodos, busqueda],
  );

  const propios = filtrados.filter((g) => !g.reintegrablePorPropietario);
  const reintegrables = filtrados.filter((g) => g.reintegrablePorPropietario);
  const pendientes = filtrados.filter((g) => g.estado === 'pendiente');
  const pag = usePaginado(filtrados, 50);

  return (
    <>
      <Encabezado titulo="Gastos" bajada="Gastos propios de la inmobiliaria y gastos a recuperar de los propietarios">
        <button className="btn btn--primario no-imprimir" onClick={() => setEditando(gastoNuevo(db.configuracion.ivaPctDefault))}>
          + Nuevo gasto
        </button>
      </Encabezado>

      <div className="contenido pila">
        <div className="fila no-imprimir">
          <select
            value={periodo}
            onChange={(e) => { setPeriodo(e.target.value); setVerTodos(false); }}
            style={{ width: 'auto' }}
            disabled={verTodos}
            aria-label="Período"
          >
            {ultimosPeriodos(periodoActual(), 18).reverse().map((p) => (
              <option key={p} value={p}>{formatearPeriodo(p, true)}</option>
            ))}
          </select>
          <label className="fila" style={{ gap: 6 }}>
            <input type="checkbox" checked={verTodos} onChange={(e) => setVerTodos(e.target.checked)} />
            Todos los períodos
          </label>
          <div className="buscador">
            <input
              type="search"
              placeholder="Buscar por descripción o categoría"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              aria-label="Buscar gastos"
            />
          </div>
        </div>

        <div className="grid grid--kpis">
          <Kpi etiqueta="Gasto propio del período" valor={formatearMoneda(sumar(propios, (g) => g.total))} pie={`${propios.length} comprobantes`} />
          <Kpi
            etiqueta="A recuperar de propietarios"
            valor={formatearMoneda(sumar(reintegrables, (g) => g.total))}
            pie={`${reintegrables.length} gastos reintegrables`}
          />
          <Kpi
            etiqueta="Pendientes de pago"
            valor={formatearMoneda(sumar(pendientes, (g) => g.total))}
            tono={pendientes.length ? 'alerta' : 'ok'}
            pie={`${pendientes.length} facturas impagas`}
          />
        </div>

        <Tarjeta ajustado>
          {filtrados.length === 0 ? (
            <Vacio icono="🧾" titulo="Sin gastos en este período" />
          ) : (
            <Tabla>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Descripción</th>
                  <th>Categoría</th>
                  <th>Imputación</th>
                  <th className="num">Neto</th>
                  <th className="num">IVA</th>
                  <th className="num">Total</th>
                  <th>Estado</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {pag.visibles.map((g) => (
                  <tr key={g.id}>
                    <td>{formatearFecha(g.fecha)}</td>
                    <td className="principal-celda">{g.descripcion}</td>
                    <td className="mini">{ETIQUETA_CATEGORIA[g.categoria]}</td>
                    <td className="mini">
                      {g.reintegrablePorPropietario ? (
                        <Chip tono="info">Al propietario</Chip>
                      ) : (
                        <Chip>Gasto propio</Chip>
                      )}
                      {g.propiedadId && <span className="tabla__sub">{propiedadDe(g.propiedadId)?.codigo}</span>}
                    </td>
                    <td className="num">{formatearMoneda(g.neto, g.moneda)}</td>
                    <td className="num tenue">{formatearMoneda(redondear(g.total - g.neto), g.moneda)}</td>
                    <td className="num">{formatearMoneda(g.total, g.moneda)}</td>
                    <td>
                      <Chip tono={g.estado === 'pagado' ? 'ok' : 'alerta'}>{g.estado === 'pagado' ? 'Pagado' : 'Pendiente'}</Chip>
                    </td>
                    <td className="num no-imprimir">
                      {g.estado === 'pendiente' && (
                        <button
                          className="btn btn--chico"
                          onClick={() => {
                            guardar({ ...g, estado: 'pagado' });
                            registrarPago({
                              gastoId: g.id,
                              fecha: hoy(),
                              monto: g.total,
                              moneda: g.moneda,
                              medio: 'transferencia',
                              cuentaId: db.cuentas.find((c) => c.moneda === g.moneda && c.activa)?.id ?? db.cuentas[0]?.id ?? '',
                            });
                          }}
                        >
                          Pagar
                        </button>
                      )}
                      <button className="btn btn--chico btn--fantasma" onClick={() => setEditando(g)}>Editar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={4}>Total del listado</td>
                  <td className="num">{formatearMoneda(sumar(filtrados, (g) => g.neto))}</td>
                  <td className="num">{formatearMoneda(sumar(filtrados, (g) => redondear(g.total - g.neto)))}</td>
                  <td className="num">{formatearMoneda(sumar(filtrados, (g) => g.total))}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </Tabla>
          )}
          <Paginador
            pagina={pag.pagina}
            paginas={pag.paginas}
            desde={pag.desde}
            hasta={pag.hasta}
            total={pag.total}
            etiqueta="gastos"
            onCambio={pag.setPagina}
          />
        </Tarjeta>
      </div>

      {editando && (
        <FormularioGasto
          gasto={editando}
          onCerrar={() => setEditando(null)}
          onGuardar={(g) => { guardar(g); setEditando(null); }}
          onEliminar={
            db.gastos.some((g) => g.id === editando.id)
              ? () => { eliminar('gastos', editando.id); setEditando(null); }
              : undefined
          }
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

  /** El total manda: el neto y el IVA se derivan de la alícuota cargada. */
  const setTotal = (total: number) => setF((x) => ({ ...x, total, neto: redondear(total / (1 + x.ivaPct / 100)) }));

  return (
    <Modal
      titulo={gasto.descripcion || 'Nuevo gasto'}
      onCerrar={onCerrar}
      pie={
        <>
          {onEliminar && <button className="btn btn--peligro" onClick={onEliminar} style={{ marginRight: 'auto' }}>Eliminar</button>}
          <button className="btn" onClick={onCerrar}>Cancelar</button>
          <button className="btn btn--primario" disabled={!f.descripcion.trim() || f.total <= 0} onClick={() => onGuardar(f)}>
            Guardar
          </button>
        </>
      }
    >
      <Campo etiqueta="Descripción">
        <input value={f.descripcion} onChange={(e) => set('descripcion', e.target.value)} />
      </Campo>

      <div className="grid grid--form">
        <Campo etiqueta="Fecha">
          <input type="date" value={f.fecha} onChange={(e) => set('fecha', e.target.value)} />
        </Campo>
        <Campo etiqueta="Categoría">
          <select value={f.categoria} onChange={(e) => set('categoria', e.target.value as CategoriaGasto)}>
            {CATEGORIAS.map((c) => (
              <option key={c} value={c}>{ETIQUETA_CATEGORIA[c]}</option>
            ))}
          </select>
        </Campo>
        <Campo etiqueta="Total (con IVA)">
          <input className="entrada-num" type="number" value={f.total || ''} onChange={(e) => setTotal(Number(e.target.value))} />
        </Campo>
        <Campo etiqueta="Alícuota de IVA (%)">
          <select value={f.ivaPct} onChange={(e) => {
            const ivaPct = Number(e.target.value);
            setF((x) => ({ ...x, ivaPct, neto: redondear(x.total / (1 + ivaPct / 100)) }));
          }}>
            <option value={21}>21 %</option>
            <option value={10.5}>10,5 %</option>
            <option value={0}>Sin IVA</option>
          </select>
        </Campo>
        <Campo etiqueta="Neto" ayuda="Se calcula a partir del total.">
          <input className="entrada-num" value={formatearMoneda(f.neto, f.moneda)} disabled />
        </Campo>
        <Campo etiqueta="Estado">
          <select value={f.estado} onChange={(e) => set('estado', e.target.value as Gasto['estado'])}>
            <option value="pendiente">Pendiente</option>
            <option value="pagado">Pagado</option>
          </select>
        </Campo>
      </div>

      <Campo etiqueta="Propiedad asociada" ayuda="Opcional: sirve para medir la rentabilidad por unidad.">
        <select value={f.propiedadId ?? ''} onChange={(e) => set('propiedadId', e.target.value || undefined)}>
          <option value="">Ninguna</option>
          {db.propiedades.map((p) => (
            <option key={p.id} value={p.id}>{p.codigo} — {p.calle} {p.numero}</option>
          ))}
        </select>
      </Campo>

      <label className="fila" style={{ gap: 6 }}>
        <input
          type="checkbox"
          checked={f.reintegrablePorPropietario}
          onChange={(e) => set('reintegrablePorPropietario', e.target.checked)}
        />
        Se le descuenta al propietario en la liquidación
      </label>
      <p className="mini tenue">
        Un gasto reintegrable no impacta en el resultado de la inmobiliaria: se carga a la cuenta del propietario y se
        descuenta de su próxima liquidación.
      </p>

      <Campo etiqueta="Comprobante">
        <input value={f.comprobante ?? ''} onChange={(e) => set('comprobante', e.target.value)} placeholder="FC-B-0003-00012345" />
      </Campo>
    </Modal>
  );
}

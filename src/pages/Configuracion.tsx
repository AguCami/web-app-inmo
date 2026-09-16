import { useRef, useState } from 'react';
import { Encabezado } from '../components/Encabezado';
import { Aviso, Campo, Pestanas, Tabla, Tarjeta } from '../components/ui';
import { useApp, useDb } from '../data/store';
import { exportarJSON, importarJSON } from '../data/db';
import type { CondicionIVA, ValorIndice } from '../domain/types';
import { formatearPeriodo, redondear } from '../domain/util';

type Vista = 'empresa' | 'indices' | 'datos';

export default function Configuracion() {
  const db = useDb();
  const actualizar = useApp((e) => e.actualizarConfiguracion);
  const guardarIndices = useApp((e) => e.guardarIndices);
  const reemplazar = useApp((e) => e.reemplazarBase);
  const cargarDemo = useApp((e) => e.cargarDemo);
  const vaciar = useApp((e) => e.vaciar);

  const [vista, setVista] = useState<Vista>('empresa');
  const [mensaje, setMensaje] = useState<{ tono: 'ok' | 'critico'; texto: string } | null>(null);
  const archivoRef = useRef<HTMLInputElement>(null);

  const c = db.configuracion;

  const editarIndice = (periodo: string, campo: keyof ValorIndice, valor: number) => {
    guardarIndices(
      db.indices.map((i) => (i.periodo === periodo ? { ...i, [campo]: valor } : i)),
    );
  };

  return (
    <>
      <Encabezado titulo="Configuración" bajada="Datos de la inmobiliaria, índices de actualización y respaldo" />

      <div className="contenido pila">
        {mensaje && (
          <Aviso tono={mensaje.tono}>{mensaje.texto}</Aviso>
        )}

        <Pestanas
          valor={vista}
          onCambio={setVista}
          opciones={[
            { id: 'empresa', etiqueta: 'Inmobiliaria' },
            { id: 'indices', etiqueta: 'Índices y cotización' },
            { id: 'datos', etiqueta: 'Datos y respaldo' },
          ]}
        />

        {vista === 'empresa' && (
          <div className="grid grid--2">
            <Tarjeta titulo="Identificación">
              <div className="grid grid--form">
                <Campo etiqueta="Razón social">
                  <input value={c.razonSocial} onChange={(e) => actualizar({ razonSocial: e.target.value })} />
                </Campo>
                <Campo etiqueta="Nombre de fantasía">
                  <input value={c.nombreFantasia} onChange={(e) => actualizar({ nombreFantasia: e.target.value })} />
                </Campo>
                <Campo etiqueta="CUIT">
                  <input value={c.cuit} onChange={(e) => actualizar({ cuit: e.target.value })} />
                </Campo>
                <Campo etiqueta="Matrícula">
                  <input value={c.matricula} onChange={(e) => actualizar({ matricula: e.target.value })} />
                </Campo>
                <Campo etiqueta="Condición frente al IVA">
                  <select value={c.condicionIVA} onChange={(e) => actualizar({ condicionIVA: e.target.value as CondicionIVA })}>
                    <option value="responsable_inscripto">Responsable inscripto</option>
                    <option value="monotributo">Monotributo</option>
                    <option value="exento">Exento</option>
                  </select>
                </Campo>
                <Campo etiqueta="Teléfono">
                  <input value={c.telefono} onChange={(e) => actualizar({ telefono: e.target.value })} />
                </Campo>
              </div>
              <Campo etiqueta="Domicilio">
                <input value={c.domicilio} onChange={(e) => actualizar({ domicilio: e.target.value })} />
              </Campo>
              <Campo etiqueta="Email">
                <input type="email" value={c.email} onChange={(e) => actualizar({ email: e.target.value })} />
              </Campo>
            </Tarjeta>

            <Tarjeta titulo="Valores por defecto" subtitulo="Se aplican a los contratos y operaciones nuevos">
              <div className="grid grid--form">
                <Campo etiqueta="Honorarios de administración (%)">
                  <input
                    className="entrada-num"
                    type="number"
                    step="0.5"
                    value={c.comisionAdminPctDefault}
                    onChange={(e) => actualizar({ comisionAdminPctDefault: Number(e.target.value) })}
                  />
                </Campo>
                <Campo etiqueta="Honorarios de venta (%)">
                  <input
                    className="entrada-num"
                    type="number"
                    step="0.5"
                    value={c.honorariosVentaPctDefault}
                    onChange={(e) => actualizar({ honorariosVentaPctDefault: Number(e.target.value) })}
                  />
                </Campo>
                <Campo etiqueta="Punitorio diario (%)">
                  <input
                    className="entrada-num"
                    type="number"
                    step="0.01"
                    value={c.punitorioDiarioPctDefault}
                    onChange={(e) => actualizar({ punitorioDiarioPctDefault: Number(e.target.value) })}
                  />
                </Campo>
                <Campo etiqueta="Alícuota de IVA (%)">
                  <input
                    className="entrada-num"
                    type="number"
                    value={c.ivaPctDefault}
                    onChange={(e) => actualizar({ ivaPctDefault: Number(e.target.value) })}
                  />
                </Campo>
              </div>
              <Campo etiqueta="Fuente de la cotización" ayuda="Queda registrada en los reportes para trazabilidad.">
                <input value={c.fuenteCotizacion} onChange={(e) => actualizar({ fuenteCotizacion: e.target.value })} />
              </Campo>
              <Aviso>
                La moneda base de la contabilidad es el peso. Los importes en dólares se convierten con la cotización del
                período del hecho económico.
              </Aviso>
            </Tarjeta>
          </div>
        )}

        {vista === 'indices' && (
          <Tarjeta
            titulo="Índices de actualización"
            subtitulo="ICL (BCRA), IPC (INDEC), Casa Propia y cotización del dólar, por período"
            ajustado
          >
            <div style={{ padding: '12px 16px 0' }}>
              <Aviso tono="alerta" titulo="Los valores cargados son de demostración">
                <span className="mini">
                  Reemplazá cada fila con el dato publicado. Los contratos recalculan su cronograma automáticamente.
                </span>
              </Aviso>
            </div>
            <Tabla compacta>
              <thead>
                <tr>
                  <th>Período</th>
                  <th className="num">ICL</th>
                  <th className="num">IPC</th>
                  <th className="num">Casa Propia</th>
                  <th className="num">Dólar</th>
                  <th className="num">Var. ICL</th>
                </tr>
              </thead>
              <tbody>
                {[...db.indices].reverse().map((i, idx, arr) => {
                  const anterior = arr[idx + 1];
                  const variacion = anterior ? ((i.ICL / anterior.ICL - 1) * 100) : 0;
                  return (
                    <tr key={i.periodo}>
                      <td className="principal-celda">{formatearPeriodo(i.periodo, true)}</td>
                      <td className="num">
                        <input className="entrada-num" type="number" step="0.01" value={i.ICL} onChange={(e) => editarIndice(i.periodo, 'ICL', Number(e.target.value))} />
                      </td>
                      <td className="num">
                        <input className="entrada-num" type="number" step="0.01" value={i.IPC} onChange={(e) => editarIndice(i.periodo, 'IPC', Number(e.target.value))} />
                      </td>
                      <td className="num">
                        <input className="entrada-num" type="number" step="0.01" value={i.CASA_PROPIA} onChange={(e) => editarIndice(i.periodo, 'CASA_PROPIA', Number(e.target.value))} />
                      </td>
                      <td className="num">
                        <input className="entrada-num" type="number" value={i.usd} onChange={(e) => editarIndice(i.periodo, 'usd', Number(e.target.value))} />
                      </td>
                      <td className="num tenue">{anterior ? `${redondear(variacion, 2).toFixed(2).replace('.', ',')} %` : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </Tabla>
          </Tarjeta>
        )}

        {vista === 'datos' && (
          <div className="grid grid--2">
            <Tarjeta titulo="Respaldo" subtitulo="Los datos viven solo en este navegador: bajá una copia seguido">
              <p className="mini tenue">
                El respaldo es un archivo JSON con todo: personas, propiedades, contratos, cuotas, pagos, liquidaciones,
                operaciones, gastos, asientos e índices.
              </p>
              <div className="fila">
                <button className="btn btn--primario" onClick={() => exportarJSON(db)}>Descargar respaldo</button>
                <button className="btn" onClick={() => archivoRef.current?.click()}>Restaurar desde archivo</button>
                <input
                  ref={archivoRef}
                  type="file"
                  accept="application/json"
                  style={{ display: 'none' }}
                  onChange={async (e) => {
                    const archivo = e.target.files?.[0];
                    if (!archivo) return;
                    try {
                      reemplazar(await importarJSON(archivo));
                      setMensaje({ tono: 'ok', texto: 'Respaldo restaurado correctamente.' });
                    } catch {
                      setMensaje({ tono: 'critico', texto: 'No pudimos leer el archivo: revisá que sea un respaldo válido.' });
                    }
                    e.target.value = '';
                  }}
                />
              </div>
            </Tarjeta>

            <Tarjeta titulo="Estado de la base">
              <Tabla compacta>
                <tbody>
                  {[
                    ['Personas', db.personas.length],
                    ['Propiedades', db.propiedades.length],
                    ['Contratos', db.contratos.length],
                    ['Cuotas emitidas', db.cuotas.length],
                    ['Pagos registrados', db.pagos.length],
                    ['Liquidaciones', db.liquidaciones.length],
                    ['Operaciones de venta', db.operaciones.length],
                    ['Gastos', db.gastos.length],
                    ['Asientos manuales', db.asientos.length],
                  ].map(([et, val]) => (
                    <tr key={String(et)}>
                      <td>{et}</td>
                      <td className="num principal-celda">{val}</td>
                    </tr>
                  ))}
                </tbody>
              </Tabla>

              <div className="fila" style={{ marginTop: 14 }}>
                <button
                  className="btn"
                  onClick={() => {
                    if (confirm('Esto reemplaza todo lo cargado por los datos de demostración. ¿Seguimos?')) {
                      cargarDemo();
                      setMensaje({ tono: 'ok', texto: 'Se recargaron los datos de demostración.' });
                    }
                  }}
                >
                  Recargar datos demo
                </button>
                <button
                  className="btn btn--peligro"
                  onClick={() => {
                    if (confirm('Esto borra todos los datos cargados y deja la base vacía. ¿Seguimos?')) {
                      vaciar();
                      setMensaje({ tono: 'ok', texto: 'La base quedó vacía, lista para cargar datos reales.' });
                    }
                  }}
                >
                  Empezar de cero
                </button>
              </div>
            </Tarjeta>
          </div>
        )}
      </div>
    </>
  );
}

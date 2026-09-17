import { useRef, useState } from 'react';
import { Encabezado } from '../components/Encabezado';
import { Campo, Dato, Nota, Panel, Pastilla, Segmentos } from '../components/ui';
import { useApp, useDb } from '../data/store';
import { exportarJSON, importarJSON } from '../data/db';
import { ETIQUETA_INDICE, INDICES_CON_SERIE } from '../domain/contratos';
import type { IndiceConSerie } from '../domain/contratos';
import type { ValorIndice } from '../domain/types';
import { formatearPeriodo, periodoActual, plural, redondear } from '../domain/util';

type Vista = 'datos' | 'indices' | 'respaldo';

export default function Ajustes() {
  const db = useDb();
  const actualizar = useApp((e) => e.actualizarConfiguracion);
  const guardarIndices = useApp((e) => e.guardarIndices);
  const sincronizar = useApp((e) => e.sincronizarIndices);
  const estadoSync = useApp((e) => e.indicesSincronizados);
  const reemplazar = useApp((e) => e.reemplazarBase);
  const cargarDemo = useApp((e) => e.cargarDemo);
  const vaciar = useApp((e) => e.vaciar);

  const [vista, setVista] = useState<Vista>('datos');
  const [indiceVisible, setIndiceVisible] = useState<IndiceConSerie>('IPC_CBA');
  const [aviso, setAviso] = useState<{ tono: 'ok' | 'critico'; texto: string } | null>(null);
  const archivoRef = useRef<HTMLInputElement>(null);

  const c = db.configuracion;

  const editarIndice = (periodo: string, campo: keyof ValorIndice, valor: number) =>
    guardarIndices(db.indices.map((i) => (i.periodo === periodo ? { ...i, [campo]: valor } : i)));

  const ultimos = [...db.indices].reverse().slice(0, 18);
  const contratosPorIndice = (indice: string) =>
    db.contratos.filter((x) => x.estado === 'activo' && x.indiceAjuste === indice).length;

  return (
    <>
      <Encabezado titulo="Ajustes" bajada="Tus datos, los índices de actualización y el respaldo" />

      <div className="contenido">
        {aviso && <Nota tono={aviso.tono}>{aviso.texto}</Nota>}

        <div className="fila no-imprimir">
          <Segmentos
            etiqueta="Sección"
            valor={vista}
            onCambio={setVista}
            opciones={[
              { id: 'datos', texto: 'Mis datos' },
              { id: 'indices', texto: 'Índices' },
              { id: 'respaldo', texto: 'Respaldo' },
            ]}
          />
        </div>

        {vista === 'datos' && (
          <div className="grid grid--2">
            <Panel titulo="Quién administra">
              <div className="grid grid--form">
                <Campo etiqueta="Nombre">
                  <input value={c.nombre} onChange={(e) => actualizar({ nombre: e.target.value })} />
                </Campo>
                <Campo etiqueta="CUIT">
                  <input value={c.cuit} onChange={(e) => actualizar({ cuit: e.target.value })} />
                </Campo>
                <Campo etiqueta="Teléfono">
                  <input value={c.telefono} onChange={(e) => actualizar({ telefono: e.target.value })} />
                </Campo>
                <Campo etiqueta="Email">
                  <input type="email" value={c.email} onChange={(e) => actualizar({ email: e.target.value })} />
                </Campo>
              </div>
            </Panel>

            <Panel titulo="Valores por defecto" subtitulo="Se usan al cargar un contrato nuevo">
              <div className="grid grid--form">
                <Campo etiqueta="Tus honorarios (%)">
                  <input
                    className="entrada-num"
                    type="number"
                    step="0.5"
                    value={c.comisionAdminPctDefault}
                    onChange={(e) => actualizar({ comisionAdminPctDefault: Number(e.target.value) })}
                  />
                </Campo>
                <Campo etiqueta="Punitorio por día (%)">
                  <input
                    className="entrada-num"
                    type="number"
                    step="0.01"
                    value={c.punitorioDiarioPctDefault}
                    onChange={(e) => actualizar({ punitorioDiarioPctDefault: Number(e.target.value) })}
                  />
                </Campo>
                <Campo etiqueta="Avisar N días antes del vencimiento">
                  <input
                    className="entrada-num"
                    type="number"
                    value={c.diasAvisoVencimiento}
                    onChange={(e) => actualizar({ diasAvisoVencimiento: Number(e.target.value) })}
                  />
                </Campo>
              </div>
            </Panel>
          </div>
        )}

        {vista === 'indices' && (
          <>
            <Nota tono={estadoSync === 'ok' ? 'ok' : 'alerta'} titulo={
              estadoSync === 'ok'
                ? 'Los índices se actualizan solos'
                : 'Por ahora los índices se cargan a mano'
            }>
              <span className="mini">
                {estadoSync === 'ok'
                  ? 'Una tarea programada consulta la fuente todos los días y publica el valor nuevo cuando sale. Igual podés corregir cualquier mes acá abajo.'
                  : 'Todavía no hay una serie publicada para esta instalación. Cargá los valores del mes acá abajo; en cuanto la tarea programada empiece a publicar, se sincroniza sola.'}
              </span>
              <button
                className="btn btn--suave btn--chico"
                style={{ marginTop: 10 }}
                onClick={async () => {
                  await sincronizar();
                  setAviso({ tono: 'ok', texto: 'Buscamos la serie publicada.' });
                }}
              >
                Buscar ahora
              </button>
            </Nota>

            <div className="grid grid--resumen">
              {INDICES_CON_SERIE.map((i) => (
                <Dato
                  key={i}
                  etiqueta={ETIQUETA_INDICE[i]}
                  valor={(db.indices[db.indices.length - 1]?.[i] ?? 0).toFixed(2).replace('.', ',')}
                  tono={i === indiceVisible ? 'acento' : 'neutro'}
                  pie={`${plural(contratosPorIndice(i), 'contrato usa', 'contratos usan')} este índice`}
                />
              ))}
            </div>

            <Panel
              titulo="Valores mes a mes"
              subtitulo="Editá el que corresponda cuando el organismo publique el dato definitivo"
              acciones={
                <Segmentos
                  etiqueta="Índice a editar"
                  valor={indiceVisible}
                  onCambio={setIndiceVisible}
                  opciones={INDICES_CON_SERIE.map((i) => ({
                    id: i,
                    texto: i === 'IPC_CBA' ? 'Córdoba' : i === 'IPC' ? 'Nacional' : i === 'ICL' ? 'ICL' : 'Casa Propia',
                  }))}
                />
              }
            >
              <div className="pila" style={{ gap: 6 }}>
                {ultimos.map((fila, idx) => {
                  const anterior = ultimos[idx + 1];
                  const variacion = anterior
                    ? (fila[indiceVisible] / anterior[indiceVisible] - 1) * 100
                    : null;
                  const esActual = fila.periodo === periodoActual();
                  return (
                    <div
                      className="fila"
                      key={fila.periodo}
                      style={{
                        gap: 12,
                        padding: '8px 4px',
                        borderBottom: '1px solid var(--borde)',
                      }}
                    >
                      <span className="crece" style={{ minWidth: 110 }}>
                        <strong style={{ fontSize: 13.8 }}>{formatearPeriodo(fila.periodo, true)}</strong>
                        {esActual && (
                          <span style={{ marginLeft: 8 }}>
                            <Pastilla tono="acento">mes en curso</Pastilla>
                          </span>
                        )}
                      </span>
                      <span className="mini tenue num" style={{ width: 72, textAlign: 'right' }}>
                        {variacion === null
                          ? '—'
                          : `${variacion >= 0 ? '+' : ''}${redondear(variacion, 2).toFixed(2).replace('.', ',')} %`}
                      </span>
                      <input
                        className="entrada-num"
                        style={{ width: 130, flex: 'none' }}
                        type="number"
                        step="0.01"
                        value={fila[indiceVisible]}
                        aria-label={`${ETIQUETA_INDICE[indiceVisible]} de ${formatearPeriodo(fila.periodo, true)}`}
                        onChange={(e) => editarIndice(fila.periodo, indiceVisible, Number(e.target.value))}
                      />
                    </div>
                  );
                })}
              </div>
              <p className="mini tenue" style={{ marginTop: 12 }}>
                Es un número índice, no un porcentaje: la variación de la izquierda se calcula sola. Cambiar un valor
                recalcula el cronograma de todos los contratos que usan ese índice.
              </p>
            </Panel>
          </>
        )}

        {vista === 'respaldo' && (
          <div className="grid grid--2">
            <Panel titulo="Copia de seguridad" subtitulo="Los datos viven en este navegador: bajá una copia seguido">
              <p className="mini tenue" style={{ marginBottom: 14 }}>
                El respaldo es un archivo con todo: personas, propiedades, contratos, cuotas, pagos, liquidaciones,
                gastos e índices.
              </p>
              <div className="fila">
                <button className="btn btn--primario" onClick={() => exportarJSON(db)}>
                  Descargar copia
                </button>
                <button className="btn" onClick={() => archivoRef.current?.click()}>
                  Restaurar
                </button>
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
                      setAviso({ tono: 'ok', texto: 'Listo, se restauró la copia.' });
                    } catch {
                      setAviso({ tono: 'critico', texto: 'No pudimos leer el archivo. Fijate que sea un respaldo de esta app.' });
                    }
                    e.target.value = '';
                  }}
                />
              </div>
            </Panel>

            <Panel titulo="Qué hay cargado">
              <div className="pila" style={{ gap: 8 }}>
                {(
                  [
                    ['Propiedades', db.propiedades.length],
                    ['Contratos', db.contratos.length],
                    ['Personas', db.personas.length],
                    ['Cuotas emitidas', db.cuotas.length],
                    ['Pagos registrados', db.pagos.length],
                    ['Liquidaciones', db.liquidaciones.length],
                    ['Gastos', db.gastos.length],
                  ] as const
                ).map(([et, val]) => (
                  <div className="fila" key={et} style={{ justifyContent: 'space-between' }}>
                    <span className="tenue mini">{et}</span>
                    <strong className="num">{val}</strong>
                  </div>
                ))}
              </div>

              <div className="fila" style={{ marginTop: 18 }}>
                <button
                  className="btn"
                  onClick={() => {
                    if (confirm('Esto reemplaza todo por los datos de ejemplo. ¿Seguimos?')) {
                      cargarDemo();
                      setAviso({ tono: 'ok', texto: 'Volvieron los datos de ejemplo.' });
                    }
                  }}
                >
                  Volver al ejemplo
                </button>
                <button
                  className="btn btn--peligro"
                  onClick={() => {
                    if (confirm('Esto borra todo lo cargado y deja la app vacía. ¿Seguimos?')) {
                      vaciar();
                      setAviso({ tono: 'ok', texto: 'Listo, la app quedó vacía para cargar tus datos.' });
                    }
                  }}
                >
                  Empezar de cero
                </button>
              </div>
            </Panel>
          </div>
        )}
      </div>
    </>
  );
}

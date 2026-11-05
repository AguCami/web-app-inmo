import { useEffect, useRef, useState } from 'react';
import { Encabezado } from '../components/Encabezado';
import { Campo, Dato, Nota, Panel, Pastilla, Segmentos } from '../components/ui';
import { Confirmar } from '../components/Confirmar';
import { useApp, useDb } from '../data/store';
import { exportarJSON, importarJSON } from '../data/db';
import {
  estadoDeAlmacenamiento,
  pedirPersistencia,
  type EstadoAlmacenamiento,
} from '../data/almacenamiento';
import { ETIQUETA_INDICE, INDICES_CON_SERIE } from '../domain/contratos';
import type { IndiceConSerie } from '../domain/contratos';
import type { ValorIndice } from '../domain/types';
import { formatearFecha, formatearPeriodo, formatearPeriodoLargo, periodoActual, plural, redondear, sumarPeriodos } from '../domain/util';

type Vista = 'datos' | 'indices' | 'respaldo';

export default function Ajustes() {
  const db = useDb();
  const actualizar = useApp((e) => e.actualizarConfiguracion);
  const guardarIndices = useApp((e) => e.guardarIndices);
  const sincronizar = useApp((e) => e.sincronizarIndices);
  const ipcCordoba = useApp((e) => e.ipcCordoba);
  const reemplazar = useApp((e) => e.reemplazarBase);
  const cargarDemo = useApp((e) => e.cargarDemo);
  const vaciar = useApp((e) => e.vaciar);
  const registrarRespaldo = useApp((e) => e.registrarRespaldo);
  const modoServidor = useApp((e) => e.modoServidor);
  const organizacion = useApp((e) => e.sesion?.organizacion);
  const [almacenamiento, setAlmacenamiento] = useState<EstadoAlmacenamiento | null>(null);
  const [negado, setNegado] = useState(false);

  // Solo se consulta: pedir persistencia al abrir la app haría que Firefox
  // muestre un permiso sin que nadie entienda por qué.
  useEffect(() => {
    void estadoDeAlmacenamiento().then(setAlmacenamiento);
  }, []);

  const [vista, setVista] = useState<Vista>('datos');
  const [indiceVisible, setIndiceVisible] = useState<IndiceConSerie>('IPC_CBA');
  const [aviso, setAviso] = useState<{ tono: 'ok' | 'critico'; texto: string } | null>(null);
  const [confirmando, setConfirmando] = useState<'demo' | 'vaciar' | null>(null);
  const archivoRef = useRef<HTMLInputElement>(null);

  const c = db.configuracion;

  const editarIndice = (periodo: string, campo: keyof ValorIndice, valor: number) =>
    guardarIndices(db.indices.map((i) => (i.periodo === periodo ? { ...i, [campo]: valor } : i)));

  const ultimos = [...db.indices].reverse().slice(0, 18);

  // Se puede sumar el mes que sigue al último de la lista, hasta el actual.
  const ultimoPeriodo = db.indices[db.indices.length - 1]?.periodo;
  const mesParaAgregar = ultimoPeriodo ? sumarPeriodos(ultimoPeriodo, 1) : sumarPeriodos(periodoActual(), -1);
  const agregarMes = () =>
    guardarIndices([
      ...db.indices,
      { periodo: mesParaAgregar, ICL: 0, IPC: 0, IPC_CBA: 0, CASA_PROPIA: 0 },
    ]);
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
            <Nota
              tono={ipcCordoba.estado === 'ok' ? 'ok' : ipcCordoba.estado === 'error' ? 'alerta' : 'neutro'}
              titulo={
                ipcCordoba.estado === 'ok'
                  ? `IPC Córdoba: último dato del portal, ${formatearPeriodoLargo(ipcCordoba.ultimo)}`
                  : ipcCordoba.estado === 'error'
                    ? 'No pudimos traer el IPC de Córdoba'
                    : 'Buscando el IPC de Córdoba…'
              }
            >
              <span className="mini">
                {ipcCordoba.estado === 'error'
                  ? `${ipcCordoba.mensaje} Podés cargar el valor a mano acá abajo o probar de nuevo en un rato.`
                  : 'Cada vez que se abre la app, el IPC de Córdoba se trae solo del portal de Estadística y Censos de la Provincia, y pisa lo cargado a mano en esos meses. El ICL, el IPC nacional y Casa Propia se siguen cargando acá abajo.'}
                {ipcCordoba.estado === 'ok' && ipcCordoba.cambios > 0 &&
                  ` En esta consulta se actualizaron ${plural(ipcCordoba.cambios, 'mes', 'meses')}.`}
              </span>
              <button
                className="btn btn--suave btn--chico"
                style={{ marginTop: 10 }}
                disabled={ipcCordoba.estado === 'buscando'}
                onClick={async () => {
                  await sincronizar();
                  const estado = useApp.getState().ipcCordoba;
                  setAviso(
                    estado.estado === 'ok'
                      ? { tono: 'ok', texto: `IPC Córdoba actualizado hasta ${formatearPeriodoLargo(estado.ultimo)}.` }
                      : { tono: 'critico', texto: 'No se pudo traer el IPC de Córdoba.' },
                  );
                }}
              >
                {ipcCordoba.estado === 'buscando' ? 'Buscando…' : 'Buscar ahora'}
              </button>
            </Nota>

            <div className="grid grid--resumen">
              {INDICES_CON_SERIE.map((i) => (
                <Dato
                  key={i}
                  etiqueta={ETIQUETA_INDICE[i]}
                  valor={([...db.indices].reverse().find((f) => f[i] > 0)?.[i] ?? 0).toFixed(2).replace('.', ',')}
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
                  const variacion =
                    anterior && fila[indiceVisible] > 0 && anterior[indiceVisible] > 0
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
                        value={fila[indiceVisible] || ''}
                        placeholder="sin cargar"
                        aria-label={`${ETIQUETA_INDICE[indiceVisible]} de ${formatearPeriodo(fila.periodo, true)}`}
                        onChange={(e) => editarIndice(fila.periodo, indiceVisible, Number(e.target.value))}
                      />
                    </div>
                  );
                })}
              </div>
              {mesParaAgregar <= periodoActual() && (
                <button
                  className="btn btn--suave btn--chico"
                  style={{ marginTop: 12 }}
                  onClick={agregarMes}
                >
                  Agregar {formatearPeriodoLargo(mesParaAgregar)}
                </button>
              )}
              <p className="mini tenue" style={{ marginTop: 12 }}>
                Es un número índice, no un porcentaje: la variación de la izquierda se calcula sola. Cambiar un valor
                recalcula el cronograma de todos los contratos que usan ese índice.
              </p>
            </Panel>
          </>
        )}

        {vista === 'respaldo' && (
          <div className="grid grid--2">
            <Panel
              titulo="Copia de seguridad"
              subtitulo={
                modoServidor
                  ? 'Los datos están en el servidor; la copia es una red extra'
                  : 'Los datos viven en este navegador: bajá una copia seguido'
              }
            >
              <p className="mini tenue" style={{ marginBottom: 14 }}>
                El respaldo es un archivo con todo: personas, propiedades, contratos, cuotas, pagos, liquidaciones,
                gastos, índices y los contratos escaneados.
              </p>
              <p className="mini" style={{ marginBottom: 14 }}>
                <strong>
                  {db.configuracion.ultimoRespaldo
                    ? `Última copia: ${formatearFecha(db.configuracion.ultimoRespaldo)}`
                    : 'Todavía no se bajó ninguna copia.'}
                </strong>
              </p>
              <div className="fila">
                <button
                  className="btn btn--primario"
                  onClick={async () => {
                    await exportarJSON(db);
                    registrarRespaldo();
                  }}
                >
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
                    } catch (error) {
                      // Con servidor, el archivo puede estar bien y fallar la subida de un
                      // adjunto: eso no es «no pudimos leerlo», y decirlo confundiría.
                      const texto =
                        error instanceof Error && error.message.startsWith('No se pudo subir')
                          ? `${error.message}. No se restauró nada; volvé a probar.`
                          : 'No pudimos leer el archivo. Fijate que sea un respaldo de esta app.';
                      setAviso({ tono: 'critico', texto });
                    }
                    e.target.value = '';
                  }}
                />
              </div>
            </Panel>

            {modoServidor ? (
              <Panel titulo="Dónde viven los datos" subtitulo="En el servidor, no en esta computadora">
                <Nota tono="ok" titulo={`Guardados en la cuenta de ${organizacion ?? 'la inmobiliaria'}`}>
                  <span>
                    Los datos y los archivos están en Supabase y los ve cualquiera de la oficina que
                    entre con su usuario. En este navegador no queda nada al cerrar sesión.
                  </span>
                </Nota>
              </Panel>
            ) : (
              <Panel
                titulo="Dónde viven los datos"
                subtitulo="En este navegador, en esta computadora"
              >
                {almacenamiento?.persistente ? (
                  <Nota tono="ok" titulo="Protegidos contra el borrado automático">
                    <span>
                      El navegador se comprometió a no descartarlos por falta de espacio. Igual se
                      pierden si alguien limpia los datos del sitio, así que la copia sigue siendo
                      la única red.
                    </span>
                  </Nota>
                ) : (
                  <Nota tono="alerta" titulo="El navegador los puede descartar">
                    <span>
                      Si le falta espacio, puede borrarlos sin avisar. Se le puede pedir que no lo
                      haga; en Chrome lo concede solo, en Firefox pregunta.
                    </span>
                    <div className="fila" style={{ marginTop: 10 }}>
                      <button
                        className="btn btn--chico"
                        disabled={!almacenamiento?.soportado}
                        onClick={async () => {
                          const concedido = await pedirPersistencia();
                          setNegado(!concedido);
                          setAlmacenamiento(await estadoDeAlmacenamiento());
                        }}
                      >
                        {almacenamiento?.soportado
                          ? 'Pedir que no los borre'
                          : 'Este navegador no lo permite'}
                      </button>
                    </div>
                  </Nota>
                )}

                {negado && !almacenamiento?.persistente && (
                  <p className="mini tenue" style={{ marginTop: 10 }}>
                    El navegador no lo concedió todavía. Chrome lo decide según cuánto se use el
                    sitio: si lo agregás a Favoritos o lo instalás como aplicación y volvés a
                    probar, suele concederlo.
                  </p>
                )}

                {almacenamiento?.usadoMB !== undefined && (
                  <p className="mini tenue" style={{ marginTop: 12 }}>
                    Ocupado:{' '}
                    {almacenamiento.usadoMB < 1 ? 'menos de 1 MB' : `${almacenamiento.usadoMB} MB`}
                    {almacenamiento.disponibleMB !== undefined &&
                      ` de ${Math.round(almacenamiento.disponibleMB)} MB disponibles`}
                    . Los contratos escaneados son lo que más pesa.
                  </p>
                )}
              </Panel>
            )}

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
                <button className="btn" onClick={() => setConfirmando('demo')}>
                  Volver al ejemplo
                </button>
                <button className="btn btn--peligro" onClick={() => setConfirmando('vaciar')}>
                  Empezar de cero
                </button>
              </div>
            </Panel>
          </div>
        )}
      </div>

      {confirmando === 'demo' && (
        <Confirmar
          titulo="¿Volver a los datos de ejemplo?"
          textoAccion="Sí, reemplazar"
          onConfirmar={() => {
            cargarDemo();
            setAviso({ tono: 'ok', texto: 'Volvieron los datos de ejemplo.' });
          }}
          onCerrar={() => setConfirmando(null)}
        >
          <p>
            Se reemplaza <strong>todo lo que tengas cargado</strong> por la administración de ejemplo.
            Si tenés datos reales, bajá antes una copia.
          </p>
        </Confirmar>
      )}

      {confirmando === 'vaciar' && (
        <Confirmar
          titulo="¿Empezar de cero?"
          textoAccion="Sí, borrar todo"
          onConfirmar={() => {
            vaciar();
            // Es el momento en que empiezan los datos de verdad, y hay un
            // clic de por medio, que es lo que el navegador necesita.
            void pedirPersistencia().then(() =>
              estadoDeAlmacenamiento().then(setAlmacenamiento),
            );
            setAviso({ tono: 'ok', texto: 'Listo, la app quedó vacía para cargar tus datos.' });
          }}
          onCerrar={() => setConfirmando(null)}
        >
          <p>
            Se borran las {db.propiedades.length} propiedades, los {db.contratos.length} contratos y
            todas las cuotas, pagos, liquidaciones y gastos. La app queda vacía.
          </p>
        </Confirmar>
      )}
    </>
  );
}

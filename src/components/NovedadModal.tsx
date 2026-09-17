import { useState } from 'react';
import { Campo, Modal } from './ui';
import {
  IconoAlerta,
  IconoBuscar,
  IconoGastos,
  IconoInfo,
  IconoLiquidaciones,
} from './iconos';
import { SubirArchivos, ListaAdjuntos } from './Adjuntos';
import { useApp, useDb } from '../data/store';
import type { Novedad, TipoNovedad } from '../domain/types';
import { hoy, nuevoId } from '../domain/util';

export const NOMBRE_NOVEDAD: Record<TipoNovedad, string> = {
  observacion: 'Observación',
  reclamo: 'Reclamo del inquilino',
  arreglo: 'Arreglo',
  inspeccion: 'Inspección',
  aviso: 'Aviso enviado',
};

export const TONO_NOVEDAD: Record<TipoNovedad, 'neutro' | 'alerta' | 'ok' | 'acento' | 'critico'> = {
  observacion: 'neutro',
  reclamo: 'alerta',
  arreglo: 'ok',
  inspeccion: 'acento',
  aviso: 'critico',
};

const ICONO_NOVEDAD: Record<TipoNovedad, typeof IconoInfo> = {
  observacion: IconoInfo,
  reclamo: IconoAlerta,
  arreglo: IconoGastos,
  inspeccion: IconoBuscar,
  aviso: IconoLiquidaciones,
};

/** Cuadradito con el ícono del tipo, en el tono que le corresponde. */
export function MarcaNovedad({ tipo }: { tipo: TipoNovedad }) {
  const Icono = ICONO_NOVEDAD[tipo];
  return (
    <span className={`marca-novedad marca-novedad--${TONO_NOVEDAD[tipo]}`} aria-hidden="true">
      <Icono tam={19} />
    </span>
  );
}

export function novedadNueva(contratoId: string): Novedad {
  return {
    id: nuevoId('nov'),
    contratoId,
    fecha: hoy(),
    tipo: 'reclamo',
    titulo: '',
    resuelta: false,
  };
}

export function NovedadModal({
  novedad,
  onCerrar,
}: {
  novedad: Novedad;
  onCerrar: () => void;
}) {
  const db = useDb();
  const guardar = useApp((e) => e.guardarNovedad);
  const eliminar = useApp((e) => e.eliminarNovedad);

  const [f, setF] = useState<Novedad>(novedad);
  const set = <K extends keyof Novedad>(k: K, v: Novedad[K]) => setF((x) => ({ ...x, [k]: v }));

  const yaGuardada = db.novedades.some((n) => n.id === novedad.id);
  const adjuntos = db.adjuntos.filter((a) => a.novedadId === novedad.id);

  return (
    <Modal
      titulo={yaGuardada ? 'Novedad' : 'Asentar una novedad'}
      subtitulo="Queda con fecha en la bitácora del contrato"
      onCerrar={onCerrar}
      pie={
        <>
          {yaGuardada && (
            <button
              className="btn btn--peligro"
              style={{ marginRight: 'auto' }}
              onClick={() => {
                eliminar(novedad.id);
                onCerrar();
              }}
            >
              Eliminar
            </button>
          )}
          <button className="btn btn--fantasma" onClick={onCerrar}>
            Cancelar
          </button>
          <button
            className="btn btn--primario"
            disabled={!f.titulo.trim()}
            onClick={() => {
              guardar(f);
              onCerrar();
            }}
          >
            Guardar
          </button>
        </>
      }
    >
      <Campo etiqueta="Qué pasó">
        <input
          value={f.titulo}
          onChange={(e) => set('titulo', e.target.value)}
          placeholder="El termotanque pierde agua"
        />
      </Campo>

      <div className="grid grid--form">
        <Campo etiqueta="Tipo">
          <select value={f.tipo} onChange={(e) => set('tipo', e.target.value as TipoNovedad)}>
            {(Object.keys(NOMBRE_NOVEDAD) as TipoNovedad[]).map((t) => (
              <option key={t} value={t}>
                {NOMBRE_NOVEDAD[t]}
              </option>
            ))}
          </select>
        </Campo>
        <Campo etiqueta="Fecha">
          <input type="date" value={f.fecha} onChange={(e) => set('fecha', e.target.value)} />
        </Campo>
        <Campo etiqueta="Quién lo reportó" ayuda="Opcional: el inquilino, un vecino, vos.">
          <input
            value={f.registradoPor ?? ''}
            onChange={(e) => set('registradoPor', e.target.value)}
          />
        </Campo>
      </div>

      <Campo etiqueta="Detalle" ayuda="Todo lo que convenga que quede asentado.">
        <textarea
          value={f.detalle ?? ''}
          onChange={(e) => set('detalle', e.target.value)}
          placeholder="Avisó por teléfono. Pierde por la base y moja el lavadero. Se pidió presupuesto."
        />
      </Campo>

      <label className="fila" style={{ gap: 8 }}>
        <input
          type="checkbox"
          checked={f.resuelta}
          onChange={(e) => set('resuelta', e.target.checked)}
        />
        Ya está resuelto
      </label>

      {yaGuardada ? (
        <div className="campo">
          <span className="campo__et">Fotos y documentos</span>
          {adjuntos.length > 0 && (
            <div className="pila" style={{ gap: 6, marginBottom: 8 }}>
              <ListaAdjuntos adjuntos={adjuntos} />
            </div>
          )}
          <SubirArchivos contratoId={novedad.contratoId} novedadId={novedad.id} compacto />
        </div>
      ) : (
        <p className="mini tenue">
          Guardala primero y después vas a poder colgarle fotos o presupuestos.
        </p>
      )}
    </Modal>
  );
}

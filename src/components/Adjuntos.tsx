import { useRef, useState } from 'react';
import { Item, Nota } from './ui';
import { IconoCerrar, IconoLiquidaciones } from './iconos';
import { useApp, useDb } from '../data/store';
import { abrirArchivo, formatearTamano } from '../data/archivos';
import type { Adjunto, ID } from '../domain/types';
import { formatearFecha } from '../domain/util';

/** Etiqueta corta del tipo de archivo: se lee mejor que un ícono genérico. */
function etiquetaTipo(a: Adjunto): { texto: string; clase: string } {
  const extension = a.nombre.includes('.') ? a.nombre.split('.').pop()!.slice(0, 4) : '';
  if (a.tipo === 'application/pdf') return { texto: 'PDF', clase: 'archivo-tipo--pdf' };
  if (a.tipo.startsWith('image/')) return { texto: extension || 'IMG', clase: 'archivo-tipo--img' };
  if (a.tipo.includes('word') || a.tipo.includes('document')) {
    return { texto: extension || 'DOC', clase: 'archivo-tipo--doc' };
  }
  return { texto: extension || 'ARCH', clase: '' };
}

/* ───────────────────────── Zona de subida ───────────────────────── */

export function SubirArchivos({
  contratoId,
  novedadId,
  compacto,
}: {
  contratoId: ID;
  novedadId?: ID;
  /** Versión chica, para colgar un archivo de una novedad. */
  compacto?: boolean;
}) {
  const adjuntar = useApp((e) => e.adjuntar);
  const entrada = useRef<HTMLInputElement>(null);
  const [encima, setEncima] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState('');

  const subir = async (archivos: FileList | null) => {
    if (!archivos?.length) return;
    setError('');
    setSubiendo(true);
    try {
      // De a uno y en orden: así el primero que falle corta y se puede avisar cuál.
      for (const archivo of Array.from(archivos)) {
        await adjuntar(contratoId, archivo, { novedadId });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No pudimos guardar el archivo.');
    } finally {
      setSubiendo(false);
      if (entrada.current) entrada.current.value = '';
    }
  };

  return (
    <div className="no-imprimir">
      <input
        ref={entrada}
        type="file"
        multiple
        style={{ display: 'none' }}
        onChange={(e) => void subir(e.target.files)}
      />

      {compacto ? (
        <button className="btn btn--suave btn--chico" disabled={subiendo} onClick={() => entrada.current?.click()}>
          {subiendo ? 'Subiendo…' : '+ Adjuntar archivo'}
        </button>
      ) : (
        <button
          type="button"
          className={`soltar${encima ? ' soltar--encima' : ''}`}
          disabled={subiendo}
          onClick={() => entrada.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setEncima(true);
          }}
          onDragLeave={() => setEncima(false)}
          onDrop={(e) => {
            e.preventDefault();
            setEncima(false);
            void subir(e.dataTransfer.files);
          }}
        >
          <span className="soltar__icono" aria-hidden="true">
            <IconoLiquidaciones tam={20} />
          </span>
          <strong>{subiendo ? 'Guardando…' : 'Soltá acá el contrato firmado'}</strong>
          <span>o hacé clic para elegir · PDF, fotos o documentos, hasta 20 MB cada uno</span>
        </button>
      )}

      {error && (
        <div style={{ marginTop: 10 }}>
          <Nota tono="critico">{error}</Nota>
        </div>
      )}
    </div>
  );
}

/* ──────────────────────── Listado de archivos ───────────────────── */

export function ListaAdjuntos({ adjuntos }: { adjuntos: Adjunto[] }) {
  const eliminarAdjunto = useApp((e) => e.eliminarAdjunto);
  const [faltante, setFaltante] = useState('');

  const abrir = async (a: Adjunto) => {
    const ok = await abrirArchivo(a.id, a.nombre);
    if (!ok) setFaltante(a.nombre);
  };

  return (
    <>
      {faltante && (
        <Nota tono="critico" titulo="No encontramos el archivo">
          <span className="mini">
            «{faltante}» figura en la ficha pero su contenido no está en este navegador. Suele pasar cuando se
            restauró un respaldo viejo o se limpiaron los datos del sitio.
          </span>
        </Nota>
      )}

      {adjuntos.map((a) => {
        const tipo = etiquetaTipo(a);
        return (
          <Item
            key={a.id}
            avatar={
              <span className={`archivo-tipo ${tipo.clase}`} aria-hidden="true">
                {tipo.texto}
              </span>
            }
            titulo={a.nombre}
            sub={
              <>
                {formatearTamano(a.tamano)} · subido el {formatearFecha(a.fecha)}
                {a.descripcion && ` · ${a.descripcion}`}
              </>
            }
            fin={
              <div className="fila no-imprimir" style={{ gap: 6 }}>
                <button className="btn btn--chico" onClick={() => void abrir(a)}>
                  Abrir
                </button>
                <button
                  className="btn btn--fantasma btn--chico"
                  aria-label={`Borrar ${a.nombre}`}
                  onClick={() => eliminarAdjunto(a.id)}
                >
                  <IconoCerrar tam={15} />
                </button>
              </div>
            }
          />
        );
      })}
    </>
  );
}

/* ───────── Archivos colgados de una novedad, en formato chip ──────── */

export function ChipsAdjuntos({ novedadId }: { novedadId: ID }) {
  const db = useDb();
  const adjuntos = db.adjuntos.filter((a) => a.novedadId === novedadId);
  if (adjuntos.length === 0) return null;

  return (
    <div className="novedad__adjuntos">
      {adjuntos.map((a) => (
        <button
          key={a.id}
          className="adjunto-chip"
          onClick={() => void abrirArchivo(a.id, a.nombre)}
          title={`${a.nombre} · ${formatearTamano(a.tamano)}`}
        >
          <span className={`archivo-tipo ${etiquetaTipo(a).clase}`} style={{ width: 20, height: 20, borderRadius: 7, fontSize: 8 }}>
            {etiquetaTipo(a).texto}
          </span>
          <span>{a.nombre}</span>
        </button>
      ))}
    </div>
  );
}

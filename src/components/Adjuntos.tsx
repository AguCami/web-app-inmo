import { useEffect, useRef, useState } from 'react';
import { usePrefiereCalma } from './animacion';
import { Item, Nota } from './ui';
import { IconoCerrar, IconoLiquidaciones } from './iconos';
import { useApp, useDb } from '../data/store';
import { abrirArchivo, formatearTamano, leerArchivo } from '../data/archivos';
import { VisorArchivo } from './VisorArchivo';
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
  const calma = usePrefiereCalma();

  // El tiro al aro: el archivo vuela en arco hasta el aro, entra, y queda la
  // barra de subida hasta que termina. La subida arranca enseguida; el tiro
  // es solo lo que se ve mientras tanto.
  const [fase, setFase] = useState<'quieto' | 'tiro' | 'subiendo' | 'listo'>('quieto');
  const [progreso, setProgreso] = useState(0);
  const [nombre, setNombre] = useState('');
  const terminado = useRef(false);

  // La subida no informa su avance: la barra camina sola hasta el 90 % y el
  // último tramo lo completa cuando de verdad terminó.
  useEffect(() => {
    if (fase !== 'subiendo') return;
    const t = window.setInterval(() => {
      setProgreso((p) => (terminado.current ? 100 : Math.min(90, p + Math.max(1, (90 - p) * 0.12))));
    }, 120);
    return () => window.clearInterval(t);
  }, [fase]);

  useEffect(() => {
    if (fase === 'subiendo' && progreso >= 100) {
      const t = window.setTimeout(() => setFase('listo'), 250);
      return () => window.clearTimeout(t);
    }
    if (fase === 'listo') {
      const t = window.setTimeout(() => setFase('quieto'), 1800);
      return () => window.clearTimeout(t);
    }
  }, [fase, progreso]);

  const subir = async (archivos: FileList | null) => {
    if (!archivos?.length) return;
    const lista = Array.from(archivos);
    setError('');
    setSubiendo(true);
    setNombre(lista.length > 1 ? `${lista.length} archivos` : lista[0].name);
    setProgreso(0);
    terminado.current = false;
    if (compacto || calma) {
      setFase('subiendo');
    } else {
      setFase('tiro');
      window.setTimeout(() => setFase((f) => (f === 'tiro' ? 'subiendo' : f)), 900);
    }
    try {
      // De a uno y en orden: así el primero que falle corta y se puede avisar cuál.
      for (const archivo of lista) {
        await adjuntar(contratoId, archivo, { novedadId });
      }
      terminado.current = true;
      if (compacto) setFase('quieto');
    } catch (e) {
      setFase('quieto');
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
          className={`soltar soltar--aro soltar--${fase}${encima ? ' soltar--encima' : ''}`}
          disabled={subiendo || fase !== 'quieto'}
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
          {fase === 'quieto' || fase === 'tiro' ? (
            <>
              <strong>{encima ? '¡Soltalo, al aro!' : 'Soltá acá el contrato firmado'}</strong>
              <span>o hacé clic para elegir · PDF, fotos o documentos, hasta 20 MB cada uno</span>
            </>
          ) : (
            <span className={`soltar__barra${fase === 'listo' ? ' soltar__barra--lista' : ''}`} role="status">
              <span className="soltar__barra-cab">
                <span className="soltar__barra-nombre">{nombre}</span>
                <span>{fase === 'listo' ? 'Listo' : `${Math.round(progreso)} %`}</span>
              </span>
              <span className="soltar__barra-pista">
                <span style={{ width: `${fase === 'listo' ? 100 : progreso}%` }} />
              </span>
              <span className="soltar__barra-pie">
                {fase === 'listo' ? '✓ Archivo guardado en el legajo' : 'Subiendo…'}
              </span>
            </span>
          )}

          {/* El aro: tablero, aro y red. La pelota es el archivo. */}
          <span className="soltar__cancha" aria-hidden="true">
            {fase === 'tiro' && (
              <span className="soltar__pelota">
                <span>
                  <IconoLiquidaciones tam={16} />
                </span>
              </span>
            )}
            <svg className="soltar__aro" viewBox="0 0 64 60" width="64" height="60">
              <rect x="10" y="2" width="44" height="26" rx="5" className="soltar__tablero" />
              <rect x="24" y="12" width="16" height="11" rx="2" className="soltar__cuadro" />
              <g className="soltar__red">
                <path d="M17 32 L22 54 M25 32 L28 54 M32 32 L32 54 M39 32 L36 54 M47 32 L42 54" />
                <path d="M18 38 H46 M20 45 H44 M22 52 H42" />
              </g>
              <ellipse cx="32" cy="32" rx="16" ry="3.5" className="soltar__llanta" />
            </svg>
          </span>
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
  const [viendo, setViendo] = useState<Adjunto | null>(null);

  // Los PDF y las imágenes se leen adentro de la app; el resto se baja.
  const abrir = async (a: Adjunto) => {
    if (a.tipo === 'application/pdf' || a.tipo.startsWith('image/')) {
      if (await leerArchivo(a.id)) setViendo(a);
      else setFaltante(a.nombre);
      return;
    }
    const ok = await abrirArchivo(a.id, a.nombre);
    if (!ok) setFaltante(a.nombre);
  };

  return (
    <>
      {viendo && <VisorArchivo adjunto={viendo} onCerrar={() => setViendo(null)} />}
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

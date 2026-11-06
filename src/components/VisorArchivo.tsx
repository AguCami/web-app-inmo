import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { IconoCerrar } from './iconos';
import { abrirArchivo, descargarArchivo, leerArchivo } from '../data/archivos';
import type { Adjunto } from '../domain/types';

/**
 * Muestra un PDF o una imagen adentro de la app, sin salir a otra pestaña.
 * Si el navegador no lo puede mostrar, queda abrirlo aparte o bajarlo.
 *
 * Va encima de todo (también de otra ventana, como el formulario del
 * contrato): Escape cierra solo el visor.
 */
export function VisorArchivo({ adjunto, onCerrar }: { adjunto: Adjunto; onCerrar: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let vigente = true;
    let creada: string | null = null;
    void leerArchivo(adjunto.id).then((contenido) => {
      if (!vigente) return;
      if (!contenido) return setError(true);
      creada = URL.createObjectURL(contenido);
      setUrl(creada);
    });
    return () => {
      vigente = false;
      if (creada) URL.revokeObjectURL(creada);
    };
  }, [adjunto.id]);

  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // Que no cierre también la ventana de abajo.
      e.stopImmediatePropagation();
      onCerrar();
    };
    document.addEventListener('keydown', alTeclear, true);
    return () => document.removeEventListener('keydown', alTeclear, true);
  }, [onCerrar]);

  const esImagen = adjunto.tipo.startsWith('image/');

  return createPortal(
    <div className="visor" role="dialog" aria-modal="true" aria-label={adjunto.nombre}>
      <header className="visor__cab">
        <strong className="crece">{adjunto.nombre}</strong>
        <button className="btn btn--chico" onClick={() => void abrirArchivo(adjunto.id, adjunto.nombre)}>
          Abrir en otra pestaña
        </button>
        <button className="btn btn--chico" onClick={() => void descargarArchivo(adjunto.id, adjunto.nombre)}>
          Descargar
        </button>
        <button className="btn btn--fantasma btn--icono" onClick={onCerrar} aria-label="Cerrar">
          <IconoCerrar />
        </button>
      </header>
      <div className="visor__cuerpo">
        {error ? (
          <p className="visor__aviso">No pudimos traer el archivo. Probá descargarlo.</p>
        ) : !url ? (
          <p className="visor__aviso">Cargando…</p>
        ) : esImagen ? (
          <img src={url} alt={adjunto.nombre} />
        ) : (
          <iframe src={url} title={adjunto.nombre} />
        )}
      </div>
    </div>,
    document.body,
  );
}

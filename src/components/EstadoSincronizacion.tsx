import { useEffect } from 'react';
import { useApp } from '../data/store';
import { Nota } from './ui';

/**
 * Qué está pasando con el servidor.
 *
 * Mientras todo va bien es una línea chica en la cabecera. Si una escritura
 * falla, se convierte en un aviso que no se puede ignorar: lo peor que
 * podría hacer la app es seguir mostrando los datos como si estuvieran
 * guardados cuando no lo están.
 */
export function EstadoSincronizacion() {
  const modoServidor = useApp((e) => e.modoServidor);
  const estado = useApp((e) => e.sincronizacion);
  const error = useApp((e) => e.errorSincronizacion);
  const reintentar = useApp((e) => e.reintentarSincronizacion);

  // Si quedó algo sin mandar, avisar antes de cerrar la pestaña.
  useEffect(() => {
    if (!modoServidor) return;
    const alSalir = (e: BeforeUnloadEvent) => {
      if (estado === 'al_dia') return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', alSalir);
    return () => window.removeEventListener('beforeunload', alSalir);
  }, [modoServidor, estado]);

  if (!modoServidor || estado === 'al_dia') return null;

  if (estado === 'guardando') {
    return (
      <div className="sincro sincro--guardando no-imprimir" style={{ marginBottom: 12 }}>
        <span className="sincro__punto" />
        Guardando…
      </div>
    );
  }

  return (
    <div className="no-imprimir" style={{ marginBottom: 14 }}>
      <Nota tono="critico" titulo="No se pudo guardar en el servidor">
        <span>
          Lo que cambiaste sigue en pantalla pero <strong>todavía no está guardado</strong>. No
          cierres la pestaña hasta que diga que está al día.
          {error && <> El servidor dijo: {error}</>}
        </span>
        <div className="fila" style={{ marginTop: 10 }}>
          <button className="btn btn--chico" onClick={reintentar}>
            Reintentar ahora
          </button>
        </div>
      </Nota>
    </div>
  );
}

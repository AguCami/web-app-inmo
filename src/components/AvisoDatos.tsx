import { useState } from 'react';
import { Link } from 'react-router-dom';
import { exportarJSON } from '../data/db';
import { useApp, useDb } from '../data/store';
import { DIAS_TOLERADOS, saludDeLosDatos } from '../domain/salud';
import { plural } from '../domain/util';
import { IconoAlerta } from './iconos';

/**
 * La barra que avisa que los datos están en riesgo.
 *
 * Va en todas las pantallas y no se puede cerrar, pero se resuelve sola: con
 * un clic en el botón deja de aparecer. Un aviso que se puede descartar lo
 * descarta todo el mundo el primer día, y lo que está en juego acá es la
 * cartera entera de la inmobiliaria.
 */
export function AvisoDatos() {
  const db = useDb();
  const registrarRespaldo = useApp((e) => e.registrarRespaldo);
  const modoServidor = useApp((e) => e.modoServidor);
  const [bajando, setBajando] = useState(false);

  // Con servidor, los datos no dependen de este navegador: el respaldo lo
  // hace Supabase y el aviso que importa es el de la sincronización.
  if (modoServidor) return null;

  const salud = saludDeLosDatos(db);
  if (salud.alerta === 'ninguna') return null;

  const bajarCopia = async () => {
    setBajando(true);
    await exportarJSON(db);
    registrarRespaldo();
    setBajando(false);
  };

  if (salud.alerta === 'demo') {
    return (
      <div className="aviso-datos aviso-datos--demo no-imprimir">
        <IconoAlerta tam={17} />
        <span>
          <strong>Estos son datos de ejemplo.</strong> Antes de cargar la cartera real conviene
          vaciarlos, para no terminar con propiedades inventadas mezcladas con las de verdad.
        </span>
        <Link className="btn btn--chico" to="/ajustes">
          Empezar de cero
        </Link>
      </div>
    );
  }

  const nunca = salud.alerta === 'sin_respaldo';
  return (
    <div className="aviso-datos aviso-datos--riesgo no-imprimir">
      <IconoAlerta tam={17} />
      <span>
        {nunca ? (
          <>
            <strong>Todavía no bajaste ninguna copia de seguridad.</strong> Los datos viven solo en
            este navegador: si se limpian, no hay de dónde recuperarlos.
          </>
        ) : (
          <>
            <strong>
              Hace {plural(salud.diasSinRespaldo ?? 0, 'día', 'días')} que no bajás una copia.
            </strong>{' '}
            Conviene bajar una al menos cada {DIAS_TOLERADOS} días.
          </>
        )}
      </span>
      <button className="btn btn--chico" onClick={bajarCopia} disabled={bajando}>
        {bajando ? 'Armando la copia…' : 'Descargar copia ahora'}
      </button>
    </div>
  );
}

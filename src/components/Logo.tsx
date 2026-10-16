import { useState } from 'react';
import { IconoPanel } from './iconos';

/**
 * Logo de la inmobiliaria.
 *
 * Se sirve desde `public/logo.png`, así que alcanza con dejar el archivo ahí
 * para que aparezca en toda la app. Mientras no esté, cae al ícono genérico:
 * nadie ve un cuadro roto ni queda un hueco en el menú.
 */
export function Logo({ tam = 34 }: { tam?: number }) {
  const [falla, setFalla] = useState(false);

  if (falla) {
    return (
      <span className="marca__logo" style={{ width: tam, height: tam }} aria-hidden="true">
        <IconoPanel tam={Math.round(tam * 0.56)} />
      </span>
    );
  }

  return (
    <img
      className="marca__logo marca__logo--imagen"
      style={{ width: tam, height: tam }}
      src={`${import.meta.env.BASE_URL}logo.png`}
      alt=""
      onError={() => setFalla(true)}
    />
  );
}

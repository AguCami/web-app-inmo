import { useEffect, useState } from 'react';
import { IconoAuto, IconoLuna, IconoSol } from './iconos';

type Tema = 'auto' | 'claro' | 'oscuro';
const CLAVE = 'gestion-alquileres/tema';

function leer(): Tema {
  try {
    const v = localStorage.getItem(CLAVE);
    return v === 'claro' || v === 'oscuro' ? v : 'auto';
  } catch {
    return 'auto';
  }
}

export function InterruptorTema() {
  const [tema, setTema] = useState<Tema>(leer);

  useEffect(() => {
    const raiz = document.documentElement;
    if (tema === 'auto') raiz.removeAttribute('data-theme');
    else raiz.setAttribute('data-theme', tema === 'oscuro' ? 'dark' : 'light');
    try {
      localStorage.setItem(CLAVE, tema);
    } catch {
      /* sin almacenamiento: el tema vale solo para esta sesión */
    }
  }, [tema]);

  const siguiente: Record<Tema, Tema> = { auto: 'claro', claro: 'oscuro', oscuro: 'auto' };
  const nombre: Record<Tema, string> = { auto: 'automático', claro: 'claro', oscuro: 'oscuro' };
  const Icono = tema === 'claro' ? IconoSol : tema === 'oscuro' ? IconoLuna : IconoAuto;

  return (
    <button
      className="btn btn--fantasma btn--icono no-imprimir"
      onClick={() => setTema(siguiente[tema])}
      title={`Tema ${nombre[tema]}`}
      aria-label={`Cambiar tema. Ahora está en ${nombre[tema]}`}
    >
      <Icono />
    </button>
  );
}

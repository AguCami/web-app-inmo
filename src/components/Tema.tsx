import { useSyncExternalStore } from 'react';
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

/*
 * El tema es uno solo para toda la app, pero lo cambian dos controles: el
 * interruptor «Modo noche» del menú y el botón de la cabecera, que es el que
 * queda en el celular. Un estado chico compartido evita que se desfasen.
 */
let actual: Tema = leer();
const oyentes = new Set<() => void>();
const sistemaOscuro =
  typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null;

function aplicar(tema: Tema) {
  actual = tema;
  const raiz = document.documentElement;
  if (tema === 'auto') raiz.removeAttribute('data-theme');
  else raiz.setAttribute('data-theme', tema === 'oscuro' ? 'dark' : 'light');
  try {
    localStorage.setItem(CLAVE, tema);
  } catch {
    /* sin almacenamiento: el tema vale solo para esta sesión */
  }
  oyentes.forEach((o) => o());
}
if (typeof document !== 'undefined') aplicar(actual);

function suscribir(o: () => void) {
  oyentes.add(o);
  sistemaOscuro?.addEventListener('change', o);
  return () => {
    oyentes.delete(o);
    sistemaOscuro?.removeEventListener('change', o);
  };
}

export function useTema() {
  const tema = useSyncExternalStore(suscribir, () => actual);
  const sistema = useSyncExternalStore(suscribir, () => sistemaOscuro?.matches ?? false);
  const oscuro = tema === 'oscuro' || (tema === 'auto' && sistema);
  return { tema, oscuro, fijar: aplicar };
}

export function InterruptorTema() {
  const { tema, fijar } = useTema();

  const siguiente: Record<Tema, Tema> = { auto: 'claro', claro: 'oscuro', oscuro: 'auto' };
  const nombre: Record<Tema, string> = { auto: 'automático', claro: 'claro', oscuro: 'oscuro' };
  const Icono = tema === 'claro' ? IconoSol : tema === 'oscuro' ? IconoLuna : IconoAuto;

  return (
    <button
      className="btn btn--fantasma btn--icono btn--tema no-imprimir"
      onClick={() => fijar(siguiente[tema])}
      title={`Tema ${nombre[tema]}`}
      aria-label={`Cambiar tema. Ahora está en ${nombre[tema]}`}
    >
      <Icono />
    </button>
  );
}

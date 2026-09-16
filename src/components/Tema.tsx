import { useEffect, useState } from 'react';

type Tema = 'auto' | 'claro' | 'oscuro';
const CLAVE = 'inmo-contable/tema';

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
  const icono: Record<Tema, string> = { auto: '🌓', claro: '☀️', oscuro: '🌙' };
  const nombre: Record<Tema, string> = { auto: 'Automático', claro: 'Claro', oscuro: 'Oscuro' };

  return (
    <button
      className="btn btn--chico btn--fantasma no-imprimir"
      onClick={() => setTema(siguiente[tema])}
      title={`Tema: ${nombre[tema]}`}
      aria-label={`Cambiar tema. Actual: ${nombre[tema]}`}
    >
      <span aria-hidden="true">{icono[tema]}</span>
    </button>
  );
}

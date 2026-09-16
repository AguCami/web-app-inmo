import type { ReactNode } from 'react';
import { InterruptorTema } from './Tema';

/** Encabezado de página: título, bajada y acciones propias de la pantalla. */
export function Encabezado({
  titulo,
  bajada,
  children,
}: {
  titulo: string;
  bajada?: string;
  children?: ReactNode;
}) {
  return (
    <header className="barra">
      <div className="barra__titulo">
        <h1>{titulo}</h1>
        {bajada && <p>{bajada}</p>}
      </div>
      {children}
      <InterruptorTema />
    </header>
  );
}

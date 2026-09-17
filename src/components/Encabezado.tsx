import type { ReactNode } from 'react';
import { InterruptorTema } from './Tema';

/** Encabezado de pantalla: título, bajada y acciones propias de la página. */
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
    <header className="cabecera">
      <div className="cabecera__texto">
        <h1>{titulo}</h1>
        {bajada && <p>{bajada}</p>}
      </div>
      {children}
      <InterruptorTema />
    </header>
  );
}

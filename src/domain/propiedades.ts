import type { Propiedad } from './types';

/** «Honduras 4820 5º "B"» — una sola forma de escribir la dirección en toda la app. */
export function direccionDe(p: Pick<Propiedad, 'calle' | 'numero' | 'piso' | 'depto'>): string {
  const piso = p.piso ? ` ${p.piso}º` : '';
  const depto = p.depto ? ` "${p.depto}"` : '';
  return `${p.calle} ${p.numero}${piso}${depto}`;
}

export function direccionCompleta(p: Propiedad): string {
  return `${direccionDe(p)}, ${p.barrio}`;
}

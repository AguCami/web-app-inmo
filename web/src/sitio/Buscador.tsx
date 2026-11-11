import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LOCALIDADES, TIPOS } from '../datos';
import { BASE } from './Sitio';
import { Desplegable } from './Desplegable';
import { IcoBuscar } from './iconos';

export const OPCIONES_TIPO = [
  { valor: '', texto: 'Todo' },
  ...[...TIPOS, 'Otros'].map((t) => ({
    valor: t,
    texto: t === 'Lote' ? 'Lotes y terrenos' : t === 'Otros' ? 'Otros' : `${t}s`,
  })),
];

export const OPCIONES_LOCALIDAD = [
  { valor: '', texto: 'Todas las localidades' },
  ...LOCALIDADES.map((l) => ({ valor: l, texto: l })),
];

/** Qué y dónde: lleva al listado con esos filtros puestos. */
export function Buscador() {
  const navegar = useNavigate();
  const [tipo, setTipo] = useState('');
  const [loc, setLoc] = useState('');

  const buscar = (e: React.FormEvent) => {
    e.preventDefault();
    const q = new URLSearchParams();
    if (tipo) q.set('tipo', tipo);
    if (loc) q.set('loc', loc);
    const s = q.toString();
    navegar(`${BASE}/propiedades${s ? `?${s}` : ''}`);
  };

  return (
    <form className="busqueda vidrio" onSubmit={buscar}>
      <Desplegable clase="busqueda__campo" etiqueta="Qué buscás" valor={tipo} opciones={OPCIONES_TIPO} alCambiar={setTipo} />
      <Desplegable clase="busqueda__campo" etiqueta="Dónde" valor={loc} opciones={OPCIONES_LOCALIDAD} alCambiar={setLoc} />
      <button className="btn btn--primario busqueda__boton" type="submit">
        <IcoBuscar /> Buscar
      </button>
    </form>
  );
}

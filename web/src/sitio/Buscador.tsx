import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LOCALIDADES, TIPOS } from '../datos';
import { BASE } from './Sitio';
import { IcoBuscar } from './iconos';

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
      <label className="busqueda__campo">
        <span>Qué buscás</span>
        <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
          <option value="">Todo</option>
          {[...TIPOS, 'Otros'].map((t) => (
            <option key={t} value={t}>{t === 'Lote' ? 'Lotes y terrenos' : t === 'Otros' ? 'Otros' : `${t}s`}</option>
          ))}
        </select>
      </label>
      <label className="busqueda__campo">
        <span>Dónde</span>
        <select value={loc} onChange={(e) => setLoc(e.target.value)}>
          <option value="">Todas las localidades</option>
          {LOCALIDADES.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
      </label>
      <button className="btn btn--primario busqueda__boton" type="submit">
        <IcoBuscar /> Buscar
      </button>
    </form>
  );
}

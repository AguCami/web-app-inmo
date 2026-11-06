import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LOCALIDADES, PROPIEDADES, TIPOS, recientes, tipoDeFiltro } from '../datos';
import { BASE } from './Sitio';
import { Tarjeta } from './Tarjeta';
import { IcoBuscar, IcoCasa, IcoFlecha, IcoTerreno } from './iconos';

const ULTIMAS = recientes(PROPIEDADES).slice(0, 6);

const CUENTA_POR_TIPO = (() => {
  const c: Record<string, number> = {};
  for (const p of PROPIEDADES) c[tipoDeFiltro(p)] = (c[tipoDeFiltro(p)] ?? 0) + 1;
  return c;
})();

export function Inicio() {
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
    <>
      <section className="portada">
        <p className="portada__pre">Inversiones Generales</p>
        <h1 className="portada__titulo">
          <span className="portada__mym">M&nbsp;&amp;&nbsp;M</span>
          <span className="portada__sub">Inmobiliaria</span>
        </h1>
        <p className="portada__bajada">
          Casas, lotes, departamentos y campos en Jesús María, Colonia Caroya y toda la región.
        </p>

        <form className="busqueda vidrio" onSubmit={buscar}>
          <label className="busqueda__campo">
            <span>Qué buscás</span>
            <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
              <option value="">Todo</option>
              {[...TIPOS, 'Otros'].map((t) => (
                <option key={t} value={t}>{t === 'Otros' ? 'Otros' : `${t}s`.replace('Lotes', 'Lotes y terrenos')}</option>
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
      </section>

      <section className="seccion">
        <div className="seccion__cab">
          <div>
            <h2>Recién publicadas</h2>
            <p>Lo último que entró a la cartera.</p>
          </div>
          <Link className="btn btn--suave" to={`${BASE}/propiedades`}>
            Ver las {PROPIEDADES.length} <IcoFlecha />
          </Link>
        </div>
        <div className="grilla">
          {ULTIMAS.map((p) => <Tarjeta key={p.codigo} p={p} />)}
        </div>
      </section>

      <section className="seccion">
        <div className="seccion__cab">
          <div>
            <h2>Explorá por tipo</h2>
          </div>
        </div>
        <div className="tipos">
          {[...TIPOS, 'Otros'].map((t) => (
            <Link key={t} className="tipo vidrio" to={`${BASE}/propiedades?tipo=${encodeURIComponent(t)}`}>
              <span className="tipo__ico">{t === 'Lote' || t === 'Campo' ? <IcoTerreno /> : <IcoCasa />}</span>
              <strong>{t === 'Lote' ? 'Lotes y terrenos' : t === 'Otros' ? 'Locales, galpones y más' : `${t}s`}</strong>
              <span>{CUENTA_POR_TIPO[t] ?? 0} publicadas</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="seccion">
        <div className="nosotros vidrio">
          <div>
            <h2>¿Querés vender o alquilar?</h2>
            <p>
              Tasamos tu propiedad, la publicamos y la mostramos. Y si la alquilás con nosotros,
              administramos el contrato, los aumentos y la cobranza todos los meses.
            </p>
          </div>
          <button
            type="button"
            className="btn btn--primario"
            onClick={() => document.getElementById('contacto')?.scrollIntoView({ behavior: 'smooth' })}
          >
            Hablemos
          </button>
        </div>
      </section>
    </>
  );
}

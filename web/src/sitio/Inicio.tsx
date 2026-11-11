import { Link } from 'react-router-dom';
import { PROPIEDADES, TIPOS, recientes, tipoDeFiltro } from '../datos';
import { Buscador } from './Buscador';
import { Carrusel } from './Carrusel';
import { BASE } from './Sitio';
import { Tarjeta } from './Tarjeta';
import { IcoCasa, IcoFlecha, IcoTerreno } from './iconos';

const ULTIMAS = recientes(PROPIEDADES).slice(0, 6);

const CUENTA_POR_TIPO = (() => {
  const c: Record<string, number> = {};
  for (const p of PROPIEDADES) c[tipoDeFiltro(p)] = (c[tipoDeFiltro(p)] ?? 0) + 1;
  return c;
})();

export function Inicio() {
  return (
    <>
      <Carrusel />
      <Buscador />

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
            <h2>¿Querés vender tu propiedad?</h2>
            <p>
              Te la tasamos según el mercado de la zona, la publicamos y la mostramos a compradores hasta
              concretar la venta.
            </p>
          </div>
          <Link className="btn btn--primario" to={`${BASE}/tasaciones`}>
            Pedí tu tasación
          </Link>
        </div>
      </section>
    </>
  );
}

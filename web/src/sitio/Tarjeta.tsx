import { Link } from 'react-router-dom';
import { foto, slug, type Propiedad } from '../datos';
import { BASE } from './Sitio';
import { IcoCamara, IcoSuperficie, IcoTerreno, IcoUbicacion } from './iconos';

/** Una propiedad en una grilla: la foto, dónde está, qué es y cuánto sale. */
export function Tarjeta({ p }: { p: Propiedad }) {
  return (
    <Link to={`${BASE}/propiedades/${slug(p)}`} className="tarjeta">
      <div className="tarjeta__foto">
        <img src={foto(p.portada, 640, 440)} alt="" loading="lazy" decoding="async" width={640} height={440} />
        <span className="tarjeta__op">{p.operacion}</span>
        {p.fotos.length > 1 && (
          <span className="tarjeta__fotos"><IcoCamara /> {p.fotos.length}</span>
        )}
      </div>
      <div className="tarjeta__cuerpo">
        <span className="tarjeta__tipo">
          {p.tipo} · <IcoUbicacion /> {p.localidad}
        </span>
        <h3 className="tarjeta__titulo">{p.titulo}</h3>
        {(p.cubiertos || p.terreno) && (
          <div className="tarjeta__sup">
            {p.cubiertos && <span title="Superficie cubierta"><IcoSuperficie /> {p.cubiertos}</span>}
            {p.terreno && <span title="Terreno"><IcoTerreno /> {p.terreno}</span>}
          </div>
        )}
        <div className="tarjeta__pie">
          <strong className="tarjeta__precio">{p.precio}</strong>
        </div>
      </div>
    </Link>
  );
}

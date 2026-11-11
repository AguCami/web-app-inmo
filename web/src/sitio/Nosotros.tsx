import { Link } from 'react-router-dom';
import { Logo } from '../../../src/components/Logo';
import { CONTACTO, LOCALIDADES, PROPIEDADES } from '../datos';
import { BASE } from './Sitio';
import { IcoCasa, IcoEscritura, IcoSuperficie, IcoTerreno, IcoUbicacion } from './iconos';

/**
 * Nosotros: quiénes son, qué hacen y dónde. Solo lleva lo que se sabe de
 * cierto; la historia, el equipo y las fotos de la oficina se suman cuando
 * estén.
 */
const SERVICIOS = [
  { ico: <IcoCasa />, titulo: 'Venta', texto: 'Casas, departamentos, lotes, locales y campos. Te acompañamos desde la publicación hasta la escritura.' },
  { ico: <IcoEscritura />, titulo: 'Alquileres', texto: 'Buscamos inquilino, armamos el contrato y administramos el alquiler: aumentos, cobranza y liquidación al propietario todos los meses.' },
  { ico: <IcoSuperficie />, titulo: 'Tasaciones', texto: 'Te decimos cuánto vale tu propiedad según el mercado de la zona.' },
  { ico: <IcoTerreno />, titulo: 'Campos', texto: 'Campos ganaderos y agrícolas en el norte de Córdoba y provincias vecinas.' },
];

export function Nosotros() {
  return (
    <>
      <section className="seccion">
        <div className="nos-portada vidrio">
          <Logo tam={64} />
          <div>
            <p className="pagina__pre">Nosotros</p>
            <h1>Inversiones Generales M &amp; M</h1>
            <p>
              Somos una inmobiliaria de Jesús María, Córdoba. Vendemos, alquilamos y administramos
              propiedades en Jesús María, Colonia Caroya y toda la región.
            </p>
          </div>
        </div>

        <div className="cifras">
          <div className="cifra vidrio"><strong>{PROPIEDADES.length}</strong><span>propiedades publicadas</span></div>
          <div className="cifra vidrio"><strong>{LOCALIDADES.length}</strong><span>localidades</span></div>
          <div className="cifra vidrio"><strong>{PROPIEDADES.filter((p) => p.tipo === 'Campo').length}</strong><span>campos en cartera</span></div>
        </div>
      </section>

      <section className="seccion">
        <div className="seccion__cab"><div><h2>Qué hacemos</h2></div></div>
        <div className="tipos tipos--servicios">
          {SERVICIOS.map((s) => (
            <div key={s.titulo} className="tipo vidrio">
              <span className="tipo__ico">{s.ico}</span>
              <strong>{s.titulo}</strong>
              <span>{s.texto}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="seccion">
        <div className="nosotros vidrio">
          <div>
            <h2>Visitanos</h2>
            <p><IcoUbicacion /> {CONTACTO.direccion}, {CONTACTO.localidad}</p>
          </div>
          <div className="nosotros__botones">
            <a className="btn btn--suave" href={CONTACTO.mapa} target="_blank" rel="noreferrer">Cómo llegar</a>
            <Link className="btn btn--primario" to={`${BASE}/propiedades`}>Ver propiedades</Link>
          </div>
        </div>
      </section>
    </>
  );
}

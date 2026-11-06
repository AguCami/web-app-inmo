import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CONTACTO, PROPIEDADES, buscarPorSlug, enlaceWhatsapp, foto, recientes, type Propiedad } from '../datos';
import { BASE } from './Sitio';
import { Tarjeta } from './Tarjeta';
import { IcoEscritura, IcoFlecha, IcoMail, IcoSuperficie, IcoTerreno, IcoUbicacion, IcoWhatsapp } from './iconos';

/** La ficha de una propiedad: las fotos, los datos, la descripción y cómo consultar. */
export function Ficha() {
  const { codigo } = useParams();
  const p = buscarPorSlug(codigo);

  if (!p) {
    return (
      <section className="seccion">
        <div className="sin-resultados vidrio">
          <p>Esa propiedad ya no está publicada.</p>
          <Link className="btn btn--suave" to={`${BASE}/propiedades`}>Ver las propiedades</Link>
        </div>
      </section>
    );
  }

  const parecidas = recientes(
    PROPIEDADES.filter((o) => o !== p && o.tipo === p.tipo && o.localidad === p.localidad),
  ).slice(0, 3);

  const mensaje = `Hola, quería consultar por la propiedad ${p.codigo}: ${p.titulo}.`;
  const whatsapp = enlaceWhatsapp(mensaje);

  return (
    <>
      <section className="seccion">
        <Link className="volver" to={`${BASE}/propiedades`}>
          <IcoFlecha izq /> Todas las propiedades
        </Link>

        <div className="ficha">
          <Galeria p={p} />

          <aside className="ficha__lado vidrio">
            <span className="ficha__tipo">{p.tipo} en {p.operacion.toLowerCase()}</span>
            <h1 className="ficha__titulo">{p.titulo}</h1>
            <p className="ficha__loc"><IcoUbicacion /> {p.localidad}</p>
            <p className="ficha__precio">{p.precio}</p>

            <ul className="ficha__datos">
              {p.cubiertos && <li><IcoSuperficie /><span>Cubiertos</span><strong>{p.cubiertos}</strong></li>}
              {p.terreno && <li><IcoTerreno /><span>Terreno</span><strong>{p.terreno}</strong></li>}
              {p.escritura !== null && (
                <li><IcoEscritura /><span>Escritura</span><strong>{p.escritura ? 'Sí' : 'No'}</strong></li>
              )}
            </ul>

            <div className="ficha__acciones">
              {whatsapp && (
                <a className="btn btn--primario btn--ancho" href={whatsapp} target="_blank" rel="noreferrer">
                  <IcoWhatsapp /> Consultar por WhatsApp
                </a>
              )}
              {CONTACTO.email && (
                <a
                  className={whatsapp ? 'btn btn--suave btn--ancho' : 'btn btn--primario btn--ancho'}
                  href={`mailto:${CONTACTO.email}?subject=${encodeURIComponent(`Consulta ${p.codigo}`)}&body=${encodeURIComponent(mensaje)}`}
                >
                  <IcoMail /> Consultar por email
                </a>
              )}
              {!whatsapp && !CONTACTO.email && (
                <a className="btn btn--primario btn--ancho" href={CONTACTO.mapa} target="_blank" rel="noreferrer">
                  <IcoUbicacion /> Visitanos en {CONTACTO.direccion}
                </a>
              )}
              {p.geo && (
                <a
                  className="btn btn--fantasma btn--ancho"
                  href={`https://www.google.com/maps/search/?api=1&query=${p.geo[0]},${p.geo[1]}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Ver la zona en el mapa
                </a>
              )}
            </div>
          </aside>
        </div>

        <article className="descripcion vidrio">
          <h2>Descripción</h2>
          <Descripcion texto={p.descripcion} />
        </article>
      </section>

      {parecidas.length > 0 && (
        <section className="seccion">
          <div className="seccion__cab">
            <div>
              <h2>Más en {p.localidad}</h2>
            </div>
          </div>
          <div className="grilla">
            {parecidas.map((o) => <Tarjeta key={o.codigo} p={o} />)}
          </div>
        </section>
      )}
    </>
  );
}

/** La foto grande con flechas, y debajo la tira de miniaturas. También se pasa con el teclado. */
function Galeria({ p }: { p: Propiedad }) {
  const fotos = p.fotos.length ? p.fotos : [p.portada];
  const [i, setI] = useState(0);
  const ir = (d: number) => setI((x) => (x + d + fotos.length) % fotos.length);

  useEffect(() => {
    setI(0);
  }, [p.codigo]);
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === 'ArrowRight') ir(1);
      if (e.key === 'ArrowLeft') ir(-1);
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  });

  // La siguiente se pide antes de que haga falta: al tocar la flecha ya está.
  useEffect(() => {
    if (fotos.length < 2) return;
    const img = new Image();
    img.src = foto(fotos[(i + 1) % fotos.length], 1280, 860);
  }, [i, fotos]);

  return (
    <div className="galeria">
      <div className="galeria__grande vidrio">
        <img key={fotos[i]} src={foto(fotos[i], 1280, 860)} alt={`${p.titulo}, foto ${i + 1} de ${fotos.length}`} />
        {fotos.length > 1 && (
          <>
            <button type="button" className="galeria__flecha galeria__flecha--izq" onClick={() => ir(-1)} aria-label="Foto anterior">
              <IcoFlecha izq />
            </button>
            <button type="button" className="galeria__flecha galeria__flecha--der" onClick={() => ir(1)} aria-label="Foto siguiente">
              <IcoFlecha />
            </button>
            <span className="galeria__cuenta">{i + 1} / {fotos.length}</span>
          </>
        )}
      </div>
      {fotos.length > 1 && (
        <div className="galeria__tira">
          {fotos.map((f, n) => (
            <button
              key={f + n}
              type="button"
              className={n === i ? 'galeria__mini galeria__mini--activa' : 'galeria__mini'}
              onClick={() => setI(n)}
              aria-label={`Ver foto ${n + 1}`}
              aria-current={n === i || undefined}
            >
              <img src={foto(f, 160, 110)} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const VINETA = /^\s*(?:[*•\-–✅✔️▪️🔹🔸]+)\s*/u;

/**
 * El texto tal como se cargó en Wix, con algo de forma: los renglones que
 * empiezan con viñeta se juntan en una lista y el resto van como párrafos.
 */
function Descripcion({ texto }: { texto: string }) {
  const bloques: ({ tipo: 'p'; texto: string } | { tipo: 'ul'; items: string[] })[] = [];
  for (const crudo of texto.split('\n')) {
    const linea = crudo.trim();
    if (!linea) continue;
    if (VINETA.test(linea)) {
      const item = linea.replace(VINETA, '');
      const ultimo = bloques[bloques.length - 1];
      if (ultimo?.tipo === 'ul') ultimo.items.push(item);
      else bloques.push({ tipo: 'ul', items: [item] });
    } else {
      bloques.push({ tipo: 'p', texto: linea });
    }
  }
  return (
    <div className="descripcion__texto">
      {bloques.map((b, n) =>
        b.tipo === 'p' ? (
          <p key={n}>{b.texto}</p>
        ) : (
          <ul key={n}>{b.items.map((t, k) => <li key={k}>{t}</li>)}</ul>
        ),
      )}
    </div>
  );
}

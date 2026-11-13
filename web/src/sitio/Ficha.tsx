import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CONTACTO, PROPIEDADES, buscarPorSlug, enlaceWhatsapp, foto, mensajePropiedad, recientes, type Propiedad } from '../datos';
import { BASE } from './Sitio';
import { Tarjeta } from './Tarjeta';
import { Mazo } from './Mazo';
import { Volteo } from './Volteo';

/**
 * Qué galería usa la ficha:
 * - 'auto':    el mazo de cartas en el celular y la carta que se da vuelta
 *              en la computadora (pantallas de 900 px o más).
 * - 'mazo', 'volteo' o 'clasica': la misma en todos lados. La clásica es la
 *              foto grande con flechas y la tira de miniaturas.
 */
const GALERIA: 'auto' | 'mazo' | 'volteo' | 'clasica' = 'auto';

/** ¿Pantalla de computadora? Se consulta en vivo: cambia si se agranda la ventana. */
function useEsAncho() {
  const consulta = '(min-width: 900px)';
  const [ancho, setAncho] = useState(() => typeof window !== 'undefined' && window.matchMedia(consulta).matches);
  useEffect(() => {
    const mq = window.matchMedia(consulta);
    const alCambiar = () => setAncho(mq.matches);
    mq.addEventListener('change', alCambiar);
    return () => mq.removeEventListener('change', alCambiar);
  }, []);
  return ancho;
}
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

  const mensaje = mensajePropiedad(p, window.location.href);
  const whatsapp = enlaceWhatsapp(mensaje);

  return (
    <>
      <section className="seccion">

        <div className="ficha">
          <GaleriaElegida p={p} />

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

        <article className="descripcion vidrio" aria-label="Descripción">
          <Descripcion p={p} />
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

function GaleriaElegida({ p }: { p: Propiedad }) {
  const ancho = useEsAncho();
  const cual = GALERIA === 'auto' ? (ancho ? 'volteo' : 'mazo') : GALERIA;
  if (cual === 'mazo') return <Mazo p={p} />;
  if (cual === 'volteo') return <Volteo p={p} />;
  return <Galeria p={p} />;
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

/** Viñetas de texto y emojis que en las descripciones hacen de viñeta. */
const VINETA = /^\s*[•*\-–▪◦·✓✔✅🔷🔹🔸🔶🔵▪️]+\s*/u;
const EMOJI = /[\p{Extended_Pictographic}\u{FE0F}\u{200D}\u{1F3FB}-\u{1F3FF}]/gu;
const EMPIEZA_CON_EMOJI = /^\s*\p{Extended_Pictographic}/u;

const sinTildes = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/**
 * Ordena el texto que se cargó en Wix, que viene con emojis, renglones
 * sueltos y datos repetidos, en dos partes:
 * - párrafos: el texto corrido («Sobre la propiedad»);
 * - características: lo que es lista o un dato corto («3 habitaciones»,
 *   «Escritura», «Terreno 760 m²»).
 * Se saca lo que la ficha ya muestra en otro lado o sobra: el título en
 * mayúsculas o con «en venta», la localidad sola, el precio, los «consultanos»
 * y los encabezados tipo «Características:». No se reescribe nada.
 */
export function ordenarDescripcion(texto: string, p: Propiedad) {
  const parrafos: string[] = [];
  const items: string[] = [];
  const vistos = new Set<string>();
  texto.split('\n').forEach((crudo, idx) => {
    const conVineta = VINETA.test(crudo);
    const conEmoji = EMPIEZA_CON_EMOJI.test(crudo);
    const t = crudo.replace(EMOJI, '').replace(VINETA, '').replace(/\s+/g, ' ').trim();
    if (!t) return;
    const letras = t.replace(/[^A-Za-zÁÉÍÓÚÑÜáéíóúñü]/g, '');
    const palabras = t.split(' ').length;
    if (letras.length > 3 && letras === letras.toUpperCase()) return; // títulos en mayúscula
    if (idx < 3 && /\ben venta\b/i.test(t)) return; // «Casa en venta – …»
    if (sinTildes(t) === sinTildes(p.localidad)) return;
    if (/^(valor|precio)\b/i.test(t) || /^(u\$d|usd)\s*[\d.]/i.test(t)) return;
    if (/(consult|contact|llama|escrib|coordin|whats)/.test(sinTildes(t)) && palabras < 16) return;
    if (/:$/.test(t) && t.length < 45) return; // encabezados
    const clave = sinTildes(t);
    if (vistos.has(clave)) return;
    vistos.add(clave);
    if (conVineta || (conEmoji && palabras <= 10) || palabras <= 4) {
      const item = t.replace(/[.;,]+$/, '');
      items.push(item.charAt(0).toUpperCase() + item.slice(1));
    } else {
      parrafos.push(t);
    }
  });
  return { parrafos, items };
}

function Descripcion({ p }: { p: Propiedad }) {
  const { parrafos, items } = ordenarDescripcion(p.descripcion, p);
  // Si no quedó nada (una descripción rara), se muestra tal cual.
  if (!parrafos.length && !items.length) {
    return (
      <div className="descripcion__texto">
        {p.descripcion.split('\n').filter((l) => l.trim()).map((l, k) => <p key={k}>{l}</p>)}
      </div>
    );
  }
  return (
    <div className={parrafos.length && items.length ? 'descripcion__grilla' : 'descripcion__grilla descripcion__grilla--una'}>
      {parrafos.length > 0 && (
        <div className="descripcion__texto">
          <h2>Sobre la propiedad</h2>
          {parrafos.map((t, k) => <p key={k}>{t}</p>)}
        </div>
      )}
      {items.length > 0 && (
        <div className="descripcion__caract">
          <h2>Características</h2>
          <ul className="caract">
            {items.map((t, k) => (
              <li key={k}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

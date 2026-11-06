import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { usePrefiereCalma } from '../../../src/components/animacion';
import { DESTACADA, LOCALIDADES, SELECCION, TIPOS, foto, porCodigo, slug, type Propiedad } from '../datos';
import { BASE } from './Sitio';
import { IcoBuscar, IcoFlecha, IcoUbicacion } from './iconos';

/**
 * La portada animada del inicio. Se maneja con el scroll:
 *
 *   1. Abanico: el título y una selección de propiedades en tarjetas abiertas.
 *   2. Pila: al bajar, las tarjetas se juntan al medio.
 *   3. Cascada: la pila se corre a la derecha y se abre en diagonal mientras
 *      a la izquierda aparece el texto, palabra por palabra.
 *   4. Destacada: las tarjetas salen volando para arriba y sube una propiedad
 *      en grande.
 *
 * La escena mide varias pantallas de alto y su contenido queda fijo
 * (sticky) mientras se recorre: el avance del scroll (0 a 1) decide dónde
 * está cada cosa. No pasa por React: cada cuadro se escriben los estilos
 * directo, y solo cuando el scroll se movió.
 *
 * Con «reducir movimiento» no hay escena: queda el abanico quieto.
 */

const SELECCIONADAS = SELECCION.map(porCodigo).filter((p): p is Propiedad => !!p);
const PRINCIPAL = porCodigo(DESTACADA) ?? SELECCIONADAS[0];

const TITULO = 'Un lugar para encontrar tu próxima propiedad.';
const TEXTO_2 = 'Casas, lotes & campos en Jesús María, Colonia Caroya y toda la región.';

/** Dónde está una tarjeta: desplazamiento, giro, escala y opacidad. */
interface Pose { x: number; y: number; r: number; s: number; o: number }

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const suave = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const tramo = (p: number, a: number, b: number) => suave(clamp((p - a) / (b - a)));
const mezclar = (a: Pose, b: Pose, t: number): Pose => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
  r: a.r + (b.r - a.r) * t,
  s: a.s + (b.s - a.s) * t,
  o: a.o + (b.o - a.o) * t,
});

/** Un giro distinto para cada tarjeta de la pila, para que se note que son varias. */
const GIRO_PILA = [-7, 5, -3, 8, -5, 3, 0, -2];

/** Las cuatro poses de la tarjeta i, según el tamaño de la pantalla. */
function poses(i: number, n: number, W: number, H: number, cw: number, ch: number) {
  const angosto = W < 760;
  const k = i - (n - 1) / 2;
  const cy = angosto ? H * 0.5 : H * 0.52;
  const paso = Math.min(cw * 0.62, (W * (angosto ? 0.74 : 0.86) - cw) / Math.max(1, n - 1));

  const abanico: Pose = { x: k * paso, y: cy + k * k * 6, r: k * 5, s: 1, o: 1 };
  const pila: Pose = { x: 0, y: cy, r: GIRO_PILA[i % GIRO_PILA.length], s: 0.94, o: 1 };
  const cascada: Pose = angosto
    ? { x: -W * 0.24 + i * cw * 0.3, y: H * 0.64 + i * ch * 0.07, r: -8 + i * 2, s: 0.95, o: 1 }
    : { x: W * 0.02 + i * cw * 0.42, y: H * 0.42 + i * ch * 0.13, r: -9 + i * 2.2, s: 1.04, o: 1 };
  const afuera: Pose = { x: W * 0.55 + i * cw * 0.25, y: -H * 0.7 - i * 30, r: 18 + i * 2, s: 0.9, o: 1 };
  return { abanico, pila, cascada, afuera };
}

/** Las palabras de un texto en spans, para revelarlas de a una. */
function Palabras({ texto, clase }: { texto: string; clase?: string }) {
  return (
    <>
      {texto.split(' ').map((w, i) => (
        <span key={i} className={clase} data-palabra style={{ '--i': i } as React.CSSProperties}>
          {w}{' '}
        </span>
      ))}
    </>
  );
}

export function Escena() {
  const calma = usePrefiereCalma();
  const escena = useRef<HTMLDivElement>(null);
  const tarjetas = useRef<(HTMLAnchorElement | null)[]>([]);
  const capa1 = useRef<HTMLDivElement>(null);
  const capa2 = useRef<HTMLDivElement>(null);
  const capa3 = useRef<HTMLDivElement>(null);
  const navegar = useNavigate();
  const [tipo, setTipo] = useState('');
  const [loc, setLoc] = useState('');

  useEffect(() => {
    const el = escena.current;
    if (!el) return;
    let cuadro = 0;

    const dibujar = () => {
      cuadro = 0;
      const W = el.clientWidth;
      const H = window.innerHeight;
      const cw = Math.max(108, Math.min(W * 0.15, 210));
      const ch = cw * 1.27;
      const n = SELECCIONADAS.length;

      // El avance: 0 arriba de todo, 1 cuando la escena terminó de pasar.
      const recorrido = el.offsetHeight - H;
      const p = calma ? 0 : clamp(-el.getBoundingClientRect().top / Math.max(1, recorrido));

      tarjetas.current.forEach((t, i) => {
        if (!t) return;
        const { abanico, pila, cascada, afuera } = poses(i, n, W, H, cw, ch);
        // Cada tarjeta sale un poquito después que la anterior.
        const d = i * 0.012;
        let pose = abanico;
        pose = mezclar(pose, pila, tramo(p, 0.14 + d, 0.3 + d));
        pose = mezclar(pose, cascada, tramo(p, 0.36 + d, 0.52 + d));
        pose = mezclar(pose, afuera, tramo(p, 0.66 + d, 0.82 + d));
        t.style.width = `${cw}px`;
        t.style.height = `${ch}px`;
        t.style.transform = `translate(${pose.x - cw / 2}px, ${pose.y - ch / 2}px) rotate(${pose.r}deg) scale(${pose.s})`;
        t.style.opacity = String(pose.o);
      });

      // 1. El título y el buscador se van al empezar a juntarse las tarjetas.
      const c1 = capa1.current;
      if (c1) {
        const t = tramo(p, 0.06, 0.2);
        c1.style.opacity = String(1 - t);
        c1.style.transform = `translateY(${-30 * t}px)`;
        c1.style.visibility = t >= 1 ? 'hidden' : 'visible';
      }

      // 2. El texto de la cascada: entra palabra por palabra y se va antes del vuelo.
      const c2 = capa2.current;
      if (c2) {
        const fuera = tramo(p, 0.62, 0.7);
        c2.style.opacity = String(1 - fuera);
        c2.style.visibility = p < 0.34 || fuera >= 1 ? 'hidden' : 'visible';
        revelar(c2, p, 0.38, 0.54);
      }

      // 3. La destacada sube desde abajo.
      const c3 = capa3.current;
      if (c3) {
        const t = tramo(p, 0.7, 0.88);
        c3.style.transform = `translateY(${(1 - t) * 105}%)`;
        c3.style.visibility = t <= 0 ? 'hidden' : 'visible';
        revelar(c3, p, 0.8, 0.94);
      }
    };

    const pedir = () => {
      if (!cuadro) cuadro = requestAnimationFrame(dibujar);
    };
    dibujar();
    window.addEventListener('scroll', pedir, { passive: true });
    window.addEventListener('resize', pedir);
    return () => {
      window.removeEventListener('scroll', pedir);
      window.removeEventListener('resize', pedir);
      cancelAnimationFrame(cuadro);
    };
  }, [calma]);

  const buscar = (e: React.FormEvent) => {
    e.preventDefault();
    const q = new URLSearchParams();
    if (tipo) q.set('tipo', tipo);
    if (loc) q.set('loc', loc);
    const s = q.toString();
    navegar(`${BASE}/propiedades${s ? `?${s}` : ''}`);
  };

  return (
    <div ref={escena} className={calma ? 'escena escena--quieta' : 'escena'}>
      <div className="escena__fija">
        {/* 1. Abanico */}
        <div className="escena__capa escena__capa--portada" ref={capa1}>
          <p className="escena__pre">Inversiones Generales M &amp; M · Inmobiliaria</p>
          <h1 className="escena__titulo escena__titulo--entra">
            <Palabras texto={TITULO} />
          </h1>
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
                <option value="">Todas</option>
                {LOCALIDADES.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </label>
            <button className="btn btn--primario busqueda__boton" type="submit">
              <IcoBuscar /> Buscar
            </button>
          </form>
        </div>

        {/* 2. Cascada */}
        {!calma && (
          <div className="escena__capa escena__capa--texto" ref={capa2}>
            <p className="escena__etiqueta">Propiedades seleccionadas</p>
            <h2 className="escena__titulo escena__titulo--izq">
              <Palabras texto={TEXTO_2} />
            </h2>
            <p className="escena__bajada" data-palabra style={{ '--i': 14 } as React.CSSProperties}>
              Una selección de lo que tenemos hoy. Tocá una tarjeta para ver la propiedad, o mirá la cartera completa.
            </p>
            <Link className="btn btn--primario" to={`${BASE}/propiedades`} data-palabra style={{ '--i': 15 } as React.CSSProperties}>
              Ver todas las propiedades <IcoFlecha />
            </Link>
          </div>
        )}

        {/* Las tarjetas */}
        <div className="escena__mazo" aria-label="Propiedades seleccionadas">
          {SELECCIONADAS.map((p, i) => (
            <Link
              key={p.codigo}
              ref={(el) => { tarjetas.current[i] = el; }}
              to={`${BASE}/propiedades/${slug(p)}`}
              className="naipe"
              style={{ zIndex: i + 1 }}
              aria-label={`${p.titulo}, ${p.precio}`}
            >
              <img src={foto(p.portada, 440, 560)} alt="" decoding="async" />
              <span className="naipe__pie">
                <strong>{p.precio}</strong>
                <span>{p.localidad}</span>
              </span>
              {i % 3 === 1 && <span className={i % 2 ? 'naipe__chip' : 'naipe__chip naipe__chip--der'}>{p.tipo}</span>}
            </Link>
          ))}
        </div>

        {/* 4. Destacada */}
        {!calma && PRINCIPAL && (
          <div className="escena__capa escena__capa--destacada" ref={capa3}>
            <div className="destacada__cab">
              <p className="escena__etiqueta" data-palabra style={{ '--i': 0 } as React.CSSProperties}>Destacada</p>
              <h2 className="escena__titulo escena__titulo--izq">
                <Palabras texto={PRINCIPAL.titulo} />
              </h2>
            </div>
            <Link className="destacada__foto" to={`${BASE}/propiedades/${slug(PRINCIPAL)}`}>
              <img src={foto(PRINCIPAL.portada, 1600, 900)} alt="" decoding="async" loading="lazy" />
              <span className="destacada__datos">
                <span><IcoUbicacion /> {PRINCIPAL.localidad}</span>
                <strong>{PRINCIPAL.precio}</strong>
              </span>
              <span className="btn btn--primario destacada__ir">Ver propiedad <IcoFlecha /></span>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

/** Revela las palabras de una capa de a una entre los avances a y b: de borrosas y transparentes a nítidas. */
function revelar(capa: HTMLElement, p: number, a: number, b: number) {
  const palabras = capa.querySelectorAll<HTMLElement>('[data-palabra]');
  const n = palabras.length;
  palabras.forEach((w, i) => {
    const ini = a + ((b - a) * 0.7 * i) / Math.max(1, n - 1);
    const t = clamp((p - ini) / ((b - a) * 0.3));
    w.style.opacity = String(0.08 + 0.92 * t);
    w.style.filter = t >= 1 ? 'none' : `blur(${(1 - t) * 8}px)`;
    w.style.transform = `translateY(${(1 - t) * 8}px)`;
  });
}

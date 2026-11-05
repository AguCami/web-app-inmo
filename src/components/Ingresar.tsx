import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Campo, Nota } from './ui';
import { Logo } from './Logo';
import { useApp } from '../data/store';
import fondo from '../assets/ingreso-fondo.webp';
import { usePrefiereCalma } from './animacion';
import { useColgante } from './colgante';

/** Lo que va impreso en la cinta. */
const NOMBRE = 'Inversiones Generales M & M';
const SEPARADOR = '  ·  ';
/** El tramo de cinta que sigue por arriba de la pantalla (margin-top en app.css). */
const CINTA_OCULTA = 400;

/**
 * El texto de la cinta, siempre en nombres enteros.
 *
 * Solo se ve el tramo de abajo (--cinta), que cambia con el alto de la
 * pantalla y nunca es más corto que el nombre. Se repite tantas veces como
 * entre completo: así el borde de la pantalla nunca corta una palabra.
 */
function useTextoCinta() {
  const cinta = useRef<HTMLDivElement>(null);
  const [texto, setTexto] = useState(NOMBRE);

  useLayoutEffect(() => {
    const el = cinta.current;
    const molde = el?.querySelector('span');
    if (!el || !molde) return;

    let vivo = true;
    const medir = () => {
      if (!vivo) return;
      const visible = el.clientHeight - CINTA_OCULTA;
      // Un clon fuera del flujo, con los mismos estilos, para medir el largo.
      const prueba = molde.cloneNode() as HTMLSpanElement;
      prueba.style.position = 'absolute';
      prueba.style.visibility = 'hidden';
      el.appendChild(prueba);
      let elegido = NOMBRE;
      for (let n = 2; n <= 8; n++) {
        const t = Array(n).fill(NOMBRE).join(SEPARADOR);
        prueba.textContent = t;
        if (prueba.offsetHeight > visible) break;
        elegido = t;
      }
      el.removeChild(prueba);
      setTexto(elegido);
    };

    medir();
    window.addEventListener('resize', medir);
    // La tipografía puede llegar después: cambia el largo del texto.
    document.fonts?.ready.then(medir).catch(() => {});
    return () => {
      vivo = false;
      window.removeEventListener('resize', medir);
    };
  }, []);

  return { cinta, texto };
}

/**
 * La pantalla de ingreso. Es lo único que se ve sin sesión: con servidor, la
 * app no muestra ni un dato antes de saber quién está del otro lado.
 *
 * Va siempre en claro: el fondo es la espiral sobre blanco, y una tarjeta
 * oscura encima no combina. El claro se fija solo acá (.tema-claro), no en
 * toda la página: al salir, el panel ya aparece con el tema elegido.
 *
 * La tarjeta es una credencial colgada de una cinta: se balancea, se puede
 * agarrar y revolear, y vuelve sola. Los campos y el botón no arrastran, así
 * que escribir y tocar funciona como siempre.
 */
export function Ingresar({
  saliendo = false,
  alMostrarPanel,
  alTerminar,
  alEntrarDePrueba,
}: {
  /** Se entró: la tarjeta sale tirada hacia arriba y deja ver el panel. */
  saliendo?: boolean;
  /** La tarjeta ya salió de la pantalla: se puede dibujar el panel debajo. */
  alMostrarPanel?: () => void;
  alTerminar?: () => void;
  /** Sin servidor: el botón muestra la salida en vez de autenticar. */
  alEntrarDePrueba?: () => void;
} = {}) {
  const iniciarSesion = useApp((e) => e.iniciarSesion);
  // Sin servidor esta pantalla es una vista previa: no hay a quién
  // preguntarle si la contraseña es correcta.
  const modoServidor = useApp((e) => e.modoServidor);

  const [email, setEmail] = useState('');
  const [clave, setClave] = useState('');
  const [error, setError] = useState('');
  const [entrando, setEntrando] = useState(false);
  const calma = usePrefiereCalma();
  const { brazo, tarjeta, empujar, manejadores } = useColgante(calma);
  const { cinta, texto: textoCinta } = useTextoCinta();

  // La salida: un tirón de la cinta y la tarjeta se va para arriba. Cuando
  // termina, App la desmonta y queda el panel.
  // Los avisos llegan nuevos en cada render de App: por ref, para que los
  // temporizadores no vuelvan a empezar cada vez que App se dibuja.
  const avisos = useRef({ alMostrarPanel, alTerminar });
  avisos.current = { alMostrarPanel, alTerminar };
  useEffect(() => {
    if (!saliendo) return;
    // Los tiempos van con los de .colgante--sale e .ingreso--sale en app.css.
    const panel = window.setTimeout(() => avisos.current.alMostrarPanel?.(), calma ? 0 : 520);
    const fin = window.setTimeout(() => avisos.current.alTerminar?.(), calma ? 260 : 1000);
    return () => {
      window.clearTimeout(panel);
      window.clearTimeout(fin);
    };
  }, [saliendo, calma]);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (entrando || saliendo) return;
    if (!modoServidor) {
      alEntrarDePrueba?.();
      return;
    }
    setEntrando(true);
    setError('');
    const falla = await iniciarSesion(email.trim(), clave);
    if (falla) {
      setError(falla);
      setEntrando(false);
      // Un sacudón: dice "no" sin que haga falta leer.
      empujar(Math.random() < 0.5 ? -2.6 : 2.6);
    }
  };

  return (
    <div className={saliendo ? 'ingreso tema-claro ingreso--sale' : 'ingreso tema-claro'} aria-hidden={saliendo || undefined}>
      {/* La espiral de la marca, detrás de la tarjeta. */}
      <img className="ingreso__fondo" src={fondo} alt="" aria-hidden="true" />

      <div className={saliendo ? 'colgante colgante--sale' : calma ? 'colgante' : 'colgante colgante--entra'}>
        <div className="colgante__brazo" ref={brazo}>
          <div className="colgante__cinta" ref={cinta} aria-hidden="true">
            <span>{textoCinta}</span>
          </div>
          <div className="colgante__gancho" aria-hidden="true" />
          <div className="ingreso__caja" ref={tarjeta} {...manejadores}>
            <span className="ingreso__ojal" aria-hidden="true" />
            <span className="colgante__argolla" aria-hidden="true" />
            <form className="ingreso__form" onSubmit={enviar}>
              <div className="ingreso__marca">
                <Logo tam={52} />
                <strong>Inversiones Generales M&nbsp;&amp;&nbsp;M Inmobiliaria</strong>
                <span>Administración de alquileres</span>
              </div>

              {error && <Nota tono="critico"><span>{error}</span></Nota>}

              <Campo etiqueta="Email">
                <input
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </Campo>

              <Campo etiqueta="Contraseña">
                <input
                  type="password"
                  autoComplete="current-password"
                  required
                  value={clave}
                  onChange={(e) => setClave(e.target.value)}
                />
              </Campo>

              <button className="btn btn--primario btn--ancho" type="submit" disabled={entrando || saliendo || (!modoServidor && !alEntrarDePrueba)}>
                {entrando ? 'Entrando…' : 'Entrar'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

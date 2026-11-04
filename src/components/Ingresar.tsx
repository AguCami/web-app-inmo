import { useEffect, useState } from 'react';
import { Campo, Nota } from './ui';
import { Logo } from './Logo';
import { useApp } from '../data/store';
import fondo from '../assets/ingreso-fondo.webp';
import { usePrefiereCalma } from './animacion';
import { useColgante } from './colgante';

/** Lo que va impreso en la cinta. Se repite: la cinta se pierde arriba. */
const CINTA = Array(8).fill('Inversiones Generales M & M').join('  ·  ');

/**
 * La pantalla de ingreso. Es lo único que se ve sin sesión: con servidor, la
 * app no muestra ni un dato antes de saber quién está del otro lado.
 *
 * Va siempre en claro: el fondo es la espiral sobre blanco, y una tarjeta
 * oscura encima no combina. Al salir se devuelve el tema que había.
 *
 * La tarjeta es una credencial colgada de una cinta: se balancea, se puede
 * agarrar y revolear, y vuelve sola. Los campos y el botón no arrastran, así
 * que escribir y tocar funciona como siempre.
 */
export function Ingresar() {
  const iniciarSesion = useApp((e) => e.iniciarSesion);

  const [email, setEmail] = useState('');
  const [clave, setClave] = useState('');
  const [error, setError] = useState('');
  const [entrando, setEntrando] = useState(false);
  const calma = usePrefiereCalma();
  const { brazo, tarjeta, empujar, manejadores } = useColgante(calma);

  useEffect(() => {
    const raiz = document.documentElement;
    const antes = raiz.getAttribute('data-theme');
    raiz.setAttribute('data-theme', 'light');
    return () => {
      if (antes === null) raiz.removeAttribute('data-theme');
      else raiz.setAttribute('data-theme', antes);
    };
  }, []);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (entrando) return;
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
    <div className="ingreso">
      {/* La espiral de la marca, detrás de la tarjeta. */}
      <img className="ingreso__fondo" src={fondo} alt="" aria-hidden="true" />

      <div className={calma ? 'colgante' : 'colgante colgante--entra'}>
        <div className="colgante__brazo" ref={brazo}>
          <div className="colgante__cinta" aria-hidden="true">
            <span>{CINTA}</span>
          </div>
          <div className="colgante__gancho" aria-hidden="true" />
          <div className="ingreso__caja" ref={tarjeta} {...manejadores}>
            <span className="ingreso__ojal" aria-hidden="true" />
            <span className="colgante__argolla" aria-hidden="true" />
            <form className="ingreso__form" onSubmit={enviar}>
              <div className="ingreso__marca">
                <Logo tam={52} />
                <strong>Inversiones Generales M &amp; M</strong>
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

              <button className="btn btn--primario btn--ancho" type="submit" disabled={entrando}>
                {entrando ? 'Entrando…' : 'Entrar'}
              </button>

              <p className="mini tenue">
                Las cuentas las crea la administración. Si no podés entrar, pedí que te den de alta.
              </p>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

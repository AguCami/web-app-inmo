import { useState } from 'react';
import { Campo, Nota } from './ui';
import { Logo } from './Logo';
import { useApp } from '../data/store';
import fondo from '../assets/ingreso-fondo.webp';

/**
 * La pantalla de ingreso. Es lo único que se ve sin sesión: con servidor, la
 * app no muestra ni un dato antes de saber quién está del otro lado.
 *
 */
export function Ingresar() {
  const iniciarSesion = useApp((e) => e.iniciarSesion);

  const [email, setEmail] = useState('');
  const [clave, setClave] = useState('');
  const [error, setError] = useState('');
  const [entrando, setEntrando] = useState(false);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (entrando) return;
    setEntrando(true);
    setError('');
    const falla = await iniciarSesion(email.trim(), clave);
    if (falla) {
      setError(falla);
      setEntrando(false);
    }
  };

  return (
    <div className="ingreso">
      {/* La espiral de la marca, detrás de la tarjeta. */}
      <img className="ingreso__fondo" src={fondo} alt="" aria-hidden="true" />

      <form className="ingreso__caja" onSubmit={enviar}>
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
  );
}

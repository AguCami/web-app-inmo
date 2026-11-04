import { useState } from 'react';
import { Link } from 'react-router-dom';
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
  // Sin servidor esta pantalla es una vista previa: no hay a quién
  // preguntarle si la contraseña es correcta.
  const modoServidor = useApp((e) => e.modoServidor);

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

        <button className="btn btn--primario btn--ancho" type="submit" disabled={entrando || !modoServidor}>
          {entrando ? 'Entrando…' : 'Entrar'}
        </button>

        {modoServidor ? (
          <p className="mini tenue">
            Las cuentas las crea la administración. Si no podés entrar, pedí que te den de alta.
          </p>
        ) : (
          // Sin esto la vista previa es un callejón sin salida: el formulario
          // no puede entrar y no hay forma de volver sin editar la dirección.
          <p className="mini tenue ingreso__previa">
            Esto es una vista previa: todavía no hay servidor de cuentas, así que el formulario no
            puede entrar. <Link to="/">Volver a la app</Link>
          </p>
        )}
      </form>
    </div>
  );
}

import { useRef, useState } from 'react';
import { Campo, Nota } from './ui';
import { Logo } from './Logo';
import { useApp } from '../data/store';
import fondo from '../assets/ingreso-fondo.webp';
import { useVidrioLiquido } from './vidrio-liquido';

/**
 * La pantalla de ingreso. Es lo único que se ve sin sesión: con servidor, la
 * app no muestra ni un dato antes de saber quién está del otro lado.
 *
 * Es también la única pantalla con vidrio líquido de verdad —WebGL, no
 * CSS—. Acá paga: una sola tarjeta sobre un fondo quieto, sin listas ni
 * importes, así que el fondo se rasteriza una vez y el shader corre
 * sobre algo que no cambia. Ver vidrio-liquido.ts. Si no hay WebGL,
 * queda la tarjeta de siempre.
 */
export function Ingresar() {
  const iniciarSesion = useApp((e) => e.iniciarSesion);

  const raiz = useRef<HTMLDivElement>(null);
  const caja = useRef<HTMLFormElement>(null);
  useVidrioLiquido(raiz, caja);

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
    <div className="ingreso" ref={raiz}>
      {/* El fondo va como hijo de la raíz, no como fondo de la raíz: el
          shader muestrea a los HIJOS, y lo pintado en la raíz le resulta
          invisible. Es lo que el vidrio refracta. */}
      <img className="ingreso__fondo" src={fondo} alt="" aria-hidden="true" />

      <form className="ingreso__caja" ref={caja} onSubmit={enviar}>
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

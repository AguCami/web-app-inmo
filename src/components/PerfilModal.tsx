import { useRef, useState } from 'react';
import { Campo, Modal, Nota } from './ui';
import { IconoPersonas } from './iconos';
import { useApp } from '../data/store';
import { cambiarClave, guardarFoto, quitarFoto, useFotoPerfil } from '../data/perfil';

/**
 * «Mi perfil»: la foto que se ve en el menú y, con cuenta, el cambio de
 * contraseña. Sin servidor no hay contraseña que cambiar: la foto queda en
 * este navegador.
 */
export function PerfilModal({
  nombre,
  iniciales,
  onCerrar,
}: {
  nombre: string;
  iniciales: string;
  onCerrar: () => void;
}) {
  const sesion = useApp((e) => e.sesion);
  const usuarioId = sesion?.usuarioId ?? null;
  const foto = useFotoPerfil(usuarioId);

  const selector = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [errorFoto, setErrorFoto] = useState('');

  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [repetida, setRepetida] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [resultado, setResultado] = useState<{ ok: boolean; texto: string } | null>(null);

  const elegirFoto = async (archivo: File | undefined) => {
    if (!archivo) return;
    setSubiendo(true);
    setErrorFoto('');
    const falla = await guardarFoto(usuarioId, archivo);
    setSubiendo(false);
    if (falla) setErrorFoto(falla);
  };

  const enviarClave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sesion || guardando) return;
    if (nueva !== repetida) {
      setResultado({ ok: false, texto: 'Las dos contraseñas nuevas no coinciden.' });
      return;
    }
    setGuardando(true);
    setResultado(null);
    const falla = await cambiarClave(sesion.email, actual, nueva);
    setGuardando(false);
    if (falla) {
      setResultado({ ok: false, texto: falla });
    } else {
      setResultado({ ok: true, texto: 'Listo: la próxima vez entrás con la contraseña nueva.' });
      setActual('');
      setNueva('');
      setRepetida('');
    }
  };

  return (
    <Modal titulo="Mi perfil" onCerrar={onCerrar}>
      <div className="perfil">
        <div className="perfil__foto">
          {foto ? <img src={foto} alt="" /> : sesion ? <span>{iniciales}</span> : <IconoPersonas tam={34} />}
        </div>
        <strong className="perfil__nombre">{nombre}</strong>
        {sesion && <span className="perfil__email">{sesion.email}</span>}

        <div className="perfil__acciones">
          <button className="btn btn--chico" onClick={() => selector.current?.click()} disabled={subiendo}>
            {subiendo ? 'Subiendo…' : foto ? 'Cambiar foto' : 'Subir foto'}
          </button>
          {foto && (
            <button className="btn btn--chico btn--fantasma" onClick={() => void quitarFoto(usuarioId)} disabled={subiendo}>
              Quitar foto
            </button>
          )}
          <input
            ref={selector}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              void elegirFoto(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </div>
        {errorFoto && <Nota tono="critico">{errorFoto}</Nota>}
      </div>

      {sesion ? (
        <form className="perfil__clave" onSubmit={enviarClave}>
          <h3>Cambiar contraseña</h3>
          {/* Para que el gestor de contraseñas sepa de qué cuenta es. */}
          <input type="email" autoComplete="username" value={sesion.email} readOnly hidden />
          <Campo etiqueta="Contraseña actual">
            <input type="password" autoComplete="current-password" required value={actual} onChange={(e) => setActual(e.target.value)} />
          </Campo>
          <Campo etiqueta="Contraseña nueva" ayuda="Al menos 8 caracteres.">
            <input type="password" autoComplete="new-password" required minLength={8} value={nueva} onChange={(e) => setNueva(e.target.value)} />
          </Campo>
          <Campo etiqueta="Repetir la nueva">
            <input type="password" autoComplete="new-password" required value={repetida} onChange={(e) => setRepetida(e.target.value)} />
          </Campo>
          {resultado && <Nota tono={resultado.ok ? 'ok' : 'critico'}>{resultado.texto}</Nota>}
          <button className="btn btn--primario btn--ancho" type="submit" disabled={guardando}>
            {guardando ? 'Guardando…' : 'Cambiar contraseña'}
          </button>
        </form>
      ) : (
        <Nota>Sin cuenta no hay contraseña: la foto queda guardada en este navegador.</Nota>
      )}
    </Modal>
  );
}

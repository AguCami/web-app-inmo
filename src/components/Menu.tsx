import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ComponentType, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { NavLink, useLocation } from 'react-router-dom';
import {
  IconoAjustes,
  IconoCobranzas,
  IconoContratos,
  IconoGastos,
  IconoLiquidaciones,
  IconoLuna,
  IconoPanel,
  IconoPersonas,
  IconoPropiedades,
} from './iconos';
import { Logo } from './Logo';
import { PerfilModal } from './PerfilModal';
import { useFotoPerfil } from '../data/perfil';
import { useTema } from './Tema';
import { useApp, useDb } from '../data/store';
import { periodoActual } from '../domain/util';

type Enlace = { a: string; Icono: ComponentType<{ tam?: number }>; texto: string; conteo?: number };

const CLAVE_COLAPSADO = 'gestion-alquileres/menu-colapsado';
const leerColapsado = () => {
  try {
    return localStorage.getItem(CLAVE_COLAPSADO) === '1';
  } catch {
    return false;
  }
};

const esMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
const TECLA = esMac ? '⌘' : 'Ctrl';

/** Las iniciales para el avatar: «ana.perez@…» → AP. */
function iniciales(texto: string) {
  const partes = texto.split(/[.\s_-]+/).filter(Boolean);
  const dos = partes.length > 1 ? partes[0][0] + partes[1][0] : texto.slice(0, 2);
  return dos.toUpperCase();
}

/** «ana.perez» → «Ana Perez». */
function nombreDesdeEmail(email: string) {
  return email
    .split('@')[0]
    .split(/[.\s_-]+/)
    .filter(Boolean)
    .map((p) => p[0].toUpperCase() + p.slice(1))
    .join(' ');
}

const ROLES: Record<string, string> = { 'dueño': 'Dueño', operador: 'Operador', lectura: 'Solo lectura' };

/**
 * El menú lateral.
 *
 * Tomado de la referencia que pasó Agu: una pieza de vidrio que se pliega a
 * una columna de íconos y se despliega con nombres, secciones y el perfil al
 * final. Una pastilla de vidrio se desliza hasta el ítem que se señala y
 * vuelve sola al de la pantalla actual.
 *
 * En el celular (≤ 900 px) es la barra de arriba de siempre: solo íconos y
 * el avatar al final.
 */
export function Menu({ pendientes }: { pendientes: { vencidas: number; sinPagar: number } }) {
  const db = useDb();
  const modoServidor = useApp((e) => e.modoServidor);
  const sesion = useApp((e) => e.sesion);
  const cerrarSesion = useApp((e) => e.cerrarSesion);
  const { oscuro, fijar } = useTema();
  const { pathname } = useLocation();

  const [colapsado, setColapsado] = useState(leerColapsado);
  const [perfilAbierto, setPerfilAbierto] = useState(false);
  const [editandoPerfil, setEditandoPerfil] = useState(false);
  const cerrarPerfil = useCallback(() => setEditandoPerfil(false), []);

  useEffect(() => {
    try {
      localStorage.setItem(CLAVE_COLAPSADO, colapsado ? '1' : '0');
    } catch {
      /* sin almacenamiento: se acuerda solo mientras dure la pestaña */
    }
  }, [colapsado]);

  const secciones: { titulo: string; enlaces: Enlace[] }[] = [
    {
      titulo: 'Principal',
      enlaces: [
        { a: '/', Icono: IconoPanel, texto: 'Inicio' },
        { a: '/cobranzas', Icono: IconoCobranzas, texto: 'Cobranzas', conteo: pendientes.vencidas },
        { a: '/contratos', Icono: IconoContratos, texto: 'Contratos' },
        { a: '/propiedades', Icono: IconoPropiedades, texto: 'Propiedades' },
      ],
    },
    {
      titulo: 'Administración',
      enlaces: [
        { a: '/liquidaciones', Icono: IconoLiquidaciones, texto: 'Liquidaciones', conteo: pendientes.sinPagar },
        { a: '/gastos', Icono: IconoGastos, texto: 'Gastos' },
        { a: '/personas', Icono: IconoPersonas, texto: 'Personas' },
      ],
    },
    { titulo: 'Sistema', enlaces: [{ a: '/ajustes', Icono: IconoAjustes, texto: 'Ajustes' }] },
  ];

  // ⌘B pliega y despliega.
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const k = e.key.toLowerCase();
      if (k === 'b') {
        e.preventDefault();
        setColapsado((c) => !c);
      }
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, []);

  /* ── La pastilla de vidrio que se desliza ──
   * Una sola pieza, posicionada sobre el ítem señalado (o el activo cuando
   * no se señala nada). Se mueve con transform, que no recalcula el layout. */
  const lista = useRef<HTMLDivElement>(null);
  const [señalado, setSeñalado] = useState<string | null>(null);
  const [lente, setLente] = useState<{ y: number; alto: number; yRail: number; etiqueta: string } | null>(null);

  const activo =
    secciones.flatMap((s) => s.enlaces).find((e) => (e.a === '/' ? pathname === '/' : pathname.startsWith(e.a)))?.a ??
    null;
  const destino = señalado ?? activo;

  const medir = useCallback(() => {
    const contenedor = lista.current;
    const el = destino ? contenedor?.querySelector<HTMLElement>(`[data-a="${destino}"]`) : null;
    setLente(
      el && contenedor
        ? {
            y: el.offsetTop,
            alto: el.offsetHeight,
            // Para el globo, que va afuera de la lista (la lista recorta).
            yRail: contenedor.offsetTop - contenedor.scrollTop + el.offsetTop + el.offsetHeight / 2,
            etiqueta: el.dataset.etiqueta ?? '',
          }
        : null,
    );
  }, [destino]);

  useLayoutEffect(medir, [medir, colapsado]);
  useEffect(() => {
    // Al plegar o desplegar los ítems cambian de alto durante la transición:
    // se vuelve a medir cuando el tamaño se asienta.
    const contenedor = lista.current;
    if (!contenedor || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(medir);
    ro.observe(contenedor);
    return () => ro.disconnect();
  }, [medir]);

  // El perfil se cierra al tocar afuera o con Escape.
  const perfil = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!perfilAbierto) return;
    const fuera = (e: PointerEvent) => {
      if (!perfil.current?.contains(e.target as Node)) setPerfilAbierto(false);
    };
    const escape = (e: KeyboardEvent) => e.key === 'Escape' && setPerfilAbierto(false);
    document.addEventListener('pointerdown', fuera);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', fuera);
      document.removeEventListener('keydown', escape);
    };
  }, [perfilAbierto]);

  const nombreUsuario = sesion ? nombreDesdeEmail(sesion.email) : 'Sin cuenta';
  const detalleUsuario = sesion ? sesion.email : 'Datos en este navegador';
  const rol = sesion ? ROLES[sesion.rol] ?? sesion.rol : 'Modo local';
  const inicialesUsuario = sesion ? iniciales(sesion.email.split('@')[0]) : '';
  const foto = useFotoPerfil(sesion?.usuarioId ?? null);

  let indice = 0;

  return (
    <nav
      className={`rail no-imprimir${colapsado ? ' rail--colapsado' : ''}`}
      aria-label="Navegación principal"
    >
      <button
        className="rail__plegar"
        onClick={() => setColapsado((c) => !c)}
        aria-label={colapsado ? 'Desplegar el menú' : 'Plegar el menú'}
        aria-expanded={!colapsado}
        data-etiqueta={colapsado ? 'Desplegar' : 'Plegar'}
        data-tecla={`${TECLA} B`}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M14.5 6 8.5 12l6 6" />
        </svg>
      </button>

      <div className="marca">
        <Logo tam={36} />
        <NombreMarca nombre={db.configuracion.nombre} />
      </div>

      {/* Plegado, el nombre aparece en un globo al costado. Es uno solo y
          viaja junto con la pastilla. */}
      {colapsado && (
        <span
          className={`rail__globo${señalado && lente ? ' rail__globo--visible' : ''}`}
          aria-hidden="true"
          style={{ top: lente?.yRail ?? 0 }}
        >
          {lente?.etiqueta}
        </span>
      )}

      <div
        className="rail__lista"
        ref={lista}
        onPointerLeave={() => setSeñalado(null)}
        onScroll={medir}
      >
        {lente && (
          <span
            className="rail__lente"
            aria-hidden="true"
            style={{ transform: `translateY(${lente.y}px)`, height: lente.alto }}
          />
        )}

        {secciones.map((s) => (
          <div className="rail__seccion" key={s.titulo}>
            <div className="rail__titulo">
              <span className="rail__desvanece">{s.titulo}</span>
            </div>
            {s.enlaces.map(({ a, Icono, texto, conteo }) => (
              <NavLink
                key={a}
                to={a}
                end={a === '/'}
                data-a={a}
                data-etiqueta={conteo ? `${texto} · ${conteo}` : texto}
                style={{ '--i': indice++ } as CSSProperties}
                className={({ isActive }) => `rail__link${isActive ? ' rail__link--activo' : ''}`}
                onPointerEnter={() => setSeñalado(a)}
                onFocus={() => setSeñalado(a)}
                onBlur={() => setSeñalado(null)}
              >
                <Icono />
                <span className="texto rail__desvanece">{texto}</span>
                {conteo ? <span className="rail__conteo">{conteo}</span> : null}
              </NavLink>
            ))}
          </div>
        ))}
      </div>

      <div className="rail__pie">
        <button
          className="rail__noche"
          role="switch"
          aria-checked={oscuro}
          onClick={() => fijar(oscuro ? 'claro' : 'oscuro')}
          data-etiqueta={oscuro ? 'Modo noche: sí' : 'Modo noche: no'}
        >
          <IconoLuna tam={17} />
          <span className="texto rail__desvanece">Modo noche</span>
          <span className="rail__interruptor rail__desvanece" aria-hidden="true" />
        </button>

        <div className="rail__perfil-caja" ref={perfil}>
          {perfilAbierto && (
            <div className="rail__perfil-menu" role="menu">
              <div className="rail__perfil-cab">
                <strong>{nombreUsuario}</strong>
                <span>{rol}</span>
                {/* «M & M» no se parte en dos renglones. */}
                {sesion && <span>{sesion.organizacion.replace(/ & /g, '\u00a0&\u00a0')}</span>}
              </div>
              <button
                role="menuitem"
                onClick={() => {
                  setPerfilAbierto(false);
                  setEditandoPerfil(true);
                }}
              >
                <IconoPersonas tam={16} /> Mi perfil
              </button>
              {modoServidor ? (
                <button role="menuitem" className="peligro" onClick={() => void cerrarSesion()}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M10 16l-4-4 4-4M6 12h10" />
                  </svg>
                  Cerrar sesión
                </button>
              ) : (
                <p className="rail__perfil-nota">Período {periodoActual()}. Los datos se guardan en este navegador.</p>
              )}
            </div>
          )}
          <button
            className="rail__perfil"
            onClick={() => setPerfilAbierto((a) => !a)}
            aria-haspopup="menu"
            aria-expanded={perfilAbierto}
            data-etiqueta={nombreUsuario}
          >
            <span className="rail__avatar">
              {foto ? <img src={foto} alt="" /> : sesion ? inicialesUsuario : <IconoPersonas tam={16} />}
              <i className={sesion ? 'en-linea' : 'local'} />
            </span>
            <span className="rail__perfil-texto rail__desvanece">
              <strong>{nombreUsuario}</strong>
              <span>{detalleUsuario}</span>
            </span>
            <svg className="rail__desvanece" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m8 9 4-4 4 4M8 15l4 4 4-4" />
            </svg>
          </button>
        </div>
      </div>
      {/* Va afuera del menú: el vidrio del menú encierra a lo que es «fixed». */}
      {editandoPerfil &&
        createPortal(
          <PerfilModal nombre={nombreUsuario} iniciales={inicialesUsuario} onCerrar={cerrarPerfil} />,
          document.body,
        )}
    </nav>
  );
}

/**
 * El nombre junto al logo, igual que en la tarjeta del ingreso: en tres
 * renglones, con «M & M» al medio y destacado. Si en Ajustes se pone un
 * nombre que no termina en «M & M», va tal cual, en dos renglones como mucho.
 */
function NombreMarca({ nombre }: { nombre: string }) {
  const partes = /^(.*?)\s*(M\s*&\s*M)$/i.exec(nombre.trim());
  if (partes) {
    return (
      <span className="marca__texto marca__texto--mym rail__desvanece">
        {partes[1] && <span>{partes[1]}</span>}
        <strong>M&nbsp;&amp;&nbsp;M</strong>
        <span>Inmobiliaria</span>
      </span>
    );
  }
  return (
    <span className="marca__texto rail__desvanece">
      {/* «M & M» no se parte en dos renglones. */}
      <strong>{(nombre || 'Alquileres').replace(/ & /g, '\u00a0&\u00a0')}</strong>
      <span>Inmobiliaria</span>
    </span>
  );
}

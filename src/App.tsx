import { useEffect, useMemo, useState } from 'react';
import { NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { EstadoSincronizacion } from './components/EstadoSincronizacion';
import { Ingresar } from './components/Ingresar';
import {
  IconoAjustes,
  IconoCobranzas,
  IconoContratos,
  IconoGastos,
  IconoLiquidaciones,
  IconoPanel,
  IconoPersonas,
  IconoPropiedades,
} from './components/iconos';
import { useApp, useDb } from './data/store';
import { saldoDeCuota } from './domain/cobranzas';
import { hoy, periodoActual } from './domain/util';

import { Logo } from './components/Logo';
import fondo from './assets/ingreso-fondo.webp';

import Inicio from './pages/Inicio';
import Propiedades from './pages/Propiedades';
import Contratos from './pages/Contratos';
import ContratoDetalle from './pages/ContratoDetalle';
import Cobranzas from './pages/Cobranzas';
import Liquidaciones from './pages/Liquidaciones';
import Personas from './pages/Personas';
import Gastos from './pages/Gastos';
import Ajustes from './pages/Ajustes';

export default function App() {
  const { pathname: ruta } = useLocation();
  const db = useDb();
  const sincronizarIndices = useApp((e) => e.sincronizarIndices);
  const modoServidor = useApp((e) => e.modoServidor);
  const verificandoSesion = useApp((e) => e.verificandoSesion);
  const sesion = useApp((e) => e.sesion);
  const cerrarSesion = useApp((e) => e.cerrarSesion);
  const navegar = useNavigate();

  // La salida del ingreso: al entrar, la credencial sale tirada hacia arriba
  // por encima del panel, que ya está dibujado debajo. Mientras dura, se
  // muestran los dos.
  const pideIngreso = modoServidor && !sesion;
  const [saliendo, setSaliendo] = useState(false);
  // El panel se dibuja recién cuando la tarjeta ya salió de la pantalla:
  // dibujarlo cuesta un par de cientos de milisegundos, y si coincide con el
  // tirón la tarjeta se queda congelada justo cuando tiene que salir.
  const [panelListo, setPanelListo] = useState(true);
  // Se decide durante el render, no en un efecto: así el mismo render que ya
  // no pide ingreso trae la tarjeta saliendo, y React la conserva en vez de
  // desmontarla y montar otra quieta.
  const [pediaIngreso, setPediaIngreso] = useState(pideIngreso);
  if (pediaIngreso !== pideIngreso) {
    setPediaIngreso(pideIngreso);
    if (!pideIngreso && sesion) {
      setSaliendo(true);
      setPanelListo(false);
    }
  }

  // Al abrir, se busca la serie de índices que publica la tarea programada.
  // Si no está, la app sigue con la que tiene guardada.
  useEffect(() => {
    void sincronizarIndices();
  }, [sincronizarIndices]);

  const pendientes = useMemo(() => {
    const vencidas = db.cuotas.filter(
      (c) => c.estado !== 'anulada' && saldoDeCuota(c, db.pagos) > 0.01 && c.vencimiento < hoy(),
    ).length;
    const sinPagar = db.liquidaciones.filter((l) => l.estado !== 'pagada').length;
    return { vencidas, sinPagar };
  }, [db]);

  const enlaces = [
    { a: '/', Icono: IconoPanel, texto: 'Inicio' },
    { a: '/cobranzas', Icono: IconoCobranzas, texto: 'Cobranzas', conteo: pendientes.vencidas },
    { a: '/contratos', Icono: IconoContratos, texto: 'Contratos' },
    { a: '/propiedades', Icono: IconoPropiedades, texto: 'Propiedades' },
    { a: '/liquidaciones', Icono: IconoLiquidaciones, texto: 'Liquidaciones', conteo: pendientes.sinPagar },
    { a: '/gastos', Icono: IconoGastos, texto: 'Gastos' },
    { a: '/personas', Icono: IconoPersonas, texto: 'Personas' },
    { a: '/ajustes', Icono: IconoAjustes, texto: 'Ajustes' },
  ];

  if (verificandoSesion) {
    return <div className="ingreso ingreso--abriendo"><span className="tenue">Abriendo…</span></div>;
  }
  // El ingreso va siempre en el mismo lugar del árbol —segundo hijo del
  // fragmento—, así React conserva la misma tarjeta al pasar de «pidiendo
  // ingreso» a «saliendo» y sigue hamacándose desde donde estaba.
  if (pideIngreso) return <>{null}<Ingresar /></>;
  // Vista previa del ingreso.
  //
  // Sin Supabase configurado `modoServidor` es falso y esta pantalla no se
  // alcanza nunca, así que no habría forma de mirarla ni de mostrarla. El
  // formulario sin servidor no hace nada: no hay a quién autenticar.
  //
  // Se acepta por el hash —/#/ingreso— y también por ?ingreso. La forma
  // buena es la del hash: en GitHub Pages, una dirección sin la barra
  // final redirige y en esa redirección se pierde la query, así que
  // ?ingreso puede no llegar nunca. El hash siempre sobrevive.
  //
  // Sin servidor el botón no autentica: muestra la salida y lleva al panel,
  // para poder ver cómo se siente entrar.
  const enVistaPrevia =
    !saliendo && (ruta === '/ingreso' || new URLSearchParams(window.location.search).has('ingreso'));
  if (enVistaPrevia) {
    return (
      <>
        {null}
        <Ingresar
          alEntrarDePrueba={() => {
            setSaliendo(true);
            setPanelListo(false);
            navegar('/', { replace: true });
          }}
        />
      </>
    );
  }

  return (
    <>
      {/* La espiral del ingreso, fija detrás del panel. Va afuera de .app
          porque .app entra con un transform, y un position: fixed adentro de
          un transform deja de estar fijo a la pantalla. Al entrar, el fondo
          del ingreso se desvanece y debajo ya está la misma imagen. */}
      {!panelListo ? null : (
        <div className="fondo-app no-imprimir" aria-hidden="true">
          <img src={fondo} alt="" decoding="async" />
        </div>
      )}
      {!panelListo ? null : (
        <div className={saliendo ? 'app app--llega' : 'app'}>
          <nav className="rail no-imprimir" aria-label="Navegación principal">
            <div className="marca">
              <Logo tam={44} />
              <span className="marca__texto">
                <strong>{db.configuracion.nombre || 'Alquileres'}</strong>
                <span>Inmobiliaria</span>
              </span>
            </div>

            {enlaces.map(({ a, Icono, texto, conteo }) => (
              <NavLink
                key={a}
                to={a}
                end={a === '/'}
                className={({ isActive }) => `rail__link${isActive ? ' rail__link--activo' : ''}`}
              >
                <Icono />
                <span className="texto">{texto}</span>
                {conteo ? <span className="rail__conteo">{conteo}</span> : null}
              </NavLink>
            ))}

            <div className="rail__pie">
              Período {periodoActual()}
              <br />
              {modoServidor ? (
                <>
                  {sesion?.email}
                  <br />
                  <button className="btn btn--fantasma btn--chico" onClick={() => void cerrarSesion()}>
                    Cerrar sesión
                  </button>
                </>
              ) : (
                'Los datos se guardan en este navegador.'
              )}
            </div>
          </nav>

          <main className="principal">
            <EstadoSincronizacion />
            <Routes>
              <Route path="/" element={<Inicio />} />
              <Route path="/cobranzas" element={<Cobranzas />} />
              <Route path="/contratos" element={<Contratos />} />
              <Route path="/contratos/:id" element={<ContratoDetalle />} />
              <Route path="/propiedades" element={<Propiedades />} />
              <Route path="/liquidaciones" element={<Liquidaciones />} />
              <Route path="/gastos" element={<Gastos />} />
              <Route path="/personas" element={<Personas />} />
              <Route path="/ajustes" element={<Ajustes />} />
            </Routes>
          </main>
        </div>
      )}
      {saliendo && (
        <Ingresar saliendo alMostrarPanel={() => setPanelListo(true)} alTerminar={() => setSaliendo(false)} />
      )}
    </>
  );
}

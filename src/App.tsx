import { useEffect, useMemo, useState } from 'react';
import { Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { EstadoSincronizacion } from './components/EstadoSincronizacion';
import { Ingresar } from './components/Ingresar';
import { Menu } from './components/Menu';
import { useApp, useDb } from './data/store';
import { saldoDeCuota } from './domain/cobranzas';
import { hoy } from './domain/util';

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

  // Al abrir se buscan los índices publicados (con cuentas, el store lo
  // repite apenas hay sesión). Y como la sesión no vence, la pestaña puede
  // quedar abierta días: se vuelve a buscar cada 6 horas, y al volver a la
  // pestaña si pasó ese tiempo desde la última vez.
  useEffect(() => {
    const CADA = 6 * 60 * 60 * 1000;
    let ultima = Date.now();
    const buscar = () => {
      ultima = Date.now();
      void sincronizarIndices();
    };
    buscar();
    const reloj = setInterval(buscar, CADA);
    const alVolver = () => {
      if (document.visibilityState === 'visible' && Date.now() - ultima >= CADA) buscar();
    };
    document.addEventListener('visibilitychange', alVolver);
    return () => {
      clearInterval(reloj);
      document.removeEventListener('visibilitychange', alVolver);
    };
  }, [sincronizarIndices]);

  const pendientes = useMemo(() => {
    const vencidas = db.cuotas.filter(
      (c) => c.estado !== 'anulada' && saldoDeCuota(c, db.pagos) > 0.01 && c.vencimiento < hoy(),
    ).length;
    const sinPagar = db.liquidaciones.filter((l) => l.estado !== 'pagada').length;
    return { vencidas, sinPagar };
  }, [db]);


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
          <Menu pendientes={pendientes} />

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

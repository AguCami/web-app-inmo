import { useEffect, useMemo } from 'react';
import { NavLink, Route, Routes } from 'react-router-dom';
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
  const db = useDb();
  const sincronizarIndices = useApp((e) => e.sincronizarIndices);

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

  return (
    <div className="app">
      <nav className="rail no-imprimir" aria-label="Navegación principal">
        <div className="marca">
          <span className="marca__logo" aria-hidden="true">
            <IconoPanel tam={19} />
          </span>
          <span className="marca__texto">
            <strong>{db.configuracion.nombre || 'Alquileres'}</strong>
            <span>Gestión de alquileres</span>
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
          Los datos se guardan en este navegador.
        </div>
      </nav>

      <main className="principal">
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
  );
}

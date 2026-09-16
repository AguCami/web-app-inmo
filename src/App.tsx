import { NavLink, Route, Routes } from 'react-router-dom';
import { useMemo } from 'react';
import { useDb } from './data/store';
import { saldoDeCuota } from './domain/cobranzas';
import { hoy, periodoActual } from './domain/util';

import Tablero from './pages/Tablero';
import Propiedades from './pages/Propiedades';
import Personas from './pages/Personas';
import Contratos from './pages/Contratos';
import ContratoDetalle from './pages/ContratoDetalle';
import Cobranzas from './pages/Cobranzas';
import Liquidaciones from './pages/Liquidaciones';
import Ventas from './pages/Ventas';
import Gastos from './pages/Gastos';
import Tesoreria from './pages/Tesoreria';
import Contabilidad from './pages/Contabilidad';
import Reportes from './pages/Reportes';
import Agenda from './pages/Agenda';
import Configuracion from './pages/Configuracion';

interface EntradaNav {
  a: string;
  icono: string;
  texto: string;
  pastilla?: number;
}

export default function App() {
  const db = useDb();

  const alertas = useMemo(() => {
    const vencidas = db.cuotas.filter(
      (c) => c.estado !== 'anulada' && saldoDeCuota(c, db.pagos) > 0.01 && c.vencimiento < hoy(),
    ).length;
    const tareasHoy = db.tareas.filter((t) => !t.completada && t.fecha <= hoy()).length;
    const liquidacionesBorrador = db.liquidaciones.filter((l) => l.estado === 'borrador').length;
    return { vencidas, tareasHoy, liquidacionesBorrador };
  }, [db]);

  const grupos: { titulo: string; items: EntradaNav[] }[] = [
    {
      titulo: 'Gestión',
      items: [
        { a: '/', icono: '◈', texto: 'Tablero' },
        { a: '/propiedades', icono: '🏠', texto: 'Propiedades' },
        { a: '/personas', icono: '👥', texto: 'Personas' },
        { a: '/agenda', icono: '🗓', texto: 'Agenda', pastilla: alertas.tareasHoy },
      ],
    },
    {
      titulo: 'Alquileres',
      items: [
        { a: '/contratos', icono: '📄', texto: 'Contratos' },
        { a: '/cobranzas', icono: '💵', texto: 'Cobranzas', pastilla: alertas.vencidas },
        { a: '/liquidaciones', icono: '📤', texto: 'Liquidaciones', pastilla: alertas.liquidacionesBorrador },
      ],
    },
    {
      titulo: 'Ventas',
      items: [{ a: '/ventas', icono: '🤝', texto: 'Operaciones' }],
    },
    {
      titulo: 'Contabilidad',
      items: [
        { a: '/gastos', icono: '🧾', texto: 'Gastos' },
        { a: '/tesoreria', icono: '🏦', texto: 'Tesorería' },
        { a: '/contabilidad', icono: '📚', texto: 'Libros' },
        { a: '/reportes', icono: '📈', texto: 'Reportes' },
      ],
    },
    {
      titulo: 'Sistema',
      items: [{ a: '/configuracion', icono: '⚙️', texto: 'Configuración' }],
    },
  ];

  return (
    <div className="app">
      <nav className="nav no-imprimir" aria-label="Navegación principal">
        <div className="nav__marca">
          <strong>{db.configuracion.nombreFantasia || 'Inmo Contable'}</strong>
          <span>{db.configuracion.matricula}</span>
        </div>

        {grupos.map((g) => (
          <div className="nav__grupo" key={g.titulo}>
            <div className="nav__grupo-titulo">{g.titulo}</div>
            {g.items.map((i) => (
              <NavLink
                key={i.a}
                to={i.a}
                end={i.a === '/'}
                className={({ isActive }) => `nav__link${isActive ? ' nav__link--activo' : ''}`}
              >
                <span className="icono" aria-hidden="true">{i.icono}</span>
                {i.texto}
                {i.pastilla ? <span className="nav__pastilla">{i.pastilla}</span> : null}
              </NavLink>
            ))}
          </div>
        ))}

        <div className="nav__pie">
          Período {periodoActual()} · datos guardados en este navegador
        </div>
      </nav>

      <main className="principal">
        <Routes>
          <Route path="/" element={<Tablero />} />
          <Route path="/propiedades" element={<Propiedades />} />
          <Route path="/personas" element={<Personas />} />
          <Route path="/agenda" element={<Agenda />} />
          <Route path="/contratos" element={<Contratos />} />
          <Route path="/contratos/:id" element={<ContratoDetalle />} />
          <Route path="/cobranzas" element={<Cobranzas />} />
          <Route path="/liquidaciones" element={<Liquidaciones />} />
          <Route path="/ventas" element={<Ventas />} />
          <Route path="/gastos" element={<Gastos />} />
          <Route path="/tesoreria" element={<Tesoreria />} />
          <Route path="/contabilidad" element={<Contabilidad />} />
          <Route path="/reportes" element={<Reportes />} />
          <Route path="/configuracion" element={<Configuracion />} />
        </Routes>
      </main>
    </div>
  );
}

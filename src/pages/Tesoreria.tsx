import { useMemo, useState } from 'react';
import { Encabezado } from '../components/Encabezado';
import { Campo, Chip, Kpi, Modal, Paginador, Tabla, Tarjeta, usePaginado, Vacio } from '../components/ui';
import { useApp, useDb } from '../data/store';
import { movimientosDerivados, saldoDeCuenta } from '../domain/reportes';
import type { CuentaFinanciera, Moneda } from '../domain/types';
import { formatearFecha, formatearMoneda, incluyeTexto, nuevoId, sumar } from '../domain/util';

export default function Tesoreria() {
  const db = useDb();
  const guardarCuenta = useApp((e) => e.guardarCuenta);

  const [cuentaId, setCuentaId] = useState<string>('todas');
  const [busqueda, setBusqueda] = useState('');
  const [editando, setEditando] = useState<CuentaFinanciera | null>(null);

  const movimientos = useMemo(() => movimientosDerivados(db), [db]);
  const cuentaDe = (id: string) => db.cuentas.find((c) => c.id === id);

  const filtrados = useMemo(
    () =>
      movimientos
        .filter((m) => cuentaId === 'todas' || m.cuentaId === cuentaId)
        .filter((m) => incluyeTexto([m.concepto, cuentaDe(m.cuentaId)?.nombre], busqueda)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [movimientos, cuentaId, busqueda, db.cuentas],
  );

  const saldos = db.cuentas.map((c) => ({ cuenta: c, saldo: saldoDeCuenta(db, c.id) }));
  const totalARS = sumar(saldos.filter((s) => s.cuenta.moneda === 'ARS'), (s) => s.saldo);
  const totalUSD = sumar(saldos.filter((s) => s.cuenta.moneda === 'USD'), (s) => s.saldo);

  const pag = usePaginado(filtrados, 60);

  const ingresos = sumar(filtrados.filter((m) => m.tipo === 'ingreso'), (m) => m.monto);
  const egresos = sumar(filtrados.filter((m) => m.tipo === 'egreso'), (m) => m.monto);

  return (
    <>
      <Encabezado titulo="Tesorería" bajada="Cuentas, saldos y libro de caja consolidado">
        <button
          className="btn btn--primario no-imprimir"
          onClick={() =>
            setEditando({
              id: nuevoId('cta'),
              nombre: '',
              tipo: 'banco',
              moneda: 'ARS',
              saldoInicial: 0,
              activa: true,
            })
          }
        >
          + Nueva cuenta
        </button>
      </Encabezado>

      <div className="contenido pila">
        <div className="grid grid--kpis">
          <Kpi etiqueta="Disponibilidad en pesos" valor={formatearMoneda(totalARS)} pie={`${saldos.filter((s) => s.cuenta.moneda === 'ARS').length} cuentas`} />
          <Kpi etiqueta="Disponibilidad en dólares" valor={formatearMoneda(totalUSD, 'USD')} pie="caja de ahorro y efectivo" />
          <Kpi etiqueta="Ingresos del listado" valor={formatearMoneda(ingresos)} tono="ok" pie={`${filtrados.filter((m) => m.tipo === 'ingreso').length} movimientos`} />
          <Kpi etiqueta="Egresos del listado" valor={formatearMoneda(egresos)} tono="critico" pie={`${filtrados.filter((m) => m.tipo === 'egreso').length} movimientos`} />
        </div>

        <Tarjeta titulo="Cuentas" ajustado>
          <Tabla compacta>
            <thead>
              <tr>
                <th>Cuenta</th>
                <th>Tipo</th>
                <th>Moneda</th>
                <th className="num">Saldo inicial</th>
                <th className="num">Saldo actual</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {saldos.map(({ cuenta, saldo }) => (
                <tr key={cuenta.id}>
                  <td className="principal-celda">
                    {cuenta.nombre}
                    {cuenta.cbu && <span className="tabla__sub">{cuenta.cbu}</span>}
                  </td>
                  <td className="mini">{cuenta.tipo.replace('_', ' ')}</td>
                  <td>
                    <Chip tono={cuenta.moneda === 'USD' ? 'info' : 'neutro'}>{cuenta.moneda}</Chip>
                  </td>
                  <td className="num tenue">{formatearMoneda(cuenta.saldoInicial, cuenta.moneda)}</td>
                  <td className={`num principal-celda ${saldo < 0 ? 'neg' : ''}`}>{formatearMoneda(saldo, cuenta.moneda)}</td>
                  <td className="num no-imprimir">
                    <button className="btn btn--chico btn--fantasma" onClick={() => setEditando(cuenta)}>Editar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Tabla>
        </Tarjeta>

        <div className="fila no-imprimir">
          <select value={cuentaId} onChange={(e) => setCuentaId(e.target.value)} style={{ width: 'auto' }} aria-label="Cuenta">
            <option value="todas">Todas las cuentas</option>
            {db.cuentas.map((c) => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
          <div className="buscador">
            <input
              type="search"
              placeholder="Buscar por concepto"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              aria-label="Buscar movimientos"
            />
          </div>
        </div>

        <Tarjeta
          titulo="Libro de caja"
          subtitulo="Se arma solo a partir de cobranzas, pagos a proveedores y liquidaciones"
          ajustado
        >
          {filtrados.length === 0 ? (
            <Vacio icono="🏦" titulo="Sin movimientos" />
          ) : (
            <Tabla>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Concepto</th>
                  <th>Cuenta</th>
                  <th>Tipo</th>
                  <th className="num">Importe</th>
                </tr>
              </thead>
              <tbody>
                {pag.visibles.map((m) => (
                  <tr key={m.id}>
                    <td>{formatearFecha(m.fecha)}</td>
                    <td className="principal-celda">{m.concepto}</td>
                    <td className="mini">{cuentaDe(m.cuentaId)?.nombre ?? '—'}</td>
                    <td>
                      <Chip tono={m.tipo === 'ingreso' ? 'ok' : 'critico'}>
                        {m.tipo === 'ingreso' ? 'Ingreso' : 'Egreso'}
                      </Chip>
                    </td>
                    <td className={`num ${m.tipo === 'egreso' ? 'neg' : 'pos'}`}>
                      {m.tipo === 'egreso' ? '−' : '+'} {formatearMoneda(m.monto, m.moneda)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Tabla>
          )}
          <Paginador
            pagina={pag.pagina}
            paginas={pag.paginas}
            desde={pag.desde}
            hasta={pag.hasta}
            total={pag.total}
            etiqueta="movimientos"
            onCambio={pag.setPagina}
          />
        </Tarjeta>
      </div>

      {editando && (
        <FormularioCuenta
          cuenta={editando}
          onCerrar={() => setEditando(null)}
          onGuardar={(c) => { guardarCuenta(c); setEditando(null); }}
        />
      )}
    </>
  );
}

function FormularioCuenta({
  cuenta,
  onGuardar,
  onCerrar,
}: {
  cuenta: CuentaFinanciera;
  onGuardar: (c: CuentaFinanciera) => void;
  onCerrar: () => void;
}) {
  const [f, setF] = useState<CuentaFinanciera>(cuenta);
  const set = <K extends keyof CuentaFinanciera>(k: K, v: CuentaFinanciera[K]) => setF((x) => ({ ...x, [k]: v }));

  return (
    <Modal
      titulo={cuenta.nombre || 'Nueva cuenta'}
      onCerrar={onCerrar}
      pie={
        <>
          <button className="btn" onClick={onCerrar}>Cancelar</button>
          <button className="btn btn--primario" disabled={!f.nombre.trim()} onClick={() => onGuardar(f)}>Guardar</button>
        </>
      }
    >
      <Campo etiqueta="Nombre">
        <input value={f.nombre} onChange={(e) => set('nombre', e.target.value)} />
      </Campo>
      <div className="grid grid--form">
        <Campo etiqueta="Tipo">
          <select value={f.tipo} onChange={(e) => set('tipo', e.target.value as CuentaFinanciera['tipo'])}>
            <option value="caja">Caja</option>
            <option value="banco">Banco</option>
            <option value="billetera_virtual">Billetera virtual</option>
          </select>
        </Campo>
        <Campo etiqueta="Moneda">
          <select value={f.moneda} onChange={(e) => set('moneda', e.target.value as Moneda)}>
            <option value="ARS">Pesos</option>
            <option value="USD">Dólares</option>
          </select>
        </Campo>
        <Campo etiqueta="Saldo inicial">
          <input className="entrada-num" type="number" value={f.saldoInicial || ''} onChange={(e) => set('saldoInicial', Number(e.target.value))} />
        </Campo>
        <Campo etiqueta="Banco">
          <input value={f.banco ?? ''} onChange={(e) => set('banco', e.target.value)} />
        </Campo>
      </div>
      <Campo etiqueta="CBU / CVU">
        <input value={f.cbu ?? ''} onChange={(e) => set('cbu', e.target.value)} />
      </Campo>
      <label className="fila" style={{ gap: 6 }}>
        <input type="checkbox" checked={f.activa} onChange={(e) => set('activa', e.target.checked)} />
        Cuenta activa
      </label>
    </Modal>
  );
}

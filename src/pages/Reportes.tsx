import { useMemo, useState } from 'react';
import { Encabezado } from '../components/Encabezado';
import { Chip, Kpi, Pestanas, Tabla, Tarjeta, Vacio } from '../components/ui';
import { GraficoBarrasHorizontales, PanelGrafico, RAMPA_MORA } from '../components/graficos';
import { useDb } from '../data/store';
import { antiguedadDeuda, diasDeMora, saldoDeCuota } from '../domain/cobranzas';
import { rentabilidadPorPropiedad } from '../domain/reportes';
import { comisionesPorAgente } from '../domain/ventas';
import {
  formatearFecha,
  formatearMoneda,
  formatearPeriodo,
  formatearPorcentaje,
  periodoActual,
  plural,
  redondear,
  sumar,
  ultimosPeriodos,
} from '../domain/util';

type Vista = 'rentabilidad' | 'morosidad' | 'agentes' | 'propietarios';

/** Exporta cualquier grilla a CSV con separador punto y coma (Excel en es-AR). */
function exportarCSV(nombre: string, encabezados: string[], filas: (string | number)[][]) {
  const escapar = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const contenido = [encabezados, ...filas].map((f) => f.map(escapar).join(';')).join('\n');
  const blob = new Blob([`﻿${contenido}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${nombre}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Reportes() {
  const db = useDb();
  const [vista, setVista] = useState<Vista>('rentabilidad');
  const [meses, setMeses] = useState(12);

  const periodos = ultimosPeriodos(periodoActual(), meses);
  const desde = periodos[0];
  const hasta = periodos[periodos.length - 1];

  const rentabilidad = useMemo(() => rentabilidadPorPropiedad(db, desde, hasta), [db, desde, hasta]);
  const comisiones = useMemo(() => comisionesPorAgente(db.operaciones, db.personas), [db.operaciones, db.personas]);
  const mora = useMemo(() => antiguedadDeuda(db.cuotas, db.pagos), [db]);

  const deudores = useMemo(() => {
    const porInquilino = new Map<string, { nombre: string; saldo: number; cuotas: number; maxMora: number }>();
    for (const cuota of db.cuotas) {
      const saldo = saldoDeCuota(cuota, db.pagos);
      if (saldo <= 0.01) continue;
      const contrato = db.contratos.find((c) => c.id === cuota.contratoId);
      if (!contrato) continue;
      const persona = db.personas.find((p) => p.id === contrato.inquilinoId);
      const clave = contrato.inquilinoId;
      const actual = porInquilino.get(clave) ?? { nombre: persona?.nombre ?? '—', saldo: 0, cuotas: 0, maxMora: 0 };
      actual.saldo = redondear(actual.saldo + saldo);
      actual.cuotas += 1;
      actual.maxMora = Math.max(actual.maxMora, diasDeMora(cuota, db.pagos));
      porInquilino.set(clave, actual);
    }
    return [...porInquilino.values()].sort((a, b) => b.saldo - a.saldo);
  }, [db]);

  const porPropietario = useMemo(() => {
    const acc = new Map<string, { nombre: string; propiedades: number; liquidado: number; honorarios: number }>();
    for (const prop of db.propiedades) {
      const persona = db.personas.find((p) => p.id === prop.propietarioId);
      const actual = acc.get(prop.propietarioId) ?? {
        nombre: persona?.nombre ?? '—',
        propiedades: 0,
        liquidado: 0,
        honorarios: 0,
      };
      actual.propiedades += 1;
      acc.set(prop.propietarioId, actual);
    }
    for (const liq of db.liquidaciones) {
      if (liq.periodo < desde || liq.periodo > hasta) continue;
      const actual = acc.get(liq.propietarioId);
      if (!actual) continue;
      actual.liquidado = redondear(actual.liquidado + liq.neto);
      actual.honorarios = redondear(actual.honorarios + liq.comisionTotal);
    }
    return [...acc.values()].sort((a, b) => b.honorarios - a.honorarios);
  }, [db, desde, hasta]);

  return (
    <>
      <Encabezado titulo="Reportes" bajada={`Período analizado: ${formatearPeriodo(desde, true)} a ${formatearPeriodo(hasta, true)}`}>
        <div className="interruptores no-imprimir">
          {[3, 6, 12, 24].map((m) => (
            <button key={m} aria-pressed={meses === m} onClick={() => setMeses(m)}>{m} m</button>
          ))}
        </div>
      </Encabezado>

      <div className="contenido pila">
        <div className="grid grid--kpis">
          <Kpi
            etiqueta="Honorarios por administración"
            valor={formatearMoneda(sumar(rentabilidad, (r) => r.honorarios))}
            pie={`${rentabilidad.length} propiedades con movimiento`}
          />
          <Kpi
            etiqueta="Alquileres cobrados"
            valor={formatearMoneda(sumar(rentabilidad, (r) => r.alquilerCobrado))}
            pie="fondos administrados en el período"
          />
          <Kpi
            etiqueta="Deuda de inquilinos"
            valor={formatearMoneda(sumar(deudores, (d) => d.saldo))}
            tono={deudores.length ? 'critico' : 'ok'}
            pie={`${deudores.length} inquilinos con saldo`}
          />
          <Kpi
            etiqueta="Comisiones a agentes"
            valor={formatearMoneda(sumar(comisiones, (c) => c.comision), 'USD')}
            chico
            pie="sobre operaciones escrituradas"
          />
        </div>

        <Pestanas
          valor={vista}
          onCambio={setVista}
          opciones={[
            { id: 'rentabilidad', etiqueta: 'Aporte por propiedad' },
            { id: 'morosidad', etiqueta: 'Morosidad' },
            { id: 'agentes', etiqueta: 'Agentes' },
            { id: 'propietarios', etiqueta: 'Propietarios' },
          ]}
        />

        {vista === 'rentabilidad' && (
          <Tarjeta
            titulo="Aporte de cada propiedad"
            subtitulo="Honorarios generados menos gastos propios imputados a la unidad"
            acciones={
              <button
                className="btn btn--chico no-imprimir"
                onClick={() =>
                  exportarCSV(
                    'aporte-por-propiedad',
                    ['Código', 'Dirección', 'Propietario', 'Alquiler cobrado', 'Honorarios', 'Gastos', 'Aporte neto'],
                    rentabilidad.map((r) => [r.codigo, r.direccion, r.propietario, r.alquilerCobrado, r.honorarios, r.gastos, r.aporteNeto]),
                  )
                }
              >
                Exportar CSV
              </button>
            }
            ajustado
          >
            {rentabilidad.length === 0 ? (
              <Vacio icono="📊" titulo="Sin datos en el período" />
            ) : (
              <Tabla>
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Dirección</th>
                    <th>Propietario</th>
                    <th className="num">Alquiler cobrado</th>
                    <th className="num">Honorarios</th>
                    <th className="num">Gastos propios</th>
                    <th className="num">Aporte neto</th>
                  </tr>
                </thead>
                <tbody>
                  {rentabilidad.map((r) => (
                    <tr key={r.propiedadId}>
                      <td className="principal-celda">{r.codigo}</td>
                      <td>{r.direccion}</td>
                      <td className="mini">{r.propietario}</td>
                      <td className="num">{formatearMoneda(r.alquilerCobrado)}</td>
                      <td className="num">{formatearMoneda(r.honorarios)}</td>
                      <td className="num tenue">{r.gastos ? formatearMoneda(r.gastos) : '—'}</td>
                      <td className={`num principal-celda ${r.aporteNeto < 0 ? 'neg' : 'pos'}`}>{formatearMoneda(r.aporteNeto)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={3}>Totales</td>
                    <td className="num">{formatearMoneda(sumar(rentabilidad, (r) => r.alquilerCobrado))}</td>
                    <td className="num">{formatearMoneda(sumar(rentabilidad, (r) => r.honorarios))}</td>
                    <td className="num">{formatearMoneda(sumar(rentabilidad, (r) => r.gastos))}</td>
                    <td className="num">{formatearMoneda(sumar(rentabilidad, (r) => r.aporteNeto))}</td>
                  </tr>
                </tfoot>
              </Tabla>
            )}
          </Tarjeta>
        )}

        {vista === 'morosidad' && (
          <div className="pila">
            <PanelGrafico
              titulo="Antigüedad de la deuda"
              subtitulo="Cuánto hace que está impaga cada parte del saldo"
              grafico={
                <GraficoBarrasHorizontales
                  datos={mora.map((m) => ({ etiqueta: m.etiqueta, valor: m.monto }))}
                  alto={200}
                  rampa={RAMPA_MORA}
                />
              }
              tabla={
                <Tabla compacta>
                  <thead>
                    <tr><th>Tramo</th><th className="num">Cuotas</th><th className="num">Saldo</th></tr>
                  </thead>
                  <tbody>
                    {mora.map((m) => (
                      <tr key={m.etiqueta}>
                        <td>{m.etiqueta}</td>
                        <td className="num">{m.cantidad}</td>
                        <td className="num">{formatearMoneda(m.monto)}</td>
                      </tr>
                    ))}
                  </tbody>
                </Tabla>
              }
            />

            <Tarjeta
              titulo="Deudores"
              subtitulo="Ordenados por saldo"
              acciones={
                <button
                  className="btn btn--chico no-imprimir"
                  onClick={() =>
                    exportarCSV(
                      'deudores',
                      ['Inquilino', 'Cuotas impagas', 'Saldo', 'Días de mora'],
                      deudores.map((d) => [d.nombre, d.cuotas, d.saldo, d.maxMora]),
                    )
                  }
                >
                  Exportar CSV
                </button>
              }
              ajustado
            >
              {deudores.length === 0 ? (
                <Vacio icono="🎉" titulo="No hay deuda pendiente" detalle="Todas las cuotas emitidas están cobradas." />
              ) : (
                <Tabla>
                  <thead>
                    <tr>
                      <th>Inquilino</th>
                      <th className="num">Cuotas impagas</th>
                      <th className="num">Saldo</th>
                      <th className="num">Mora máxima</th>
                      <th>Situación</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deudores.map((d) => (
                      <tr key={d.nombre}>
                        <td className="principal-celda">{d.nombre}</td>
                        <td className="num">{d.cuotas}</td>
                        <td className="num neg">{formatearMoneda(d.saldo)}</td>
                        <td className="num">{plural(d.maxMora, 'día', 'días')}</td>
                        <td>
                          {d.maxMora > 90 ? (
                            <Chip tono="critico">Gestión judicial</Chip>
                          ) : d.maxMora > 30 ? (
                            <Chip tono="serio">Intimación</Chip>
                          ) : (
                            <Chip tono="alerta">Reclamo</Chip>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Tabla>
              )}
            </Tarjeta>
          </div>
        )}

        {vista === 'agentes' && (
          <Tarjeta titulo="Producción por agente" subtitulo="Volumen intermediado y comisiones" ajustado>
            {comisiones.length === 0 ? (
              <Vacio icono="🧑‍💼" titulo="Sin operaciones asignadas a agentes" />
            ) : (
              <Tabla>
                <thead>
                  <tr>
                    <th>Agente</th>
                    <th className="num">Operaciones</th>
                    <th className="num">Volumen</th>
                    <th className="num">Comisión cobrada</th>
                    <th className="num">Comisión en curso</th>
                  </tr>
                </thead>
                <tbody>
                  {comisiones.map((c) => (
                    <tr key={c.agenteId}>
                      <td className="principal-celda">{c.nombre}</td>
                      <td className="num">{c.operaciones}</td>
                      <td className="num">{formatearMoneda(c.volumen, 'USD')}</td>
                      <td className="num pos">{formatearMoneda(c.comision, 'USD')}</td>
                      <td className="num tenue">{formatearMoneda(c.comisionPendiente, 'USD')}</td>
                    </tr>
                  ))}
                </tbody>
              </Tabla>
            )}
          </Tarjeta>
        )}

        {vista === 'propietarios' && (
          <Tarjeta titulo="Cartera por propietario" subtitulo="Qué se le liquidó y qué dejó de honorarios" ajustado>
            <Tabla>
              <thead>
                <tr>
                  <th>Propietario</th>
                  <th className="num">Propiedades</th>
                  <th className="num">Liquidado en el período</th>
                  <th className="num">Honorarios generados</th>
                  <th className="num">Participación</th>
                </tr>
              </thead>
              <tbody>
                {porPropietario.map((p) => {
                  const total = sumar(porPropietario, (x) => x.honorarios);
                  return (
                    <tr key={p.nombre}>
                      <td className="principal-celda">{p.nombre}</td>
                      <td className="num">{p.propiedades}</td>
                      <td className="num">{formatearMoneda(p.liquidado)}</td>
                      <td className="num pos">{formatearMoneda(p.honorarios)}</td>
                      <td className="num tenue">{formatearPorcentaje(total ? (p.honorarios / total) * 100 : 0)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </Tabla>
          </Tarjeta>
        )}

        <p className="mini tenue">Reporte generado el {formatearFecha(new Date().toISOString().slice(0, 10))}.</p>
      </div>
    </>
  );
}

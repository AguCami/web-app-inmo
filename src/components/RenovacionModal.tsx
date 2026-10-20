import { useMemo, useState } from 'react';
import { Campo, Modal, Nota } from './ui';
import { useApp, useDb } from '../data/store';
import {
  ETIQUETA_INDICE,
  contratoRenovado,
  mesesDeContrato,
  montoVigente,
  siguienteNumeroContrato,
} from '../domain/contratos';
import type { Contrato, IndiceAjuste } from '../domain/types';
import {
  formatearFecha,
  formatearMoneda,
  formatearPeriodo,
  formatearPorcentaje,
  periodoDe,
  sumarMeses,
} from '../domain/util';

/**
 * Renovar es dar de alta el contrato que sigue y cerrar el que vence.
 *
 * No se estira la fecha de fin del viejo a propósito: el cronograma encadena
 * los coeficientes desde el monto inicial, así que estirarlo seguiría
 * ajustando sobre una base de hace dos años. Con un contrato nuevo, la
 * actualización arranca del alquiler que rige hoy.
 */
export function RenovacionModal({
  contrato,
  onCerrar,
  onRenovado,
}: {
  contrato: Contrato;
  onCerrar: () => void;
  onRenovado: (nuevo: Contrato) => void;
}) {
  const db = useDb();
  const renovar = useApp((e) => e.renovarContrato);

  const propiedad = db.propiedades.find((p) => p.id === contrato.propiedadId);
  const inquilino = db.personas.find((p) => p.id === contrato.inquilinoId);

  const propuesta = useMemo(
    () => contratoRenovado(contrato, db.indices, siguienteNumeroContrato(db.contratos)),
    [contrato, db.indices, db.contratos],
  );
  const montoAlFinal = montoVigente(contrato, periodoDe(propuesta.fechaInicio), db.indices);

  const [f, setF] = useState({
    numero: propuesta.numero,
    fechaInicio: propuesta.fechaInicio,
    meses: mesesDeContrato(contrato),
    montoInicial: propuesta.montoInicial,
    indiceAjuste: contrato.indiceAjuste,
    mesesAjuste: contrato.mesesAjuste,
    comisionAdminPct: contrato.comisionAdminPct,
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));

  const fechaFin = sumarMeses(f.fechaInicio, Math.max(1, f.meses) - 1);
  const variacion = montoAlFinal > 0 ? ((f.montoInicial - montoAlFinal) / montoAlFinal) * 100 : 0;

  // El contrato anterior factura el mes de su vencimiento completo. Si el
  // nuevo empieza dentro de ese mes, los dos emiten cuota de la misma unidad.
  const sePisan = periodoDe(f.fechaInicio) <= periodoDe(contrato.fechaFin);
  const valido = f.numero.trim().length > 0 && f.montoInicial > 0 && f.meses >= 1 && !sePisan;

  return (
    <Modal
      titulo="Renovar el contrato"
      subtitulo={`${inquilino?.nombre ?? ''} · ${propiedad?.codigo ?? ''}`}
      onCerrar={onCerrar}
      ancho
      pie={
        <>
          <button className="btn btn--fantasma" onClick={onCerrar}>Cancelar</button>
          <button
            className="btn btn--primario"
            disabled={!valido}
            onClick={() => {
              const nuevo: Contrato = {
                ...propuesta,
                numero: f.numero.trim(),
                fechaInicio: f.fechaInicio,
                fechaFin,
                montoInicial: f.montoInicial,
                indiceAjuste: f.indiceAjuste,
                mesesAjuste: f.mesesAjuste,
                comisionAdminPct: f.comisionAdminPct,
              };
              renovar(contrato.id, nuevo);
              onRenovado(nuevo);
            }}
          >
            Renovar por {Math.max(1, f.meses)} meses
          </button>
        </>
      }
    >
      <Nota titulo="Se crea un contrato nuevo">
        <span>
          El contrato {contrato.numero} queda finalizado el{' '}
          {formatearFecha(contrato.fechaFin)}, con sus cuotas, recibos y liquidaciones intactos.
          El nuevo arranca el mes siguiente y no al día siguiente, porque el anterior factura{' '}
          {formatearPeriodo(periodoDe(contrato.fechaFin), true)} entero: si se superpusieran, la
          unidad quedaría con dos cuotas del mismo mes. Tampoco se estira el anterior, porque las
          actualizaciones seguirían encadenándose sobre el alquiler de{' '}
          {formatearFecha(contrato.fechaInicio)}.
        </span>
      </Nota>

      <div className="grid grid--form">
        <Campo etiqueta="Número del contrato nuevo">
          <input value={f.numero} onChange={(e) => set('numero', e.target.value)} />
        </Campo>
        <Campo
          etiqueta="Empieza el"
          ayuda={
            sePisan
              ? `El anterior factura hasta ${formatearPeriodo(periodoDe(contrato.fechaFin), true)} inclusive: el nuevo tiene que empezar después.`
              : undefined
          }
        >
          <input
            type="date"
            value={f.fechaInicio}
            onChange={(e) => set('fechaInicio', e.target.value)}
          />
        </Campo>
        <Campo etiqueta="Plazo en meses" ayuda={`Termina el ${formatearFecha(fechaFin)}`}>
          <input
            className="entrada-num"
            type="number"
            min={1}
            max={120}
            value={f.meses}
            onChange={(e) => set('meses', Number(e.target.value))}
          />
        </Campo>
      </div>

      <div className="grid grid--form">
        <Campo
          etiqueta="Alquiler inicial"
          ayuda={
            `El anterior terminaba en ${formatearMoneda(montoAlFinal, contrato.moneda)}` +
            (Math.abs(variacion) >= 0.1 ? ` · ${variacion > 0 ? '+' : ''}${formatearPorcentaje(variacion)}` : '')
          }
        >
          <input
            className="entrada-num"
            type="number"
            value={f.montoInicial || ''}
            onChange={(e) => set('montoInicial', Number(e.target.value))}
          />
        </Campo>
        <Campo etiqueta="Se actualiza por">
          <select
            value={f.indiceAjuste}
            onChange={(e) => set('indiceAjuste', e.target.value as IndiceAjuste)}
          >
            {(Object.keys(ETIQUETA_INDICE) as IndiceAjuste[]).map((i) => (
              <option key={i} value={i}>{ETIQUETA_INDICE[i]}</option>
            ))}
          </select>
        </Campo>
        <Campo etiqueta="Cada cuántos meses">
          <input
            className="entrada-num"
            type="number"
            min={1}
            max={12}
            value={f.mesesAjuste}
            onChange={(e) => set('mesesAjuste', Number(e.target.value))}
          />
        </Campo>
      </div>

      <Campo
        etiqueta="Honorarios de administración (%)"
        ayuda="Se heredan del contrato anterior; es el momento de revisarlos."
      >
        <input
          className="entrada-num"
          type="number"
          step="0.5"
          value={f.comisionAdminPct}
          onChange={(e) => set('comisionAdminPct', Number(e.target.value))}
        />
      </Campo>

      <p className="mini">
        Se heredan el inquilino, los garantes, el depósito y los conceptos fijos
        {contrato.conceptosFijos.length > 0 &&
          ` (${contrato.conceptosFijos.map((c) => c.descripcion).join(', ')})`}
        . Todo eso se puede editar después desde el contrato nuevo.
      </p>
    </Modal>
  );
}

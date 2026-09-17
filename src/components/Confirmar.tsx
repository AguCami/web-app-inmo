import type { ReactNode } from 'react';
import { Modal, Nota } from './ui';
import { impactoDeBorrar, type ColeccionBorrable } from '../domain/integridad';
import { useDb } from '../data/store';
import type { ID } from '../domain/types';
import { plural } from '../domain/util';

/** Confirmación genérica para cualquier acción que no tiene vuelta atrás. */
export function Confirmar({
  titulo,
  textoAccion,
  children,
  onConfirmar,
  onCerrar,
}: {
  titulo: string;
  textoAccion: string;
  children?: ReactNode;
  onConfirmar: () => void;
  onCerrar: () => void;
}) {
  return (
    <Modal
      titulo={titulo}
      onCerrar={onCerrar}
      pie={
        <>
          <button className="btn btn--fantasma" onClick={onCerrar}>
            Cancelar
          </button>
          <button
            className="btn btn--peligro"
            onClick={() => {
              onConfirmar();
              onCerrar();
            }}
          >
            {textoAccion}
          </button>
        </>
      }
    >
      {children}
      <p className="mini tenue">Esto no se puede deshacer.</p>
    </Modal>
  );
}

/**
 * Confirmación de borrado que dice, antes de borrar, qué más se va con eso.
 * El detalle se calcula simulando el borrado real, así lo que promete el
 * cartel es exactamente lo que va a pasar.
 */
export function ConfirmarBorrado({
  coleccion,
  id,
  nombre,
  queEs,
  onConfirmar,
  onCerrar,
}: {
  coleccion: ColeccionBorrable;
  id: ID;
  nombre: string;
  /** Cómo llamarlo en el título: «la propiedad», «el contrato»… */
  queEs: string;
  onConfirmar: () => void;
  onCerrar: () => void;
}) {
  const db = useDb();
  const impacto = impactoDeBorrar(db, coleccion, id);

  const arrastra: string[] = [];
  if (impacto.contratos > 1 || (impacto.contratos === 1 && coleccion !== 'contratos')) {
    arrastra.push(plural(impacto.contratos, 'contrato', 'contratos'));
  }
  if (impacto.cuotas) arrastra.push(plural(impacto.cuotas, 'cuota', 'cuotas'));
  if (impacto.pagos) arrastra.push(plural(impacto.pagos, 'pago', 'pagos'));
  if (impacto.gastos && coleccion !== 'gastos') {
    arrastra.push(plural(impacto.gastos, 'gasto', 'gastos'));
  }
  if (impacto.liquidaciones) {
    arrastra.push(plural(impacto.liquidaciones, 'liquidación', 'liquidaciones'));
  }

  return (
    <Confirmar
      titulo={`¿Borrar ${queEs}?`}
      textoAccion="Sí, borrar"
      onConfirmar={onConfirmar}
      onCerrar={onCerrar}
    >
      <p>
        Se va a borrar <strong>{nombre}</strong>.
      </p>

      {arrastra.length > 0 && (
        <Nota tono="alerta" titulo="Se borra también todo lo que dependía de esto">
          <span className="mini">{arrastra.join(' · ')}</span>
        </Nota>
      )}
    </Confirmar>
  );
}

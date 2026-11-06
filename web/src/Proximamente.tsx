import { Logo } from '../../src/components/Logo';
import { usePrefiereCalma } from '../../src/components/animacion';
import { useColgante } from '../../src/components/colgante';
import fondo from '../../src/assets/ingreso-fondo.webp';

/** Lo que va impreso en la cinta: el mismo texto y largo que en la app de gestión. */
const CINTA = 'Inversiones Generales M & M';

/**
 * La portada de la web pública mientras se arma: la misma credencial colgada
 * del ingreso de la app de gestión —espiral, cinta, vaivén, se puede revolear—,
 * pero sin formulario. La tarjeta dice «Próximamente» y nada más.
 *
 * Reusa las piezas de src/ a propósito: si la credencial cambia allá, cambia acá.
 */
export function Proximamente() {
  const calma = usePrefiereCalma();
  const { brazo, tarjeta, manejadores } = useColgante(calma);

  return (
    <main className="ingreso tema-claro">
      <img className="ingreso__fondo" src={fondo} alt="" aria-hidden="true" />

      <div className={calma ? 'colgante' : 'colgante colgante--entra'}>
        <div className="colgante__brazo" ref={brazo}>
          <div className="colgante__cinta" aria-hidden="true">
            <span>{CINTA}</span>
          </div>
          <div className="colgante__gancho" aria-hidden="true" />
          <div className="ingreso__caja" ref={tarjeta} {...manejadores}>
            <span className="ingreso__ojal" aria-hidden="true" />
            <span className="colgante__argolla" aria-hidden="true" />
            <div className="ingreso__form">
              <div className="ingreso__marca">
                <Logo tam={52} />
                <h1 className="ingreso__nombre">
                  <span>Inversiones Generales</span>
                  <span className="ingreso__mym">M&nbsp;&amp;&nbsp;M</span>
                  <span>Inmobiliaria</span>
                </h1>
              </div>
              <p className="proximamente">Próximamente</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

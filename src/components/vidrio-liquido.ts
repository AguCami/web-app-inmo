import { useEffect, type RefObject } from 'react';

/**
 * El vidrio líquido de verdad, con WebGL.
 *
 * Por qué no alcanza con CSS: `backdrop-filter` no puede leer los píxeles
 * que hay detrás de un elemento, así que desenfoca y satura pero no
 * refracta. Se puede imitar con un filtro SVG de desplazamiento —y eso es
 * lo que hace la variante `?vidrio`—, pero el mapa que se arma con
 * degradés describe una lente rectangular y se rompe en las esquinas
 * redondeadas.
 *
 * Esta librería lo resuelve al revés: en vez de pedirle el fondo al
 * navegador, vuelve a dibujar la página en un canvas, la sube como
 * textura a WebGL y corre un shader que sí conoce la forma —la distancia
 * firmada al borde del rectángulo redondeado— y hace refracción,
 * aberración cromática, Fresnel y especular por píxel.
 *
 * Se usa SOLO en el ingreso, y la razón es el costo: la librería
 * rasteriza el DOM que hay detrás del vidrio cada vez que cambia. En una
 * pantalla con una sola tarjeta sobre un fondo quieto eso se captura una
 * vez; en el listado de cobranzas, que scrollea y se filtra, sería caro
 * todo el tiempo. El resto de la app usa el CSS de siempre.
 *
 * Degradación: si el navegador no tiene WebGL, si la carga falla o si la
 * persona pidió menos transparencia o menos movimiento, no pasa nada y
 * queda la tarjeta normal. El atributo `data-vidrio-liquido` solo se
 * pone cuando el efecto está realmente andando, así el CSS puede sacarle
 * el fondo a la tarjeta únicamente en ese caso.
 */
export function useVidrioLiquido(
  raiz: RefObject<HTMLElement | null>,
  vidrio: RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    const elRaiz = raiz.current;
    const elVidrio = vidrio.current;
    if (!elRaiz || !elVidrio) return;

    // Un lazo de render permanente no se le impone a quien pidió calma.
    const calma =
      window.matchMedia('(prefers-reduced-transparency: reduce)').matches ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (calma) return;

    let vivo = true;
    let instancia: { destroy: () => void } | null = null;

    void (async () => {
      try {
        // Import dinámico: el shader y el rasterizador no entran en el
        // bundle principal, solo se bajan al llegar al ingreso.
        const { LiquidGlass } = await import('@ybouane/liquidglass');
        if (!vivo) return;

        instancia = await LiquidGlass.init({
          root: elRaiz,
          glassElements: [elVidrio],
          defaults: {
            // Desenfoque: detrás hay una ciudad con ventanas, y el
            // formulario tiene que leerse por encima sin pelearse con
            // ella. Es el parámetro que más cuida la legibilidad.
            blurAmount: 1.2,
            refraction: 0.9,
            chromAberration: 0.1,
            // El canto y el especular son lo que delimita la pieza. Con
            // los valores de fábrica (0,05 y 0) el panel no se veía.
            edgeHighlight: 0.9,
            specular: 0.85,
            fresnel: 1,
            // Un velo apenas, para despegar el cuerpo del fondo y que el
            // texto blanco tenga sobre qué apoyarse.
            tintStrength: 0.12,
            brightness: 0.04,
            // Tiene que coincidir con el --r-lg de la tarjeta, o el
            // shader redondea distinto que el borde del CSS.
            cornerRadius: 24,
            zRadius: 26,
            shadowOpacity: 0.26,
            shadowSpread: 26,
            shadowOffsetY: 10,
          },
        });

        if (!vivo) {
          instancia.destroy();
          instancia = null;
          return;
        }
        elRaiz.dataset.vidrioLiquido = 'si';
      } catch {
        // Sin WebGL, con el canvas contaminado o si el módulo no baja:
        // la tarjeta de siempre ya está en pantalla y alcanza.
      }
    })();

    return () => {
      vivo = false;
      instancia?.destroy();
      delete elRaiz.dataset.vidrioLiquido;
    };
  }, [raiz, vidrio]);
}

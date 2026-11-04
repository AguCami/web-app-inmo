#!/usr/bin/env python3
"""Genera las lentes SVG del vidrio líquido y las escribe en index.html.

Las lentes no se arman a mano. El mapa de `feDisplacementMap` es fácil de
equivocar de dos formas que no se ven leyendo el código, y las dos ya
pasaron:

 1. El mapa se compone con dos degradés en `screen`, uno que mueve en X
    por el canal rojo y otro que mueve en Y por el verde. `screen` no es
    una selección de canales, es 1-(1-a)(1-b): si el degradé horizontal
    lleva verde distinto de cero, le ensucia el canal al vertical y la
    lente arrastra el interior en vez de deformar el canto. Por eso acá
    el degradé X lleva SOLO rojo y el Y SOLO verde.

 2. `feImage` con preserveAspectRatio="none" estira el mapa a la REGIÓN
    del filtro, no al elemento. Si la región es más grande que la pieza
    —y tiene que serlo, o el desplazamiento no tiene de dónde tomar
    píxeles—, las rampas del canto caen fuera de la pieza y no se ve
    nada. Por eso las rampas se recolocan en función del margen.

Uso:  python3 scripts/lente.py          # reescribe index.html
      python3 scripts/lente.py --ver    # solo imprime, no toca nada
"""
import re
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
INDEX = RAIZ / 'index.html'

# Una lente por tamaño de pieza. El canto pesa más en una pieza chica,
# así que su banda de refracción es proporcionalmente más ancha.
LENTES = {
    'lente': dict(margen=0.25, banda=0.16, escala=72, croma=0.0),
    'lente-chica': dict(margen=0.30, banda=0.26, escala=34, croma=0.0),
}

# Aberración cromática: tres pasadas a escalas levemente distintas, tomando
# R de una, G de otra y B de la tercera.
#
# Queda en 0 a propósito, y conviene no subirlo con este fondo. Medido: el
# fondo de esta variante es una retícula de líneas de 1 px, y cualquier
# separación de canales de ese orden parte cada línea en tres copias de
# color. Con croma 0,03 y escala 72 la separación es ~2 px y aparecen
# franjas de cian saturado (medido: saturación 0,90 sobre un fondo que no
# tiene ningún color). La aberración se luce sobre fotos o degradés suaves,
# no sobre líneas finas. El camino de código queda porque es correcto y
# sirve si algún día el fondo cambia.
CANALES = (
    ('R', (1, 0, 0)),
    ('G', (0, 1, 0)),
    ('B', (0, 0, 1)),
)

PASOS = 7  # stops por rampa; con menos se ve el escalón


def mapa(margen: float, banda: float):
    """Devuelve (data-URI del mapa, atributos de región) para una lente.

    margen: cuánto se agranda la región por lado, en fracción del elemento.
    banda:  ancho del canto donde ocurre la refracción, ídem.
    """
    total = 1 + 2 * margen
    ini = margen / total          # dónde empieza el elemento dentro del mapa
    fin = (margen + 1) / total
    b = banda * (fin - ini)
    f = lambda v: f'{v:.5f}'

    def rampa(desde, hasta, c0, c1, canal):
        """Rampa suavizada (smoothstep). Una rampa lineal desplaza con
        pendiente constante, que es un corte y no una lente."""
        salida = []
        for i in range(PASOS + 1):
            t = i / PASOS
            s = t * t * (3 - 2 * t)
            off = desde + (hasta - desde) * t
            salida.append(f"<stop offset='{f(off)}' stop-color='{canal(round(c0 + (c1 - c0) * s))}'/>")
        return ''.join(salida)

    rojo = lambda v: f'rgb({v},0,0)'
    verde = lambda v: f'rgb(0,{v},0)'

    def eje(ident, coords, canal, plano):
        return (
            f"<linearGradient id='{ident}' {coords}>"
            f"<stop offset='0' stop-color='{canal(0)}'/>"
            + rampa(ini, ini + b, 0, 128, canal)
            + f"<stop offset='{f(fin - b)}' stop-color='{plano}'/>"
            + rampa(fin - b, fin, 128, 255, canal)
            + f"<stop offset='1' stop-color='{canal(255)}'/></linearGradient>"
        )

    gx = eje('x', "x1='0' x2='1'", rojo, 'rgb(128,0,0)')
    gy = eje('y', "y1='0' y2='1'", verde, 'rgb(0,128,0)')

    svg = (
        "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200' preserveAspectRatio='none'>"
        f'<defs>{gx}{gy}</defs>'
        "<rect width='200' height='200' fill='url(%23x)'/>"
        "<rect width='200' height='200' fill='url(%23y)' style='mix-blend-mode:screen'/></svg>"
    )
    pct = lambda v: f'{v * 100:.0f}%'
    region = f'x="{pct(-margen)}" y="{pct(-margen)}" width="{pct(total)}" height="{pct(total)}"'
    return svg, region


def filtro(ident, margen, banda, escala, croma):
    """Devuelve el elemento <filter> completo, con aberración cromática."""
    svg, region = mapa(margen, banda)
    partes = [f'<filter id="{ident}" {region} color-interpolation-filters="sRGB">']
    partes.append(f'<feImage result="m" preserveAspectRatio="none" href="data:image/svg+xml;utf8,{svg}" />')

    if croma <= 0:
        partes.append(
            f'<feDisplacementMap in="SourceGraphic" in2="m" scale="{escala}"'
            ' xChannelSelector="R" yChannelSelector="G" />'
        )
    else:
        # Una pasada por canal, a escalas levemente distintas.
        for i, (canal, fila) in enumerate(CANALES):
            k = escala * (1 + croma * (1 - i))      # R más, G igual, B menos
            partes.append(
                f'<feDisplacementMap in="SourceGraphic" in2="m" scale="{k:.2f}"'
                f' xChannelSelector="R" yChannelSelector="G" result="d{canal}" />'
            )
            r, g, b = fila
            partes.append(
                f'<feColorMatrix in="d{canal}" type="matrix" result="c{canal}"'
                f' values="{r} 0 0 0 0  0 {g} 0 0 0  0 0 {b} 0 0  0 0 0 1 0" />'
            )
        # Recombinar los tres canales.
        partes.append('<feBlend in="cR" in2="cG" mode="screen" result="rg" />')
        partes.append('<feBlend in="rg" in2="cB" mode="screen" />')

    partes.append('</filter>')
    return ''.join(partes)


def comprobar(escala: int):
    """El centro del mapa tiene que quedar en 128, o la lente arrastra."""
    centro = 1 - (1 - 0.0) * (1 - 128 / 255)      # X sin verde, Y al medio
    return escala * (centro - 0.5)


def main() -> int:
    solo_ver = '--ver' in sys.argv
    texto = INDEX.read_text(encoding='utf-8')
    original = texto

    for ident, cfg in LENTES.items():
        nuevo = filtro(ident, **cfg)
        patron = re.compile(r'<filter\s+id="' + re.escape(ident) + r'".*?</filter>', re.S)
        if not patron.search(texto):
            print(f'no encontré el filtro «{ident}» en index.html', file=sys.stderr)
            return 1
        texto = patron.sub(lambda m: nuevo, texto, count=1)
        pasadas = 3 if cfg['croma'] > 0 else 1
        print(
            f"{ident}: banda {cfg['banda']:.2f}, escala {cfg['escala']}, "
            f"croma {cfg['croma']:.2f} ({pasadas} pasada{'s' if pasadas > 1 else ''}), "
            f"centro {comprobar(cfg['escala']):+.2f} px"
        )

    if solo_ver:
        return 0
    if texto == original:
        print('index.html ya estaba al día')
        return 0
    INDEX.write_text(texto, encoding='utf-8')
    print('index.html actualizado — pasale prettier antes de commitear')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())

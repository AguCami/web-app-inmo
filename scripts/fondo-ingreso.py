#!/usr/bin/env python3
"""Genera el fondo de la pantalla de ingreso.

Por qué una imagen y no un degradé CSS: el vidrio líquido del ingreso
refracta lo que hay detrás, y refractar un degradé liso da otro degradé
liso —o sea, no se ve nada—. La refracción necesita DETALLE: bordes y
frecuencia alta que al doblarse se noten. Un degradé no los tiene.

Además la librería dibuja los <img> directo con ctx.drawImage, mientras
que un árbol de divs lo rasteriza con html-to-image, que es bastante más
caro.

El motivo es una silueta urbana abstracta en los azules de la marca:
tiene sentido para una inmobiliaria y le da al cristal aristas que doblar.

Uso:  python3 scripts/fondo-ingreso.py
"""
import math
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ANCHO, ALTO = 1600, 1000
SALIDA = Path(__file__).resolve().parent.parent / 'src' / 'assets' / 'ingreso-fondo.webp'

# Los azules del logo, más un verdeazulado y un violeta de apoyo.
CIELO = [(0x2f, 0x55, 0x8c), (0x3b, 0x6b, 0xa8), (0x46, 0x7f, 0xbe)]
TORRES = [
    (0x1c, 0x3a, 0x66), (0x24, 0x47, 0x79), (0x2b, 0x55, 0x8d),
    (0x1f, 0x5e, 0x72), (0x35, 0x3f, 0x7a), (0x17, 0x30, 0x57),
]


def degrade_vertical(im, arriba, abajo):
    d = ImageDraw.Draw(im)
    for y in range(im.height):
        t = y / (im.height - 1)
        c = tuple(round(a + (b - a) * t) for a, b in zip(arriba, abajo))
        d.line([(0, y), (im.width, y)], fill=c)


def main() -> int:
    rnd = random.Random(7)  # fijo: el fondo tiene que ser reproducible
    im = Image.new('RGB', (ANCHO, ALTO))
    degrade_vertical(im, CIELO[2], CIELO[0])

    # Resplandores de color, bien suaves, para que el conjunto no sea plano.
    brillo = Image.new('RGB', (ANCHO, ALTO), CIELO[1])
    bd = ImageDraw.Draw(brillo)
    for cx, cy, r, col in [
        (0.14, 0.10, 0.52, (0x5f, 0x93, 0xdd)),
        (0.88, 0.08, 0.46, (0x7d, 0x6b, 0xcf)),
        (0.80, 0.96, 0.50, (0x2f, 0x9c, 0xa8)),
    ]:
        bd.ellipse(
            [cx * ANCHO - r * ANCHO, cy * ALTO - r * ALTO,
             cx * ANCHO + r * ANCHO, cy * ALTO + r * ALTO],
            fill=col,
        )
    brillo = brillo.filter(ImageFilter.GaussianBlur(170))
    im = Image.blend(im, brillo, 0.55)

    # Las torres: tres planos, el de atrás más claro y difuso.
    for plano, (desenf, alfa, alto_min, alto_max, ancho_min, ancho_max) in enumerate(
        [(7.0, 0.38, 0.30, 0.52, 52, 120),
         (3.0, 0.60, 0.40, 0.70, 64, 150),
         (0.8, 0.86, 0.52, 0.88, 78, 190)]
    ):
        capa = Image.new('RGBA', (ANCHO, ALTO), (0, 0, 0, 0))
        cd = ImageDraw.Draw(capa)
        x = -60
        while x < ANCHO + 60:
            an = rnd.randint(ancho_min, ancho_max)
            al = rnd.uniform(alto_min, alto_max) * ALTO
            y0 = ALTO - al
            col = TORRES[rnd.randrange(len(TORRES))]
            cd.rectangle([x, y0, x + an, ALTO], fill=col + (round(255 * alfa),))

            # Ventanas: son las que aportan la frecuencia alta que el
            # vidrio necesita para que la refracción se note.
            if plano >= 1:
                paso_x, paso_y = 13, 17
                luz = (0xe8, 0xf0, 0xff)
                for vy in range(int(y0) + 16, ALTO - 10, paso_y):
                    for vx in range(x + 10, x + an - 8, paso_x):
                        if rnd.random() < 0.42:
                            a = round(255 * alfa * rnd.uniform(0.25, 0.75))
                            cd.rectangle([vx, vy, vx + 5, vy + 8], fill=luz + (a,))
            x += an + rnd.randint(6, 26)

        if desenf:
            capa = capa.filter(ImageFilter.GaussianBlur(desenf))
        im = Image.alpha_composite(im.convert('RGBA'), capa).convert('RGB')

    # Grano fino: sube un poco más la frecuencia alta, sin ensuciar.
    grano = Image.effect_noise((ANCHO, ALTO), 7).convert('L')
    im = Image.composite(im, Image.blend(im, Image.new('RGB', im.size, (255, 255, 255)), 0.05), grano)

    # Viñeta suave, para que la tarjeta del centro resalte.
    vin = Image.new('L', (ANCHO, ALTO), 0)
    ImageDraw.Draw(vin).ellipse(
        [-ANCHO * 0.12, -ALTO * 0.22, ANCHO * 1.12, ALTO * 1.22], fill=255
    )
    vin = vin.filter(ImageFilter.GaussianBlur(190))
    oscuro = Image.new('RGB', (ANCHO, ALTO), (0x15, 0x28, 0x45))
    im = Image.composite(im, Image.blend(im, oscuro, 0.45), vin)

    SALIDA.parent.mkdir(parents=True, exist_ok=True)
    # WebP con pérdida: el PNG daba casi 1 MB para una pantalla de login.
    # La calidad alcanza de sobra, y el detalle fino de las ventanas
    # —que es lo que el vidrio refracta— sobrevive.
    im.save(SALIDA, quality=86, method=6)
    kb = SALIDA.stat().st_size / 1024
    print(f'{SALIDA.relative_to(SALIDA.parents[2])}  {ANCHO}x{ALTO}  {kb:.0f} kB')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())

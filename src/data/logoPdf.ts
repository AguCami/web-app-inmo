/**
 * El logo, listo para meter en un PDF.
 *
 * El PDF embebe el JPEG tal cual viene, así que hay que convertir el PNG: se
 * dibuja sobre blanco —el PNG es transparente y el JPEG no tiene canal alfa—
 * y se exporta con el canvas del navegador. Nada de esto es crítico: si
 * falla, el recibo sale sin logo y con el nombre en grande.
 */
import type { ImagenJPEG } from '../domain/pdf';

const LADO = 220;

let cache: ImagenJPEG | null | undefined;

function cargarImagen(url: string): Promise<HTMLImageElement> {
  return new Promise((resolver, rechazar) => {
    const img = new Image();
    img.onload = () => resolver(img);
    img.onerror = () => rechazar(new Error(`no se pudo cargar ${url}`));
    img.src = url;
  });
}

function bytesDeDataURL(dataURL: string): Uint8Array {
  const base64 = dataURL.slice(dataURL.indexOf(',') + 1);
  const binario = atob(base64);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i += 1) bytes[i] = binario.charCodeAt(i);
  return bytes;
}

export async function logoParaPdf(): Promise<ImagenJPEG | undefined> {
  if (cache !== undefined) return cache ?? undefined;

  try {
    const img = await cargarImagen(`${import.meta.env.BASE_URL}logo.png`);
    const lienzo = document.createElement('canvas');
    lienzo.width = LADO;
    lienzo.height = LADO;

    const ctx = lienzo.getContext('2d');
    if (!ctx) throw new Error('el navegador no dio contexto 2d');

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, LADO, LADO);

    // Contenido, centrado y sin deformar.
    const escala = Math.min(LADO / img.width, LADO / img.height);
    const ancho = img.width * escala;
    const alto = img.height * escala;
    ctx.drawImage(img, (LADO - ancho) / 2, (LADO - alto) / 2, ancho, alto);

    cache = { datos: bytesDeDataURL(lienzo.toDataURL('image/jpeg', 0.92)), ancho: LADO, alto: LADO };
  } catch {
    cache = null; // se intentó una vez; no vale reintentar en cada recibo
  }

  return cache ?? undefined;
}

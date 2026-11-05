/**
 * El perfil de quien usa la app: su foto y su contraseña.
 *
 * La foto va al mismo depósito que los adjuntos (archivos.ts): con servidor,
 * al bucket "adjuntos" bajo la carpeta de la inmobiliaria, así la cubren las
 * políticas que ya existen y no hace falta tocar el esquema; sin servidor,
 * a IndexedDB. Se achica antes de guardarla: un avatar no necesita más de
 * 256 px, y una foto de celular pesa varios MB.
 */
import { useEffect, useState } from 'react';
import { borrarArchivos, guardarArchivo, leerArchivo } from './archivos';
import { obtenerCliente } from './servidor';

/** El lado del avatar guardado, en píxeles. */
const LADO = 256;

const idFoto = (usuarioId: string | null) => `perfil-${usuarioId ?? 'local'}`;

/* ── La foto, compartida entre el menú y la ventana del perfil ── */

let actual: { id: string; url: string | null } | null = null;
const avisar = new Set<() => void>();

function publicar(id: string, foto: Blob | null) {
  if (actual?.url) URL.revokeObjectURL(actual.url);
  actual = { id, url: foto ? URL.createObjectURL(foto) : null };
  avisar.forEach((f) => f());
}

/** La dirección de la foto para un <img>, o null si no hay. */
export function useFotoPerfil(usuarioId: string | null): string | null {
  const id = idFoto(usuarioId);
  const [, refrescar] = useState(0);

  useEffect(() => {
    const f = () => refrescar((n) => n + 1);
    avisar.add(f);
    if (actual?.id !== id) {
      let vigente = true;
      void leerArchivo(id).then((foto) => vigente && publicar(id, foto));
      return () => {
        vigente = false;
        avisar.delete(f);
      };
    }
    return () => {
      avisar.delete(f);
    };
  }, [id]);

  return actual?.id === id ? actual.url : null;
}

/** Recorta al cuadrado del medio y lo achica. Devuelve un JPEG liviano. */
async function achicar(archivo: File): Promise<Blob> {
  const imagen = await createImageBitmap(archivo);
  const lado = Math.min(imagen.width, imagen.height);
  const lienzo = document.createElement('canvas');
  lienzo.width = LADO;
  lienzo.height = LADO;
  const ctx = lienzo.getContext('2d');
  if (!ctx) throw new Error('El navegador no puede procesar la imagen.');
  ctx.drawImage(imagen, (imagen.width - lado) / 2, (imagen.height - lado) / 2, lado, lado, 0, 0, LADO, LADO);
  imagen.close();
  return new Promise((resolver, rechazar) =>
    lienzo.toBlob((b) => (b ? resolver(b) : rechazar(new Error('No se pudo preparar la imagen.'))), 'image/jpeg', 0.86),
  );
}

/** Devuelve un mensaje de error, o null si salió bien. */
export async function guardarFoto(usuarioId: string | null, archivo: File): Promise<string | null> {
  if (!archivo.type.startsWith('image/')) return 'Elegí una imagen (JPG, PNG o similar).';
  try {
    const foto = await achicar(archivo);
    await guardarArchivo(idFoto(usuarioId), foto);
    publicar(idFoto(usuarioId), foto);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : 'No se pudo guardar la foto.';
  }
}

export async function quitarFoto(usuarioId: string | null): Promise<void> {
  await borrarArchivos([idFoto(usuarioId)]);
  publicar(idFoto(usuarioId), null);
}

/* ── La contraseña ── */

/**
 * Cambia la contraseña. Pide la actual y la comprueba antes: así nadie la
 * cambia desde una compu que quedó con la sesión abierta.
 */
export async function cambiarClave(email: string, actualClave: string, nueva: string): Promise<string | null> {
  if (nueva.length < 8) return 'La contraseña nueva tiene que tener al menos 8 caracteres.';
  if (nueva === actualClave) return 'La contraseña nueva tiene que ser distinta de la actual.';
  try {
    const sb = await obtenerCliente();
    const prueba = await sb.auth.signInWithPassword({ email, password: actualClave });
    if (prueba.error) {
      if (/invalid login credentials/i.test(prueba.error.message)) return 'La contraseña actual no es correcta.';
      return traducir(prueba.error.message);
    }
    const { error } = await sb.auth.updateUser({ password: nueva });
    return error ? traducir(error.message) : null;
  } catch {
    return 'No se pudo contactar al servidor. Revisá la conexión y volvé a probar.';
  }
}

function traducir(mensaje: string): string {
  if (/should be different/i.test(mensaje)) return 'La contraseña nueva tiene que ser distinta de la actual.';
  if (/at least|too short|weak/i.test(mensaje)) return 'La contraseña nueva es muy corta o muy fácil de adivinar.';
  if (/too many requests|rate limit/i.test(mensaje)) return 'Demasiados intentos seguidos. Esperá un minuto.';
  if (/failed to fetch|networkerror|load failed/i.test(mensaje)) {
    return 'No se pudo contactar al servidor. Revisá la conexión y volvé a probar.';
  }
  return mensaje;
}

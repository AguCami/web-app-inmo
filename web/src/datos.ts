import crudas from './datos/propiedades.json';

/**
 * Las propiedades de la web.
 *
 * Por ahora es una copia de lo que hay cargado en el CMS del sitio Wix actual
 * (colección «Properties», solo las publicadas), bajada el 6/11/2026 para ver
 * cómo queda la web nueva con datos reales. Las fotos se siguen sirviendo
 * desde Wix. Cuando se lance, esta lista pasa a salir de una fuente viva.
 */
export interface Propiedad {
  codigo: string;
  titulo: string;
  tipo: string;
  operacion: string;
  localidad: string;
  /** Tal cual se publica: «U$D 220.000», «Consultar», «U$D 350 la Hectárea»… */
  precio: string;
  cubiertos: string | null;
  terreno: string | null;
  /** true: tiene escritura; false: no; null: no se informó. */
  escritura: boolean | null;
  portada: string;
  fotos: string[];
  descripcion: string;
  prioridad: number;
  geo: [number, number] | null;
  /** Fecha de alta, AAAA-MM-DD. */
  alta: string;
}

/**
 * La web se centra en la venta: las que están en alquiler no se publican.
 * (Hoy es una sola; siguen en el archivo por si algún día se muestran.)
 */
export const PROPIEDADES = (crudas as Propiedad[]).filter((p) => p.operacion !== 'Alquiler');

/** Los datos de contacto que se muestran en la web. Lo que esté vacío no se muestra. */
export const CONTACTO = {
  direccion: 'Italia 677',
  localidad: 'Jesús María, Córdoba',
  mapa: 'https://www.google.com/maps/search/?api=1&query=Italia+677,+Jes%C3%BAs+Mar%C3%ADa,+C%C3%B3rdoba',
  /** Con código de país y sin signos, para el enlace de WhatsApp. Ej.: 5493525000000. */
  whatsapp: '',
  telefono: '',
  email: '',
  instagram: '',
};

export const slug = (p: Propiedad) => p.codigo.toLowerCase();

export function buscarPorSlug(s: string | undefined): Propiedad | undefined {
  if (!s) return undefined;
  return PROPIEDADES.find((p) => slug(p) === s.toLowerCase());
}

/** Una foto de Wix recortada al tamaño justo: no se baja la original de 2560 px para una tarjeta. */
export function foto(id: string, ancho: number, alto: number): string {
  return `https://static.wixstatic.com/media/${id}/v1/fill/w_${ancho},h_${alto},al_c,q_80,enc_auto/${id}`;
}

/** Para ordenar por precio: solo los importes en dólares por la propiedad entera. */
export function precioOrdenable(p: Propiedad): number | null {
  const t = p.precio.toLowerCase();
  if (!/u\$d|usd/.test(t) || /hect|m²|m2|desde|por mes/.test(t)) return null;
  const n = Number(t.replace(/[^\d]/g, ''));
  return n > 0 ? n : null;
}

/** Los tipos con nombre propio en los filtros; el resto va a «Otros». */
export const TIPOS = ['Casa', 'Lote', 'Departamento', 'Campo'] as const;

export function tipoDeFiltro(p: Propiedad): string {
  return (TIPOS as readonly string[]).includes(p.tipo) ? p.tipo : 'Otros';
}

/** Las localidades, de la que más tiene a la que menos. */
export const LOCALIDADES = (() => {
  const cuenta = new Map<string, number>();
  for (const p of PROPIEDADES) cuenta.set(p.localidad, (cuenta.get(p.localidad) ?? 0) + 1);
  return [...cuenta.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([l]) => l);
})();

/** Las más recientes primero; a igual fecha, la de más prioridad. */
export function recientes(lista: Propiedad[]): Propiedad[] {
  return [...lista].sort((a, b) => b.alta.localeCompare(a.alta) || a.prioridad - b.prioridad);
}

export function enlaceWhatsapp(texto: string): string | null {
  if (!CONTACTO.whatsapp) return null;
  return `https://wa.me/${CONTACTO.whatsapp}?text=${encodeURIComponent(texto)}`;
}

/**
 * La selección que se muestra en el carrusel del inicio, en orden.
 * Se elige a mano: cambiar los códigos alcanza. Si un código ya no está
 * publicado, se saltea.
 */
export const SELECCION = ['P-0241', 'P-0216', 'P-0223', 'P-0229', 'P-0243', 'P-0227', 'P-0225', 'P-0240', 'P-0205'];

export function porCodigo(codigo: string): Propiedad | undefined {
  return PROPIEDADES.find((p) => p.codigo === codigo);
}

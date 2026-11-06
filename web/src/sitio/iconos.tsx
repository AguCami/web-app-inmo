/** Íconos de trazo, del mismo peso que los de la app. */
const base = {
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

export const IcoUbicacion = () => (
  <svg {...base}><path d="M12 21s-7-6.1-7-11.5A7 7 0 0 1 19 9.5C19 14.9 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></svg>
);
export const IcoCasa = () => (
  <svg {...base}><path d="M3 11 12 4l9 7" /><path d="M5 10v10h14V10" /><path d="M10 20v-6h4v6" /></svg>
);
export const IcoTerreno = () => (
  <svg {...base}><path d="M3 7l6-3 6 3 6-3v13l-6 3-6-3-6 3z" /><path d="M9 4v13M15 7v13" /></svg>
);
export const IcoSuperficie = () => (
  <svg {...base}><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M4 9h5V4M20 15h-5v5" /></svg>
);
export const IcoEscritura = () => (
  <svg {...base}><path d="M7 3h7l5 5v13H7z" /><path d="M14 3v5h5M10 13h6M10 17h6" /></svg>
);
export const IcoFlecha = ({ izq = false }: { izq?: boolean }) => (
  <svg {...base} style={izq ? { transform: 'scaleX(-1)' } : undefined}><path d="M5 12h14M13 6l6 6-6 6" /></svg>
);
export const IcoBuscar = () => (
  <svg {...base}><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></svg>
);
export const IcoWhatsapp = () => (
  <svg {...base}><path d="M4 20l1.3-3.9A8 8 0 1 1 8 19z" /><path d="M9 9.5c.3 2 2.5 4.2 4.5 4.5l1.2-1.2 2 1-.4 1.6c-3.6.6-8.4-4.2-7.8-7.8l1.6-.4 1 2z" /></svg>
);
export const IcoMail = () => (
  <svg {...base}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3.5 6.5 8.5 6 8.5-6" /></svg>
);
export const IcoCamara = () => (
  <svg {...base}><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>
);

/**
 * Íconos de línea, dibujados a mano con el mismo grosor y radio que el resto
 * de la interfaz. Se usan en vez de emojis para que el rail no parezca un menú
 * de chat y para que hereden el color del texto en los dos temas.
 */
import type { SVGProps } from 'react';

type Props = SVGProps<SVGSVGElement> & { tam?: number };

function Base({ tam = 18, children, ...resto }: Props) {
  return (
    <svg
      width={tam}
      height={tam}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...resto}
    >
      {children}
    </svg>
  );
}

export const IconoPanel = (p: Props) => (
  <Base {...p}>
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5" />
    <path d="M9.5 21v-6h5v6" />
  </Base>
);

export const IconoPropiedades = (p: Props) => (
  <Base {...p}>
    <rect x="3" y="7" width="8" height="14" rx="2" />
    <rect x="13" y="3" width="8" height="18" rx="2" />
    <path d="M6 11h2M6 15h2M16 7h2M16 11h2M16 15h2" />
  </Base>
);

export const IconoContratos = (p: Props) => (
  <Base {...p}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5" />
    <path d="M9 13h6M9 17h4" />
  </Base>
);

export const IconoCobranzas = (p: Props) => (
  <Base {...p}>
    <rect x="2" y="6" width="20" height="12" rx="3" />
    <circle cx="12" cy="12" r="2.6" />
    <path d="M6 12h.01M18 12h.01" />
  </Base>
);

export const IconoLiquidaciones = (p: Props) => (
  <Base {...p}>
    <path d="M4 13.5 20 4l-4.5 16-3.5-6z" />
    <path d="M12 14 20 4" />
  </Base>
);

export const IconoPersonas = (p: Props) => (
  <Base {...p}>
    <circle cx="9" cy="8" r="3.4" />
    <path d="M3 20c0-3.1 2.7-5.2 6-5.2s6 2.1 6 5.2" />
    <path d="M16.5 5.2a3.4 3.4 0 0 1 0 6.1M17.5 14.9c2 .7 3.5 2.5 3.5 5.1" />
  </Base>
);

export const IconoGastos = (p: Props) => (
  <Base {...p}>
    <path d="M14.5 5.5a3.6 3.6 0 0 1 4.9 4.6l-9 9-4.9 1 1-4.9z" />
    <path d="M13 7.5 17 11.5" />
  </Base>
);

export const IconoAjustes = (p: Props) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="3.2" />
    <path d="M12 2.5v2.4M12 19.1v2.4M4.2 4.2l1.7 1.7M18.1 18.1l1.7 1.7M2.5 12h2.4M19.1 12h2.4M4.2 19.8l1.7-1.7M18.1 5.9l1.7-1.7" />
  </Base>
);

export const IconoBuscar = (p: Props) => (
  <Base {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4.5 4.5" />
  </Base>
);

export const IconoMas = (p: Props) => (
  <Base {...p}>
    <path d="M12 5v14M5 12h14" />
  </Base>
);

export const IconoCerrar = (p: Props) => (
  <Base {...p}>
    <path d="m6 6 12 12M18 6 6 18" />
  </Base>
);

export const IconoCheck = (p: Props) => (
  <Base {...p}>
    <path d="m4.5 12.5 5 5 10-11" />
  </Base>
);

export const IconoAlerta = (p: Props) => (
  <Base {...p}>
    <path d="M12 3.5 22 20H2z" />
    <path d="M12 10v4M12 17.2v.01" />
  </Base>
);

export const IconoInfo = (p: Props) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5M12 8.2v.01" />
  </Base>
);

export const IconoFlechaDer = (p: Props) => (
  <Base {...p}>
    <path d="M5 12h13M12.5 5.5 19 12l-6.5 6.5" />
  </Base>
);

export const IconoVolver = (p: Props) => (
  <Base {...p}>
    <path d="M19 12H6M11.5 5.5 5 12l6.5 6.5" />
  </Base>
);

export const IconoTendencia = (p: Props) => (
  <Base {...p}>
    <path d="M3 16.5 9 10l4 4 7.5-8" />
    <path d="M15 6h5.5v5.5" />
  </Base>
);

export const IconoSol = (p: Props) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.5v2M12 19.5v2M4.2 4.2l1.5 1.5M18.3 18.3l1.5 1.5M2.5 12h2M19.5 12h2M4.2 19.8l1.5-1.5M18.3 5.7l1.5-1.5" />
  </Base>
);

export const IconoLuna = (p: Props) => (
  <Base {...p}>
    <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" />
  </Base>
);

export const IconoAuto = (p: Props) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 3.5v17" />
    <path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor" stroke="none" />
  </Base>
);

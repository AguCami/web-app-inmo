/**
 * Mantiene el servidor al día con lo que pasa en la app.
 *
 * La app trabaja en memoria sobre un `BaseDatos` entero y toda mutación pasa
 * por `mutar()`. Acá se guarda cuál fue el último estado que el servidor
 * confirmó; cada vez que algo cambia se calcula la diferencia contra ese
 * estado y se manda solo eso.
 *
 * Dos decisiones que importan:
 *
 * · Se espera un momento antes de mandar. Escribir un nombre en un
 *   formulario dispara una mutación por tecla; sin esto serían treinta
 *   pedidos para guardar una persona.
 * · El punto de referencia solo avanza cuando el servidor confirma. Si una
 *   escritura falla, el próximo intento reenvía todo lo que quedó pendiente
 *   en vez de dar por guardado algo que no se guardó.
 */
import type { BaseDatos } from '../domain/types';
import { aplicarCambios, calcularCambios, hayCambios } from './remoto';

export type EstadoSincronizacion = 'al_dia' | 'guardando' | 'error';

const ESPERA_MS = 700;

export class Sincronizador {
  private confirmada: BaseDatos;
  private pendiente: BaseDatos | null = null;
  private reloj: ReturnType<typeof setTimeout> | null = null;
  private enVuelo = false;

  constructor(
    private organizacionId: string,
    baseInicial: BaseDatos,
    private alCambiarEstado: (estado: EstadoSincronizacion, error?: string) => void,
  ) {
    this.confirmada = baseInicial;
  }

  /** Avisa que la base cambió. No espera: la escritura va en segundo plano. */
  encolar(db: BaseDatos): void {
    this.pendiente = db;
    this.alCambiarEstado('guardando');
    if (this.reloj) clearTimeout(this.reloj);
    this.reloj = setTimeout(() => void this.vaciarCola(), ESPERA_MS);
  }

  /** Fuerza el envío de lo pendiente, sin esperar. */
  async vaciarCola(): Promise<void> {
    if (this.reloj) {
      clearTimeout(this.reloj);
      this.reloj = null;
    }
    // Si ya hay una escritura en curso, esta tanda se va con la que sigue:
    // `pendiente` siempre tiene el estado más nuevo.
    if (this.enVuelo || !this.pendiente) return;

    const objetivo = this.pendiente;
    const cambios = calcularCambios(this.confirmada, objetivo);
    if (!hayCambios(cambios)) {
      this.pendiente = null;
      this.alCambiarEstado('al_dia');
      return;
    }

    this.enVuelo = true;
    try {
      await aplicarCambios(cambios, this.organizacionId);
      this.confirmada = objetivo;
      // Mientras se escribía pudo cambiar algo más.
      if (this.pendiente === objetivo) this.pendiente = null;
      this.alCambiarEstado(this.pendiente ? 'guardando' : 'al_dia');
    } catch (e) {
      this.alCambiarEstado('error', e instanceof Error ? e.message : String(e));
    } finally {
      this.enVuelo = false;
      if (this.pendiente) this.reloj = setTimeout(() => void this.vaciarCola(), ESPERA_MS);
    }
  }

  /** Vuelve a intentar desde el último estado confirmado. */
  reintentar(): void {
    if (this.pendiente) void this.vaciarCola();
  }

  hayPendientes(): boolean {
    return this.pendiente !== null;
  }
}

/**
 * Modelo de dominio — inmobiliaria argentina.
 *
 * Convenciones:
 *  - Todos los importes se guardan como number con 2 decimales en su moneda original.
 *  - Las fechas se guardan como ISO `YYYY-MM-DD` (sin hora, sin zona horaria) para
 *    evitar corrimientos de día al serializar.
 *  - Los períodos mensuales se guardan como `YYYY-MM`.
 */

export type ISODate = string; // YYYY-MM-DD
export type Periodo = string; // YYYY-MM
export type ID = string;

export type Moneda = 'ARS' | 'USD';

export interface Importe {
  monto: number;
  moneda: Moneda;
}

/* ───────────────────────────── Personas ───────────────────────────── */

export type RolPersona = 'propietario' | 'inquilino' | 'comprador' | 'garante' | 'agente' | 'proveedor';

export type CondicionIVA =
  | 'responsable_inscripto'
  | 'monotributo'
  | 'exento'
  | 'consumidor_final';

export interface Persona {
  id: ID;
  nombre: string;
  roles: RolPersona[];
  tipoDoc: 'DNI' | 'CUIT' | 'CUIL' | 'PAS';
  documento: string;
  email?: string;
  telefono?: string;
  domicilio?: string;
  localidad?: string;
  condicionIVA: CondicionIVA;
  cbu?: string;
  /** Solo para agentes: % por defecto de la comisión de venta que le corresponde. */
  comisionAgentePct?: number;
  notas?: string;
  activo: boolean;
}

/* ──────────────────────────── Propiedades ─────────────────────────── */

export type TipoPropiedad =
  | 'departamento'
  | 'casa'
  | 'ph'
  | 'local'
  | 'oficina'
  | 'galpon'
  | 'terreno'
  | 'cochera';

export type EstadoPropiedad =
  | 'disponible'
  | 'alquilada'
  | 'reservada'
  | 'vendida'
  | 'fuera_de_mercado';

export type DestinoPropiedad = 'alquiler' | 'venta' | 'ambos';

export interface Propiedad {
  id: ID;
  codigo: string;
  titulo: string;
  tipo: TipoPropiedad;
  propietarioId: ID;
  calle: string;
  numero: string;
  piso?: string;
  depto?: string;
  localidad: string;
  provincia: string;
  ambientes?: number;
  dormitorios?: number;
  banos?: number;
  m2Cubiertos?: number;
  m2Totales?: number;
  cochera: boolean;
  destino: DestinoPropiedad;
  estado: EstadoPropiedad;
  /** Precio de publicación (alquiler mensual o venta, según destino). */
  precioAlquiler?: Importe;
  precioVenta?: Importe;
  expensasEstimadas?: number; // ARS
  partidaInmobiliaria?: string;
  nomenclaturaCatastral?: string;
  notas?: string;
}

/* ───────────────────────── Contratos de alquiler ──────────────────── */

/** Índices de actualización habituales en contratos de locación en Argentina. */
export type IndiceAjuste = 'ICL' | 'IPC' | 'CASA_PROPIA' | 'PORCENTAJE_FIJO' | 'SIN_AJUSTE';

export type EstadoContrato = 'borrador' | 'activo' | 'finalizado' | 'rescindido';

export interface Contrato {
  id: ID;
  numero: string;
  propiedadId: ID;
  inquilinoId: ID;
  garanteIds: ID[];
  fechaInicio: ISODate;
  fechaFin: ISODate;
  /** Monto del primer período; los siguientes salen del cronograma de ajustes. */
  montoInicial: number;
  moneda: Moneda;
  /** Día del mes en que vence la cuota. */
  diaVencimiento: number;
  indiceAjuste: IndiceAjuste;
  /** Cada cuántos meses se actualiza el alquiler. */
  mesesAjuste: number;
  /** Solo si indiceAjuste === 'PORCENTAJE_FIJO'. */
  porcentajeFijo?: number;
  /** Honorarios de administración que cobra la inmobiliaria, sobre el alquiler cobrado. */
  comisionAdminPct: number;
  /** Interés punitorio diario por mora (en %). */
  punitorioDiarioPct: number;
  depositoGarantia: number;
  /** Conceptos fijos que se facturan junto al alquiler (expensas, ABL, etc.). */
  conceptosFijos: ConceptoFijo[];
  estado: EstadoContrato;
  fechaRescision?: ISODate;
  notas?: string;
}

export interface ConceptoFijo {
  id: ID;
  descripcion: string;
  monto: number;
  /** Si es true, el importe se le traslada al propietario en la liquidación. */
  aCuentaDelPropietario: boolean;
}

/** Un tramo del cronograma: desde `periodoDesde` (inclusive) rige `monto`. */
export interface TramoAjuste {
  periodoDesde: Periodo;
  periodoHasta: Periodo;
  monto: number;
  coeficiente: number;
  variacionPct: number;
}

/* ──────────────────────────── Cobranzas ───────────────────────────── */

export type EstadoCuota = 'pendiente' | 'parcial' | 'pagada' | 'vencida' | 'anulada';

export interface ItemCuota {
  descripcion: string;
  monto: number;
  tipo: 'alquiler' | 'expensas' | 'servicio' | 'punitorio' | 'otro';
}

export interface Cuota {
  id: ID;
  contratoId: ID;
  periodo: Periodo;
  vencimiento: ISODate;
  moneda: Moneda;
  items: ItemCuota[];
  /** Total facturado sin punitorios. */
  total: number;
  estado: EstadoCuota;
  /** Se completa al liquidar al propietario. */
  liquidacionId?: ID;
  notas?: string;
}

export type MedioPago = 'efectivo' | 'transferencia' | 'cheque' | 'debito_automatico' | 'mercadopago';

export interface Pago {
  id: ID;
  cuotaId?: ID;
  operacionId?: ID;
  gastoId?: ID;
  fecha: ISODate;
  monto: number;
  moneda: Moneda;
  /** Cotización usada si la moneda del pago difiere de la del comprobante. */
  cotizacion?: number;
  medio: MedioPago;
  cuentaId: ID;
  comprobante?: string;
  /** Punitorios incluidos en este pago (informativo). */
  punitorios?: number;
  notas?: string;
}

/* ────────────────── Liquidaciones a propietarios ──────────────────── */

export type EstadoLiquidacion = 'borrador' | 'aprobada' | 'pagada';

export interface ItemLiquidacion {
  descripcion: string;
  tipo: 'alquiler_cobrado' | 'comision_admin' | 'gasto' | 'retencion' | 'ajuste';
  monto: number; // positivo suma al propietario, negativo descuenta
  referenciaId?: ID;
  /**
   * Qué fracción de la cuota referenciada liquida este ítem (0 a 1). Es lo que
   * permite liquidar después el resto de una cuota que se cobró en partes: sin
   * esto, un cobro parcial dejaría el saldo sin rendir para siempre.
   */
  proporcion?: number;
}

export interface Liquidacion {
  id: ID;
  numero: string;
  propietarioId: ID;
  periodo: Periodo;
  fecha: ISODate;
  moneda: Moneda;
  items: ItemLiquidacion[];
  /** Total a pagar al propietario. */
  neto: number;
  /** Lo que gana la inmobiliaria en esta liquidación. */
  comisionTotal: number;
  estado: EstadoLiquidacion;
  fechaPago?: ISODate;
  cuentaId?: ID;
  notas?: string;
}

/* ─────────────────────── Operaciones de venta ─────────────────────── */

export type EstadoOperacion =
  | 'captacion'
  | 'reserva'
  | 'boleto'
  | 'escriturada'
  | 'caida';

export interface ParticipacionAgente {
  agenteId: ID;
  /** % de la comisión total de la inmobiliaria que se lleva el agente. */
  porcentaje: number;
}

export interface Operacion {
  id: ID;
  numero: string;
  propiedadId: ID;
  vendedorId: ID; // propietario
  compradorId?: ID;
  estado: EstadoOperacion;
  fechaCaptacion: ISODate;
  fechaReserva?: ISODate;
  fechaBoleto?: ISODate;
  fechaEscritura?: ISODate;
  precioPublicado: number;
  precioAcordado?: number;
  moneda: Moneda;
  senia?: number;
  /** Honorarios en % sobre el precio acordado. */
  honorariosVendedorPct: number;
  honorariosCompradorPct: number;
  agentes: ParticipacionAgente[];
  probabilidad?: number;
  motivoCaida?: string;
  notas?: string;
}

/* ───────────────────────────── Gastos ─────────────────────────────── */

export type CategoriaGasto =
  | 'mantenimiento'
  | 'expensas'
  | 'impuestos'
  | 'servicios'
  | 'sueldos'
  | 'marketing'
  | 'alquiler_oficina'
  | 'honorarios'
  | 'comisiones'
  | 'bancarios'
  | 'otros';

export type EstadoGasto = 'pendiente' | 'pagado';

export interface Gasto {
  id: ID;
  fecha: ISODate;
  descripcion: string;
  categoria: CategoriaGasto;
  proveedorId?: ID;
  /** Si el gasto corresponde a una propiedad administrada se le traslada al propietario. */
  propiedadId?: ID;
  reintegrablePorPropietario: boolean;
  neto: number;
  ivaPct: number;
  total: number;
  moneda: Moneda;
  estado: EstadoGasto;
  comprobante?: string;
  liquidacionId?: ID;
}

/* ─────────────────────────── Tesorería ────────────────────────────── */

export type TipoCuenta = 'caja' | 'banco' | 'billetera_virtual';

export interface CuentaFinanciera {
  id: ID;
  nombre: string;
  tipo: TipoCuenta;
  moneda: Moneda;
  saldoInicial: number;
  banco?: string;
  cbu?: string;
  activa: boolean;
}

export type TipoMovimiento = 'ingreso' | 'egreso' | 'transferencia';

export interface Movimiento {
  id: ID;
  fecha: ISODate;
  cuentaId: ID;
  tipo: TipoMovimiento;
  concepto: string;
  monto: number;
  moneda: Moneda;
  /** Vínculo al hecho económico que lo originó. */
  origen?: { tipo: 'pago' | 'liquidacion' | 'gasto' | 'operacion' | 'manual'; id: ID };
  cuentaDestinoId?: ID;
  conciliado: boolean;
}

/* ──────────────────────── Contabilidad ────────────────────────────── */

export type TipoCuentaContable = 'activo' | 'pasivo' | 'patrimonio' | 'ingreso' | 'egreso';

export interface CuentaContable {
  codigo: string;
  nombre: string;
  tipo: TipoCuentaContable;
  /** Cuenta de movimiento (imputable) o de agrupación. */
  imputable: boolean;
}

export interface LineaAsiento {
  cuenta: string; // código del plan de cuentas
  debe: number;
  haber: number;
  detalle?: string;
}

export interface Asiento {
  id: ID;
  numero: number;
  fecha: ISODate;
  descripcion: string;
  lineas: LineaAsiento[];
  /** Los asientos automáticos se regeneran; los manuales no se tocan. */
  automatico: boolean;
  origen?: { tipo: string; id: ID };
}

/* ─────────────────────── Índices y cotizaciones ───────────────────── */

export interface ValorIndice {
  periodo: Periodo;
  ICL: number;
  IPC: number;
  CASA_PROPIA: number;
  /** Cotización del dólar usada para valuar (venta BNA o MEP según configuración). */
  usd: number;
}

/* ──────────────────────────── Agenda ──────────────────────────────── */

export type TipoTarea = 'visita' | 'vencimiento' | 'cobranza' | 'firma' | 'mantenimiento' | 'otro';

export interface Tarea {
  id: ID;
  titulo: string;
  tipo: TipoTarea;
  fecha: ISODate;
  completada: boolean;
  responsableId?: ID;
  propiedadId?: ID;
  contratoId?: ID;
  operacionId?: ID;
  notas?: string;
}

/* ─────────────────────────── Configuración ────────────────────────── */

export interface Configuracion {
  razonSocial: string;
  nombreFantasia: string;
  cuit: string;
  condicionIVA: CondicionIVA;
  domicilio: string;
  telefono: string;
  email: string;
  matricula: string;
  /** % de honorarios de administración por defecto para contratos nuevos. */
  comisionAdminPctDefault: number;
  honorariosVentaPctDefault: number;
  punitorioDiarioPctDefault: number;
  ivaPctDefault: number;
  monedaBase: Moneda;
  /** Origen declarado de la cotización (informativo, se carga a mano). */
  fuenteCotizacion: string;
}

/* ───────────────────────── Estado completo ────────────────────────── */

export interface BaseDatos {
  version: number;
  configuracion: Configuracion;
  personas: Persona[];
  propiedades: Propiedad[];
  contratos: Contrato[];
  cuotas: Cuota[];
  pagos: Pago[];
  liquidaciones: Liquidacion[];
  operaciones: Operacion[];
  gastos: Gasto[];
  cuentas: CuentaFinanciera[];
  movimientos: Movimiento[];
  asientos: Asiento[];
  indices: ValorIndice[];
  tareas: Tarea[];
}

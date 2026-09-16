import type { CategoriaGasto, CuentaContable, CuentaFinanciera } from './types';

/**
 * Plan de cuentas mínimo para una inmobiliaria que administra alquileres y
 * opera ventas. La clave del esquema es que la plata de los inquilinos no es
 * ingreso de la inmobiliaria: entra como deuda con el propietario
 * (2.1.01) y solo se reconoce ingreso por los honorarios.
 */
export const PLAN_CUENTAS: CuentaContable[] = [
  { codigo: '1', nombre: 'Activo', tipo: 'activo', imputable: false },
  { codigo: '1.1', nombre: 'Caja y bancos', tipo: 'activo', imputable: false },
  { codigo: '1.1.01', nombre: 'Caja en pesos', tipo: 'activo', imputable: true },
  { codigo: '1.1.02', nombre: 'Banco cuenta corriente', tipo: 'activo', imputable: true },
  { codigo: '1.1.03', nombre: 'Banco cuenta en dólares', tipo: 'activo', imputable: true },
  { codigo: '1.1.04', nombre: 'Billeteras virtuales', tipo: 'activo', imputable: true },
  { codigo: '1.2', nombre: 'Créditos', tipo: 'activo', imputable: false },
  { codigo: '1.2.01', nombre: 'Inquilinos a cobrar', tipo: 'activo', imputable: true },
  { codigo: '1.2.02', nombre: 'Honorarios por venta a cobrar', tipo: 'activo', imputable: true },

  { codigo: '2', nombre: 'Pasivo', tipo: 'pasivo', imputable: false },
  { codigo: '2.1', nombre: 'Deudas', tipo: 'pasivo', imputable: false },
  { codigo: '2.1.01', nombre: 'Propietarios cuenta liquidación', tipo: 'pasivo', imputable: true },
  { codigo: '2.1.02', nombre: 'Proveedores', tipo: 'pasivo', imputable: true },
  { codigo: '2.1.03', nombre: 'IVA a pagar', tipo: 'pasivo', imputable: true },
  { codigo: '2.1.04', nombre: 'Depósitos en garantía recibidos', tipo: 'pasivo', imputable: true },

  { codigo: '3', nombre: 'Patrimonio neto', tipo: 'patrimonio', imputable: false },
  { codigo: '3.1.01', nombre: 'Capital', tipo: 'patrimonio', imputable: true },
  { codigo: '3.1.02', nombre: 'Resultados acumulados', tipo: 'patrimonio', imputable: true },

  { codigo: '4', nombre: 'Ingresos', tipo: 'ingreso', imputable: false },
  { codigo: '4.1.01', nombre: 'Honorarios por administración', tipo: 'ingreso', imputable: true },
  { codigo: '4.1.02', nombre: 'Honorarios por venta', tipo: 'ingreso', imputable: true },
  { codigo: '4.1.03', nombre: 'Punitorios e intereses', tipo: 'ingreso', imputable: true },
  { codigo: '4.1.04', nombre: 'Otros ingresos', tipo: 'ingreso', imputable: true },

  { codigo: '5', nombre: 'Egresos', tipo: 'egreso', imputable: false },
  { codigo: '5.1.01', nombre: 'Sueldos y cargas sociales', tipo: 'egreso', imputable: true },
  { codigo: '5.1.02', nombre: 'Alquiler de oficina', tipo: 'egreso', imputable: true },
  { codigo: '5.1.03', nombre: 'Marketing y publicidad', tipo: 'egreso', imputable: true },
  { codigo: '5.1.04', nombre: 'Servicios', tipo: 'egreso', imputable: true },
  { codigo: '5.1.05', nombre: 'Impuestos y tasas', tipo: 'egreso', imputable: true },
  { codigo: '5.1.06', nombre: 'Gastos bancarios', tipo: 'egreso', imputable: true },
  { codigo: '5.1.07', nombre: 'Mantenimiento de propiedades', tipo: 'egreso', imputable: true },
  { codigo: '5.1.08', nombre: 'Honorarios profesionales', tipo: 'egreso', imputable: true },
  { codigo: '5.1.09', nombre: 'Otros gastos', tipo: 'egreso', imputable: true },
  { codigo: '5.1.10', nombre: 'Comisiones a agentes', tipo: 'egreso', imputable: true },
];

export const CUENTA_POR_CODIGO = new Map(PLAN_CUENTAS.map((c) => [c.codigo, c]));

export function nombreCuenta(codigo: string): string {
  return CUENTA_POR_CODIGO.get(codigo)?.nombre ?? codigo;
}

export const CUENTA_POR_CATEGORIA_GASTO: Record<CategoriaGasto, string> = {
  sueldos: '5.1.01',
  alquiler_oficina: '5.1.02',
  marketing: '5.1.03',
  servicios: '5.1.04',
  impuestos: '5.1.05',
  bancarios: '5.1.06',
  mantenimiento: '5.1.07',
  honorarios: '5.1.08',
  comisiones: '5.1.10',
  expensas: '5.1.09',
  otros: '5.1.09',
};

/** Cuenta contable que representa a cada cuenta financiera de tesorería. */
export function cuentaContableDe(cuenta: CuentaFinanciera | undefined): string {
  if (!cuenta) return '1.1.01';
  if (cuenta.tipo === 'caja') return '1.1.01';
  if (cuenta.tipo === 'billetera_virtual') return '1.1.04';
  return cuenta.moneda === 'USD' ? '1.1.03' : '1.1.02';
}

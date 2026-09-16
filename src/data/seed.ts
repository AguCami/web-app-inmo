import type {
  BaseDatos,
  Contrato,
  CuentaFinanciera,
  Cuota,
  Gasto,
  Operacion,
  Pago,
  Persona,
  Propiedad,
  Tarea,
} from '../domain/types';
import { armarCuota, cobradoDeCuota } from '../domain/cobranzas';
import { armarLiquidacion } from '../domain/liquidaciones';
import { periodosDelContrato } from '../domain/contratos';
import {
  hoy,
  nuevoId,
  periodoActual,
  redondear,
  sumarMeses,
  sumarPeriodos,
} from '../domain/util';
import { construirIndices } from './indices';
import { crearAzar, generarCartera, generarVentasHistoricas } from './generador';

export const VERSION_BD = 1;

const personas: Persona[] = [
  {
    id: 'per_prop1', nombre: 'Marta Elena Suárez', roles: ['propietario'], tipoDoc: 'CUIT',
    documento: '27-14582369-4', email: 'marta.suarez@mail.com', telefono: '11 4455-7788',
    domicilio: 'Av. Santa Fe 2314, 6º B', localidad: 'CABA', condicionIVA: 'monotributo',
    cbu: '0720123488000012345678', activo: true,
  },
  {
    id: 'per_prop2', nombre: 'Jorge Daniel Ferreyra', roles: ['propietario'], tipoDoc: 'CUIT',
    documento: '20-18994512-7', email: 'jdferreyra@mail.com', telefono: '11 6677-2211',
    domicilio: 'Bulnes 1180', localidad: 'CABA', condicionIVA: 'responsable_inscripto',
    cbu: '0170099220000098765432', activo: true,
  },
  {
    id: 'per_prop3', nombre: 'Inversiones Del Plata S.A.', roles: ['propietario'], tipoDoc: 'CUIT',
    documento: '30-71255890-3', email: 'admin@delplata.com.ar', telefono: '11 5211-4400',
    domicilio: 'Reconquista 660, 3º', localidad: 'CABA', condicionIVA: 'responsable_inscripto',
    cbu: '0070055530004455667788', activo: true,
  },
  {
    id: 'per_prop4', nombre: 'Lucía Beatriz Roldán', roles: ['propietario'], tipoDoc: 'CUIL',
    documento: '27-30556711-2', email: 'lroldan@mail.com', telefono: '11 3344-9900',
    domicilio: 'Gorriti 4520', localidad: 'CABA', condicionIVA: 'consumidor_final',
    cbu: '0290011100000112233445', activo: true,
  },
  {
    id: 'per_inq1', nombre: 'Federico Ariel Gómez', roles: ['inquilino'], tipoDoc: 'DNI',
    documento: '35.884.221', email: 'fedegomez@mail.com', telefono: '11 6012-3344',
    localidad: 'CABA', condicionIVA: 'consumidor_final', activo: true,
  },
  {
    id: 'per_inq2', nombre: 'Carolina Paz Medina', roles: ['inquilino'], tipoDoc: 'DNI',
    documento: '38.110.567', email: 'caro.medina@mail.com', telefono: '11 5544-1122',
    localidad: 'CABA', condicionIVA: 'consumidor_final', activo: true,
  },
  {
    id: 'per_inq3', nombre: 'Estudio Vidal & Asociados', roles: ['inquilino'], tipoDoc: 'CUIT',
    documento: '30-70998877-1', email: 'contacto@vidalasoc.com.ar', telefono: '11 4322-8080',
    localidad: 'CABA', condicionIVA: 'responsable_inscripto', activo: true,
  },
  {
    id: 'per_inq4', nombre: 'Ramiro Esteban Costa', roles: ['inquilino'], tipoDoc: 'DNI',
    documento: '33.412.908', email: 'rcosta@mail.com', telefono: '11 3399-4455',
    localidad: 'CABA', condicionIVA: 'consumidor_final', activo: true,
  },
  {
    id: 'per_inq5', nombre: 'Valentina Ruiz Díaz', roles: ['inquilino'], tipoDoc: 'DNI',
    documento: '40.223.116', email: 'vruizdiaz@mail.com', telefono: '11 2277-6633',
    localidad: 'CABA', condicionIVA: 'consumidor_final', activo: true,
  },
  {
    id: 'per_inq6', nombre: 'Distribuidora Andina S.R.L.', roles: ['inquilino'], tipoDoc: 'CUIT',
    documento: '33-71044556-9', email: 'pagos@andinasrl.com.ar', telefono: '11 4555-1200',
    localidad: 'CABA', condicionIVA: 'responsable_inscripto', activo: true,
  },
  {
    id: 'per_comp1', nombre: 'Andrés Nicolás Peralta', roles: ['comprador'], tipoDoc: 'DNI',
    documento: '31.776.554', email: 'aperalta@mail.com', telefono: '11 6789-0011',
    localidad: 'CABA', condicionIVA: 'consumidor_final', activo: true,
  },
  {
    id: 'per_comp2', nombre: 'Sofía Mariana Alonso', roles: ['comprador'], tipoDoc: 'DNI',
    documento: '36.990.114', email: 'sofi.alonso@mail.com', telefono: '11 5001-7788',
    localidad: 'CABA', condicionIVA: 'consumidor_final', activo: true,
  },
  {
    id: 'per_ag1', nombre: 'Mariano Iglesias', roles: ['agente'], tipoDoc: 'CUIT',
    documento: '20-29887123-5', email: 'mariano@inmobiliaria.com', telefono: '11 6600-1122',
    localidad: 'CABA', condicionIVA: 'monotributo', comisionAgentePct: 30, activo: true,
  },
  {
    id: 'per_ag2', nombre: 'Paula Bianchi', roles: ['agente'], tipoDoc: 'CUIT',
    documento: '27-32115488-0', email: 'paula@inmobiliaria.com', telefono: '11 6600-1133',
    localidad: 'CABA', condicionIVA: 'monotributo', comisionAgentePct: 30, activo: true,
  },
  {
    id: 'per_prov1', nombre: 'Servicios Integrales Aurora', roles: ['proveedor'], tipoDoc: 'CUIT',
    documento: '30-71300221-8', email: 'aurora@servicios.com.ar', telefono: '11 4700-2200',
    localidad: 'CABA', condicionIVA: 'responsable_inscripto', activo: true,
  },
];

const propiedades: Propiedad[] = [
  {
    id: 'pro_01', codigo: 'PA-001', titulo: 'Depto 2 amb. con balcón — Palermo', tipo: 'departamento',
    propietarioId: 'per_prop1', calle: 'Honduras', numero: '4820', piso: '5', depto: 'B',
    localidad: 'Palermo, CABA', provincia: 'CABA', ambientes: 2, dormitorios: 1, banos: 1,
    m2Cubiertos: 48, m2Totales: 54, cochera: false, destino: 'alquiler', estado: 'alquilada',
    precioAlquiler: { monto: 620000, moneda: 'ARS' }, expensasEstimadas: 92000,
    partidaInmobiliaria: '1-233188-4',
  },
  {
    id: 'pro_02', codigo: 'PA-002', titulo: 'Depto 3 amb. al frente — Belgrano', tipo: 'departamento',
    propietarioId: 'per_prop2', calle: 'Vuelta de Obligado', numero: '2355', piso: '8', depto: 'A',
    localidad: 'Belgrano, CABA', provincia: 'CABA', ambientes: 3, dormitorios: 2, banos: 2,
    m2Cubiertos: 74, m2Totales: 80, cochera: true, destino: 'alquiler', estado: 'alquilada',
    precioAlquiler: { monto: 890000, moneda: 'ARS' }, expensasEstimadas: 145000,
    partidaInmobiliaria: '2-401992-7',
  },
  {
    id: 'pro_03', codigo: 'PA-003', titulo: 'Oficina 120 m² — Microcentro', tipo: 'oficina',
    propietarioId: 'per_prop3', calle: 'San Martín', numero: '640', piso: '4',
    localidad: 'Microcentro, CABA', provincia: 'CABA', m2Cubiertos: 120, m2Totales: 120,
    cochera: false, destino: 'alquiler', estado: 'alquilada',
    precioAlquiler: { monto: 1450000, moneda: 'ARS' }, expensasEstimadas: 260000,
    partidaInmobiliaria: '3-119004-2',
  },
  {
    id: 'pro_04', codigo: 'PA-004', titulo: 'PH reciclado 4 amb. — Villa Crespo', tipo: 'ph',
    propietarioId: 'per_prop4', calle: 'Aguirre', numero: '1188',
    localidad: 'Villa Crespo, CABA', provincia: 'CABA', ambientes: 4, dormitorios: 3, banos: 2,
    m2Cubiertos: 96, m2Totales: 130, cochera: false, destino: 'alquiler', estado: 'alquilada',
    precioAlquiler: { monto: 780000, moneda: 'ARS' },
    partidaInmobiliaria: '6-288771-0',
  },
  {
    id: 'pro_05', codigo: 'PA-005', titulo: 'Local comercial a la calle — Caballito', tipo: 'local',
    propietarioId: 'per_prop3', calle: 'Av. Rivadavia', numero: '5120',
    localidad: 'Caballito, CABA', provincia: 'CABA', m2Cubiertos: 85, m2Totales: 85,
    cochera: false, destino: 'alquiler', estado: 'alquilada',
    precioAlquiler: { monto: 1150000, moneda: 'ARS' }, expensasEstimadas: 70000,
    partidaInmobiliaria: '7-055412-9',
  },
  {
    id: 'pro_06', codigo: 'PA-006', titulo: 'Monoambiente a estrenar — Almagro', tipo: 'departamento',
    propietarioId: 'per_prop1', calle: 'Sánchez de Loria', numero: '890', piso: '2', depto: 'C',
    localidad: 'Almagro, CABA', provincia: 'CABA', ambientes: 1, dormitorios: 1, banos: 1,
    m2Cubiertos: 33, m2Totales: 35, cochera: false, destino: 'alquiler', estado: 'alquilada',
    precioAlquiler: { monto: 480000, moneda: 'ARS' }, expensasEstimadas: 68000,
  },
  {
    id: 'pro_07', codigo: 'VE-101', titulo: 'Casa 5 amb. con jardín — Olivos', tipo: 'casa',
    propietarioId: 'per_prop2', calle: 'Corrientes', numero: '345',
    localidad: 'Olivos, Vicente López', provincia: 'Buenos Aires', ambientes: 5, dormitorios: 3,
    banos: 3, m2Cubiertos: 185, m2Totales: 320, cochera: true, destino: 'venta', estado: 'reservada',
    precioVenta: { monto: 295000, moneda: 'USD' },
  },
  {
    id: 'pro_08', codigo: 'VE-102', titulo: 'Depto 4 amb. con vista — Núñez', tipo: 'departamento',
    propietarioId: 'per_prop4', calle: 'Ramallo', numero: '2280', piso: '11',
    localidad: 'Núñez, CABA', provincia: 'CABA', ambientes: 4, dormitorios: 3, banos: 2,
    m2Cubiertos: 110, m2Totales: 118, cochera: true, destino: 'venta', estado: 'vendida',
    precioVenta: { monto: 218000, moneda: 'USD' },
  },
  {
    id: 'pro_09', codigo: 'VE-103', titulo: 'Lote 600 m² en barrio cerrado — Pilar', tipo: 'terreno',
    propietarioId: 'per_prop3', calle: 'Ruta 8 km 52 — Barrio Los Álamos', numero: 'Lote 42',
    localidad: 'Pilar', provincia: 'Buenos Aires', m2Totales: 600, cochera: false,
    destino: 'venta', estado: 'disponible', precioVenta: { monto: 88000, moneda: 'USD' },
  },
  {
    id: 'pro_10', codigo: 'VE-104', titulo: 'Galpón industrial 450 m² — San Martín', tipo: 'galpon',
    propietarioId: 'per_prop3', calle: 'Pedro de Mendoza', numero: '3300',
    localidad: 'San Martín', provincia: 'Buenos Aires', m2Cubiertos: 450, m2Totales: 520,
    cochera: false, destino: 'ambos', estado: 'disponible',
    precioVenta: { monto: 320000, moneda: 'USD' }, precioAlquiler: { monto: 2100000, moneda: 'ARS' },
  },
  {
    id: 'pro_11', codigo: 'PA-007', titulo: 'Depto 2 amb. — Recoleta', tipo: 'departamento',
    propietarioId: 'per_prop1', calle: 'Junín', numero: '1455', piso: '3', depto: 'D',
    localidad: 'Recoleta, CABA', provincia: 'CABA', ambientes: 2, dormitorios: 1, banos: 1,
    m2Cubiertos: 52, m2Totales: 56, cochera: false, destino: 'alquiler', estado: 'disponible',
    precioAlquiler: { monto: 710000, moneda: 'ARS' }, expensasEstimadas: 118000,
  },
  {
    id: 'pro_12', codigo: 'PA-008', titulo: 'Cochera cubierta — Palermo', tipo: 'cochera',
    propietarioId: 'per_prop4', calle: 'Godoy Cruz', numero: '2700',
    localidad: 'Palermo, CABA', provincia: 'CABA', cochera: true, destino: 'alquiler',
    estado: 'disponible', precioAlquiler: { monto: 165000, moneda: 'ARS' },
  },
];

interface DefContrato {
  id: string;
  numero: string;
  propiedadId: string;
  inquilinoId: string;
  mesesAtras: number;
  duracion: number;
  montoInicial: number;
  indice: Contrato['indiceAjuste'];
  mesesAjuste: number;
  comision: number;
  dia: number;
  expensas?: number;
}

const DEF_CONTRATOS: DefContrato[] = [
  { id: 'con_01', numero: 'LOC-2025-018', propiedadId: 'pro_01', inquilinoId: 'per_inq1', mesesAtras: 14, duracion: 36, montoInicial: 395000, indice: 'ICL', mesesAjuste: 3, comision: 8, dia: 10, expensas: 92000 },
  { id: 'con_02', numero: 'LOC-2025-024', propiedadId: 'pro_02', inquilinoId: 'per_inq2', mesesAtras: 11, duracion: 24, montoInicial: 640000, indice: 'ICL', mesesAjuste: 4, comision: 8, dia: 5, expensas: 145000 },
  { id: 'con_03', numero: 'LOC-2024-091', propiedadId: 'pro_03', inquilinoId: 'per_inq3', mesesAtras: 20, duracion: 36, montoInicial: 880000, indice: 'IPC', mesesAjuste: 6, comision: 10, dia: 10, expensas: 260000 },
  { id: 'con_04', numero: 'LOC-2026-003', propiedadId: 'pro_04', inquilinoId: 'per_inq4', mesesAtras: 7, duracion: 24, montoInicial: 700000, indice: 'ICL', mesesAjuste: 3, comision: 8, dia: 1 },
  { id: 'con_05', numero: 'LOC-2025-047', propiedadId: 'pro_05', inquilinoId: 'per_inq6', mesesAtras: 9, duracion: 36, montoInicial: 950000, indice: 'PORCENTAJE_FIJO', mesesAjuste: 6, comision: 10, dia: 8, expensas: 70000 },
  { id: 'con_06', numero: 'LOC-2026-011', propiedadId: 'pro_06', inquilinoId: 'per_inq5', mesesAtras: 4, duracion: 24, montoInicial: 455000, indice: 'ICL', mesesAjuste: 3, comision: 8, dia: 10, expensas: 68000 },
];

function construirContratos(): Contrato[] {
  return DEF_CONTRATOS.map((d) => {
    const fechaInicio = sumarMeses(`${hoy().slice(0, 8)}01`, -d.mesesAtras);
    const fechaFin = sumarMeses(fechaInicio, d.duracion - 1);
    const conceptosFijos = d.expensas
      ? [{ id: nuevoId('cf'), descripcion: 'Expensas', monto: d.expensas, aCuentaDelPropietario: false }]
      : [];
    return {
      id: d.id,
      numero: d.numero,
      propiedadId: d.propiedadId,
      inquilinoId: d.inquilinoId,
      garanteIds: [],
      fechaInicio,
      fechaFin,
      montoInicial: d.montoInicial,
      moneda: 'ARS',
      diaVencimiento: d.dia,
      indiceAjuste: d.indice,
      mesesAjuste: d.mesesAjuste,
      porcentajeFijo: d.indice === 'PORCENTAJE_FIJO' ? 12 : undefined,
      comisionAdminPct: d.comision,
      punitorioDiarioPct: 0.15,
      depositoGarantia: d.montoInicial,
      conceptosFijos,
      estado: 'activo',
    } satisfies Contrato;
  });
}

const cuentas: CuentaFinanciera[] = [
  { id: 'cta_caja', nombre: 'Caja oficina', tipo: 'caja', moneda: 'ARS', saldoInicial: 850000, activa: true },
  { id: 'cta_bco', nombre: 'Banco Galicia — Cta. Cte.', tipo: 'banco', moneda: 'ARS', saldoInicial: 12400000, banco: 'Banco Galicia', cbu: '0070123420000011223344', activa: true },
  { id: 'cta_usd', nombre: 'Banco Galicia — Caja de ahorro USD', tipo: 'banco', moneda: 'USD', saldoInicial: 18500, banco: 'Banco Galicia', activa: true },
  { id: 'cta_mp', nombre: 'Mercado Pago', tipo: 'billetera_virtual', moneda: 'ARS', saldoInicial: 320000, activa: true },
];

function construirOperaciones(): Operacion[] {
  const base = hoy();
  return [
    {
      id: 'ope_01', numero: 'OP-2026-014', propiedadId: 'pro_08', vendedorId: 'per_prop4',
      compradorId: 'per_comp1', estado: 'escriturada', fechaCaptacion: sumarMeses(base, -7),
      fechaReserva: sumarMeses(base, -4), fechaBoleto: sumarMeses(base, -3),
      fechaEscritura: sumarMeses(base, -1), precioPublicado: 232000, precioAcordado: 218000,
      moneda: 'USD', senia: 21800, honorariosVendedorPct: 3, honorariosCompradorPct: 3,
      agentes: [{ agenteId: 'per_ag1', porcentaje: 60 }, { agenteId: 'per_ag2', porcentaje: 40 }],
    },
    {
      id: 'ope_02', numero: 'OP-2026-021', propiedadId: 'pro_07', vendedorId: 'per_prop2',
      compradorId: 'per_comp2', estado: 'boleto', fechaCaptacion: sumarMeses(base, -5),
      fechaReserva: sumarMeses(base, -2), fechaBoleto: sumarMeses(base, -1),
      precioPublicado: 310000, precioAcordado: 295000, moneda: 'USD', senia: 29500,
      honorariosVendedorPct: 3, honorariosCompradorPct: 3,
      agentes: [{ agenteId: 'per_ag2', porcentaje: 100 }],
    },
    {
      id: 'ope_03', numero: 'OP-2026-026', propiedadId: 'pro_10', vendedorId: 'per_prop3',
      estado: 'reserva', fechaCaptacion: sumarMeses(base, -3), fechaReserva: sumarMeses(base, -1),
      precioPublicado: 320000, precioAcordado: 305000, moneda: 'USD', senia: 15000,
      honorariosVendedorPct: 3, honorariosCompradorPct: 2,
      agentes: [{ agenteId: 'per_ag1', porcentaje: 100 }], probabilidad: 55,
    },
    {
      id: 'ope_04', numero: 'OP-2026-029', propiedadId: 'pro_09', vendedorId: 'per_prop3',
      estado: 'captacion', fechaCaptacion: sumarMeses(base, -2), precioPublicado: 88000,
      moneda: 'USD', honorariosVendedorPct: 4, honorariosCompradorPct: 4,
      agentes: [{ agenteId: 'per_ag2', porcentaje: 100 }], probabilidad: 25,
    },
    {
      id: 'ope_05', numero: 'OP-2026-009', propiedadId: 'pro_11', vendedorId: 'per_prop1',
      estado: 'caida', fechaCaptacion: sumarMeses(base, -9), fechaReserva: sumarMeses(base, -6),
      precioPublicado: 142000, moneda: 'USD', honorariosVendedorPct: 3, honorariosCompradorPct: 3,
      agentes: [{ agenteId: 'per_ag1', porcentaje: 100 }],
      motivoCaida: 'El comprador no consiguió el crédito hipotecario.',
    },
  ];
}

function construirGastos(): Gasto[] {
  const p = periodoActual();
  const gastos: Gasto[] = [];
  let n = 0;

  // Gastos recurrentes de la estructura, con importes que acompañan la inflación.
  const recurrentes: Array<[string, Gasto['categoria'], number, number]> = [
    ['Sueldos y cargas sociales', 'sueldos', 4_200_000, 5],
    ['Alquiler de la oficina comercial', 'alquiler_oficina', 1_350_000, 3],
    ['Publicaciones en portales inmobiliarios', 'marketing', 640_000, 8],
    ['Servicios (luz, internet, telefonía)', 'servicios', 310_000, 12],
    ['Ingresos Brutos y tasas', 'impuestos', 780_000, 15],
    ['Comisiones y mantenimiento de cuenta', 'bancarios', 96_000, 20],
  ];

  for (let atras = 13; atras >= 0; atras -= 1) {
    const periodo = sumarPeriodos(p, -atras);
    for (const [descripcion, categoria, montoHoy, dia] of recurrentes) {
      // Se deflacta hacia atrás: el mismo gasto costaba menos unos meses antes.
      const total = Math.round(montoHoy / 1.015 ** atras / 100) * 100;
      gastos.push({
        id: `gas_${String((n += 1)).padStart(3, '0')}`,
        fecha: `${periodo}-${String(dia).padStart(2, '0')}`,
        descripcion,
        categoria,
        reintegrablePorPropietario: false,
        neto: redondear(total / 1.21),
        ivaPct: 21,
        total,
        moneda: 'ARS',
        estado: atras === 0 ? 'pendiente' : 'pagado',
        liquidacionId: undefined,
      });
    }
  }

  // Gastos de mantenimiento que se le trasladan al propietario.
  const mantenimientos: Array<[number, string, string, number]> = [
    [0, 'Reparación de termotanque', 'pro_02', 285_000],
    [1, 'Impermeabilización de terraza', 'pro_04', 890_000],
    [3, 'Pintura integral de la unidad', 'pro_01', 640_000],
    [5, 'Cambio de cerradura y llaves', 'pro_06', 165_000],
    [7, 'Reparación de filtración en baño', 'pro_03', 420_000],
    [10, 'Service de aire acondicionado', 'pro_05', 230_000],
  ];

  for (const [atras, descripcion, propiedadId, total] of mantenimientos) {
    const periodo = sumarPeriodos(p, -atras);
    gastos.push({
      id: `gas_${String((n += 1)).padStart(3, '0')}`,
      fecha: `${periodo}-${String(10 + (n % 15)).padStart(2, '0')}`,
      descripcion,
      categoria: 'mantenimiento',
      proveedorId: 'per_prov1',
      propiedadId,
      reintegrablePorPropietario: true,
      neto: redondear(total / 1.21),
      ivaPct: 21,
      total,
      moneda: 'ARS',
      estado: atras === 0 ? 'pendiente' : 'pagado',
      liquidacionId: undefined,
    });
  }

  // Gastos propios imputados a una unidad: no se le cobran al propietario,
  // los absorbe la inmobiliaria. Son los que muestran si una unidad rinde.
  const propios: Array<[number, string, string, Gasto['categoria'], number]> = [
    [1, 'Sesión de fotos y video para la publicación', 'pro_gen_3', 'marketing', 180_000],
    [2, 'Cartelería en frente de la unidad', 'pro_gen_11', 'marketing', 95_000],
    [4, 'Aviso destacado en portal', 'pro_gen_18', 'marketing', 140_000],
    [6, 'Limpieza final previa a la entrega', 'pro_02', 'servicios', 210_000],
    [8, 'Sesión de fotos y video para la publicación', 'pro_gen_27', 'marketing', 165_000],
    [11, 'Cerrajería por entrega de llaves', 'pro_gen_34', 'servicios', 88_000],
  ];

  for (const [atras, descripcion, propiedadId, categoria, total] of propios) {
    const periodo = sumarPeriodos(p, -atras);
    gastos.push({
      id: `gas_${String((n += 1)).padStart(3, '0')}`,
      fecha: `${periodo}-${String(8 + (n % 18)).padStart(2, '0')}`,
      descripcion,
      categoria,
      propiedadId,
      reintegrablePorPropietario: false,
      neto: redondear(total / 1.21),
      ivaPct: 21,
      total,
      moneda: 'ARS',
      estado: 'pagado',
      liquidacionId: undefined,
    });
  }

  return gastos.sort((a, b) => a.fecha.localeCompare(b.fecha));
}

function construirTareas(): Tarea[] {
  const base = hoy();
  return [
    { id: 'tar_01', titulo: 'Visita PA-007 con interesado (Recoleta)', tipo: 'visita', fecha: base, completada: false, responsableId: 'per_ag2', propiedadId: 'pro_11' },
    { id: 'tar_02', titulo: 'Firma de boleto OP-2026-021 en escribanía', tipo: 'firma', fecha: sumarMeses(base, 0).slice(0, 8) + '28', completada: false, responsableId: 'per_ag2', operacionId: 'ope_02' },
    { id: 'tar_03', titulo: 'Notificar ajuste ICL a inquilino de PA-001', tipo: 'vencimiento', fecha: base, completada: false, contratoId: 'con_01' },
    { id: 'tar_04', titulo: 'Reclamo de deuda — contrato LOC-2024-091', tipo: 'cobranza', fecha: base, completada: false, contratoId: 'con_03' },
    { id: 'tar_05', titulo: 'Presupuesto de plomería para PA-004', tipo: 'mantenimiento', fecha: sumarMeses(base, 0).slice(0, 8) + '22', completada: false, propiedadId: 'pro_04' },
    { id: 'tar_06', titulo: 'Renovación contrato LOC-2024-091 (vence pronto)', tipo: 'vencimiento', fecha: sumarMeses(base, 1), completada: false, contratoId: 'con_03' },
  ];
}

/** Base de datos de demostración, coherente de punta a punta. */
export function crearBaseDemo(): BaseDatos {
  const indices = construirIndices();
  const azar = crearAzar(20260916);
  const pActual = periodoActual();

  // Cartera de tamaño realista: las seis unidades escritas a mano sirven para
  // mostrar casos particulares, pero una inmobiliaria que vive de administrar
  // necesita del orden de cuarenta contratos para que los números cierren.
  const propietarios = [...new Set(propiedades.map((p) => p.propietarioId))];
  const cartera = generarCartera(39, propietarios, 8, hoy());
  const ventas = generarVentasHistoricas(6, propiedades, ['per_ag1', 'per_ag2'], hoy());

  const todasLasPersonas = [...personas, ...cartera.personas, ...ventas.compradores];
  const todasLasPropiedades = [...propiedades, ...cartera.propiedades, ...ventas.propiedades];
  const contratos = [...construirContratos(), ...cartera.contratos];

  const cuotas: Cuota[] = [];
  const pagos: Pago[] = [];
  const MOROSOS = new Set(['con_03', 'con_gen_7', 'con_gen_22']);

  for (const c of contratos) {
    for (const periodo of periodosDelContrato(c)) {
      if (periodo > pActual) break;
      const cuota = armarCuota(c, periodo, indices);
      cuota.id = `cuo_${c.id}_${periodo}`;
      cuotas.push(cuota);

      const antiguedad = Number(pActual.slice(0, 4)) * 12 + Number(pActual.slice(5)) -
        (Number(periodo.slice(0, 4)) * 12 + Number(periodo.slice(5)));

      // Tres inquilinos arrastran mora crónica; el resto paga casi siempre en
      // término. Una cartera sana ronda el 3 % de incobrabilidad, no el 40 %.
      const moroso = MOROSOS.has(c.id);
      const probImpago = moroso
        ? antiguedad <= 4
          ? 0.8
          : 0.12
        : antiguedad === 0
          ? 0.22 // mitad de mes: todavía falta entrar parte de la cobranza
          : 0.02;
      if (azar() < probImpago) continue;

      const parcial = !moroso && antiguedad === 0 && azar() < 0.12;
      const monto = parcial ? redondear(cuota.total * 0.5) : cuota.total;
      const demora = Math.floor(azar() * 8) - 3;
      const fechaPago = sumarMeses(cuota.vencimiento, 0);
      const fecha = new Date(fechaPago);
      fecha.setDate(fecha.getDate() + demora);
      const fechaISO = fecha.toISOString().slice(0, 10);

      pagos.push({
        id: `pag_${cuota.id}`,
        cuotaId: cuota.id,
        fecha: fechaISO > hoy() ? hoy() : fechaISO,
        monto,
        moneda: cuota.moneda,
        medio: azar() < 0.7 ? 'transferencia' : 'efectivo',
        cuentaId: azar() < 0.75 ? 'cta_bco' : 'cta_caja',
        comprobante: `REC-${cuota.id.slice(-7)}`,
        punitorios: demora > 3 ? redondear((cuota.total * 0.15 * demora) / 100) : 0,
      });
    }
  }

  const gastos = construirGastos();
  const operaciones = construirOperaciones();
  const tareas = construirTareas();

  const db: BaseDatos = {
    version: VERSION_BD,
    configuracion: {
      razonSocial: 'Camino Propiedades S.R.L.',
      nombreFantasia: 'Camino Propiedades',
      cuit: '30-71588420-6',
      condicionIVA: 'responsable_inscripto',
      domicilio: 'Av. Córdoba 3450, CABA',
      telefono: '11 4862-5500',
      email: 'hola@caminopropiedades.com.ar',
      matricula: 'CUCICBA 7712',
      comisionAdminPctDefault: 8,
      honorariosVentaPctDefault: 3,
      punitorioDiarioPctDefault: 0.15,
      ivaPctDefault: 21,
      monedaBase: 'ARS',
      fuenteCotizacion: 'Dólar BNA vendedor (carga manual)',
    },
    personas: todasLasPersonas,
    propiedades: todasLasPropiedades,
    contratos,
    cuotas,
    pagos,
    liquidaciones: [],
    operaciones: [...operaciones, ...ventas.operaciones],
    gastos,
    cuentas,
    movimientos: [],
    asientos: [],
    indices,
    tareas,
  };

  // Historia de liquidaciones: los meses cerrados están pagados y el mes en
  // curso queda aprobado pero sin transferir, que es la foto típica a mitad de mes.
  let n = 1;
  for (let atras = 13; atras >= 0; atras -= 1) {
    const periodo = sumarPeriodos(pActual, -atras);
    for (const propietarioId of propietarios) {
      const liq = armarLiquidacion(propietarioId, periodo, db, `LIQ-${periodo.replace('-', '')}-${String(n).padStart(3, '0')}`);
      if (!liq || liq.neto <= 0) continue;
      liq.id = `liq_${periodo}_${propietarioId}`;
      liq.fecha = `${periodo}-15`;
      liq.cuentaId = 'cta_bco';
      if (atras === 0) {
        liq.estado = 'aprobada';
      } else {
        liq.estado = 'pagada';
        liq.fechaPago = `${periodo}-16`;
      }
      db.liquidaciones.push(liq);
      for (const item of liq.items) {
        if (item.tipo === 'alquiler_cobrado' && item.referenciaId) {
          const cuota = db.cuotas.find((c) => c.id === item.referenciaId);
          if (cuota) cuota.liquidacionId = liq.id;
        }
        if (item.tipo === 'gasto' && item.referenciaId) {
          const gasto = db.gastos.find((g) => g.id === item.referenciaId);
          if (gasto) gasto.liquidacionId = liq.id;
        }
      }
      n += 1;
    }
  }

  // Cada escrituración cobra sus honorarios y paga la comisión de los agentes.
  let nVenta = 0;
  for (const venta of db.operaciones) {
    if (venta.estado !== 'escriturada' || !venta.fechaEscritura) continue;
    nVenta += 1;
    const honorarios = redondear(
      ((venta.precioAcordado ?? venta.precioPublicado) *
        (venta.honorariosVendedorPct + venta.honorariosCompradorPct)) / 100,
    );

    db.pagos.push({
      id: `pag_venta_${nVenta}`,
      operacionId: venta.id,
      fecha: venta.fechaEscritura,
      monto: honorarios,
      moneda: 'USD',
      medio: 'transferencia',
      cuentaId: 'cta_usd',
      comprobante: `FC-A-0001-${String(400 + nVenta).padStart(8, '0')}`,
    });

    // La comisión del agente es el costo variable más grande de una venta.
    const cotizacion = db.indices.find((i) => i.periodo === venta.fechaEscritura!.slice(0, 7))?.usd ?? 1500;
    const comision = Math.round((honorarios * 0.3 * cotizacion) / 1000) * 1000;
    db.gastos.push({
      id: `gas_com_${nVenta}`,
      fecha: venta.fechaEscritura,
      descripcion: `Comisión de agentes · operación ${venta.numero}`,
      categoria: 'comisiones',
      reintegrablePorPropietario: false,
      neto: redondear(comision / 1.21),
      ivaPct: 21,
      total: comision,
      moneda: 'ARS',
      estado: 'pagado',
    });
  }

  // Pagos de los gastos ya cancelados.
  for (const g of db.gastos) {
    if (g.estado !== 'pagado') continue;
    db.pagos.push({
      id: `pag_${g.id}`,
      gastoId: g.id,
      fecha: g.fecha,
      monto: g.total,
      moneda: g.moneda,
      medio: 'transferencia',
      cuentaId: 'cta_bco',
    });
  }

  // Estado de las propiedades según lo que realmente pasó.
  for (const prop of db.propiedades) {
    const tieneContrato = db.contratos.some((c) => c.propiedadId === prop.id && c.estado === 'activo');
    if (tieneContrato) prop.estado = 'alquilada';
  }

  // Marca de sanidad: las cuotas del período en curso sin cobro quedan pendientes.
  for (const cuota of db.cuotas) {
    cuota.estado = cobradoDeCuota(cuota, db.pagos) >= cuota.total - 0.01 ? 'pagada' : 'pendiente';
  }

  return db;
}

export function baseVacia(): BaseDatos {
  const demo = crearBaseDemo();
  return {
    version: VERSION_BD,
    configuracion: demo.configuracion,
    personas: [],
    propiedades: [],
    contratos: [],
    cuotas: [],
    pagos: [],
    liquidaciones: [],
    operaciones: [],
    gastos: [],
    cuentas: cuentas.map((c) => ({ ...c, saldoInicial: 0 })),
    movimientos: [],
    asientos: [],
    indices: construirIndices(),
    tareas: [],
  };
}

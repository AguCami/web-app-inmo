import type {
  BaseDatos,
  Contrato,
  Cuota,
  Gasto,
  Pago,
  Persona,
  Propiedad,
} from '../domain/types';
import { armarCuota } from '../domain/cobranzas';
import { armarLiquidacion } from '../domain/liquidaciones';
import { periodosDelContrato } from '../domain/contratos';
import { hoy, nuevoId, periodoActual, redondear, sumarMeses, sumarPeriodos } from '../domain/util';
import { construirIndices } from './indices';

export const VERSION_BD = 2;

/** Generador determinístico: la demo se ve igual en cada carga. */
function crearAzar(semilla: number) {
  let s = semilla >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/* ───────────────────────────── Personas ───────────────────────────── */

const personas: Persona[] = [
  { id: 'pro_1', nombre: 'Marta Elena Suárez', roles: ['propietario'], tipoDoc: 'CUIT', documento: '27-14582369-4', email: 'marta.suarez@mail.com', telefono: '351 415-7788', domicilio: 'Av. Colón 1240, Córdoba', condicionIVA: 'monotributo', cbu: '0720123488000012345678', activo: true },
  { id: 'pro_2', nombre: 'Jorge Daniel Ferreyra', roles: ['propietario'], tipoDoc: 'CUIT', documento: '20-18994512-7', email: 'jdferreyra@mail.com', telefono: '351 677-2211', domicilio: 'Rondeau 180, Nueva Córdoba', condicionIVA: 'responsable_inscripto', cbu: '0170099220000098765432', activo: true },
  { id: 'pro_3', nombre: 'Inversiones Del Suquía S.A.', roles: ['propietario'], tipoDoc: 'CUIT', documento: '30-71255890-3', email: 'admin@delsuquia.com.ar', telefono: '351 521-4400', domicilio: 'Bv. San Juan 660', condicionIVA: 'responsable_inscripto', cbu: '0070055530004455667788', activo: true },
  { id: 'pro_4', nombre: 'Lucía Beatriz Roldán', roles: ['propietario'], tipoDoc: 'CUIL', documento: '27-30556711-2', email: 'lroldan@mail.com', telefono: '351 334-9900', domicilio: 'Tristán Malbrán 4120, Cerro', condicionIVA: 'consumidor_final', cbu: '0290011100000112233445', activo: true },

  { id: 'inq_1', nombre: 'Federico Ariel Gómez', roles: ['inquilino'], tipoDoc: 'DNI', documento: '35.884.221', email: 'fedegomez@mail.com', telefono: '351 601-3344', condicionIVA: 'consumidor_final', activo: true },
  { id: 'inq_2', nombre: 'Carolina Paz Medina', roles: ['inquilino'], tipoDoc: 'DNI', documento: '38.110.567', email: 'caro.medina@mail.com', telefono: '351 554-1122', condicionIVA: 'consumidor_final', activo: true },
  { id: 'inq_3', nombre: 'Estudio Vidal & Asociados', roles: ['inquilino'], tipoDoc: 'CUIT', documento: '30-70998877-1', email: 'contacto@vidalasoc.com.ar', telefono: '351 432-8080', condicionIVA: 'responsable_inscripto', activo: true },
  { id: 'inq_4', nombre: 'Ramiro Esteban Costa', roles: ['inquilino'], tipoDoc: 'DNI', documento: '33.412.908', email: 'rcosta@mail.com', telefono: '351 339-4455', condicionIVA: 'consumidor_final', activo: true },
  { id: 'inq_5', nombre: 'Valentina Ruiz Díaz', roles: ['inquilino'], tipoDoc: 'DNI', documento: '40.223.116', email: 'vruizdiaz@mail.com', telefono: '351 227-6633', condicionIVA: 'consumidor_final', activo: true },
  { id: 'inq_6', nombre: 'Distribuidora Andina S.R.L.', roles: ['inquilino'], tipoDoc: 'CUIT', documento: '33-71044556-9', email: 'pagos@andinasrl.com.ar', telefono: '351 455-1200', condicionIVA: 'responsable_inscripto', activo: true },
  { id: 'inq_7', nombre: 'Martín Ignacio Ledesma', roles: ['inquilino'], tipoDoc: 'DNI', documento: '37.559.014', email: 'mledesma@mail.com', telefono: '351 688-2299', condicionIVA: 'consumidor_final', activo: true },
  { id: 'inq_8', nombre: 'Sofía Antonella Bianchi', roles: ['inquilino'], tipoDoc: 'DNI', documento: '41.007.882', email: 'sbianchi@mail.com', telefono: '351 712-5511', condicionIVA: 'consumidor_final', activo: true },
  { id: 'inq_9', nombre: 'Panadería La Esquina', roles: ['inquilino'], tipoDoc: 'CUIT', documento: '30-71622445-8', email: 'laesquina@mail.com', telefono: '351 490-3300', condicionIVA: 'monotributo', activo: true },
  { id: 'inq_10', nombre: 'Julieta Mercedes Ávila', roles: ['inquilino'], tipoDoc: 'DNI', documento: '39.844.230', email: 'juliavila@mail.com', telefono: '351 265-7744', condicionIVA: 'consumidor_final', activo: true },
  { id: 'inq_11', nombre: 'Tomás Agustín Peralta', roles: ['inquilino'], tipoDoc: 'DNI', documento: '36.220.771', email: 'tperalta@mail.com', telefono: '351 501-8822', condicionIVA: 'consumidor_final', activo: true },
  { id: 'inq_12', nombre: 'Guadalupe Sosa', roles: ['inquilino'], tipoDoc: 'DNI', documento: '42.115.663', email: 'gsosa@mail.com', telefono: '351 377-1199', condicionIVA: 'consumidor_final', activo: true },
];

/* ──────────────────────────── Propiedades ─────────────────────────── */

const propiedades: Propiedad[] = [
  { id: 'p01', codigo: 'NC-01', tipo: 'departamento', propietarioId: 'pro_1', calle: 'Obispo Trejo', numero: '1240', piso: '5', depto: 'B', barrio: 'Nueva Córdoba', ambientes: 2, dormitorios: 1, banos: 1, m2: 48, cochera: false, estado: 'alquilada', expensas: 92000 },
  { id: 'p02', codigo: 'GP-02', tipo: 'departamento', propietarioId: 'pro_2', calle: 'Av. Rafael Núñez', numero: '4355', piso: '8', depto: 'A', barrio: 'Cerro de las Rosas', ambientes: 3, dormitorios: 2, banos: 2, m2: 74, cochera: true, estado: 'alquilada', expensas: 145000 },
  { id: 'p03', codigo: 'CT-03', tipo: 'oficina', propietarioId: 'pro_3', calle: 'San Jerónimo', numero: '640', piso: '4', barrio: 'Centro', m2: 120, cochera: false, estado: 'alquilada', expensas: 210000 },
  { id: 'p04', codigo: 'GE-04', tipo: 'ph', propietarioId: 'pro_4', calle: 'Tristán Malbrán', numero: '1188', barrio: 'General Paz', ambientes: 4, dormitorios: 3, banos: 2, m2: 96, cochera: false, estado: 'alquilada' },
  { id: 'p05', codigo: 'AL-05', tipo: 'local', propietarioId: 'pro_3', calle: 'Av. Colón', numero: '2120', barrio: 'Alberdi', m2: 85, cochera: false, estado: 'alquilada', expensas: 60000 },
  { id: 'p06', codigo: 'NC-06', tipo: 'departamento', propietarioId: 'pro_1', calle: 'Ituzaingó', numero: '890', piso: '2', depto: 'C', barrio: 'Nueva Córdoba', ambientes: 1, dormitorios: 1, banos: 1, m2: 33, cochera: false, estado: 'alquilada', expensas: 68000 },
  { id: 'p07', codigo: 'VB-07', tipo: 'casa', propietarioId: 'pro_2', calle: 'Lima', numero: '345', barrio: 'Villa Belgrano', ambientes: 5, dormitorios: 3, banos: 3, m2: 185, cochera: true, estado: 'alquilada' },
  { id: 'p08', codigo: 'CT-08', tipo: 'departamento', propietarioId: 'pro_4', calle: 'Caseros', numero: '280', piso: '11', barrio: 'Centro', ambientes: 4, dormitorios: 3, banos: 2, m2: 110, cochera: true, estado: 'alquilada', expensas: 128000 },
  { id: 'p09', codigo: 'JP-09', tipo: 'departamento', propietarioId: 'pro_3', calle: 'Chacabuco', numero: '1502', piso: '3', depto: 'D', barrio: 'Nueva Córdoba', ambientes: 2, dormitorios: 1, banos: 1, m2: 52, cochera: false, estado: 'alquilada', expensas: 104000 },
  { id: 'p10', codigo: 'SM-10', tipo: 'galpon', propietarioId: 'pro_3', calle: 'Av. Sabattini', numero: '3300', barrio: 'San Vicente', m2: 450, cochera: false, estado: 'alquilada' },
  { id: 'p11', codigo: 'CR-11', tipo: 'departamento', propietarioId: 'pro_1', calle: 'Av. Vélez Sarsfield', numero: '1455', piso: '6', depto: 'A', barrio: 'Nueva Córdoba', ambientes: 2, dormitorios: 1, banos: 1, m2: 55, cochera: false, estado: 'alquilada', expensas: 118000 },
  { id: 'p12', codigo: 'GP-12', tipo: 'departamento', propietarioId: 'pro_4', calle: '25 de Mayo', numero: '1020', piso: '1', depto: 'B', barrio: 'General Paz', ambientes: 3, dormitorios: 2, banos: 1, m2: 68, cochera: false, estado: 'alquilada', expensas: 96000 },

  // Vacantes: son las que hay que salir a alquilar.
  { id: 'p13', codigo: 'NC-13', tipo: 'departamento', propietarioId: 'pro_1', calle: 'Buenos Aires', numero: '1180', piso: '9', depto: 'C', barrio: 'Nueva Córdoba', ambientes: 2, dormitorios: 1, banos: 1, m2: 50, cochera: false, estado: 'disponible', alquilerSugerido: 680000, expensas: 112000, notas: 'Se entregó el 20 del mes pasado. Falta pintura en el dormitorio.' },
  { id: 'p14', codigo: 'CR-14', tipo: 'cochera', propietarioId: 'pro_4', calle: 'Bv. Chacabuco', numero: '760', barrio: 'Nueva Córdoba', cochera: true, estado: 'disponible', alquilerSugerido: 165000 },
];

/* ───────────────────────────── Contratos ──────────────────────────── */

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
  { id: 'c01', numero: 'LOC-2025-018', propiedadId: 'p01', inquilinoId: 'inq_1', mesesAtras: 14, duracion: 36, montoInicial: 395000, indice: 'IPC_CBA', mesesAjuste: 3, comision: 8, dia: 10, expensas: 92000 },
  { id: 'c02', numero: 'LOC-2025-024', propiedadId: 'p02', inquilinoId: 'inq_2', mesesAtras: 11, duracion: 24, montoInicial: 640000, indice: 'ICL', mesesAjuste: 4, comision: 8, dia: 5, expensas: 145000 },
  { id: 'c03', numero: 'LOC-2024-091', propiedadId: 'p03', inquilinoId: 'inq_3', mesesAtras: 20, duracion: 22, montoInicial: 780000, indice: 'IPC', mesesAjuste: 6, comision: 10, dia: 10, expensas: 210000 },
  { id: 'c04', numero: 'LOC-2026-003', propiedadId: 'p04', inquilinoId: 'inq_4', mesesAtras: 7, duracion: 24, montoInicial: 700000, indice: 'IPC_CBA', mesesAjuste: 3, comision: 8, dia: 1 },
  { id: 'c05', numero: 'LOC-2025-047', propiedadId: 'p05', inquilinoId: 'inq_9', mesesAtras: 9, duracion: 36, montoInicial: 830000, indice: 'PORCENTAJE_FIJO', mesesAjuste: 6, comision: 10, dia: 8, expensas: 60000 },
  { id: 'c06', numero: 'LOC-2026-011', propiedadId: 'p06', inquilinoId: 'inq_5', mesesAtras: 4, duracion: 24, montoInicial: 455000, indice: 'IPC_CBA', mesesAjuste: 3, comision: 8, dia: 10, expensas: 68000 },
  { id: 'c07', numero: 'LOC-2025-052', propiedadId: 'p07', inquilinoId: 'inq_6', mesesAtras: 16, duracion: 18, montoInicial: 890000, indice: 'ICL', mesesAjuste: 4, comision: 8, dia: 5 },
  { id: 'c08', numero: 'LOC-2025-061', propiedadId: 'p08', inquilinoId: 'inq_7', mesesAtras: 12, duracion: 36, montoInicial: 720000, indice: 'IPC_CBA', mesesAjuste: 3, comision: 8, dia: 10, expensas: 128000 },
  { id: 'c09', numero: 'LOC-2026-006', propiedadId: 'p09', inquilinoId: 'inq_8', mesesAtras: 6, duracion: 24, montoInicial: 520000, indice: 'IPC_CBA', mesesAjuste: 3, comision: 8, dia: 15, expensas: 104000 },
  { id: 'c10', numero: 'LOC-2024-077', propiedadId: 'p10', inquilinoId: 'inq_6', mesesAtras: 22, duracion: 36, montoInicial: 1150000, indice: 'IPC', mesesAjuste: 6, comision: 10, dia: 5 },
  { id: 'c11', numero: 'LOC-2026-014', propiedadId: 'p11', inquilinoId: 'inq_10', mesesAtras: 3, duracion: 24, montoInicial: 690000, indice: 'IPC_CBA', mesesAjuste: 3, comision: 8, dia: 10, expensas: 118000 },
  { id: 'c12', numero: 'LOC-2025-033', propiedadId: 'p12', inquilinoId: 'inq_11', mesesAtras: 10, duracion: 24, montoInicial: 580000, indice: 'ICL', mesesAjuste: 4, comision: 8, dia: 1, expensas: 96000 },
];

function construirContratos(): Contrato[] {
  return DEF_CONTRATOS.map((d) => {
    const fechaInicio = sumarMeses(`${hoy().slice(0, 8)}01`, -d.mesesAtras);
    return {
      id: d.id,
      numero: d.numero,
      propiedadId: d.propiedadId,
      inquilinoId: d.inquilinoId,
      garanteIds: [],
      fechaInicio,
      fechaFin: sumarMeses(fechaInicio, d.duracion - 1),
      montoInicial: d.montoInicial,
      moneda: 'ARS',
      diaVencimiento: d.dia,
      indiceAjuste: d.indice,
      mesesAjuste: d.mesesAjuste,
      porcentajeFijo: d.indice === 'PORCENTAJE_FIJO' ? 12 : undefined,
      comisionAdminPct: d.comision,
      punitorioDiarioPct: 0.15,
      depositoGarantia: d.montoInicial,
      conceptosFijos: d.expensas
        ? [{ id: nuevoId('cf'), descripcion: 'Expensas', monto: d.expensas, aCuentaDelPropietario: false }]
        : [],
      estado: 'activo',
    } satisfies Contrato;
  });
}

/* ─────────────────────────────── Gastos ───────────────────────────── */

function construirGastos(): Gasto[] {
  const p = periodoActual();
  const def: Array<[number, string, Gasto['categoria'], string, number, boolean]> = [
    [0, 'Reparación de termotanque', 'mantenimiento', 'p02', 285000, true],
    [0, 'Pintura del dormitorio', 'mantenimiento', 'p13', 190000, true],
    [1, 'Impermeabilización de terraza', 'mantenimiento', 'p04', 890000, true],
    [1, 'Desagote de cloaca', 'servicios', 'p07', 165000, true],
    [3, 'Pintura integral de la unidad', 'mantenimiento', 'p01', 640000, true],
    [4, 'Service de aire acondicionado', 'mantenimiento', 'p08', 230000, true],
    [6, 'Cambio de cerradura y llaves', 'mantenimiento', 'p06', 145000, true],
  ];

  return def.map(([atras, descripcion, categoria, propiedadId, monto, descuenta], i) => {
    const periodo = sumarPeriodos(p, -atras);
    return {
      id: `g${String(i + 1).padStart(2, '0')}`,
      fecha: `${periodo}-${String(6 + i * 2).padStart(2, '0')}`,
      descripcion,
      categoria,
      propiedadId,
      monto,
      moneda: 'ARS',
      seLeDescuentaAlPropietario: descuenta,
    } satisfies Gasto;
  });
}

/* ──────────────────────── Base de demostración ────────────────────── */

export function crearBaseDemo(): BaseDatos {
  const indices = construirIndices();
  const contratos = construirContratos();
  const azar = crearAzar(20260917);
  const pActual = periodoActual();

  const cuotas: Cuota[] = [];
  const pagos: Pago[] = [];

  // Dos inquilinos arrastran mora; el resto paga casi siempre en término.
  const MOROSOS = new Set(['c03', 'c09']);

  for (const c of contratos) {
    for (const periodo of periodosDelContrato(c)) {
      if (periodo > pActual) break;
      const cuota = armarCuota(c, periodo, indices);
      cuota.id = `cu_${c.id}_${periodo}`;
      cuotas.push(cuota);

      const antiguedad =
        Number(pActual.slice(0, 4)) * 12 +
        Number(pActual.slice(5)) -
        (Number(periodo.slice(0, 4)) * 12 + Number(periodo.slice(5)));

      // La mora se concentra en los últimos meses: una cuota de hace dos años
      // sin cobrar no es morosidad, es un juicio. Los morosos dejaron de pagar
      // hace poco; el resto puede tener alguna cuota suelta del mes anterior.
      const moroso = MOROSOS.has(c.id);
      const probImpago = moroso
        ? antiguedad <= 4
          ? 0.85
          : 0
        : antiguedad === 0
          ? 0.28 // mitad de mes: todavía falta entrar parte de la cobranza
          : antiguedad === 1
            ? 0.05
            : 0;
      if (azar() < probImpago) continue;

      const parcial = !moroso && antiguedad === 0 && azar() < 0.15;
      const monto = parcial ? redondear(cuota.total * 0.5) : cuota.total;
      const demora = Math.floor(azar() * 8) - 3;
      const fecha = new Date(cuota.vencimiento);
      fecha.setDate(fecha.getDate() + demora);
      const fechaISO = fecha.toISOString().slice(0, 10);

      pagos.push({
        id: `pa_${cuota.id}`,
        cuotaId: cuota.id,
        fecha: fechaISO > hoy() ? hoy() : fechaISO,
        monto,
        moneda: cuota.moneda,
        medio: azar() < 0.75 ? 'transferencia' : 'efectivo',
        comprobante: `REC-${cuota.id.slice(-6)}`,
        punitorios: demora > 3 ? redondear((cuota.total * 0.15 * demora) / 100) : 0,
      });
    }
  }

  const db: BaseDatos = {
    version: VERSION_BD,
    configuracion: {
      nombre: 'Camino Propiedades',
      cuit: '30-71588420-6',
      telefono: '351 486-5500',
      email: 'hola@caminopropiedades.com.ar',
      comisionAdminPctDefault: 8,
      punitorioDiarioPctDefault: 0.15,
      diasAvisoVencimiento: 5,
    },
    personas,
    propiedades,
    contratos,
    cuotas,
    pagos,
    liquidaciones: [],
    gastos: construirGastos(),
    indices,
  };

  // Los meses cerrados están liquidados y pagados; el mes en curso, aprobado
  // pero sin transferir, que es la foto típica a mitad de mes.
  let n = 1;
  const propietarios = [...new Set(propiedades.map((p) => p.propietarioId))];
  for (let atras = 11; atras >= 0; atras -= 1) {
    const periodo = sumarPeriodos(pActual, -atras);
    for (const propietarioId of propietarios) {
      const liq = armarLiquidacion(
        propietarioId,
        periodo,
        db,
        `LIQ-${periodo.replace('-', '')}-${String(n).padStart(3, '0')}`,
      );
      if (!liq || liq.neto <= 0) continue;
      liq.id = `li_${periodo}_${propietarioId}`;
      liq.fecha = `${periodo}-15`;
      if (atras === 0) {
        liq.estado = 'aprobada';
      } else {
        liq.estado = 'pagada';
        liq.fechaPago = `${periodo}-16`;
      }
      db.liquidaciones.push(liq);

      for (const item of liq.items) {
        if (!item.referenciaId) continue;
        if (item.tipo === 'alquiler_cobrado') {
          const cuota = db.cuotas.find((c) => c.id === item.referenciaId);
          if (cuota && !cuota.liquidacionId) cuota.liquidacionId = liq.id;
        }
        if (item.tipo === 'gasto') {
          const gasto = db.gastos.find((g) => g.id === item.referenciaId);
          if (gasto) gasto.liquidacionId = liq.id;
        }
      }
      n += 1;
    }
  }

  return db;
}

export function baseVacia(): BaseDatos {
  return {
    version: VERSION_BD,
    configuracion: crearBaseDemo().configuracion,
    personas: [],
    propiedades: [],
    contratos: [],
    cuotas: [],
    pagos: [],
    liquidaciones: [],
    gastos: [],
    indices: construirIndices(),
  };
}

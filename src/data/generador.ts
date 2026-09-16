import type { Contrato, Operacion, Persona, Propiedad, TipoPropiedad } from '../domain/types';
import { redondear, sumarMeses } from '../domain/util';

/**
 * Generador determinístico de cartera.
 *
 * La demo necesita una inmobiliaria de tamaño creíble: con seis unidades en
 * administración los honorarios no pagan ni un sueldo, y el tablero miente. Acá
 * se completan las unidades, los inquilinos y las operaciones históricas que
 * faltan, siempre con la misma semilla para que la demo no cambie entre cargas.
 */
export function crearAzar(semilla: number) {
  let s = semilla >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const NOMBRES = [
  'Martín', 'Sofía', 'Lucas', 'Camila', 'Nicolás', 'Julieta', 'Matías', 'Agustina',
  'Santiago', 'Florencia', 'Joaquín', 'Milagros', 'Tomás', 'Rocío', 'Ignacio', 'Delfina',
  'Emiliano', 'Bianca', 'Gonzalo', 'Micaela', 'Franco', 'Abril', 'Leandro', 'Guadalupe',
  'Ezequiel', 'Antonella', 'Bruno', 'Malena', 'Facundo', 'Renata',
];

const APELLIDOS = [
  'Álvarez', 'Benítez', 'Cabrera', 'Domínguez', 'Escobar', 'Figueroa', 'Godoy', 'Herrera',
  'Ibarra', 'Juárez', 'Ledesma', 'Maldonado', 'Núñez', 'Ojeda', 'Paredes', 'Quiroga',
  'Ramírez', 'Sosa', 'Toledo', 'Urbano', 'Vera', 'Zalazar', 'Acosta', 'Barrios',
  'Coronel', 'Duarte', 'Espíndola', 'Franco', 'Gauna', 'Heredia',
];

const CALLES = [
  'Thames', 'Gurruchaga', 'Malabia', 'Costa Rica', 'El Salvador', 'Nicaragua', 'Güemes',
  'Salguero', 'Bulnes', 'Medrano', 'Yerbal', 'Doblas', 'Felipe Vallese', 'Rojas',
  'Campichuelo', 'Hidalgo', 'Ambrosetti', 'Terrada', 'Cuenca', 'Argerich', 'Nazca',
  'Arregui', 'Concordia', 'Bahía Blanca', 'Álvarez Jonte', 'Chivilcoy', 'Lascano',
  'Camarones', 'Helguera', 'Galicia',
];

const BARRIOS = [
  'Palermo, CABA', 'Villa Crespo, CABA', 'Caballito, CABA', 'Almagro, CABA',
  'Flores, CABA', 'Villa del Parque, CABA', 'Devoto, CABA', 'Colegiales, CABA',
  'Boedo, CABA', 'Saavedra, CABA',
];

const TIPOS: TipoPropiedad[] = ['departamento', 'departamento', 'departamento', 'ph', 'casa', 'local', 'oficina'];

const TITULO_POR_TIPO: Record<TipoPropiedad, (amb: number) => string> = {
  departamento: (a) => `Depto ${a} amb.`,
  casa: (a) => `Casa ${a} amb.`,
  ph: (a) => `PH ${a} amb.`,
  local: () => 'Local comercial',
  oficina: () => 'Oficina',
  galpon: () => 'Galpón',
  terreno: () => 'Lote',
  cochera: () => 'Cochera',
};

export interface CarteraGenerada {
  personas: Persona[];
  propiedades: Propiedad[];
  contratos: Contrato[];
}

/** Completa la cartera de alquileres hasta `cantidad` unidades administradas. */
export function generarCartera(
  cantidad: number,
  propietariosExistentes: string[],
  comisionDefault: number,
  hoyISO: string,
): CarteraGenerada {
  const azar = crearAzar(90210);
  const personas: Persona[] = [];
  const propiedades: Propiedad[] = [];
  const contratos: Contrato[] = [];

  const elegir = <T,>(xs: T[]) => xs[Math.floor(azar() * xs.length)];
  const usados = new Set<string>();

  /** Evita que dos inquilinos distintos terminen llamándose igual. */
  const nombreUnico = (): string => {
    for (let intento = 0; intento < 200; intento += 1) {
      const candidato = `${elegir(NOMBRES)} ${elegir(APELLIDOS)}`;
      if (!usados.has(candidato)) {
        usados.add(candidato);
        return candidato;
      }
    }
    return `${elegir(NOMBRES)} ${elegir(APELLIDOS)} ${usados.size}`;
  };

  for (let i = 0; i < cantidad; i += 1) {
    const idx = i + 1;
    const nombre = nombreUnico();
    const inquilinoId = `per_gen_inq_${idx}`;
    personas.push({
      id: inquilinoId,
      nombre,
      roles: ['inquilino'],
      tipoDoc: 'DNI',
      documento: `${28 + Math.floor(azar() * 16)}.${String(Math.floor(azar() * 900) + 100)}.${String(Math.floor(azar() * 900) + 100)}`,
      email: `${nombre.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ /g, '.')}@mail.com`,
      telefono: `11 ${Math.floor(azar() * 9000) + 1000}-${Math.floor(azar() * 9000) + 1000}`,
      localidad: 'CABA',
      condicionIVA: 'consumidor_final',
      activo: true,
    });

    const tipo = elegir(TIPOS);
    const ambientes = tipo === 'local' || tipo === 'oficina' ? 1 : 1 + Math.floor(azar() * 4);
    const m2 = tipo === 'local' || tipo === 'oficina' ? 40 + Math.floor(azar() * 90) : 30 + ambientes * 18;
    const propiedadId = `pro_gen_${idx}`;
    const barrio = elegir(BARRIOS);
    const expensas = tipo === 'casa' || tipo === 'ph' ? 0 : Math.round((40000 + m2 * 1400) / 1000) * 1000;

    // Alquiler de referencia a valores de hoy; el contrato arranca más atrás.
    const alquilerHoy = Math.round((280000 + m2 * 9500 + azar() * 180000) / 5000) * 5000;

    propiedades.push({
      id: propiedadId,
      codigo: `PA-${String(100 + idx)}`,
      titulo: `${TITULO_POR_TIPO[tipo](ambientes)} — ${barrio.split(',')[0]}`,
      tipo,
      propietarioId: elegir(propietariosExistentes),
      calle: elegir(CALLES),
      numero: String(200 + Math.floor(azar() * 4300)),
      piso: tipo === 'departamento' ? String(1 + Math.floor(azar() * 12)) : undefined,
      depto: tipo === 'departamento' ? elegir(['A', 'B', 'C', 'D']) : undefined,
      localidad: barrio,
      provincia: 'CABA',
      ambientes,
      dormitorios: Math.max(1, ambientes - 1),
      banos: ambientes > 3 ? 2 : 1,
      m2Cubiertos: m2,
      m2Totales: m2 + Math.floor(azar() * 12),
      cochera: azar() < 0.2,
      destino: 'alquiler',
      estado: 'alquilada',
      precioAlquiler: { monto: alquilerHoy, moneda: 'ARS' },
      expensasEstimadas: expensas || undefined,
    });

    // Antigüedad repartida: contratos nuevos, de media vida y por vencer.
    const mesesAtras = 1 + Math.floor(azar() * 30);
    // La duración se estira para que el contrato siga vigente: los vencimientos
    // próximos los aportan los contratos escritos a mano.
    const duracion = Math.max(24, mesesAtras + 3 + Math.floor(azar() * 22));
    const fechaInicio = sumarMeses(`${hoyISO.slice(0, 8)}01`, -mesesAtras);
    // El alquiler inicial se deflacta para que el vigente se parezca al de referencia.
    const montoInicial = Math.round((alquilerHoy / 1.022 ** mesesAtras) / 1000) * 1000;
    const indice = azar() < 0.72 ? 'ICL' : azar() < 0.6 ? 'IPC' : 'CASA_PROPIA';

    contratos.push({
      id: `con_gen_${idx}`,
      numero: `LOC-${fechaInicio.slice(0, 4)}-${String(100 + idx)}`,
      propiedadId,
      inquilinoId,
      garanteIds: [],
      fechaInicio,
      fechaFin: sumarMeses(fechaInicio, duracion - 1),
      montoInicial,
      moneda: 'ARS',
      diaVencimiento: elegir([1, 5, 10, 10, 15]),
      indiceAjuste: indice,
      mesesAjuste: elegir([3, 3, 4, 6]),
      comisionAdminPct: comisionDefault,
      punitorioDiarioPct: 0.15,
      depositoGarantia: montoInicial,
      conceptosFijos: expensas
        ? [{ id: `cf_gen_${idx}`, descripcion: 'Expensas', monto: expensas, aCuentaDelPropietario: false }]
        : [],
      estado: 'activo',
    });
  }

  return { personas, propiedades, contratos };
}

/** Operaciones de venta ya escrituradas, repartidas en los últimos meses. */
export function generarVentasHistoricas(
  cantidad: number,
  propiedades: Propiedad[],
  agentes: string[],
  hoyISO: string,
): { operaciones: Operacion[]; propiedades: Propiedad[]; compradores: Persona[] } {
  const azar = crearAzar(4242);
  const operaciones: Operacion[] = [];
  const nuevas: Propiedad[] = [];
  const compradores: Persona[] = [];
  const elegir = <T,>(xs: T[]) => xs[Math.floor(azar() * xs.length)];

  const propietarios = [...new Set(propiedades.map((p) => p.propietarioId))];

  for (let i = 0; i < cantidad; i += 1) {
    const idx = i + 1;
    const mesesAtras = 1 + Math.floor((i / cantidad) * 13);
    const fechaEscritura = sumarMeses(hoyISO, -mesesAtras);
    const precio = Math.round((75000 + azar() * 240000) / 500) * 500;
    const tipo = elegir(TIPOS);
    const barrio = elegir(BARRIOS);
    const propiedadId = `pro_ven_${idx}`;
    const compradorId = `per_ven_comp_${idx}`;

    compradores.push({
      id: compradorId,
      nombre: `${elegir(NOMBRES)} ${elegir(APELLIDOS)}`,
      roles: ['comprador'],
      tipoDoc: 'DNI',
      documento: `${28 + Math.floor(azar() * 16)}.${String(Math.floor(azar() * 900) + 100)}.${String(Math.floor(azar() * 900) + 100)}`,
      localidad: 'CABA',
      condicionIVA: 'consumidor_final',
      activo: true,
    });

    nuevas.push({
      id: propiedadId,
      codigo: `VE-${String(200 + idx)}`,
      titulo: `${TITULO_POR_TIPO[tipo](3)} — ${barrio.split(',')[0]}`,
      tipo,
      propietarioId: elegir(propietarios),
      calle: elegir(CALLES),
      numero: String(200 + Math.floor(azar() * 4300)),
      localidad: barrio,
      provincia: 'CABA',
      cochera: azar() < 0.4,
      destino: 'venta',
      estado: 'vendida',
      precioVenta: { monto: precio, moneda: 'USD' },
    });

    const agentePrincipal = elegir(agentes);
    const compartida = azar() < 0.35;

    operaciones.push({
      id: `ope_gen_${idx}`,
      numero: `OP-${fechaEscritura.slice(0, 4)}-${String(100 + idx)}`,
      propiedadId,
      vendedorId: nuevas[nuevas.length - 1].propietarioId,
      compradorId,
      estado: 'escriturada',
      fechaCaptacion: sumarMeses(fechaEscritura, -(3 + Math.floor(azar() * 5))),
      fechaReserva: sumarMeses(fechaEscritura, -2),
      fechaBoleto: sumarMeses(fechaEscritura, -1),
      fechaEscritura,
      precioPublicado: redondear(precio * 1.06),
      precioAcordado: precio,
      moneda: 'USD',
      senia: redondear(precio * 0.1),
      honorariosVendedorPct: 3,
      honorariosCompradorPct: azar() < 0.7 ? 3 : 2,
      agentes: compartida
        ? [
            { agenteId: agentePrincipal, porcentaje: 60 },
            { agenteId: agentes.find((a) => a !== agentePrincipal) ?? agentePrincipal, porcentaje: 40 },
          ]
        : [{ agenteId: agentePrincipal, porcentaje: 100 }],
    });
  }

  return { operaciones, propiedades: nuevas, compradores };
}

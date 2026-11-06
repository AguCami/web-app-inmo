/**
 * Pruebas de las reglas puras del dominio: el importe en letras, el nombre
 * de los archivos y la renovación de contratos. No necesitan navegador ni
 * servidor, así que corren en un segundo.
 *
 *   npm run dominio
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const carpeta = mkdtempSync(join(tmpdir(), 'docs-'));
const empaquetar = (entrada, nombre) => {
  const salida = join(carpeta, nombre);
  execFileSync('npx', [
    'esbuild', entrada, '--bundle', '--format=esm', '--platform=node',
    `--outfile=${salida}`, '--log-level=error',
  ]);
  return import(salida);
};

const { montoEnLetras, numeroALetras } = await empaquetar('src/domain/letras.ts', 'letras.mjs');
const { nombreDeArchivo } = await empaquetar('src/domain/documento.ts', 'documento.mjs');
const { nombreArchivoRecibo } = await empaquetar('src/domain/recibo.ts', 'recibo.mjs');
const { nombreArchivoLiquidacion } = await empaquetar('src/domain/liquidacion-pdf.ts', 'liq.mjs');
const { contratoRenovado, mesesDeContrato, periodosDelContrato, siguienteNumeroContrato } =
  await empaquetar('src/domain/contratos.ts', 'contratos.mjs');
const { saludDeLosDatos, DIAS_TOLERADOS } = await empaquetar('src/domain/salud.ts', 'salud.mjs');
const ipc = await empaquetar('src/domain/ipcCordoba.ts', 'ipc.mjs');
const nac = await empaquetar('src/domain/indicesNacionales.ts', 'nacionales.mjs');
const { valorIndice, cronogramaAjustes } = await empaquetar('src/domain/contratos.ts', 'contratos-indice.mjs');
const cobranzas = await empaquetar('src/domain/cobranzas.ts', 'cobranzas.mjs');

let fallos = 0;
const ok = (n, c, d = '') => { if (!c) fallos += 1; console.log(`${c ? '✓' : '✗'} ${n}${d ? ` — ${d}` : ''}`); };
const ASCII = /^[\x20-\x7E]+$/;

/* ── El importe en letras ── */
ok('cien se dice cien, no ciento', numeroALetras(100) === 'cien');
ok('el uno se apocopa delante de mil', numeroALetras(21000) === 'veintiún mil');
ok('mil no lleva un adelante', numeroALetras(1000) === 'mil');
ok('un millón va en singular', numeroALetras(1_000_000) === 'un millón');
ok('los millones en plural', numeroALetras(2_000_000) === 'dos millones');
ok(
  'los centavos se redondean sin desbordar',
  montoEnLetras(0.999) === 'peso uno con 00/100',
  montoEnLetras(0.999),
);
ok(
  'un importe real se escribe entero',
  montoEnLetras(737431.96) ===
    'pesos setecientos treinta y siete mil cuatrocientos treinta y uno con 96/100',
);
ok('los dólares se nombran dólares', montoEnLetras(2, 'USD') === 'dólares dos con 00/100');

/* ── El nombre del archivo ──
   Chrome descarta el atributo `download` entero si tiene un solo carácter
   fuera de ASCII: el archivo se baja como «download», sin nombre ni
   extensión. Es lo que pasaba con cualquier inquilino con tilde.            */
ok('el ayudante saca los acentos', nombreDeArchivo('Marta Suárez') === 'Marta Suarez');
ok('y la eñe', nombreDeArchivo('Niño') === 'Nino');
ok('y lo que Windows no acepta', nombreDeArchivo('a/b:c*d?e"f<g>h|i') === 'abcdefghi');

const conTilde = nombreArchivoRecibo('REC-00007', 'Julieta Mercedes Ávila');
ok('el recibo de alguien con tilde sale en ASCII', ASCII.test(conTilde), conTilde);
ok('y conserva el número y el nombre',
  conTilde === 'Recibo REC-00007 - Julieta Mercedes Avila.pdf');

const liq = nombreArchivoLiquidacion('LIQ-202610-003', 'Panadería La Esquina');
ok('la liquidación también', ASCII.test(liq), liq);
ok('incluida la palabra Liquidacion, que lleva tilde',
  liq === 'Liquidacion LIQ-202610-003 - Panaderia La Esquina.pdf');

ok('sin nombre de persona igual queda un archivo válido',
  nombreArchivoRecibo('REC-1') === 'Recibo REC-1.pdf');

/* ── La renovación del contrato ── */
const viejo = {
  id: 'c1', numero: 'LOC-2025-007', propiedadId: 'p1', inquilinoId: 'i1', garanteIds: ['g1'],
  fechaInicio: '2025-02-01', fechaFin: '2026-11-01', montoInicial: 780000, moneda: 'ARS',
  diaVencimiento: 10, indiceAjuste: 'SIN_AJUSTE', mesesAjuste: 6,
  comisionAdminPct: 10, punitorioDiarioPct: 0.15, estado: 'activo',
  conceptosFijos: [{ id: 'cf1', descripcion: 'Expensas', monto: 90000, aCuentaDelPropietario: false }],
  depositoGarantia: 780000,
};

const nuevo = contratoRenovado(viejo, [], 'LOC-2026-001');

// Lo caro de equivocarse: el anterior factura el mes de su vencimiento
// entero, así que si el nuevo arranca dentro de ese mes los dos emiten
// cuota de la misma unidad.
const mesesViejo = periodosDelContrato(viejo);
const mesesNuevo = periodosDelContrato(nuevo);
const pisados = mesesNuevo.filter((m) => mesesViejo.includes(m));
ok('el contrato nuevo no factura ningún mes del anterior', pisados.length === 0, pisados.join(', '));
ok('arranca el mes siguiente al último que factura el viejo',
  nuevo.fechaInicio === '2026-12-01', nuevo.fechaInicio);
ok('y no deja meses sin facturar en el medio',
  mesesNuevo[0] === '2026-12' && mesesViejo[mesesViejo.length - 1] === '2026-11');

ok('dura lo mismo que el anterior', mesesDeContrato(nuevo) === mesesDeContrato(viejo),
  `${mesesDeContrato(viejo)} → ${mesesDeContrato(nuevo)}`);
ok('es un contrato distinto, no el mismo editado', nuevo.id !== viejo.id);
ok('hereda inquilino, garantes, depósito y conceptos fijos',
  nuevo.inquilinoId === viejo.inquilinoId &&
  nuevo.garanteIds.length === 1 &&
  nuevo.depositoGarantia === viejo.depositoGarantia &&
  nuevo.conceptosFijos.length === 1);
ok('queda activo', nuevo.estado === 'activo');
ok('no toca el contrato anterior', viejo.estado === 'activo' && viejo.fechaFin === '2026-11-01');

// Sin ajustes el alquiler vigente es el inicial; con ajustes sería el último.
ok('arranca por el alquiler que regía al final, no por el original',
  nuevo.montoInicial === 780000);

ok('el número propuesto sigue al último del año',
  siguienteNumeroContrato([{ numero: 'LOC-2026-014' }, { numero: 'LOC-2025-099' }], 2026) ===
    'LOC-2026-015');
ok('y arranca en 001 si no hay ninguno de este año',
  siguienteNumeroContrato([{ numero: 'LOC-2025-099' }], 2026) === 'LOC-2026-001');

/* ── Cuándo avisar que los datos están en riesgo ──
   La app guarda todo en el navegador: si nadie baja una copia y alguien
   limpia los datos del sitio, no queda nada.                               */
const base = (extra = {}) => ({
  demo: false,
  configuracion: {},
  propiedades: [], contratos: [], personas: [], pagos: [],
  ...extra,
});
const HOY = '2026-11-03';

ok('una base vacía no molesta con avisos',
  saludDeLosDatos(base(), HOY).alerta === 'ninguna');

ok('con la demo cargada avisa que no son datos reales',
  saludDeLosDatos(base({ demo: true, propiedades: [{}, {}] }), HOY).alerta === 'demo');

ok('y mientras sea la demo no pide respaldos, que no sirven de nada',
  saludDeLosDatos(base({ demo: true, propiedades: [{}] }), HOY).alerta !== 'sin_respaldo');

ok('con datos reales y ninguna copia, avisa',
  saludDeLosDatos(base({ propiedades: [{}] }), HOY).alerta === 'sin_respaldo');

ok('recién respaldado no molesta',
  saludDeLosDatos(base({ propiedades: [{}], configuracion: { ultimoRespaldo: HOY } }), HOY)
    .alerta === 'ninguna');

ok(`una copia de hace ${DIAS_TOLERADOS} días todavía pasa`,
  saludDeLosDatos(base({ propiedades: [{}], configuracion: { ultimoRespaldo: '2026-10-27' } }), HOY)
    .alerta === 'ninguna');

ok('una de hace 20 días ya no',
  saludDeLosDatos(base({ propiedades: [{}], configuracion: { ultimoRespaldo: '2026-10-14' } }), HOY)
    .alerta === 'respaldo_viejo');

ok('y cuenta bien los días',
  saludDeLosDatos(base({ propiedades: [{}], configuracion: { ultimoRespaldo: '2026-10-14' } }), HOY)
    .diasSinRespaldo === 20);

/* ── El IPC de Córdoba, como lo publica Estadística y Censos ── */
// Filas recortadas de lo que devolvió el portal el 5/11/2026.
const EMPALME = [
  { _id: 1, COICOP: null, Descripcion: 'NIVEL GENERAL', 'sep-25': '100,7', 'oct-25': '103', 'nov-25': '105,7' },
  { _id: 2, COICOP: 'A01', Descripcion: 'ALIMENTOS Y BEBIDAS NO ALCOHÓLICAS', 'sep-25': '99,4', 'oct-25': '102,2', 'nov-25': '105,9' },
];
const MENSUAL = [
  { _id: 1, Codigo: 'Código', Descripcion: 'Descripción', 'nov-25': 'nov-25', 'dic-25': 'dic-25', 'jul-26': 'jul-26' },
  { _id: 2, Codigo: null, Descripcion: 'NIVEL GENERAL', 'nov-25': '105,7', 'dic-25': '108,8', 'jul-26': '128,4' },
];
const BASE_2014 = [{ Descripcion: 'NIVEL GENERAL', 'nov-25': '6543,2', 'dic-25': '6730,1' }];

ok('las columnas de mes se leen como período', ipc.periodoDeColumna('abr-22') === '2022-04');
ok('y también con el año entero', ipc.periodoDeColumna('Sep-2026') === '2026-09');
ok('una columna que no es mes no es período', ipc.periodoDeColumna('Descripcion') === null);
ok('la coma es el decimal', ipc.numeroDeCelda('105,7') === 105.7);
ok('el punto separa miles', ipc.numeroDeCelda('6.543,2') === 6543.2);
ok('un encabezado repetido no es un número', ipc.numeroDeCelda('nov-25') === null);
ok('sin coma, el punto es el decimal, redondeado como publica la Provincia',
  ipc.numeroDeCelda('132.5076651581576') === 132.5);
ok('un número de la planilla también se redondea', ipc.numeroDeCelda(130.69720218771903) === 130.7);
ok('una columna con fecha ISO es período', ipc.periodoDeColumna('2026-09-01 00:00:00') === '2026-09');
ok('y una con fecha día/mes/año', ipc.periodoDeColumna('1/8/2026') === '2026-08');
ok('el título de la planilla no es período',
  ipc.periodoDeColumna('Índice de Precios al Consumidor Córdoba. Base Jun - Nov 2025=100') === null);

const empalme = ipc.serieDeFilas(EMPALME);
ok('toma el nivel general y no el de alimentos', empalme.get('2025-11') === 105.7);
const mensual = ipc.serieDeFilas(MENSUAL);
ok('la fila de encabezados repetidos no estorba', mensual.size === 3 && mensual.get('2026-07') === 128.4);

const unida = ipc.unirSeries([empalme, mensual]);
ok('el empalme y la mensual se unen por el mes que comparten',
  unida.serie.size === 5 && unida.serie.get('2025-09') === 100.7 && unida.serie.get('2026-07') === 128.4);
const conVieja = ipc.unirSeries([empalme, mensual, ipc.serieDeFilas(BASE_2014)]);
ok('una planilla en base 2014 se descarta entera', conVieja.descartadas === 1 && conVieja.serie.get('2025-12') === 108.8);

ok('una serie de verdad pasa el control', ipc.problemaDeSerie(unida.serie) === null);
ok('un salto imposible no pasa',
  ipc.problemaDeSerie(new Map([['2025-11', 105.7], ['2025-12', 6730.1]])) !== null);

const csv = 'Código;Descripción;oct-26;nov-26\n;NIVEL GENERAL;133,1;135,9\nA01;ALIMENTOS;140;142\n';
ok('el CSV con punto y coma se lee', ipc.serieDeCSV(csv).get('2026-11') === 135.9);
const csvComas = 'Codigo,Descripcion,oct-26,nov-26\n,NIVEL GENERAL,"133,1","135,9"\n';
ok('y el separado por comas, con los decimales entre comillas', ipc.serieDeCSV(csvComas).get('2026-10') === 133.1);

const previos = [
  { periodo: '2025-10', ICL: 50, IPC: 60, IPC_CBA: 99 },
  { periodo: '2025-11', ICL: 51, IPC: 61, IPC_CBA: 105.7 },
];
const aplicado = ipc.aplicarIpcCordoba(previos, unida.serie);
ok('el dato oficial pisa lo cargado a mano', aplicado.indices.find((i) => i.periodo === '2025-10').IPC_CBA === 103);
ok('y no toca los demás índices', aplicado.indices.find((i) => i.periodo === '2025-10').ICL === 50);
ok('un mes que ya coincidía no cuenta como cambio', aplicado.cambios === 4);
const mesNuevo = aplicado.indices.find((i) => i.periodo === '2026-07');
ok('un mes nuevo llega con los demás índices sin publicar', mesNuevo.ICL === 0 && mesNuevo.IPC_CBA === 128.4);

// Lo que más importa: que ese 0 no rompa los contratos por ICL.
const icl = valorIndice(aplicado.indices, '2026-07', 'ICL');
ok('un ICL en 0 se lee como no publicado y arrastra el último', icl.valor === 51 && icl.estimado);
ok('mientras el IPC de Córdoba de ese mes sí es exacto',
  valorIndice(aplicado.indices, '2026-07', 'IPC_CBA').estimado === false);

/* ── ICL (BCRA) e IPC nacional (INDEC) ── */
const BCRA_V3 = { status: 200, results: [
  { idVariable: 40, fecha: '2026-09-02', valor: 25.81 },
  { idVariable: 40, fecha: '2026-09-01', valor: 25.79 },
  { idVariable: 40, fecha: '2026-10-01', valor: 26.43 },
  { idVariable: 40, fecha: '2026-10-15', valor: 26.7 },
] };
const BCRA_V4 = { status: 200, results: [{ idVariable: 40, detalle: [
  { fecha: '2026-10-01', valor: 26.43 },
  { fecha: '2026-09-03', valor: 25.83 },
] }] };
const icl3 = nac.serieICL(BCRA_V3);
ok('el ICL toma el valor del primero de cada mes', icl3.get('2026-09') === 25.79 && icl3.get('2026-10') === 26.43);
const icl4 = nac.serieICL(BCRA_V4);
ok('lee también la forma nueva del API del BCRA', icl4.get('2026-10') === 26.43);
ok('si falta el día 1, usa el primero publicado del mes', icl4.get('2026-09') === 25.83);
ok('una respuesta rara no rompe', nac.serieICL({ error: 'x' }).size === 0 && nac.serieICL(null).size === 0);

const SERIES = { data: [['2026-08-01', 9512.3456], ['2026-09-01', 9701.18], ['basura', 1]], count: 2 };
const ipcNac = nac.serieIPCNacional(SERIES);
ok('el IPC nacional sale de las filas fecha-valor', ipcNac.size === 2 && ipcNac.get('2026-08') === 9512.3);

const CSV_INDEC = [
  'Codigo;Descripcion;Clasificador;Periodo;Indice_IPC;v_m_IPC;v_i_a_IPC;Region',
  '0;NIVEL GENERAL;Nivel general y divisiones COICOP;202608;12276,766;1,7;33,5;Nacional',
  '0;NIVEL GENERAL;Nivel general y divisiones COICOP;202608;12276,812;1,6;33,7;GBA',
  '1;Alimentos y bebidas no alcohólicas;Nivel general y divisiones COICOP;202609;13384,1945;2;35,1;Nacional',
  'Estacional;;Categorias;202609;10389,768;2,9;24,9;Nacional',
  '0;NIVEL GENERAL;Nivel general y divisiones COICOP;202609;12514,1508;1,9;33,4;Nacional',
].join('\r\n');
const indec = nac.serieIPCIndecCSV(CSV_INDEC);
ok('del CSV del INDEC sale solo el nivel general nacional',
  indec.size === 2 && indec.get('2026-08') === 12276.8 && indec.get('2026-09') === 12514.2);
const indecTab = nac.serieIPCIndecCSV(CSV_INDEC.replaceAll(';', '\t'));
ok('también lee el CSV separado por tabulaciones', indecTab.get('2026-09') === 12514.2);
ok('un archivo sin las columnas esperadas no rompe', nac.serieIPCIndecCSV('hola;chau\n1;2').size === 0);
const unidaNac = ipc.unirSeries([new Map([['2026-07', 12073], ['2026-08', 12276.8]]), indec]).serie;
ok('el CSV suma septiembre a lo que trae el API', unidaNac.get('2026-09') === 12514.2 && unidaNac.size === 3);

const conICL = ipc.aplicarSerie(previos, icl3, 'ICL');
ok('aplicar el ICL no toca el IPC de Córdoba',
  conICL.indices.find((i) => i.periodo === '2026-09').ICL === 25.79 &&
  conICL.indices.find((i) => i.periodo === '2025-10').IPC_CBA === 99);

/* ── Los índices de demostración que se colaron después del último publicado ── */
const conDemo = [
  { periodo: '2026-08', ICL: 0, IPC: 0, IPC_CBA: 140 },
  { periodo: '2026-09', ICL: 0, IPC: 0, IPC_CBA: 142 },
  { periodo: '2026-10', ICL: 0, IPC: 0, IPC_CBA: 538 },
  { periodo: '2026-11', ICL: 0, IPC: 0, IPC_CBA: 545 },
  { periodo: '2026-12', ICL: 3, IPC: 0, IPC_CBA: 550 },
];
const limpio = ipc.aplicarSerie(conDemo, new Map([['2026-08', 140.5], ['2026-09', 142.4]]), 'IPC_CBA').indices;
ok('los meses de otra base después del último publicado se borran',
  !limpio.some((i) => i.periodo === '2026-10' || i.periodo === '2026-11'), limpio.map((i) => i.periodo).join(','));
ok('si al mes le queda otro índice, se conserva sin el que no encajaba',
  limpio.find((i) => i.periodo === '2026-12')?.IPC_CBA === 0 && limpio.find((i) => i.periodo === '2026-12')?.ICL === 3);
const aMano = ipc.aplicarSerie(
  [{ periodo: '2026-09', ICL: 0, IPC: 0, IPC_CBA: 142 }, { periodo: '2026-10', ICL: 0, IPC: 0, IPC_CBA: 144.1 }],
  new Map([['2026-08', 140.5], ['2026-09', 142.4]]), 'IPC_CBA').indices;
ok('un valor cargado a mano que encaja con la serie se respeta',
  aMano.find((i) => i.periodo === '2026-10')?.IPC_CBA === 144.1);

/* ── Sin el último mes publicado, la ventana se corre hacia atrás ── */
const serieMeses = ['2026-03','2026-04','2026-05','2026-06','2026-07','2026-08','2026-09']
  .map((periodo, n) => ({ periodo, ICL: 0, IPC: 0, IPC_CBA: 100 + n * 2 }));
const cada4 = { ...viejo, fechaInicio: '2026-07-01', fechaFin: '2028-06-30', montoInicial: 100000,
  indiceAjuste: 'IPC_CBA', mesesAjuste: 4 };
const tramoNov = cronogramaAjustes(cada4, serieMeses)[1];
// Noviembre se ajusta con 4 meses: sin octubre ni noviembre publicados, van
// jun, jul, ago y sep → septiembre (112) sobre mayo (104).
ok('con el mes sin publicar usa los últimos 4 publicados (jun a sep)',
  tramoNov.periodoDesde === '2026-11' && Math.abs(tramoNov.coeficiente - 112 / 104) < 0.0001,
  String(tramoNov.coeficiente));
const serieCompleta = [...serieMeses,
  { periodo: '2026-10', ICL: 0, IPC: 0, IPC_CBA: 114 }, { periodo: '2026-11', ICL: 0, IPC: 0, IPC_CBA: 116 }];
ok('con todo publicado no cambia nada (nov sobre jul)',
  Math.abs(cronogramaAjustes(cada4, serieCompleta)[1].coeficiente - 116 / 108) < 0.0001);

/* ── Los servicios se completan al cobrar ── */
const cuotaServ = cobranzas.armarCuota(
  { ...viejo, conceptosFijos: [
    { id: 'l', descripcion: 'Luz', monto: 0, aCuentaDelPropietario: false },
    { id: 'a', descripcion: 'Agua', monto: 5000, aCuentaDelPropietario: false },
  ] },
  '2026-03',
  [],
);
ok('la cuota sale con los servicios sin importe, para completar al cobrar',
  cobranzas.itemsACompletar(cuotaServ).length === 2 &&
  cuotaServ.items.filter((i) => i.aCompletar).every((i) => i.monto === 0));
ok('y el total es solo el alquiler mientras tanto', cuotaServ.total === 780000, String(cuotaServ.total));
const completa = cobranzas.completarItems(cuotaServ, new Map([[1, 12345.5], [2, 0]]));
ok('al completarlos se suman al total', completa.total === 792345.5, String(completa.total));
ok('y dejan de estar pendientes', cobranzas.itemsACompletar(completa).length === 0);
ok('el alquiler no se toca', completa.items[0].monto === 780000 && !completa.items[0].aCompletar);

console.log(fallos === 0 ? '\nTodo en orden.' : `\n${fallos} fallaron.`);
process.exit(fallos ? 1 : 0);

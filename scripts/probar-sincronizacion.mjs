/**
 * Prueba el cálculo de diferencias con el que la app sincroniza contra
 * Supabase. Es pura: no necesita servidor ni red.
 *
 *   npm run sincro
 *
 * Lo que se verifica es lo caro de equivocarse: que no se mande de más
 * (escrituras inútiles en cada tecla) ni de menos (un cambio que se pierde).
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const carpeta = mkdtempSync(join(tmpdir(), 'sincro-'));
const salida = join(carpeta, 'remoto.mjs');
execFileSync('npx', [
  'esbuild', 'src/data/remoto.ts', '--bundle', '--format=esm', '--platform=node',
  '--external:@supabase/supabase-js', '--define:import.meta.env={}',
  `--outfile=${salida}`, '--log-level=error',
]);
const { calcularCambios, hayCambios } = await import(salida);

let fallos = 0;
const ok = (n, c, d = '') => { if (!c) fallos++; console.log(`${c ? '✓' : '✗'} ${n}${d ? ` — ${d}` : ''}`); };

// Una base mínima armada a mano: no hace falta la demo entera.
const vacia = () => ({
  version: 3,
  configuracion: { nombre: 'M & M', cuit: '', telefono: '', email: '',
                   comisionAdminPctDefault: 8, punitorioDiarioPctDefault: 0.15, diasAvisoVencimiento: 5 },
  personas: [], propiedades: [], contratos: [], cuotas: [], pagos: [],
  liquidaciones: [], gastos: [], adjuntos: [], novedades: [], indices: [],
});

const conDatos = () => {
  const b = vacia();
  b.personas = [{ id: 'per_1', nombre: 'Marta' }, { id: 'per_2', nombre: 'Caro' }];
  b.propiedades = [{ id: 'pro_1', codigo: 'NC-01', propietarioId: 'per_1' }];
  b.contratos = [{ id: 'con_1', propiedadId: 'pro_1', inquilinoId: 'per_2' }];
  b.cuotas = [{ id: 'cuo_1', contratoId: 'con_1', total: 500000 },
              { id: 'cuo_2', contratoId: 'con_1', total: 500000 }];
  b.pagos = [{ id: 'pag_1', cuotaId: 'cuo_1', monto: 500000 }];
  b.indices = [{ periodo: '2026-09', IPC_CBA: 100 }, { periodo: '2026-10', IPC_CBA: 102 }];
  return b;
};

// 1. Sin cambios, no se manda nada
const a = conDatos();
ok('una base igual a sí misma no genera escrituras', !hayCambios(calcularCambios(a, a)));

// 2. Alta
const b2 = { ...a, personas: [...a.personas, { id: 'per_3', nombre: 'Nuevo' }] };
const c2 = calcularCambios(a, b2);
ok('un alta manda solo esa fila',
  c2.guardar.persona?.length === 1 && c2.guardar.persona[0].id === 'per_3',
  JSON.stringify(Object.keys(c2.guardar)));

// 3. Modificación
const b3 = { ...a, cuotas: a.cuotas.map((c) => (c.id === 'cuo_2' ? { ...c, total: 600000 } : c)) };
const c3 = calcularCambios(a, b3);
ok('una modificación manda solo la fila tocada',
  c3.guardar.cuota?.length === 1 && c3.guardar.cuota[0].id === 'cuo_2');
ok('y no toca las demás colecciones', Object.keys(c3.guardar).length === 1);

// 4. Borrado en cascada, como lo deja integridad.ts
const b4 = { ...a, propiedades: [], contratos: [], cuotas: [], pagos: [] };
const c4 = calcularCambios(a, b4);
ok('el borrado en cascada se manda entero',
  c4.borrar.propiedad?.length === 1 && c4.borrar.contrato?.length === 1 &&
  c4.borrar.cuota?.length === 2 && c4.borrar.pago?.length === 1);
ok('y no manda nada para guardar', Object.keys(c4.guardar).length === 0);

// 5. Índices, que van por período y no por id
const b5 = { ...a, indices: [a.indices[0], { periodo: '2026-10', IPC_CBA: 103 }] };
const c5 = calcularCambios(a, b5);
ok('un índice corregido se manda por su período',
  c5.guardar.indice?.length === 1 && c5.guardar.indice[0].periodo === '2026-10');

// 6. Configuración
const b6 = { ...a, configuracion: { ...a.configuracion, cuit: '30-12345678-9' } };
const c6 = calcularCambios(a, b6);
ok('la configuración se manda cuando cambia', c6.guardar.configuracion?.length === 1);
ok('y no cuando no cambia', !calcularCambios(a, { ...a, configuracion: { ...a.configuracion } }).guardar.configuracion);

// 7. Un objeto reemplazado por otro idéntico no genera escritura
const b7 = { ...a, personas: a.personas.map((p) => ({ ...p })) };
ok('copiar objetos sin cambiarlos no genera escrituras', !hayCambios(calcularCambios(a, b7)));

// 8. Cargar desde cero: todo es alta
const c8 = calcularCambios(vacia(), a);
ok('una base nueva se sube entera',
  c8.guardar.persona?.length === 2 && c8.guardar.cuota?.length === 2 && c8.guardar.indice?.length === 2);

console.log(fallos === 0 ? '\nTodo en orden.' : `\n${fallos} fallaron.`);
process.exit(fallos ? 1 : 0);

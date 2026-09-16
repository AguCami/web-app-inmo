# Diseño

Documento de referencia del modelo de datos, el circuito contable y las
decisiones que no se leen solas mirando el código.

---

## 1. Para quién es

Una inmobiliaria chica o mediana del mercado argentino que hace las dos cosas:

- **Administra alquileres**: emite cuotas, cobra, aplica punitorios, actualiza
  por índice y le rinde a cada propietario.
- **Intermedia ventas**: capta, reserva, firma boleto, escritura y reparte
  honorarios entre agentes.

El problema que resuelve no es "llevar la contabilidad" en abstracto, sino el
que rompe todas las planillas de Excel del rubro: **la plata que entra no es
plata propia**. Del alquiler que cobra, la inmobiliaria se queda con el 8 % y
tiene que devolver el 92 %. Si esa distinción no está en el modelo de datos, el
estado de resultados miente por un orden de magnitud.

## 2. Modelo de datos

Todo el estado es un único objeto `BaseDatos` serializable (`src/domain/types.ts`).

```
Persona ──┬─< Propiedad >── Contrato ──< Cuota ──< Pago
          │       │             │          │
          │       │             │          └──> Liquidacion (ítems con proporción)
          │       │             │
          │       └─────< Operacion >──── ParticipacionAgente
          │
          └──< Gasto ──> Liquidacion (si es reintegrable)

CuentaFinanciera ──< Movimiento (derivado)
ValorIndice (ICL / IPC / Casa Propia / USD por período)
Asiento (automáticos derivados + manuales guardados)
```

### Convenciones

| Decisión | Por qué |
|---|---|
| Fechas como `YYYY-MM-DD` en string | `new Date('2026-01-01')` se parsea como UTC y en Argentina (UTC−3) devuelve el 31 de diciembre. Las fechas del negocio no tienen hora ni zona. |
| Períodos como `YYYY-MM` en string | Ordenan lexicográficamente igual que cronológicamente: `periodo >= desde && periodo <= hasta` funciona sin convertir. |
| Importes en `number` con 2 decimales | Los montos del rubro no llegan a perder precisión en doble; usar centavos enteros complicaría cada fórmula de porcentaje sin ganancia real. |
| `Persona` con `roles: RolPersona[]` | Un propietario suele ser también inquilino de otra unidad. Tener tablas separadas obliga a duplicar y a que los datos se desincronicen. |
| Una sola persona por rol en el contrato | Los cotitulares se resuelven con garantes y notas. Modelar copropiedad con porcentajes es un salto de complejidad que esta versión no necesita. |

### Lo que se calcula y no se guarda

Guardar un valor derivado es aceptar que algún día quede desactualizado. Se
calculan siempre:

- **El alquiler vigente**, a partir del monto inicial y el índice.
- **El estado de una cuota** (pendiente / parcial / pagada / vencida), a partir
  de sus pagos y de la fecha.
- **Los punitorios**, a partir del saldo y los días de mora.
- **El libro diario automático**, a partir de cuotas, pagos, liquidaciones,
  operaciones y gastos.
- **El libro de caja**, a partir de los pagos y las liquidaciones pagadas.
- **Los saldos de las cuentas**, a partir del saldo inicial más los movimientos.

Solo se guarda lo que alguien decidió: entidades, pagos, estados administrativos
y asientos manuales.

## 3. Actualización de alquileres

La Ley de Alquileres argentina y sus sucesivas reformas dejaron conviviendo
varios esquemas. El modelo soporta los cuatro que se usan en la práctica:

| Índice | Fuente | Uso típico |
|---|---|---|
| **ICL** | BCRA | Contratos bajo el régimen de la ley de alquileres |
| **IPC** | INDEC | Contratos con actualización por inflación pura |
| **Casa Propia** | Secretaría de Vivienda | Combina inflación y salarios; sube más suave |
| **% fijo** | — | Escalonados pactados entre partes |

El cronograma parte el contrato en tramos de `mesesAjuste` y encadena el
coeficiente de cada tramo con el anterior:

```
monto(k) = monto(k−1) × índice(períodoTramo k) / índice(períodoTramo k−1)
```

que es equivalente a `montoInicial × índice(t) / índice(0)`, pero deja visible
el coeficiente de cada ajuste — que es lo que hay que notificarle al inquilino.

**Si falta el dato del período** (el BCRA publica con retraso) se arrastra el
último publicado y el tramo queda marcado como *proyectado*. Al cargar el valor
definitivo en Configuración, el cronograma se recalcula solo.

> **Detalle que costó un bug:** si el período pedido es *anterior* al comienzo de
> la serie, devolver 1 como índice hace que el coeficiente sea el valor entero
> del índice y multiplique el alquiler por cien. La función devuelve el primer
> valor de la serie, no 1 (`valorMasCercano` en `domain/contratos.ts`).

## 4. Circuito contable

Plan de cuentas mínimo en `domain/planCuentas.ts`. Las cuentas que sostienen
todo el esquema son dos:

- **`1.2.01` Inquilinos a cobrar** — lo que se devengó y todavía no entró.
- **`2.1.01` Propietarios cuenta liquidación** — fondos de terceros a rendir.

### Asientos automáticos

| Hecho | Debe | Haber |
|---|---|---|
| Emisión de cuota | `1.2.01` Inquilinos a cobrar | `2.1.01` Propietarios cta. liquidación |
| Cobranza | `1.1.0x` Caja o banco | `1.2.01` Inquilinos a cobrar<br>`4.1.03` Punitorios (si hubo mora) |
| Liquidación aprobada | `2.1.01` Propietarios cta. liquidación | `4.1.01` Honorarios administración |
| Pago de la liquidación | `2.1.01` Propietarios cta. liquidación | `1.1.0x` Caja o banco |
| Escrituración | `1.2.02` Honorarios por venta a cobrar | `4.1.02` Honorarios por venta |
| Cobro de honorarios de venta | `1.1.0x` Caja o banco | `1.2.02` Honorarios por venta a cobrar |
| Gasto propio | `5.1.xx` según categoría | `2.1.02` Proveedores |
| Gasto reintegrable | `2.1.01` Propietarios cta. liquidación | `2.1.02` Proveedores |
| Pago a proveedor | `2.1.02` Proveedores | `1.1.0x` Caja o banco |

Dos consecuencias que vale la pena hacer explícitas:

1. **El ingreso de administración se reconoce al liquidar, no al cobrar.** Es el
   criterio que usa la mayoría de las administraciones y es el que hace que la
   liquidación sea el documento que cierra el mes.
2. **Un gasto reintegrable no toca el resultado.** Va contra la cuenta del
   propietario y se le descuenta en su próxima liquidación. Si se imputara como
   gasto propio, el margen de la inmobiliaria aparecería artificialmente bajo.

Los asientos automáticos se **regeneran enteros** en cada lectura: son función
pura de los datos. Los asientos manuales del contador se guardan y se mezclan
por fecha. El numerador del diario es global y se recalcula al ordenar.

### Moneda

La moneda base es el peso. Los importes en dólares (ventas, cuentas en USD) se
convierten al asentarlos, con la cotización del período del hecho económico
cargada en Configuración. La cotización queda registrada junto con su fuente
declarada, para trazabilidad.

## 5. Liquidación a propietarios

El criterio es **caja, no devengado**: se rinde lo que efectivamente entró.

```
   alquiler cobrado (× proporción cobrada)
 + conceptos a cuenta del propietario
 − honorarios de administración (% sobre el alquiler cobrado)
 − gastos reintegrables sin liquidar
 ─────────────────────────────────────────
 = neto a transferir
```

Cada ítem de alquiler guarda **qué fracción de la cuota está rindiendo**
(`ItemLiquidacion.proporcion`). De ahí salen dos propiedades que importan:

- **Es incremental.** Una cobranza que entró después de emitida la liquidación
  del mes, o el resto de un pago parcial, se rinde en una liquidación
  complementaria del mismo período.
- **Es idempotente.** Generar liquidaciones dos veces sobre el mismo período no
  duplica nada: lo ya rendido no vuelve a entrar.

Marcar la cuota con un único `liquidacionId` como "ya liquidada" —que fue el
primer diseño— dejaba el saldo de todo pago parcial sin rendir para siempre.

Circuito: **borrador** (revisable, editable, borrable) → **aprobada** (se
reconoce el honorario como ingreso) → **pagada** (sale la plata de la cuenta).

## 6. Ventas

La operación avanza por etapas: captación → reserva → boleto → escritura, con
"caída" como salida lateral y su motivo.

- Los honorarios se calculan sobre el precio acordado (o el publicado si todavía
  no hay acuerdo), con porcentajes separados para vendedor y comprador.
- El **pipeline ponderado** multiplica los honorarios por la probabilidad de
  cierre, que por defecto sale de la etapa y se puede pisar a mano.
- El reparto entre agentes es una lista de porcentajes sobre el honorario total
  de la inmobiliaria. La comisión se considera cobrada solo al escriturar.
- En el tablero el embudo muestra **solo las etapas abiertas**: mezclar el
  histórico de escrituradas con lo que está en curso aplasta la escala y el
  gráfico deja de decir nada.

## 7. Presentación de datos

- **Paleta de series de orden fijo**, validada para daltonismo (ΔE ≥ 8 entre
  adyacentes bajo simulación CVD) y para contraste contra la superficie. El
  color sigue a la entidad, nunca al ranking: filtrar una serie no repinta a las
  demás.
- **Rampa ordinal de una sola tinta** para las categorías que tienen orden
  natural (tramos de mora, etapas del embudo), con pasos de luminosidad
  suficientemente separados y un extremo claro que conserva contraste.
- **Un solo eje por gráfico.** Nunca dos escalas verticales: la alineación entre
  ellas es arbitraria e inventa correlaciones que no están en los datos.
- **Todo gráfico tiene vista de tabla.** Es la salida accesible y además es lo
  que la gente copia al mail.
- **Los colores de estado están reservados** (bien / alerta / serio / crítico) y
  nunca se usan como color de serie. Siempre van con texto al lado.
- El modo oscuro tiene **sus propios pasos de color**, elegidos contra la
  superficie oscura, no un invertido automático del modo claro.

## 8. Persistencia

`localStorage` bajo la clave `inmo-contable/db/v1`, con la base entera
serializada en JSON (la demo completa ocupa unos 540 KB, sobre un límite
habitual de 5 MB).

Toda lectura y escritura va envuelta en `try/catch`: en ventana privada o con el
almacenamiento bloqueado la app tiene que seguir funcionando en memoria. Cada
mutación pasa por un único punto del store, que muta y persiste; no hay
caminos alternativos que puedan olvidarse de guardar.

El respaldo y la restauración son un archivo JSON con toda la base. Es la
estrategia de backup real de una app local-first, y conviene decirlo en la
interfaz — está dicho en Configuración.

## 9. Rendimiento

Con la cartera de demostración (45 contratos, ~660 cuotas, ~700 pagos, ~1.600
asientos generados) las pantallas cargan en menos de 250 ms. Los listados que
crecen sin techo —diario, mayor, cuotas, movimientos— están paginados; sin eso
el libro diario armaba una página de 65.000 px de alto.

Si la cartera creciera un orden de magnitud, lo primero a tocar sería indexar
los pagos por cuota: hoy `cobradoDeCuota` recorre el array de pagos y se llama
en bucle desde varios reportes.

## 10. Lo que falta para producción

Por orden de lo que más duele:

1. **Backend y multiusuario.** API con Postgres, login y permisos por rol
   (administrador / contable / agente). El módulo `domain/` se muda tal cual: no
   conoce React ni el almacenamiento.
2. **Tests automatizados del dominio.** Hoy hay una verificación de humo con
   Playwright (`npm run smoke`). Falta la batería unitaria sobre cronogramas de
   ajuste, prorrateo de liquidaciones y partida doble.
3. **Carga automática de índices y cotización** desde las APIs del BCRA y el
   INDEC, con el fallback manual que ya existe.
4. **Facturación electrónica** (AFIP/ARCA): comprobante por los honorarios,
   libro IVA ventas y compras, retenciones y percepciones.
5. **Documentos imprimibles de verdad**: recibo de alquiler, liquidación en PDF
   con el membrete de la inmobiliaria, contrato tipo.
6. **Notificaciones**: aviso de ajuste al inquilino, intimación por mora, alerta
   de vencimiento de contrato, por mail o WhatsApp.
7. **Auditoría**: registro de quién cambió qué y cuándo, imprescindible en
   cuanto haya más de una persona operando.

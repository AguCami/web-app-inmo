-- ============================================================================
--  Gestión de alquileres — esquema de Supabase
--  Pegar entero en Supabase → SQL Editor → New query → Run.
--  Es idempotente: se puede volver a correr sin romper nada.
-- ============================================================================
--
--  Dos decisiones que explican el resto:
--
--  1. Las columnas se llaman igual que los campos de TypeScript, en camelCase
--     y entre comillas. Es poco idiomático en SQL, pero evita una capa de
--     traducción entre la base y la app, y sobre todo evita romper nombres que
--     ninguna conversión automática maneja bien: "IPC_CBA", "m2", "cbu".
--     Al escribir SQL a mano hay que comillarlos: select "propiedadId" from ...
--
--  2. La clave primaria de cada tabla es (organizacion_id, id), y las claves
--     foráneas llevan las dos columnas. Así la base misma impide que una
--     inmobiliaria referencie una fila de otra: no depende de que la política
--     de seguridad esté bien escrita.
--
--  Las cascadas de borrado son las mismas que hoy hace a mano
--  src/domain/integridad.ts. Acá las hace Postgres.

/* ─────────────────────── Organizaciones y acceso ─────────────────────── */

create table if not exists organizacion (
  id     uuid primary key default gen_random_uuid(),
  nombre text not null,
  creada timestamptz not null default now()
);

create table if not exists miembro (
  organizacion_id uuid not null references organizacion (id) on delete cascade,
  usuario_id      uuid not null references auth.users (id) on delete cascade,
  rol             text not null default 'operador'
                  check (rol in ('dueño', 'operador', 'lectura')),
  primary key (organizacion_id, usuario_id)
);

-- A qué organizaciones pertenece quien está pidiendo.
--
-- Va como security definer y no como subconsulta suelta por dos razones: si
-- la política de `miembro` consultara `miembro`, Postgres entra en recursión
-- infinita; y así la consulta se planifica una sola vez por sentencia en vez
-- de una por fila.
create or replace function mis_organizaciones()
returns setof uuid
language sql
security definer
set search_path = public
stable
as $$
  select organizacion_id from miembro where usuario_id = auth.uid()
$$;

alter table organizacion enable row level security;
alter table miembro      enable row level security;

drop policy if exists "ver mi organizacion" on organizacion;
create policy "ver mi organizacion" on organizacion
  for select using (id in (select mis_organizaciones()));

drop policy if exists "ver mis membresias" on miembro;
create policy "ver mis membresias" on miembro
  for select using (organizacion_id in (select mis_organizaciones()));

/* ───────────────────────────── Datos del negocio ──────────────────────── */

create table if not exists configuracion (
  organizacion_id            uuid primary key references organizacion (id) on delete cascade,
  "nombre"                   text    not null default '',
  "cuit"                     text    not null default '',
  "telefono"                 text    not null default '',
  "email"                    text    not null default '',
  "comisionAdminPctDefault"  numeric not null default 8,
  "punitorioDiarioPctDefault" numeric not null default 0.15,
  "diasAvisoVencimiento"     integer not null default 5
);

create table if not exists persona (
  organizacion_id uuid not null references organizacion (id) on delete cascade,
  id              text not null,
  "nombre"        text not null,
  "roles"         text[] not null default '{}',
  "tipoDoc"       text not null default 'DNI',
  "documento"     text not null default '',
  "email"         text,
  "telefono"      text,
  "domicilio"     text,
  "condicionIVA"  text not null default 'consumidor_final',
  "cbu"           text,
  "notas"         text,
  "activo"        boolean not null default true,
  primary key (organizacion_id, id)
);

create table if not exists propiedad (
  organizacion_id    uuid not null references organizacion (id) on delete cascade,
  id                 text not null,
  "codigo"           text not null,
  "tipo"             text not null,
  "propietarioId"    text not null,
  "calle"            text not null,
  "numero"           text not null,
  "piso"             text,
  "depto"            text,
  "barrio"           text not null default '',
  "ambientes"        integer,
  "dormitorios"      integer,
  "banos"            integer,
  "m2"               numeric,
  "cochera"          boolean not null default false,
  "estado"           text not null default 'disponible',
  "alquilerSugerido" numeric,
  "expensas"         numeric,
  "notas"            text,
  primary key (organizacion_id, id)
);

create table if not exists contrato (
  organizacion_id     uuid not null references organizacion (id) on delete cascade,
  id                  text not null,
  "numero"            text not null,
  "propiedadId"       text not null,
  "inquilinoId"       text not null,
  "garanteIds"        text[] not null default '{}',
  "fechaInicio"       date not null,
  "fechaFin"          date not null,
  "montoInicial"      numeric not null,
  "moneda"            text not null default 'ARS',
  "diaVencimiento"    integer not null default 10,
  "indiceAjuste"      text not null default 'IPC_CBA',
  "mesesAjuste"       integer not null default 3,
  "porcentajeFijo"    numeric,
  "comisionAdminPct"  numeric not null default 8,
  "punitorioDiarioPct" numeric not null default 0.15,
  "estado"            text not null default 'activo',
  "conceptosFijos"    jsonb not null default '[]',
  "deposito"          numeric,
  "notas"             text,
  primary key (organizacion_id, id),
  foreign key (organizacion_id, "propiedadId")
    references propiedad (organizacion_id, id) on delete cascade
);

create table if not exists liquidacion (
  organizacion_id uuid not null references organizacion (id) on delete cascade,
  id              text not null,
  "numero"        text not null,
  "propietarioId" text not null,
  "periodo"       text not null,
  "fecha"         date not null,
  "items"         jsonb not null default '[]',
  "neto"          numeric not null default 0,
  "moneda"        text not null default 'ARS',
  "estado"        text not null default 'borrador',
  "fechaPago"     date,
  "notas"         text,
  primary key (organizacion_id, id),
  foreign key (organizacion_id, "propietarioId")
    references persona (organizacion_id, id) on delete cascade
);

create table if not exists cuota (
  organizacion_id uuid not null references organizacion (id) on delete cascade,
  id              text not null,
  "contratoId"    text not null,
  "periodo"       text not null,
  "vencimiento"   date not null,
  "moneda"        text not null default 'ARS',
  "items"         jsonb not null default '[]',
  "total"         numeric not null default 0,
  "estado"        text not null default 'pendiente',
  "liquidacionId" text,
  primary key (organizacion_id, id),
  foreign key (organizacion_id, "contratoId")
    references contrato (organizacion_id, id) on delete cascade,
  -- Si se borra la liquidación, la cuota queda sin rendir, no se borra.
  foreign key (organizacion_id, "liquidacionId")
    references liquidacion (organizacion_id, id) on delete set null ("liquidacionId")
);

create table if not exists pago (
  organizacion_id     uuid not null references organizacion (id) on delete cascade,
  id                  text not null,
  "cuotaId"           text not null,
  "fecha"             date not null,
  "monto"             numeric not null,
  "moneda"            text not null default 'ARS',
  "medio"             text not null default 'transferencia',
  "recibo"            text,
  "comprobante"       text,
  "periodosAdeudados" text[],
  "punitorios"        numeric,
  "notas"             text,
  primary key (organizacion_id, id),
  foreign key (organizacion_id, "cuotaId")
    references cuota (organizacion_id, id) on delete cascade
);

create table if not exists gasto (
  organizacion_id uuid not null references organizacion (id) on delete cascade,
  id              text not null,
  "propiedadId"   text not null,
  "fecha"         date not null,
  "descripcion"   text not null,
  "monto"         numeric not null,
  "moneda"        text not null default 'ARS',
  "categoria"     text not null default 'otro',
  "aCargoDe"      text not null default 'propietario',
  "liquidacionId" text,
  "comprobante"   text,
  "notas"         text,
  primary key (organizacion_id, id),
  foreign key (organizacion_id, "propiedadId")
    references propiedad (organizacion_id, id) on delete cascade,
  foreign key (organizacion_id, "liquidacionId")
    references liquidacion (organizacion_id, id) on delete set null ("liquidacionId")
);

create table if not exists novedad (
  organizacion_id uuid not null references organizacion (id) on delete cascade,
  id              text not null,
  "contratoId"    text not null,
  "fecha"         date not null,
  "tipo"          text not null default 'otro',
  "titulo"        text not null,
  "detalle"       text,
  "registradoPor" text,
  "resuelta"      boolean not null default false,
  primary key (organizacion_id, id),
  foreign key (organizacion_id, "contratoId")
    references contrato (organizacion_id, id) on delete cascade
);

create table if not exists adjunto (
  organizacion_id uuid not null references organizacion (id) on delete cascade,
  id              text not null,
  "contratoId"    text not null,
  "novedadId"     text,
  "nombre"        text not null,
  "tipo"          text not null default '',
  "tamano"        bigint not null default 0,
  "fecha"         date not null,
  "descripcion"   text,
  primary key (organizacion_id, id),
  foreign key (organizacion_id, "contratoId")
    references contrato (organizacion_id, id) on delete cascade,
  -- Un adjunto de una novedad se va con ella; el del legajo cuelga del contrato.
  foreign key (organizacion_id, "novedadId")
    references novedad (organizacion_id, id) on delete cascade
);

create table if not exists indice (
  organizacion_id uuid not null references organizacion (id) on delete cascade,
  "periodo"       text not null,
  "ICL"           numeric,
  "IPC"           numeric,
  "IPC_CBA"       numeric,
  "CASA_PROPIA"   numeric,
  "provisorio"    boolean,
  primary key (organizacion_id, "periodo")
);

/* ─────────── Índices de apoyo para las consultas más frecuentes ───────── */

create index if not exists cuota_por_contrato on cuota (organizacion_id, "contratoId");
create index if not exists cuota_por_periodo  on cuota (organizacion_id, "periodo");
create index if not exists pago_por_cuota     on pago (organizacion_id, "cuotaId");
create index if not exists contrato_por_prop  on contrato (organizacion_id, "propiedadId");
create index if not exists gasto_por_prop     on gasto (organizacion_id, "propiedadId");
create index if not exists novedad_por_contrato on novedad (organizacion_id, "contratoId");
create index if not exists adjunto_por_contrato on adjunto (organizacion_id, "contratoId");

/* ──────────────────────────── Seguridad por fila ──────────────────────── */

-- Una sola regla para todas: se ve y se toca lo de las organizaciones a las
-- que pertenece quien pide. Sin sesión, auth.uid() es null y no se ve nada.
do $$
declare t text;
begin
  foreach t in array array[
    'configuracion', 'persona', 'propiedad', 'contrato', 'liquidacion',
    'cuota', 'pago', 'gasto', 'novedad', 'adjunto', 'indice'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "solo mi organizacion" on %I', t);
    execute format(
      'create policy "solo mi organizacion" on %I for all
         using (organizacion_id in (select mis_organizaciones()))
         with check (organizacion_id in (select mis_organizaciones()))', t);
  end loop;
end $$;

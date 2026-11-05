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
  "diasAvisoVencimiento"     integer not null default 5,
  "ultimoRespaldo"           date
);
-- Para las bases creadas antes de que existiera la columna.
alter table configuracion add column if not exists "ultimoRespaldo" date;

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

/* ───────────────────────── Archivos adjuntos (Storage) ────────────────── */

-- Los PDF y las fotos del legajo no van en una tabla: van al bucket
-- "adjuntos", privado. La fila de `adjunto` es la ficha; el binario vive en
-- Storage bajo la ruta  <organizacion_id>/<id del adjunto>.
--
-- La primera carpeta de la ruta es la organización, y eso es lo que miran
-- las políticas: se lee, sube y borra solo debajo de la carpeta de una
-- inmobiliaria a la que se pertenece. Es la misma regla que las tablas.
--
-- Va dentro de un bloque que primero pregunta si existe Storage: en Supabase
-- siempre está, pero así el esquema también corre en un Postgres pelado.
do $$
begin
  if to_regclass('storage.buckets') is null then
    raise notice 'Sin Storage: se saltea el bucket de adjuntos';
    return;
  end if;

  -- 20 MB por archivo, el mismo tope que pone la app (MAXIMO_POR_ARCHIVO).
  insert into storage.buckets (id, name, public, file_size_limit)
  values ('adjuntos', 'adjuntos', false, 20 * 1024 * 1024)
  on conflict (id) do update
    set public = false, file_size_limit = excluded.file_size_limit;

  drop policy if exists "adjuntos: ver los de mi organizacion"    on storage.objects;
  drop policy if exists "adjuntos: subir a mi organizacion"       on storage.objects;
  drop policy if exists "adjuntos: reemplazar en mi organizacion" on storage.objects;
  drop policy if exists "adjuntos: borrar los de mi organizacion" on storage.objects;

  -- Se compara como texto: castear la carpeta a uuid revienta con una ruta
  -- cualquiera, y una política que tira error es peor que una que dice no.
  create policy "adjuntos: ver los de mi organizacion" on storage.objects
    for select to authenticated
    using (bucket_id = 'adjuntos'
           and (storage.foldername(name))[1] in (select o::text from public.mis_organizaciones() o));

  create policy "adjuntos: subir a mi organizacion" on storage.objects
    for insert to authenticated
    with check (bucket_id = 'adjuntos'
                and (storage.foldername(name))[1] in (select o::text from public.mis_organizaciones() o));

  create policy "adjuntos: reemplazar en mi organizacion" on storage.objects
    for update to authenticated
    using (bucket_id = 'adjuntos'
           and (storage.foldername(name))[1] in (select o::text from public.mis_organizaciones() o))
    with check (bucket_id = 'adjuntos'
                and (storage.foldername(name))[1] in (select o::text from public.mis_organizaciones() o));

  create policy "adjuntos: borrar los de mi organizacion" on storage.objects
    for delete to authenticated
    using (bucket_id = 'adjuntos'
           and (storage.foldername(name))[1] in (select o::text from public.mis_organizaciones() o));
end $$;

/* ─────────────────────────────── Permisos ──────────────────────────────── */

-- Se dan acá, a mano, y no se depende de que el proyecto tenga tildado
-- "Automatically expose new tables" (Supabase recomienda destildarlo).
-- Solo el usuario con sesión (authenticated) toca tablas; las políticas de
-- arriba deciden qué filas. El visitante sin sesión (anon) no toca ninguna.
grant usage on schema public to authenticated;
grant select, insert, update, delete on
  configuracion, persona, propiedad, contrato, liquidacion,
  cuota, pago, gasto, novedad, adjunto, indice
  to authenticated;
-- organizacion y miembro se leen, pero se escriben solo desde el SQL Editor.
grant select on organizacion, miembro to authenticated;
grant execute on function mis_organizaciones() to authenticated;

revoke all on all tables in schema public from anon;
revoke execute on function mis_organizaciones() from anon, public;

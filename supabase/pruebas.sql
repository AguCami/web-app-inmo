-- ============================================================================
--  Pruebas del esquema. No se corren en Supabase: son para verificar acá, en
--  un Postgres limpio, que el aislamiento entre inmobiliarias y las cascadas
--  hacen lo que decimos que hacen.
--
--    psql -f /tmp/stub-auth.sql -f supabase/esquema.sql -f supabase/pruebas.sql
-- ============================================================================
\set ON_ERROR_STOP on
set client_min_messages = notice;

create or replace function afirmar(descripcion text, condicion boolean) returns void
language plpgsql as $$
begin
  if condicion then raise notice '✓ %', descripcion;
  else raise exception '✗ %', descripcion;
  end if;
end $$;

/* ── Dos inmobiliarias, un usuario cada una ── */
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'ana@mym.com'),
  ('22222222-2222-2222-2222-222222222222', 'beto@otra.com');

insert into organizacion (id, nombre) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'M & M'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'La Otra');

insert into miembro (organizacion_id, usuario_id, rol) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'dueño'),
  ('bbbbbbbb-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'dueño');

/* ── Ana carga su cartera ── */
set role authenticated;
set request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111"}';

insert into persona (organizacion_id, id, "nombre", "roles") values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'per_1', 'Marta Suárez', '{propietario}'),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'per_2', 'Carolina Medina', '{inquilino}');
insert into propiedad (organizacion_id, id, "codigo", "tipo", "propietarioId", "calle", "numero")
  values ('aaaaaaaa-0000-0000-0000-000000000001', 'pro_1', 'NC-01', 'departamento', 'per_1', 'Obispo Trejo', '1240');
insert into contrato (organizacion_id, id, "numero", "propiedadId", "inquilinoId", "fechaInicio", "fechaFin", "montoInicial")
  values ('aaaaaaaa-0000-0000-0000-000000000001', 'con_1', 'LOC-1', 'pro_1', 'per_2', '2026-01-01', '2027-12-31', 500000);
insert into liquidacion (organizacion_id, id, "numero", "propietarioId", "periodo", "fecha")
  values ('aaaaaaaa-0000-0000-0000-000000000001', 'liq_1', 'LIQ-1', 'per_1', '2026-10', '2026-10-05');
insert into cuota (organizacion_id, id, "contratoId", "periodo", "vencimiento", "total", "liquidacionId")
  values ('aaaaaaaa-0000-0000-0000-000000000001', 'cuo_1', 'con_1', '2026-10', '2026-10-10', 500000, 'liq_1');
insert into pago (organizacion_id, id, "cuotaId", "fecha", "monto", "recibo")
  values ('aaaaaaaa-0000-0000-0000-000000000001', 'pag_1', 'cuo_1', '2026-10-09', 500000, 'REC-00001');
insert into gasto (organizacion_id, id, "propiedadId", "fecha", "descripcion", "monto")
  values ('aaaaaaaa-0000-0000-0000-000000000001', 'gas_1', 'pro_1', '2026-10-02', 'Plomería', 80000);
insert into novedad (organizacion_id, id, "contratoId", "fecha", "titulo")
  values ('aaaaaaaa-0000-0000-0000-000000000001', 'nov_1', 'con_1', '2026-10-03', 'Se filtra agua');
insert into adjunto (organizacion_id, id, "contratoId", "novedadId", "nombre", "fecha")
  values ('aaaaaaaa-0000-0000-0000-000000000001', 'adj_1', 'con_1', 'nov_1', 'foto.jpg', '2026-10-03'),
         ('aaaaaaaa-0000-0000-0000-000000000001', 'adj_2', 'con_1', null, 'contrato.pdf', '2026-01-01');

select afirmar('Ana ve su cartera', (select count(*) from contrato) = 1);

/* ── Aislamiento: Beto no ve nada de Ana ── */
set request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222"}';
select afirmar('Beto no ve las personas de Ana',    (select count(*) from persona) = 0);
select afirmar('Beto no ve las propiedades de Ana', (select count(*) from propiedad) = 0);
select afirmar('Beto no ve los contratos de Ana',   (select count(*) from contrato) = 0);
select afirmar('Beto no ve los pagos de Ana',       (select count(*) from pago) = 0);

-- Y tampoco puede escribir en la organización ajena.
do $$ begin
  begin
    insert into persona (organizacion_id, id, "nombre")
      values ('aaaaaaaa-0000-0000-0000-000000000001', 'per_intruso', 'Intruso');
    raise exception '✗ Beto pudo escribir en la organización de Ana';
  exception when insufficient_privilege then
    raise notice '✓ Beto no puede escribir en la organización de Ana';
  end;
end $$;

-- Ni colgar algo suyo de una fila de Ana: lo frena la clave foránea
-- compuesta, no la política. Vale para todas las relaciones que tienen
-- clave foránea; la lista está al pie de este archivo.
insert into persona (organizacion_id, id, "nombre", "roles")
  values ('bbbbbbbb-0000-0000-0000-000000000002', 'per_b', 'Dueño de La Otra', '{propietario}');
insert into propiedad (organizacion_id, id, "codigo", "tipo", "propietarioId", "calle", "numero")
  values ('bbbbbbbb-0000-0000-0000-000000000002', 'pro_b', 'X-1', 'casa', 'per_b', 'Calle', '1');
do $$ begin
  begin
    insert into contrato (organizacion_id, id, "numero", "propiedadId", "inquilinoId",
                          "fechaInicio", "fechaFin", "montoInicial")
      values ('bbbbbbbb-0000-0000-0000-000000000002', 'con_b', 'X', 'pro_1', 'per_b',
              '2026-01-01', '2027-01-01', 1);
    raise exception '✗ Beto pudo colgar un contrato de una propiedad de Ana';
  exception when foreign_key_violation then
    raise notice '✓ no se puede referenciar una fila de otra inmobiliaria';
  end;
end $$;

/* ── Cascadas: las mismas que hace hoy integridad.ts ── */
set request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111"}';

-- Borrar la liquidación no borra la cuota: la deja sin rendir.
delete from liquidacion where id = 'liq_1';
select afirmar('borrar la liquidación no borra la cuota', (select count(*) from cuota) = 1);
select afirmar('la cuota queda sin liquidación',
  (select "liquidacionId" is null from cuota where id = 'cuo_1'));

-- Borrar la novedad se lleva su adjunto, pero no el del legajo.
delete from novedad where id = 'nov_1';
select afirmar('borrar la novedad se lleva su adjunto',
  (select count(*) from adjunto where id = 'adj_1') = 0);
select afirmar('el adjunto del legajo sobrevive',
  (select count(*) from adjunto where id = 'adj_2') = 1);

-- Borrar la propiedad arrastra todo lo que colgaba de ella.
delete from propiedad where id = 'pro_1';
select afirmar('la propiedad arrastra sus contratos', (select count(*) from contrato) = 0);
select afirmar('y sus cuotas',                        (select count(*) from cuota) = 0);
select afirmar('y sus pagos',                         (select count(*) from pago) = 0);
select afirmar('y sus gastos',                        (select count(*) from gasto) = 0);
select afirmar('y los adjuntos que quedaban',         (select count(*) from adjunto) = 0);
select afirmar('las personas no se tocan',            (select count(*) from persona) = 2);

/* ── Hueco conocido, a la vista a propósito ──────────────────────────────
   propiedad."propietarioId" NO tiene clave foránea, porque integridad.ts
   tampoco borra una propiedad cuando se borra su propietario. Queda igual
   que hoy para no cambiar en silencio qué pasa al borrar una persona.
   Es un problema de calidad de dato, no de seguridad: la política igual
   impide leer la persona de otra inmobiliaria.                            */
select afirmar(
  'propiedad."propietarioId" sigue sin clave foránea, como en la app de hoy',
  (select count(*) from pg_constraint
    where conrelid = 'propiedad'::regclass and contype = 'f'
      and conkey @> array[(select attnum from pg_attribute
                           where attrelid = 'propiedad'::regclass
                             and attname = 'propietarioId')]) = 0);

/* ── Sin sesión no se ve nada ── */
set request.jwt.claims = '';
select afirmar('sin sesión no se ve ninguna persona', (select count(*) from persona) = 0);

reset role;

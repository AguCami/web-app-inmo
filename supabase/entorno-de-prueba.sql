-- Solo para probar el esquema en un Postgres pelado. En Supabase nada de
-- esto hace falta: el esquema auth, el rol authenticated y los permisos ya
-- vienen puestos. Acá se remedan para que supabase/esquema.sql corra igual.
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key, email text);

-- Supabase la define así: lee el "sub" del JWT que manda PostgREST.
create or replace function auth.uid() returns uuid
language sql stable as $$
  select (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid
$$;

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
end $$;
grant usage on schema public, auth to authenticated;

-- Storage, reducido a lo que miran las políticas del bucket de adjuntos.
create schema if not exists storage;
create table if not exists storage.buckets (
  id text primary key, name text not null, public boolean default false,
  file_size_limit bigint
);
create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name text not null,
  unique (bucket_id, name)
);
alter table storage.objects enable row level security;

-- Igual que la de Supabase: las carpetas de la ruta, sin el nombre final.
create or replace function storage.foldername(name text) returns text[]
language sql immutable as $$
  select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
$$;

grant usage on schema storage to authenticated;
grant select, insert, update, delete on storage.objects to authenticated;
grant select on storage.buckets to authenticated;
grant execute on function storage.foldername(text) to authenticated;

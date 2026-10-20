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
end $$;
grant usage on schema public, auth to authenticated;

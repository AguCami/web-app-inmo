-- Se corre después del esquema: en Supabase esto lo hace la plataforma.
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on all functions in schema public to authenticated;

-- Se corre después del esquema. Ya no da permisos sobre las tablas: eso lo
-- hace supabase/esquema.sql, para no depender de "Automatically expose new
-- tables". Queda el archivo para lo que en Supabase pone la plataforma.
select 1;

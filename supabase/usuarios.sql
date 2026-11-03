-- ============================================================================
--  Alta de la inmobiliaria y de sus usuarios.
--  Se corre UNA vez, después de supabase/esquema.sql.
--
--  Las contraseñas NO van acá. Los usuarios se crean en el panel de Supabase
--  (Authentication → Users → Add user), que es lo único que las guarda
--  hasheadas como corresponde. Este archivo solo los ata a la inmobiliaria.
--  Nunca escribas una contraseña en un archivo del repositorio.
-- ============================================================================

/* ── 1. La inmobiliaria ── */

insert into organizacion (nombre)
values ('Inversiones Generales M & M')
on conflict do nothing;

/* ── 2. Los usuarios ──
   Antes de correr esto, en Authentication → Users → Add user:
     · Email: el de cada persona. Supabase Auth identifica por email, no por
       nombre de usuario. Si no tienen casilla propia, sirve una del dominio
       de la inmobiliaria (nombre@inversionesgeneralesmym.com.ar).
     · Marcar "Auto Confirm User" para que no tengan que confirmar el mail.
     · Contraseña: distinta para cada uno. Ver la nota al pie.

   Después, por cada uno, completar el email acá abajo y correr.           */

insert into miembro (organizacion_id, usuario_id, rol)
select o.id, u.id, v.rol
from organizacion o
cross join (values
  -- (email de la persona, rol)
  ('reemplazar-1@inversionesgeneralesmym.com.ar', 'dueño'),
  ('reemplazar-2@inversionesgeneralesmym.com.ar', 'operador'),
  ('reemplazar-3@inversionesgeneralesmym.com.ar', 'operador')
) as v(email, rol)
join auth.users u on lower(u.email) = lower(v.email)
where o.nombre = 'Inversiones Generales M & M'
on conflict (organizacion_id, usuario_id) do update set rol = excluded.rol;

/* ── 3. Comprobar que quedó bien ──
   Tiene que devolver una fila por persona. Si devuelve menos, es que algún
   email no coincide con el que se cargó en Authentication → Users.         */

select u.email, m.rol, o.nombre as inmobiliaria
from miembro m
join auth.users u on u.id = m.usuario_id
join organizacion o on o.id = m.organizacion_id
order by u.email;

-- ─────────────────────────────────────────────────────────────────────────
--  Sobre las contraseñas
--
--  Que las tres personas compartan la misma, y que sea una de las más usadas
--  del mundo, es el agujero más grande del sistema: ni las políticas por
--  fila ni el login sirven de nada si la contraseña se adivina en el primer
--  intento. Además, si las tres son iguales, no se puede saber quién hizo
--  qué.
--
--  En Authentication → Policies conviene subir el mínimo a 12 caracteres.
--  El rechazo de contraseñas filtradas (HaveIBeenPwned) existe, pero es del
--  plan Pro.
-- ─────────────────────────────────────────────────────────────────────────

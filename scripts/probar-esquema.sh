#!/usr/bin/env bash
# Prueba supabase/esquema.sql contra un Postgres de verdad: levanta uno
# efímero, aplica el esquema y corre las afirmaciones de supabase/pruebas.sql.
#
#   ./scripts/probar-esquema.sh
#
# No toca Supabase ni necesita red. Requiere los binarios de PostgreSQL.
set -euo pipefail

BIN=${PG_BIN:-/usr/lib/postgresql/16/bin}
DATOS=${PG_DATOS:-/tmp/pgdata-esquema}
PUERTO=${PG_PUERTO:-55432}
RAIZ="$(cd "$(dirname "$0")/.." && pwd)"

psql_() { psql -h /tmp -p "$PUERTO" -U postgres -v ON_ERROR_STOP=1 "$@"; }

if ! psql -h /tmp -p "$PUERTO" -U postgres -c 'select 1' >/dev/null 2>&1; then
  echo "Levantando Postgres en $DATOS…"
  rm -rf "$DATOS"; mkdir -p "$DATOS"; chown postgres:postgres "$DATOS"
  su postgres -c "$BIN/initdb -D $DATOS -U postgres --auth=trust" >/dev/null
  su postgres -c "$BIN/pg_ctl -D $DATOS -o '-p $PUERTO -k /tmp' -l /tmp/pg-esquema.log start" >/dev/null
  until psql -h /tmp -p "$PUERTO" -U postgres -c 'select 1' >/dev/null 2>&1; do sleep 1; done
fi

# Siempre desde cero: una prueba que depende de lo que quedó no prueba nada.
psql_ -q -c 'drop schema public cascade; create schema public; drop schema if exists auth cascade;' >/dev/null
psql_ -q -f "$RAIZ/supabase/entorno-de-prueba.sql"   >/dev/null 2>&1
psql_ -q -f "$RAIZ/supabase/esquema.sql"             >/dev/null 2>&1
psql_ -q -f "$RAIZ/supabase/permisos-de-prueba.sql"  >/dev/null 2>&1

salida=$(psql_ -f "$RAIZ/supabase/pruebas.sql" 2>&1)
echo "$salida" | grep -E '✓|✗' | sed 's/^psql:[^ ]* //; s/^NOTICE:  //'

if echo "$salida" | grep -qE '✗|ERROR'; then
  echo; echo "Hay verificaciones que fallaron."; exit 1
fi
echo; echo "Esquema en orden."

#!/usr/bin/env bash
set -euo pipefail

if (( $# != 0 )); then
  printf 'Usage: set PGHOST, PGPORT, PGDATABASE and PGUSER; pass no arguments.\n' >&2
  exit 64
fi

: "${PGHOST:?Set PGHOST to 127.0.0.1 after opening the SSH tunnel}"
: "${PGPORT:=15432}"
: "${PGDATABASE:?Set PGDATABASE to the read-only source database}"
: "${PGUSER:?Set PGUSER to the dedicated dashboard reader role}"

if [[ "${PGHOST}" != '127.0.0.1' ]]; then
  printf 'Refusing a non-loopback PGHOST; open the SSH tunnel first.\n' >&2
  exit 64
fi

if [[ -n "${PGHOSTADDR:-}" || -n "${PGSERVICE:-}" || -n "${PGSERVICEFILE:-}" ]]; then
  printf 'PGHOSTADDR, PGSERVICE, and PGSERVICEFILE must be unset to prevent connection overrides.\n' >&2
  exit 64
fi

if [[ ! "${PGDATABASE}" =~ ^[A-Za-z_][A-Za-z0-9_.-]*$ ]]; then
  printf 'PGDATABASE must be a plain database name, not a URI or conninfo string.\n' >&2
  exit 64
fi

if [[ ! "${PGUSER}" =~ ^[A-Za-z_][A-Za-z0-9_.-]*$ ]]; then
  printf 'PGUSER contains unsupported characters.\n' >&2
  exit 64
fi

if [[ ! "${PGPORT}" =~ ^[0-9]+$ ]] ||
  (( PGPORT < 1024 || PGPORT > 65535 )); then
  printf 'PGPORT must be an integer from 1024 through 65535.\n' >&2
  exit 64
fi

command -v psql >/dev/null 2>&1 || {
  printf 'psql is required to verify the read-only role.\n' >&2
  exit 69
}

readonly_sql=$(cat <<'SQL'
select concat_ws('|',
  current_setting('transaction_read_only'),
  coalesce(
    'default_transaction_read_only=on' = any(r.rolconfig),
    false
  )::text,
  r.rolinherit::text,
  r.rolsuper::text,
  r.rolcreatedb::text,
  r.rolcreaterole::text,
  r.rolreplication::text,
  r.rolbypassrls::text,
  has_database_privilege(current_user, current_database(), 'CREATE')::text,
  has_database_privilege(current_user, current_database(), 'TEMP')::text,
  (
    select count(*)::text
      from information_schema.tables t
     where t.table_schema not in ('pg_catalog', 'information_schema')
       and (
         has_table_privilege(current_user, quote_ident(t.table_schema) || '.' || quote_ident(t.table_name), 'INSERT')
         or has_table_privilege(current_user, quote_ident(t.table_schema) || '.' || quote_ident(t.table_name), 'UPDATE')
         or has_table_privilege(current_user, quote_ident(t.table_schema) || '.' || quote_ident(t.table_name), 'DELETE')
         or has_table_privilege(current_user, quote_ident(t.table_schema) || '.' || quote_ident(t.table_name), 'TRUNCATE')
         or has_table_privilege(current_user, quote_ident(t.table_schema) || '.' || quote_ident(t.table_name), 'REFERENCES')
         or has_table_privilege(current_user, quote_ident(t.table_schema) || '.' || quote_ident(t.table_name), 'TRIGGER')
       )
  ),
  (
    select count(*)::text
      from information_schema.schemata s
     where s.schema_name <> 'information_schema'
       and s.schema_name !~ '^pg_'
       and has_schema_privilege(current_user, quote_ident(s.schema_name), 'CREATE')
  ),
  (
    select count(*)::text
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where c.relkind = 'S'
       and n.nspname <> 'information_schema'
       and n.nspname !~ '^pg_'
       and (
         has_sequence_privilege(current_user, c.oid, 'SELECT')
         or has_sequence_privilege(current_user, c.oid, 'USAGE')
         or has_sequence_privilege(current_user, c.oid, 'UPDATE')
       )
  ),
  (
    select count(*)::text
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname <> 'information_schema'
       and n.nspname !~ '^pg_'
       and has_function_privilege(current_user, p.oid, 'EXECUTE')
  ),
  (
    select count(*)::text
      from pg_auth_members m
     where m.member = r.oid
  )
)
from pg_roles r
where r.rolname = current_user;
SQL
)

result="$({
  PGAPPNAME='shuanglong-readonly-preflight' \
  PGCONNECT_TIMEOUT=5 \
  PGOPTIONS='-c default_transaction_read_only=on' \
    psql --no-psqlrc --set ON_ERROR_STOP=1 --tuples-only --no-align \
      --command "${readonly_sql}"
} | tr -d '[:space:]')"

IFS='|' read -r transaction_ro default_ro inherits_roles superuser create_db \
  create_role replication bypass_rls database_create database_temp \
  writable_relations writable_schemas usable_sequences executable_functions \
  role_memberships extra_result <<<"${result}"

if [[ -n "${extra_result}" ]]; then
  printf 'FAIL: PostgreSQL verification returned an unexpected result shape.\n' >&2
  exit 1
fi

if [[ "${transaction_ro}" != 'on' || "${default_ro}" != 'on' ]]; then
  printf 'FAIL: the current and default PostgreSQL transaction modes must both be read-only.\n' >&2
  exit 1
fi

if [[ "${inherits_roles}" != 'f' ]]; then
  printf 'FAIL: the reader role must use NOINHERIT.\n' >&2
  exit 1
fi

if [[ "${superuser}" != 'f' || "${create_db}" != 'f' || "${create_role}" != 'f' ||
  "${replication}" != 'f' || "${bypass_rls}" != 'f' ]]; then
  printf 'FAIL: the reader has a prohibited PostgreSQL role attribute.\n' >&2
  exit 1
fi

if [[ "${database_create}" != 'f' || "${database_temp}" != 'f' ]]; then
  printf 'FAIL: the reader must not have CREATE or TEMP privilege on the database.\n' >&2
  exit 1
fi

if [[ ! "${writable_relations}" =~ ^[0-9]+$ ]] || (( writable_relations != 0 )); then
  printf 'FAIL: the reader has an effective write privilege on a table or view.\n' >&2
  exit 1
fi

if [[ ! "${writable_schemas}" =~ ^[0-9]+$ ]] || (( writable_schemas != 0 )); then
  printf 'FAIL: the reader has effective CREATE privilege on a user schema.\n' >&2
  exit 1
fi

if [[ ! "${usable_sequences}" =~ ^[0-9]+$ ]] || (( usable_sequences != 0 )); then
  printf 'FAIL: the reader has an effective privilege on a user sequence.\n' >&2
  exit 1
fi

if [[ ! "${executable_functions}" =~ ^[0-9]+$ ]] || (( executable_functions != 0 )); then
  printf 'FAIL: the reader can execute a user-defined function.\n' >&2
  exit 1
fi

if [[ ! "${role_memberships}" =~ ^[0-9]+$ ]] || (( role_memberships != 0 )); then
  printf 'FAIL: the reader belongs to another role and could use SET ROLE.\n' >&2
  exit 1
fi

printf 'PASS: PostgreSQL session and role are read-only\n'

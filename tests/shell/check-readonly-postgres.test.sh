#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
script_path="${repo_root}/scripts/check-readonly-postgres.sh"
test_tmp="$(mktemp -d)"
trap 'rm -rf "${test_tmp}"' EXIT

fail() {
  printf 'FAIL: %s\n' "$1" >&2
  exit 1
}

assert_fails() {
  local description="$1"
  shift
  if "$@" >"${test_tmp}/stdout" 2>"${test_tmp}/stderr"; then
    fail "${description}"
  fi
}

assert_fails_with() {
  local description="$1"
  local expected="$2"
  shift 2
  assert_fails "${description}" "$@"
  grep -Fq "${expected}" "${test_tmp}/stderr" || \
    fail "${description}: unexpected error message"
}

bash -n "${script_path}"

assert_fails_with "non-loopback database hosts must be rejected" 'Refusing a non-loopback PGHOST' \
  env PGHOST=database.example.com PGDATABASE=wecom_chat PGUSER=dashboard_reader \
  bash "${script_path}"

assert_fails_with "localhost must be rejected because the tunnel binds IPv4 loopback only" 'Refusing a non-loopback PGHOST' \
  env PGHOST=localhost PGDATABASE=wecom_chat PGUSER=dashboard_reader \
  bash "${script_path}"

assert_fails_with "PGHOSTADDR must not bypass the loopback host" 'must be unset' \
  env PGHOST=127.0.0.1 PGHOSTADDR=203.0.113.10 PGDATABASE=wecom_chat \
  PGUSER=dashboard_reader bash "${script_path}"

assert_fails_with "database connection URIs must be rejected" 'plain database name' \
  env PGHOST=127.0.0.1 PGDATABASE='postgresql://database.example.com/wecom_chat' \
  PGUSER=dashboard_reader bash "${script_path}"

assert_fails_with "libpq service overrides must be rejected" 'must be unset' \
  env PGHOST=127.0.0.1 PGSERVICE=production PGDATABASE=wecom_chat \
  PGUSER=dashboard_reader bash "${script_path}"

mkdir -p "${test_tmp}/bin"
cat >"${test_tmp}/bin/psql" <<'EOF'
#!/usr/bin/env bash
{
  printf 'PGHOST=%s\n' "${PGHOST-}"
  printf 'PGPORT=%s\n' "${PGPORT-}"
  printf 'PGDATABASE=%s\n' "${PGDATABASE-}"
  printf 'PGUSER=%s\n' "${PGUSER-}"
  printf 'PGOPTIONS=%s\n' "${PGOPTIONS-}"
  printf 'PGAPPNAME=%s\n' "${PGAPPNAME-}"
  printf 'ARG=%s\n' "$@"
} >"${PSQL_CAPTURE_FILE:?}"
printf '%s\n' "${FAKE_PSQL_RESULT:?}"
EOF
chmod +x "${test_tmp}/bin/psql"

common_env=(
  "PATH=${test_tmp}/bin:${PATH}"
  'PGHOST=127.0.0.1'
  'PGPORT=15432'
  'PGDATABASE=wecom_chat'
  'PGUSER=dashboard_reader'
)

capture_file="${test_tmp}/psql-capture"
env -u PGHOSTADDR -u PGSERVICE -u PGSERVICEFILE \
  "${common_env[@]}" PSQL_CAPTURE_FILE="${capture_file}" \
  FAKE_PSQL_RESULT='on|on|f|f|f|f|f|f|f|f|0|0|0|0|0' \
  bash "${script_path}" >"${test_tmp}/success"
grep -Fq 'PASS: PostgreSQL session and role are read-only' "${test_tmp}/success" || \
  fail "a least-privilege read-only role must pass"
grep -Fxq 'PGHOST=127.0.0.1' "${capture_file}" || fail "psql must use the loopback host"
grep -Fxq 'PGOPTIONS=-c default_transaction_read_only=on' "${capture_file}" || \
  fail "psql must force read-only transactions"
grep -Fxq 'PGAPPNAME=shuanglong-readonly-preflight' "${capture_file}" || \
  fail "psql must identify the preflight session"
grep -Fxq 'ARG=--no-psqlrc' "${capture_file}" || fail "psql must ignore user startup files"
grep -Fq 'pg_auth_members' "${capture_file}" || fail "the query must inspect role memberships"
grep -Fq 'has_sequence_privilege' "${capture_file}" || fail "the query must inspect sequence privileges"
grep -Fq 'has_function_privilege' "${capture_file}" || fail "the query must inspect function privileges"

assert_fails "a role with CREATE privilege must be rejected" \
  env "${common_env[@]}" PSQL_CAPTURE_FILE="${capture_file}" \
  FAKE_PSQL_RESULT='on|on|f|f|f|f|f|f|t|f|0|0|0|0|0' \
  bash "${script_path}"

assert_fails "a writable transaction must be rejected" \
  env "${common_env[@]}" PSQL_CAPTURE_FILE="${capture_file}" \
  FAKE_PSQL_RESULT='off|on|f|f|f|f|f|f|f|f|0|0|0|0|0' \
  bash "${script_path}"

assert_fails "non-SELECT table grants must be rejected" \
  env "${common_env[@]}" PSQL_CAPTURE_FILE="${capture_file}" \
  FAKE_PSQL_RESULT='on|on|f|f|f|f|f|f|f|f|1|0|0|0|0' \
  bash "${script_path}"

assert_fails "effective schema CREATE privilege must be rejected" \
  env "${common_env[@]}" PSQL_CAPTURE_FILE="${capture_file}" \
  FAKE_PSQL_RESULT='on|on|f|f|f|f|f|f|f|f|0|1|0|0|0' \
  bash "${script_path}"

assert_fails "effective sequence privileges must be rejected" \
  env "${common_env[@]}" PSQL_CAPTURE_FILE="${capture_file}" \
  FAKE_PSQL_RESULT='on|on|f|f|f|f|f|f|f|f|0|0|1|0|0' \
  bash "${script_path}"

assert_fails "effective user-function EXECUTE must be rejected" \
  env "${common_env[@]}" PSQL_CAPTURE_FILE="${capture_file}" \
  FAKE_PSQL_RESULT='on|on|f|f|f|f|f|f|f|f|0|0|0|1|0' \
  bash "${script_path}"

assert_fails "role memberships that permit SET ROLE must be rejected" \
  env "${common_env[@]}" PSQL_CAPTURE_FILE="${capture_file}" \
  FAKE_PSQL_RESULT='on|on|f|f|f|f|f|f|f|f|0|0|0|0|1' \
  bash "${script_path}"

assert_fails "roles with INHERIT must be rejected" \
  env "${common_env[@]}" PSQL_CAPTURE_FILE="${capture_file}" \
  FAKE_PSQL_RESULT='on|on|t|f|f|f|f|f|f|f|0|0|0|0|0' \
  bash "${script_path}"

assert_fails "malformed verification output must be rejected" \
  env "${common_env[@]}" PSQL_CAPTURE_FILE="${capture_file}" \
  FAKE_PSQL_RESULT='unexpected-output' \
  bash "${script_path}"

printf 'PASS: PostgreSQL read-only verification checks\n'

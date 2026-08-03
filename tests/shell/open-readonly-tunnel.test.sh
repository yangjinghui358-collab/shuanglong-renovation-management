#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
script_path="${repo_root}/scripts/open-readonly-tunnel.sh"
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

assert_fails_with "missing SSH_HOST must be rejected" 'SSH_HOST' \
  env -i PATH="${PATH}" SSH_USER=dashboard-tunnel bash "${script_path}"

assert_fails_with "missing SSH_USER must be rejected" 'SSH_USER' \
  env -i PATH="${PATH}" SSH_HOST=db-jump.example.com bash "${script_path}"

assert_fails_with "positional password arguments must be rejected" 'Usage:' \
  env SSH_HOST=db-jump.example.com SSH_USER=dashboard-tunnel \
  bash "${script_path}" plaintext-password

assert_fails_with "non-numeric local ports must be rejected" 'LOCAL_DB_PORT must' \
  env SSH_HOST=db-jump.example.com SSH_USER=dashboard-tunnel LOCAL_DB_PORT=not-a-port \
  bash "${script_path}"

assert_fails_with "option-like SSH users must be rejected" 'SSH_USER contains' \
  env SSH_HOST=db-jump.example.com SSH_USER=-oProxyCommand=unexpected \
  bash "${script_path}"

assert_fails_with "SSH hosts containing whitespace must be rejected" 'SSH_HOST must' \
  env SSH_HOST='db-jump.example.com unexpected' SSH_USER=dashboard-tunnel \
  bash "${script_path}"

mkdir -p "${test_tmp}/bin"
cat >"${test_tmp}/bin/ssh" <<'EOF'
#!/usr/bin/env bash
printf '%s\n' "$@" >"${SSH_CAPTURE_FILE:?}"
EOF
chmod +x "${test_tmp}/bin/ssh"

capture_file="${test_tmp}/ssh-arguments"
env PATH="${test_tmp}/bin:${PATH}" \
  SSH_CAPTURE_FILE="${capture_file}" \
  SSH_HOST=db-jump.example.com \
  SSH_USER=dashboard-tunnel \
  LOCAL_DB_PORT=15432 \
  bash "${script_path}"

grep -Fxq 'BatchMode=yes' "${capture_file}" || fail "SSH must forbid password prompts"
grep -Fxq 'ExitOnForwardFailure=yes' "${capture_file}" || fail "SSH must fail when forwarding cannot open"
grep -Fxq '127.0.0.1:15432:127.0.0.1:5432' "${capture_file}" || \
  fail "forwarding must bind locally and target server loopback only"
grep -Fxq 'dashboard-tunnel@db-jump.example.com' "${capture_file}" || \
  fail "SSH destination must come from SSH_USER and SSH_HOST"
grep -Fxq -- '--' "${capture_file}" || fail "SSH options must end before the destination"

printf 'PASS: readonly tunnel safety checks\n'

#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
nginx_config="${repo_root}/infra/nginx/admin.shuanglongzhuangshi.cn.conf.example"
api_server="${repo_root}/apps/api/src/server.ts"

fail() {
  printf 'FAIL: %s\n' "$1" >&2
  exit 1
}

api_port="$(sed -nE 's/.*process\.env\.PORT \?\? ([0-9]+).*/\1/p' "${api_server}")"
upstream_port="$(sed -nE 's/^[[:space:]]*server 127\.0\.0\.1:([0-9]+);/\1/p' "${nginx_config}")"

[[ -n "${api_port}" ]] || fail "API default port could not be determined"
[[ -n "${upstream_port}" ]] || fail "Nginx upstream port could not be determined"
[[ "${api_port}" == "${upstream_port}" ]] || \
  fail "Nginx upstream ${upstream_port} does not match API default ${api_port}"

printf 'PASS: Nginx upstream matches API default port\n'

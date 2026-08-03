#!/usr/bin/env bash
set -euo pipefail

env_file="${1:-/etc/wecom-chat-pipeline/secrets.env}"
if [[ ! -f "$env_file" ]]; then
  echo "找不到密钥文件: $env_file" >&2
  exit 1
fi

read -r -s -p "PushPlus Token（输入不回显）: " pushplus_token
printf '\n'
if [[ -z "$pushplus_token" ]]; then
  echo "Token 不能为空，未修改配置。" >&2
  exit 1
fi

tmp_file="$(mktemp)"
trap 'rm -f "$tmp_file"' EXIT
awk -F= '!/^(PUSHPLUS_TOKEN|PUSHPLUS_ENABLED)=/' "$env_file" > "$tmp_file"
{
  printf 'PUSHPLUS_TOKEN=%s\n' "$pushplus_token"
  printf 'PUSHPLUS_ENABLED=true\n'
} >> "$tmp_file"
install -m 0600 "$tmp_file" "$env_file"
unset pushplus_token
systemctl restart wecom-chat-pipeline.service
set -a
# shellcheck disable=SC1090
. "$env_file"
set +a
cd /opt/wecom-chat-pipeline
node src/cli.js push-test
echo "PushPlus 已启用，并已提交一条最新简报测试消息。"

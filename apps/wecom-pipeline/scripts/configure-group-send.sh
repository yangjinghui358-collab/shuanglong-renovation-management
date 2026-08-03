#!/usr/bin/env bash
set -euo pipefail

env_file="${1:-/etc/wecom-chat-pipeline/secrets.env}"
if [[ ! -f "$env_file" ]]; then
  echo "找不到密钥文件: $env_file" >&2
  exit 1
fi

read -r -p "企业 ID (CorpID): " corp_id
read -r -p "群主企业微信 userid: " sender_user_id
read -r -s -p "待办机器人应用 Secret（输入不回显）: " app_secret
printf '\n'

if [[ -z "$corp_id" || -z "$sender_user_id" || -z "$app_secret" ]]; then
  echo "三项均不能为空，未修改配置。" >&2
  exit 1
fi

tmp_file="$(mktemp)"
trap 'rm -f "$tmp_file"' EXIT
awk -F= '
  !/^(WECOM_CORP_ID|WECOM_SENDER_USER_ID|WECOM_APP_SECRET|WECOM_GROUP_SEND_ENABLED)=/
' "$env_file" > "$tmp_file"
{
  printf 'WECOM_CORP_ID=%s\n' "$corp_id"
  printf 'WECOM_SENDER_USER_ID=%s\n' "$sender_user_id"
  printf 'WECOM_APP_SECRET=%s\n' "$app_secret"
  printf 'WECOM_GROUP_SEND_ENABLED=false\n'
} >> "$tmp_file"
install -m 0600 "$tmp_file" "$env_file"
unset app_secret
echo "凭据已安全写入；群发开关仍为 false，完成测试前不会创建任务。"

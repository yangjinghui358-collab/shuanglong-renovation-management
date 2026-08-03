#!/usr/bin/env bash
set -euo pipefail

env_file=/etc/wecom-chat-pipeline/secrets.env
temp_file=/etc/wecom-chat-pipeline/secrets.env.new

umask 077
read -r -s -p '请输入飞书 App Secret（输入不显示）: ' app_secret
printf '\n'

if [[ -z "$app_secret" ]]; then
  echo 'App Secret 不能为空。' >&2
  exit 1
fi

while IFS= read -r line || [[ -n "$line" ]]; do
  case "$line" in
    FEISHU_APP_SECRET=*) ;;
    *) printf '%s\n' "$line" ;;
  esac
done < "$env_file" > "$temp_file"

printf 'FEISHU_APP_SECRET=%s\n' "$app_secret" >> "$temp_file"
unset app_secret
chmod 600 "$temp_file"
mv -f "$temp_file" "$env_file"
echo '飞书 App Secret 已安全保存。'

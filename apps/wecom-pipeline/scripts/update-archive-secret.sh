#!/usr/bin/env bash
set -euo pipefail

env_file=/etc/wecom-chat-pipeline/secrets.env
temp_file=/etc/wecom-chat-pipeline/secrets.env.new

umask 077
read -r -s -p '请输入新的企微会话存档 Secret（输入不显示）: ' archive_secret
printf '\n'

if [[ -z "$archive_secret" ]]; then
  echo 'Secret 不能为空。' >&2
  exit 1
fi

while IFS= read -r line || [[ -n "$line" ]]; do
  case "$line" in
    WECOM_ARCHIVE_SECRET=*) ;;
    *) printf '%s\n' "$line" ;;
  esac
done < "$env_file" > "$temp_file"

printf 'WECOM_ARCHIVE_SECRET=%s\n' "$archive_secret" >> "$temp_file"
unset archive_secret
chmod 600 "$temp_file"
mv -f "$temp_file" "$env_file"
systemctl restart wecom-chat-pipeline.service
echo 'Secret 已更新，采集服务已重启。'

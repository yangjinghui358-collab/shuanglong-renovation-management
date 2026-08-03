#!/usr/bin/env bash
set -euo pipefail

SECRET_FILE=${SECRET_FILE:-/etc/wecom-chat-pipeline/secrets.env}
umask 077

printf '请粘贴新的企微智能表格 Webhook（输入不回显），然后按回车：' >&2
IFS= read -r -s webhook_url
printf '\n' >&2

case "$webhook_url" in
  https://qyapi.weixin.qq.com/cgi-bin/wedoc/smartsheet/webhook?key=*) ;;
  *)
    printf '地址格式不正确，未保存。\n' >&2
    exit 2
    ;;
esac

temp_file=$(mktemp "${SECRET_FILE}.XXXXXX")
trap 'rm -f "$temp_file"' EXIT
awk '!/^WECOM_SMARTSHEET_WEBHOOK=/' "$SECRET_FILE" > "$temp_file"
printf 'WECOM_SMARTSHEET_WEBHOOK=%s\n' "$webhook_url" >> "$temp_file"
chmod 600 "$temp_file"
chown root:root "$temp_file"
mv "$temp_file" "$SECRET_FILE"
trap - EXIT
unset webhook_url
printf '已安全保存。\n' >&2

#!/usr/bin/env bash
set -euo pipefail

SECRET_FILE=${SECRET_FILE:-/etc/wecom-chat-pipeline/secrets.env}
umask 077

declare -A values
read_webhook() {
  local key=$1
  local label=$2
  local value
  printf '请粘贴“%s”的 Webhook（输入不回显），然后按回车：' "$label" >&2
  IFS= read -r -s value
  printf '\n' >&2
  case "$value" in
    https://qyapi.weixin.qq.com/cgi-bin/wedoc/smartsheet/webhook?key=*) ;;
    *) printf '“%s”地址格式不正确，所有配置均未修改。\n' "$label" >&2; exit 2 ;;
  esac
  values[$key]=$value
}

read_webhook WECOM_SMARTSHEET_EVENTS_WEBHOOK '项目事件'
read_webhook WECOM_SMARTSHEET_RISKS_WEBHOOK '风险异常'
read_webhook WECOM_SMARTSHEET_DIGESTS_WEBHOOK '老板简报'

temp_file=$(mktemp "${SECRET_FILE}.XXXXXX")
trap 'rm -f "$temp_file"' EXIT
awk '!/^WECOM_SMARTSHEET_EVENTS_WEBHOOK=/ && !/^WECOM_SMARTSHEET_RISKS_WEBHOOK=/ && !/^WECOM_SMARTSHEET_DIGESTS_WEBHOOK=/' "$SECRET_FILE" > "$temp_file"
for key in WECOM_SMARTSHEET_EVENTS_WEBHOOK WECOM_SMARTSHEET_RISKS_WEBHOOK WECOM_SMARTSHEET_DIGESTS_WEBHOOK; do
  printf '%s=%s\n' "$key" "${values[$key]}" >> "$temp_file"
done
chmod 600 "$temp_file"
chown root:root "$temp_file"
mv "$temp_file" "$SECRET_FILE"
trap - EXIT
unset values
printf '三个 Webhook 已安全保存。\n' >&2

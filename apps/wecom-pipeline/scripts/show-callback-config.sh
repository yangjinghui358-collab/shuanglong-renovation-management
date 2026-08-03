#!/usr/bin/env bash
set -euo pipefail
env_file="${1:-/etc/wecom-chat-pipeline/secrets.env}"
echo "URL: http://182.92.114.58/wecom/callback"
sed -n 's/^WECOM_CALLBACK_TOKEN=/Token: /p; s/^WECOM_CALLBACK_AES_KEY=/EncodingAESKey: /p' "$env_file"

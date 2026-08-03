#!/usr/bin/env bash
set -euo pipefail

env_file="${1:-/etc/wecom-chat-pipeline/secrets.env}"
if [[ ! -f "$env_file" ]]; then
  echo "找不到密钥文件: $env_file" >&2
  exit 1
fi

api_base_url="https://ws-gl9p890pejsy6qlp.cn-beijing.maas.aliyuncs.com/compatible-mode/v1"

echo "API Host 已预配置，无需粘贴网址。"
read -r -s -p "现在请粘贴新的阿里云百炼 API Key（输入不回显）: " api_key
printf '\n'
if [[ -z "$api_key" ]]; then
  echo "API Key 不能为空，未修改配置。" >&2
  exit 1
fi

echo "正在验证 API Key，验证成功前不会修改生产配置……"
AI_TEST_BASE_URL="$api_base_url" AI_TEST_API_KEY="$api_key" node --input-type=module -e '
  const response = await fetch(process.env.AI_TEST_BASE_URL + "/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${process.env.AI_TEST_API_KEY}` },
    body: JSON.stringify({
      model: "qwen-plus",
      temperature: 0,
      max_tokens: 8,
      messages: [{ role: "user", content: "只回答OK" }]
    })
  })
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    console.error(`API Key 验证失败：HTTP ${response.status}，${body?.error?.code || body?.error?.message || "未知错误"}`)
    process.exit(1)
  }
  console.log("API Key 验证成功。")
'

tmp_file="$(mktemp)"
trap 'rm -f "$tmp_file"' EXIT
awk -F= '!/^(AI_BASE_URL|AI_API_KEY|AI_MODEL)=/' "$env_file" > "$tmp_file"
{
  printf 'AI_BASE_URL=%s\n' "$api_base_url"
  printf 'AI_API_KEY=%s\n' "$api_key"
  printf 'AI_MODEL=qwen-plus\n'
} >> "$tmp_file"
install -m 0600 "$tmp_file" "$env_file"
unset api_key
unset api_base_url
systemctl restart wecom-chat-pipeline.service

set -a
# shellcheck disable=SC1090
. "$env_file"
set +a
cd /opt/wecom-chat-pipeline
node src/cli.js ai-test
echo "千问已启用，并已提交一条 AI 分析测试简报。"

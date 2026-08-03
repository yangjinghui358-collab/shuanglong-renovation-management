#!/usr/bin/env bash
set -euo pipefail

env_file="/etc/wecom-chat-pipeline/secrets.env"
api_base_url="https://token-plan-cn.xiaomimimo.com/v1"

if [[ ! -f "$env_file" ]]; then
  echo "找不到服务器密钥文件: $env_file" >&2
  exit 1
fi

read -r -s -p "请粘贴小米 MiMo API Key（输入不会显示）: " api_key
printf '\n'
if [[ -z "$api_key" ]]; then
  echo "API Key 不能为空，未修改任何配置。" >&2
  exit 1
fi

echo "正在验证 Key 并读取可用模型……"
models_json="$(AI_TEST_BASE_URL="$api_base_url" AI_TEST_API_KEY="$api_key" node --input-type=module -e '
  const response = await fetch(process.env.AI_TEST_BASE_URL + "/models", {
    headers: { authorization: `Bearer ${process.env.AI_TEST_API_KEY}` }
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    console.error(`API Key 验证失败：HTTP ${response.status}，${body?.error?.message || "未知错误"}`)
    process.exit(1)
  }
  const ids = (Array.isArray(body.data) ? body.data : []).map(item => item.id).filter(Boolean)
  if (!ids.length) {
    console.error("Key 有效，但接口没有返回可用模型。")
    process.exit(1)
  }
  process.stdout.write(JSON.stringify(ids))
')"

echo "可用模型："
MODELS_JSON="$models_json" node --input-type=module -e '
  JSON.parse(process.env.MODELS_JSON).forEach((id, index) => console.log(`  ${index + 1}. ${id}`))
'
default_model="$(MODELS_JSON="$models_json" node --input-type=module -e 'process.stdout.write(JSON.parse(process.env.MODELS_JSON)[0])')"
read -r -p "请输入模型名称（直接回车使用 ${default_model}）: " selected_model
selected_model="${selected_model:-$default_model}"

MODELS_JSON="$models_json" SELECTED_MODEL="$selected_model" node --input-type=module -e '
  const models = JSON.parse(process.env.MODELS_JSON)
  if (!models.includes(process.env.SELECTED_MODEL)) {
    console.error("输入的模型不在可用列表中。")
    process.exit(1)
  }
'

echo "正在验证模型对话接口……"
AI_TEST_BASE_URL="$api_base_url" AI_TEST_API_KEY="$api_key" AI_TEST_MODEL="$selected_model" node --input-type=module -e '
  const response = await fetch(process.env.AI_TEST_BASE_URL + "/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${process.env.AI_TEST_API_KEY}` },
    body: JSON.stringify({
      model: process.env.AI_TEST_MODEL,
      temperature: 0,
      max_tokens: 16,
      messages: [{ role: "user", content: "只回答OK" }]
    })
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    console.error(`模型验证失败：HTTP ${response.status}，${body?.error?.message || "未知错误"}`)
    process.exit(1)
  }
  console.log("模型接口验证成功。")
'

tmp_file="$(mktemp)"
trap 'rm -f "$tmp_file"; unset api_key' EXIT
awk -F= '!/^(AI_BASE_URL|AI_API_KEY|AI_MODEL|AGENT_KEY)=/' "$env_file" > "$tmp_file"
{
  printf 'AI_BASE_URL=%s\n' "$api_base_url"
  printf 'AI_API_KEY=%s\n' "$api_key"
  printf 'AI_MODEL=%s\n' "$selected_model"
  printf 'AGENT_KEY=project_manager\n'
} >> "$tmp_file"
install -m 0600 "$tmp_file" "$env_file"

systemctl restart wecom-chat-pipeline.service
cd /opt/wecom-chat-pipeline
set -a
# shellcheck disable=SC1090
. "$env_file"
set +a
node src/cli.js agent-test
echo "配置完成：Agent 已连接 ${selected_model}。"

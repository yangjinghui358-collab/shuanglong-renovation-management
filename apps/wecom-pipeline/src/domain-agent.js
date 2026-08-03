export async function getAgentStatus(db, config) {
  const [profile, terms, drafts, feedback, prompt] = await Promise.all([
    db.query('SELECT agent_key,name,description,status,settings,updated_at FROM agent_profiles WHERE agent_key=$1', [config.agentKey]),
    db.query('SELECT COUNT(*)::int AS count FROM industry_terms WHERE enabled=TRUE'),
    db.query(`SELECT status,COUNT(*)::int AS count FROM ai_drafts GROUP BY status ORDER BY status`),
    db.query('SELECT COUNT(*)::int AS count FROM agent_feedback'),
    db.query(`SELECT prompt_id,version,status,created_at FROM prompt_versions
      WHERE agent_key=$1 AND status='active' ORDER BY version DESC LIMIT 1`, [config.agentKey])
  ])
  return {
    agent: profile.rows[0] || null,
    ai: {
      configured: Boolean(config.aiBaseUrl && config.aiApiKey && config.aiModel),
      base_url: redactUrl(config.aiBaseUrl),
      model: config.aiModel || '',
      api_key_present: Boolean(config.aiApiKey)
    },
    knowledge: { enabled_terms: terms.rows[0].count, feedback: feedback.rows[0].count },
    drafts: Object.fromEntries(drafts.rows.map(item => [item.status, item.count])),
    active_prompt: prompt.rows[0] || null
  }
}

export async function testAiConnection(db, config, fetchImpl = fetch) {
  if (!config.aiBaseUrl || !config.aiApiKey || !config.aiModel) {
    throw new Error('AI 尚未配置：需要 AI_BASE_URL、AI_API_KEY 和 AI_MODEL')
  }
  const startedAt = Date.now()
  let status = 'failed'
  let errorCode = ''
  let errorMessage = ''
  let usage = {}
  try {
    const response = await fetchImpl(config.aiBaseUrl.replace(/\/$/, '') + '/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${config.aiApiKey}` },
      body: JSON.stringify({
        model: config.aiModel,
        temperature: 0,
        max_tokens: 40,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: '你是装修行业项目管理 Agent。只输出 JSON。' },
          { role: 'user', content: '输出 {"ok":true,"capability":"装修项目聊天结构化"}' }
        ]
      })
    })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) {
      errorCode = String(body?.error?.code || response.status)
      errorMessage = String(body?.error?.message || `HTTP ${response.status}`)
      throw new Error(errorMessage)
    }
    const content = body.choices?.[0]?.message?.content || ''
    const parsed = JSON.parse(content)
    usage = body.usage || {}
    status = 'success'
    return { ok: true, model: config.aiModel, response: parsed, latency_ms: Date.now() - startedAt }
  } catch (error) {
    errorMessage ||= error.message
    throw error
  } finally {
    await db.query(`INSERT INTO ai_api_calls
      (agent_key,provider,model,purpose,status,input_message_count,prompt_tokens,completion_tokens,latency_ms,error_code,error_message)
      VALUES($1,$2,$3,'connection_test',$4,1,$5,$6,$7,$8,$9)`, [
      config.agentKey, providerName(config.aiBaseUrl), config.aiModel, status,
      numberOrNull(usage.prompt_tokens), numberOrNull(usage.completion_tokens), Date.now() - startedAt,
      errorCode, errorMessage.slice(0, 500)
    ])
  }
}

function redactUrl(value) {
  if (!value) return ''
  try {
    const url = new URL(value)
    return `${url.protocol}//${url.host}${url.pathname}`
  } catch {
    return ''
  }
}

function providerName(value) {
  if (/aliyuncs\.com/i.test(value)) return 'aliyun-bailian'
  if (/openai\.com/i.test(value)) return 'openai'
  return 'openai-compatible'
}

function numberOrNull(value) {
  return Number.isFinite(Number(value)) ? Number(value) : null
}

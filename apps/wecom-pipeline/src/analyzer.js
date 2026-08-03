const TODO_PATTERN = /(请|需要|负责|截止|完成|确认|跟进|提交|汇总|安排|执行|访谈|录入|梳理|整理|准备|集合|带上|明天|后天)/
const QUESTION_PATTERN = /(待确认|还需要|是否|能否|有没有|多少|哪些|什么|怎么|啥|方便吗|有啥需求|上午.*还是下午|[？?])/

export async function analyzeMessages(messages, config) {
  if (config.aiBaseUrl && config.aiApiKey && config.aiModel) {
    return analyzeWithModel(messages, config)
  }
  return analyzeLocally(messages)
}

function analyzeLocally(messages) {
  const textMessages = messages.filter(item => item.msg_type === 'text' && item.content.trim())
  const meaningful = textMessages.filter(item => isMeaningful(item.content))
  const todos = meaningful.filter(item => isActionable(item.content) && !isPureQuestion(item.content)).map(item => ({
    source_msg_id: item.msg_id,
    title: item.content.slice(0, 120),
    owner: extractOwner(item),
    due_date: extractDueDate(item.content),
    confidence: 0.55
  }))
  const questions = meaningful.filter(item => QUESTION_PATTERN.test(item.content)).map(item => item.content.slice(0, 160)).slice(0, 5)
  const highlights = selectHighlights(meaningful)
  return {
    summary: meaningful.length
      ? `本时段共有 ${textMessages.length} 条文字消息，筛出 ${meaningful.length} 条有效信息。重点内容、待办和待确认问题如下。`
      : '本时段没有有效文字消息。',
    highlights,
    decisions: meaningful.filter(item => (
      /(已经确定|已确认|定于|统一安排|决定)/.test(item.content) &&
      !QUESTION_PATTERN.test(item.content)
    )).map(item => item.content.slice(0, 160)).slice(0, 5),
    questions,
    todos
  }
}

function isMeaningful(content) {
  const text = content.replace(/\[[^\]]+\]/g, '').replace(/[@\s ]/g, '')
  if (text.length < 5) return false
  return !/^(哈)+[a-z！!~。，,]*$/i.test(text) && !/^(好|好的|好呢|知道了|可以|哦|嗯)+[~！!。，,]*$/.test(text)
}

function isPureQuestion(content) {
  return QUESTION_PATTERN.test(content) && !/(我来|我做|准备|需要|安排|执行|确认后|明天.*(去|做|问))/.test(content)
}

function isActionable(content) {
  if (/^「/.test(content)) return false
  return /(请|需要|负责|截止|完成|确认|跟进|提交|汇总|安排|执行|明天.*(访谈|去|问|做)|后天.*(访谈|去|问|做)|我做个|信息录入|责任梳理|我准备.*(做|训练|整理)|集合|带上)/.test(content)
}

function selectHighlights(messages) {
  return messages
    .map((item, index) => ({
      index,
      text: item.content.slice(0, 220),
      score: Math.min(item.content.length, 120) +
        (/(决议|目标|流程|需求|方案|计划|时间|费用|人数|岗位|进度|客户|工长|设计师|访谈|机器人|知识库|AI)/i.test(item.content) ? 45 : 0)
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .sort((a, b) => a.index - b.index)
    .map(item => item.text)
}

async function analyzeWithModel(messages, config) {
  const endpoint = config.aiBaseUrl.replace(/\/$/, '') + '/chat/completions'
  const transcript = messages.map(item => `[msg_id=${item.msg_id}] [${item.sent_at}] ${item.sender_name || item.sender_id}: ${item.content}`).join('\n')
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${config.aiApiKey}`
    },
    body: JSON.stringify({
      model: config.aiModel,
      temperature: 0.1,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: '你是企业微信群经营简报分析师。先理解完整上下文，合并重复和零散表述，区分闲聊、问题、决定与可执行待办。摘要必须说清“沟通了什么、得出什么结论、下一步是什么”，不得只统计消息数量或复制原句。只根据原文输出JSON，格式为 {"summary":"经过归纳的整体摘要","highlights":["重点事项，使用概括语句"],"decisions":["已经明确的决定"],"questions":["仍待确认的问题"],"todos":[{"source_msg_id":"与待办最相关的原消息ID","title":"合并归纳后的具体动作","owner":"","due_date":"","confidence":0.0}]}。同一任务只保留一次；纯意向、玩笑和疑问不得当作待办；缺失责任人或日期时留空，不得猜测。'
        },
        { role: 'user', content: transcript }
      ]
    })
  })
  if (!response.ok) throw new Error(`AI 接口失败: ${response.status} ${await response.text()}`)
  const body = await response.json()
  const parsed = JSON.parse(body.choices?.[0]?.message?.content || '{}')
  return normalizeAnalysis(parsed, messages)
}

function normalizeAnalysis(value, messages) {
  const messageIds = new Set(messages.map(item => item.msg_id))
  return {
    summary: String(value.summary || ''),
    highlights: stringArray(value.highlights),
    decisions: stringArray(value.decisions),
    questions: stringArray(value.questions),
    todos: (Array.isArray(value.todos) ? value.todos : []).filter(item => messageIds.has(item.source_msg_id)).map(item => ({
      source_msg_id: item.source_msg_id,
      title: String(item.title || '').slice(0, 200),
      owner: String(item.owner || '').slice(0, 80),
      due_date: String(item.due_date || '').slice(0, 40),
      confidence: Math.max(0, Math.min(1, Number(item.confidence) || 0))
    })).filter(item => item.title)
  }
}

function stringArray(value) {
  return (Array.isArray(value) ? value : []).map(item => String(item).slice(0, 200))
}

function extractOwner(message) {
  if (/我负责|我来/.test(message.content)) return message.sender_name || message.sender_id
  const match = message.content.match(/请([^，。]{1,20}?)(负责|确认|提交|汇总)/)
  if (!match) return ''
  return match[1].replace(/(今天|明天|后天|上午|下午|晚上|\d{1,2}[点时]).*$/, '').trim()
}

function extractDueDate(content) {
  const match = content.match(/(\d{1,2}月\d{1,2}日|今天|明天|后天)(?:前|之前)?/)
  return match ? match[1] : ''
}

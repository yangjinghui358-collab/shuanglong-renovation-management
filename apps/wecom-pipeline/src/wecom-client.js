const API_BASE = 'https://qyapi.weixin.qq.com/cgi-bin'

export class WeComClient {
  constructor({ corpId, secret, fetchImpl = fetch }) {
    if (!corpId || !secret) throw new Error('创建企微群发任务需要 WECOM_CORP_ID 和 WECOM_APP_SECRET')
    this.corpId = corpId
    this.secret = secret
    this.fetch = fetchImpl
    this.token = null
    this.tokenExpiresAt = 0
  }

  async createGroupMessageTask({ sender, content }) {
    if (!sender) throw new Error('创建企微群发任务需要 WECOM_SENDER_USER_ID')
    if (!content?.trim()) throw new Error('群发内容不能为空')
    const accessToken = await this.getAccessToken()
    const body = await this.request(
      `${API_BASE}/externalcontact/add_msg_template?access_token=${encodeURIComponent(accessToken)}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          chat_type: 'group',
          sender,
          text: { content: content.slice(0, 4000) }
        })
      }
    )
    return {
      msgid: body.msgid || '',
      failList: Array.isArray(body.fail_list) ? body.fail_list : []
    }
  }

  async getAccessToken() {
    if (this.token && Date.now() < this.tokenExpiresAt) return this.token
    const url = new URL(`${API_BASE}/gettoken`)
    url.searchParams.set('corpid', this.corpId)
    url.searchParams.set('corpsecret', this.secret)
    const body = await this.request(url)
    if (!body.access_token) throw new Error('企微 access_token 响应缺少 access_token')
    this.token = body.access_token
    this.tokenExpiresAt = Date.now() + Math.max(0, Number(body.expires_in || 7200) - 300) * 1000
    return this.token
  }

  async request(url, init) {
    const response = await this.fetch(url, init)
    const body = await response.json().catch(() => ({}))
    if (!response.ok || Number(body.errcode || 0) !== 0) {
      throw new Error(`企微 API 失败: HTTP ${response.status}, errcode=${body.errcode ?? 'unknown'}, errmsg=${body.errmsg || 'unknown'}`)
    }
    return body
  }
}

export function formatDigestForGroup(digest, { includeConfirmation = true } = {}) {
  const sections = [
    `【每日简报｜${digest.digest_date}】`,
    digest.summary || '本时段暂无摘要。',
    formatList('重点内容', digest.highlights),
    formatList('已确认事项', digest.decisions),
    formatList('待确认问题', digest.questions),
    formatTodos(digest.todos, digest.todo_count),
    `统计：${digest.message_count} 条消息（前一日08:00至当日08:00）`,
    includeConfirmation ? '' : null,
    includeConfirmation ? '请群主在企业微信「客户群群发」中确认发送。' : null
  ]
  return sections.filter(value => value !== null).join('\n')
}

function formatTodos(todos, count) {
  if (!Array.isArray(todos) || todos.length === 0) return `待办：${count || 0} 项`
  return `待办事项（${todos.length}）：\n${todos.map((item, index) => {
    const meta = [item.owner && `负责人：${item.owner}`, item.due_date && `时间：${item.due_date}`].filter(Boolean).join('，')
    return `${index + 1}. ${item.title}${meta ? `（${meta}）` : ''}`
  }).join('\n')}`
}

function formatList(title, items) {
  if (!Array.isArray(items) || items.length === 0) return null
  return `${title}：\n${items.map((item, index) => `${index + 1}. ${item}`).join('\n')}`
}

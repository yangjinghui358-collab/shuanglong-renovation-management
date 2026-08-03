import { formatDigestForGroup } from './wecom-client.js'

const PUSHPLUS_ENDPOINT = 'https://www.pushplus.plus/send'

export class PushPlusClient {
  constructor({ token, fetchImpl = fetch }) {
    if (!token) throw new Error('启用个人微信推送需要 PUSHPLUS_TOKEN')
    this.token = token
    this.fetch = fetchImpl
  }

  async sendDigest(digest) {
    const response = await this.fetch(PUSHPLUS_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        token: this.token,
        title: `客户群每日简报｜${digest.digest_date}`,
        content: formatDigestForGroup(digest, { includeConfirmation: false }),
        template: 'markdown',
        channel: 'wechat'
      })
    })
    const body = await response.json().catch(() => ({}))
    if (!response.ok || Number(body.code) !== 200) {
      throw new Error(`PushPlus 推送失败: HTTP ${response.status}, code=${body.code ?? 'unknown'}, msg=${body.msg || 'unknown'}`)
    }
    return {
      code: body.code,
      messageId: String(body.data || '')
    }
  }
}

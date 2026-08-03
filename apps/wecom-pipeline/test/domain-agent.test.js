import assert from 'node:assert/strict'
import test from 'node:test'
import { testAiConnection } from '../src/domain-agent.js'

test('AI connection test sends a structured request and records success', async () => {
  const calls = []
  const db = { query: async (sql, params) => { calls.push({ sql, params }); return { rows: [] } } }
  const config = {
    agentKey: 'project_manager',
    aiBaseUrl: 'https://example.com/compatible-mode/v1',
    aiApiKey: 'secret',
    aiModel: 'qwen-plus'
  }
  const fakeFetch = async (_url, options) => {
    assert.equal(options.headers.authorization, 'Bearer secret')
    return {
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '{"ok":true}' } }],
        usage: { prompt_tokens: 10, completion_tokens: 3 }
      })
    }
  }
  const result = await testAiConnection(db, config, fakeFetch)
  assert.equal(result.ok, true)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].params[3], 'success')
})

test('AI connection test refuses missing credentials', async () => {
  const db = { query: async () => ({ rows: [] }) }
  await assert.rejects(() => testAiConnection(db, { agentKey: 'project_manager' }), /AI 尚未配置/)
})

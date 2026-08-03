import fs from 'node:fs'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export function createArchiveProvider(config) {
  if (config.archiveProvider === 'mock') return new MockArchiveProvider(config.mockArchiveFile)
  if (config.archiveProvider === 'command') {
    if (!config.archiveCommand) throw new Error('ARCHIVE_PROVIDER=command 时必须配置 WECOM_ARCHIVE_COMMAND')
    return new CommandArchiveProvider(config.archiveCommand)
  }
  throw new Error(`不支持的 ARCHIVE_PROVIDER: ${config.archiveProvider}`)
}

class MockArchiveProvider {
  constructor(file) {
    this.file = file
  }

  async fetchAfter(seq) {
    const messages = JSON.parse(fs.readFileSync(this.file, 'utf8'))
    return messages.filter(item => Number(item.seq) > Number(seq))
  }
}

class CommandArchiveProvider {
  constructor(command) {
    this.command = command
  }

  async fetchAfter(seq) {
    const { stdout } = await execFileAsync(this.command, ['fetch', '--seq', String(seq), '--limit', '1000'], {
      maxBuffer: 20 * 1024 * 1024,
      env: process.env
    })
    const payload = JSON.parse(stdout)
    if (!Array.isArray(payload)) throw new Error('会话存档适配器必须输出 JSON 数组')
    return payload
  }
}

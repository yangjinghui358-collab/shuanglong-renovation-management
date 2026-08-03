import { openDatabase } from './database.js'

export async function openRepository(config) {
  if (config.databaseDriver === 'sqlite') return openDatabase(config.databasePath)
  if (config.databaseDriver === 'postgres') {
    const { openPostgresDatabase } = await import('./database-postgres.js')
    return openPostgresDatabase(config)
  }
  throw new Error(`不支持的 DATABASE_DRIVER: ${config.databaseDriver}`)
}

export function closeRepository(repository) {
  if (typeof repository.close === 'function') return repository.close()
  if (typeof repository.end === 'function') return repository.end()
}

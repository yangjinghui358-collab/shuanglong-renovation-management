#!/usr/bin/env node
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadConfig } from '../src/config.js'
import { openPostgresDatabase } from '../src/database-postgres.js'
import { syncSmartSheets } from '../src/smartsheet-sync.js'
import { analyzeNewConstructionMessages } from '../src/construction-progress.js'

const rootDir=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
const config=loadConfig(rootDir)
if(config.databaseDriver!=='postgres') throw new Error('智能表格同步仅使用 PostgreSQL')
const db=await openPostgresDatabase(config)
try {
  const construction=await analyzeNewConstructionMessages(db)
  const sheets=await syncSmartSheets(db,config)
  console.log(JSON.stringify({construction,sheets}))
} finally { await db.end() }

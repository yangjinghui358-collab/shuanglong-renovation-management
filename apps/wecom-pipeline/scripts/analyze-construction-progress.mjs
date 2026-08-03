#!/usr/bin/env node
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadConfig } from '../src/config.js'
import { openPostgresDatabase } from '../src/database-postgres.js'
import { analyzeNewConstructionMessages } from '../src/construction-progress.js'

const rootDir=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
const config=loadConfig(rootDir)
if(config.databaseDriver!=='postgres') throw new Error('施工进度分析仅使用 PostgreSQL')
const db=await openPostgresDatabase(config)
try { console.log(JSON.stringify(await analyzeNewConstructionMessages(db))) } finally { await db.end() }


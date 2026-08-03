# 双龙装饰 AI 经营管理平台

本仓库是双龙装饰服务器应用、管理后台和 Agent 的唯一代码源。

## 目录

- `apps/web`：React 管理后台。
- `apps/api`：Fastify 管理 API。
- `apps/wecom-pipeline`：企业微信会话采集、回调、PostgreSQL 接入和底层业务处理。
- `apps/agent-worker`：Agent 审核、语音、施工分析和智能表格任务入口。
- `packages/contracts`：前后端共享数据合约。
- `packages/data-access`：管理后台只读数据访问层。
- `infra/nginx`：Nginx 审核模板。
- `infra/systemd`：服务器 systemd 单元基线。
- `scripts`：本地只读隧道和安全检查脚本。
- `docs`：设计、数据、交接和运维文档。

## 安全边界

真实 `.env`、`production.env`、密码、Token、SSH 私钥、数据库、日志、客户数据、聊天原文、媒体和服务器备份不得提交。服务器配置值保留在服务器权限受控的环境文件中。

## 开发验证

要求 Node.js 22 和 pnpm 11.9：

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm test:pipeline
pnpm test:shell
pnpm build
pnpm test:e2e
```

部署和服务重启必须经过明确授权；提交到本仓库不代表自动部署生产服务器。

## 登录与 Agent 写入

管理 API 使用独立的 `MANAGEMENT_DATABASE_URL` 保存用户、会话、Agent 候选、老板决策、模块记录和审计信息。`WECOM_DATABASE_URL` 继续只读现有企微数据。首次启动前设置：

- `ADMIN_PHONE`：老板初始化手机号，不提交真实号码。
- `ADMIN_INITIAL_PASSWORD`：至少 12 位的临时随机密码。
- `AGENT_INGEST_TOKEN`：至少 24 位的 Agent 专用随机 Token。
- `MANAGEMENT_DATABASE_URL`：仅对 `management` Schema 有写权限的连接。

Agent 只能调用 `/api/agent/candidates` 创建候选。老板登录后必须在 `/ai-review` 逐条确认，系统才会以幂等事务写入 `projects`、`procurement` 或 `crm` 模块记录，并保留审核与审计记录。

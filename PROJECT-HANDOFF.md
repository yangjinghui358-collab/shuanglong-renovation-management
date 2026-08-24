# 双龙装饰 AI 经营管理中心·项目交接说明

> 交接基线：Phase 1A 已完成，Phase 1B 设计已批准、待编写实施计划
>
> 更新日期：2026-08-03
>
> 生产域名：`https://admin.shuanglongzhuangshi.cn`

## 1. 项目目标

本项目面向装修企业老板，将企业微信会话存档、工地进度、主材采购、客户跟进、待确认事项等信息汇总为老板经营看板。系统强调数据来源可追溯，并明确区分真实数据、演示数据、AI 推测和人工确认结果。

## 2. 当前交付状态

### 已完成

- React/Vite 老板经营看板，支持电脑端和手机端。
- Fastify 只读 API，提供老板首页数据和健康检查。
- PostgreSQL 只读适配层，连接时强制 `default_transaction_read_only=on`。
- 工地、主材、客户意向、老板待确认、AI 简报和证据摘要界面。
- 明确标注的演示数据回退；演示记录不进入真实老板行动统计，也不提供“处理”按钮。
- 数据合约、单元/集成测试、Chromium 端到端测试和只读安全脚本。
- Nginx 同源部署模板：前端使用根路径，API 使用 `/api/*`。
- 企业微信语音转写的设计与实施计划文档。

### 当前线上状态

- `https://admin.shuanglongzhuangshi.cn/` 可访问，HTTPS 证书校验通过。
- `https://admin.shuanglongzhuangshi.cn/api/health` 可访问。
- 截至本交接文档更新时，健康端点为 `degraded / database unavailable`，页面使用明确标注的演示数据。
- 当前是 Phase 1A 预览环境，不应视为已完成的生产业务系统。

### 尚未完成/上线前阻塞

- 尚未实现登录、会话管理、RBAC 和敏感操作再验证，不得将真实客户与财务数据暴露给未认证访问者。
- 服务器尚未配置已审核的 PostgreSQL 专用只读账号，不得复用聊天采集写账号。
- Phase 1B 的业务写入、AI 待确认闭环、审批和通知尚未实现。
- 本仓库的管理平台代码尚未实现语音转写链路，也不包含现有 `wecom-chat-pipeline` 生产采集程序；生产服务器上的实际语音处理现状见下方只读审计摘要。

### 2026-08-03 生产环境只读审计摘要

- 企业微信采集服务和装修管理 API 均在运行，API 仅监听 `127.0.0.1:3001`。
- 文字消息采集正常，文字 Agent 已能生成事件、待办、风险和简报。
- 语音已能下载和转写，但缺少稳定自动调度，且语音转写结果尚未进入 Agent 候选事项证据链。
- 小米 MiMo 连接已有成功记录：业务提取使用 `mimo-v2.5-pro`，语音识别使用 `mimo-v2.5-asr`。
- 当时共有 12 条 Agent 草稿，全部处于 `pending_review`，且均来自文字消息。
- 管理后台尚未接入真实业务数据，仍是明确标识的演示回退状态。
- 审计期间未修改生产数据库，也未覆盖 `/opt/wecom-chat-pipeline`。

## 3. 技术架构

```text
浏览器
  └─ https://admin.shuanglongzhuangshi.cn
       ├─ /                 React/Vite 静态前端
       └─ /api/*            Nginx 同源反向代理
            └─ 127.0.0.1:3001  Fastify API
                 ├─ Demo Reader
                 └─ Read-only PostgreSQL Adapter
                      └─ 现有 wecom_chat PostgreSQL（不对公网开放）
```

技术栈：

- Node.js 22 LTS（项目限制 `>=22 <23`）
- pnpm 11
- TypeScript 5
- React 19、Vite、React Router、TanStack Query
- Fastify 5、PostgreSQL `pg`、Zod
- Vitest、Testing Library、Playwright

## 4. 目录结构

```text
apps/
  api/                 Fastify API、环境校验、看板与健康路由
  web/                 React 老板看板、演示 fixture、UI/E2E 测试
packages/
  contracts/           前后端共享数据合约
  data-access/         演示读取器与 PostgreSQL 只读适配层
docs/
  data/                数据模式、只读角色和验收矩阵
  runbooks/            本地预览、备份恢复和生产准备手册
  superpowers/         已确认的产品设计与实施计划
infra/nginx/           admin 域名同源部署模板
scripts/               SSH 只读隧道和 PostgreSQL 只读校验脚本
tests/shell/           发布安全检查
PROJECT-HANDOFF.md     本交接文档
```

`node_modules/`、`dist/`、`.env`、`.DS_Store`、测试报告、旧发布产物和生产 `wecom-chat-pipeline/` 不进入 GitHub。

## 5. 本地开发

### 前置条件

- Node.js 22
- pnpm 11.9
- 受限 SSH 密钥和 SSH Config 别名
- PostgreSQL 专用只读用户

### 安装与校验

```bash
pnpm install --frozen-lockfile
pnpm verify
```

`pnpm verify` 依次执行：

1. TypeScript 类型检查；
2. Vitest 单元/集成测试；
3. PostgreSQL 只读、SSH 隧道、Nginx 端口和发布门禁脚本；
4. 前后端生产构建；
5. Chromium 电脑端/手机端 E2E。

### 启动只读预览

1. 配置 SSH 只读隧道，不使用 root 密码：

```bash
SSH_HOST=<ssh-config-alias> \
SSH_USER=dashboard-tunnel \
LOCAL_DB_PORT=15432 \
scripts/open-readonly-tunnel.sh
```

2. 复制环境模板并在当前 shell 导出：

```bash
cp .env.example .env
set -a
. ./.env
set +a
pnpm dev
```

`.env` 仅允许保存本机回环地址的连接信息，不保存 SSH 密钥、root 密码或生产写账号。

## 6. 环境变量

| 变量 | 作用 | 默认/要求 |
|---|---|---|
| `WECOM_DATABASE_URL` | API 连接现有 PostgreSQL | 必填；必须使用只读账号和回环/内网地址 |
| `PORT` | API 监听端口 | `3001` |
| `HOST` | API 监听地址 | `127.0.0.1`，不应设为公网地址 |
| `VITE_API_BASE_URL` | 前端 API 基路径 | `/api` |
| `VITE_ENABLE_DEMO_FALLBACK` | API 交通失败时显示明确演示数据 | 正常构建必须为 `false`；静态演示版才可为 `true` |

仓库仅提交 `.env.example`，不提交任何真实环境值。

## 7. API 与部署约定

- API 健康端点：`GET /api/health`
- 老板看板端点：`GET /api/dashboard/owner`
- API 默认仅监听 `127.0.0.1:3001`。
- Nginx 对外提供 `admin.shuanglongzhuangshi.cn`，将 `/api/*` 反代到本机 API，其余路径提供 React 静态文件。
- 变更 Nginx 前必须备份现有配置，执行 `nginx -t`，通过后才能 reload。
- 不得修改、覆盖或删除现有 `/opt/wecom-chat-pipeline`。
- 不得把 PostgreSQL 5432 端口暴露到公网。

参考：

- `infra/nginx/admin.shuanglongzhuangshi.cn.conf.example`
- `docs/runbooks/production-readiness.md`
- `docs/runbooks/backup-restore.md`

## 8. 数据与安全边界

- 仓库不包含真实客户名称、电话、地址、完整聊天原文或生产数据库 dump。
- 所有 fixture 使用“测试”、“演示”或“合成”名称。
- 前端不直连 PostgreSQL，不含数据库密码。
- AI 推测不得直接覆盖正式业务记录；财务、报价、设计变更和增减项必须由老板最终确认。
- 历史聊天中出现过的服务器密码必须轮换，并改用 SSH 密钥。
- 在完成登录、RBAC、审计和只读数据账号前，不得将真实经营数据接入公网预览。

## 9. 后续开发路线

### Phase 1B：真实业务闭环

- 企业微信聊天数据增量同步和 AI 候选事项。
- 老板 AI 待确认、驳回、指派、通知和审计留痕。
- 工地、主材、客户跟进等正式业务写入。
- 老板、店长、项目经理、采购、销售等权限入口。

Phase 1B 已确认的关键规则：

- 文字消息直接进入统一 Agent 输入层；语音先转写，再进入同一条处理链。
- Agent 提取的事项必须由老板逐条确认，不提供批量确认或一键全部确认。
- 未确认事项同时出现在“AI 待确认”和对应业务模块，但不计入正式统计，员工不得按正式任务执行。
- 老板可以确认、修改后确认、驳回，或指派负责人后确认。
- 确认后才由模块投影器写入工地、主材、客户、财务等正式业务模块。
- 采用一个 PostgreSQL 数据库，按 `ingestion`、`agent`、`review`、正式业务和 `audit` 等 Schema 分模块管理。
- Coze 不是生产运行依赖；小米 MiMo 保持为主模型，通过 provider adapter 保留未来替换能力。

详细规格：`docs/superpowers/specs/2026-08-03-agent-review-modular-platform-design.md`。

### Phase 1C：生产安全与运维

- 登录、RBAC、敏感操作再验证和审计日志。
- 只读数据库账号、备份恢复、监控告警、服务自启和回滚演练。
- 正式 HTTPS 域名、安全头和发布验收。

### 第二期：设计、报价与财务

- 设计图版本、客户在线确认、报价模板和 AI 报价草稿。
- 设计师提交、店长审核、老板终审后发客户。
- 合同收款、应收应付、成本、利润、现金流和异常支出。

### 第三期：库存、排班与经营扩展

- 入库、直送、领料、退料、损耗、调拨和盘点。
- 固定员工、临时工、外包个人/班组、排班冲突和工期影响。
- 客户建议、投诉、售后闭环和多门店经营汇总。

## 10. GitHub 与交接规则

- GitHub 仓库应设为私有，未经审核不得转为公开。
- 本次发布使用清洗后的全新 Git 历史，不上传早期可能包含客户/项目标识的本地提交对象。
- 新开发应从 GitHub 默认分支创建 `codex/*` 功能分支，通过 PR 审查后合并。
- 提交前必须运行 `pnpm verify`，并重新扫描密钥、客户隐私、数据库连接串和大文件。

## 11. 接手人第一天检查清单

- [ ] 使用 Node.js 22 执行 `pnpm install --frozen-lockfile && pnpm verify`。
- [ ] 确认 GitHub 分支保护、密钥扫描和最小成员权限已开启。
- [ ] 确认生产服务不使用聊天采集写账号。
- [ ] 确认 `admin` 域名证书、Nginx 配置、systemd 服务和回滚 release。
- [ ] 在导入真实数据前完成认证/RBAC，并执行隐私与越权测试。
- [ ] 确认历史暴露过的服务器密码已轮换。

## 12. 更换 Codex 账号后的续接方法

安全交接基线：

- GitHub：`https://github.com/yangjinghui358-collab/shuanglong-renovation-management`
- 当前分支：`codex/phase-1a-integration`
- 设计规格提交：`f39ef03`
- 生产域名：`https://admin.shuanglongzhuangshi.cn`
- 本地项目入口：`/Users/a0000/Documents/装修行业FDE`

注意：上述本地主目录可能停留在其他分支，并包含用户自有、未跟踪的 `wecom-chat-pipeline/`。接手时不得删除、覆盖或强制重置该目录；优先在新目录中从 GitHub 检出交接分支。

新账号登录后：

1. 在新目录中从 GitHub 检出 `codex/phase-1a-integration` 最新代码，不依赖旧 Codex 对话历史。
2. 首先阅读本文档和 Phase 1B 设计规格。
3. 从“编写 Phase 1B 详细实施计划”继续，不直接跳过计划修改生产环境。
4. 实施前再做一次只读审计，因为服务器状态、数据量和模型调用情况可能已变化。
5. 不得将 `.env`、API Key、SSH 密钥、客户聊天原文或生产数据库导出物提交到 GitHub。

当前应继续的下一步：根据已批准的设计规格，编写 Phase 1B 可执行实施计划，然后分 1B-1、1B-2、1B-3 实施、测试和发布。

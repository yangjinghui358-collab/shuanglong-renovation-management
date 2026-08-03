# 本地只读预览运行手册

本手册用于通过 SSH 本地端口转发预览现有 `wecom_chat` 数据。数据库端口始终不对公网开放，预览不创建或修改生产记录。

## 前置条件

- SSH 使用独立、受限的 `dashboard-tunnel` 用户和密钥，不使用 root 密码。
- 服务器 SSH 公钥应限制为仅允许到 `127.0.0.1:5432` 的 TCP 转发，禁用 shell、PTY 和其他端口转发。
- PostgreSQL 使用[DBA 审核过的只读角色](../data/postgresql-readonly-role.md)。
- 主机、用户、密钥路径和密码保存在本机 shell、`~/.ssh/config` 或批准的密钥管理工具中，不进入 Git。
- 历史聊天中出现过的服务器密码必须在正式部署前轮换，不得复制到 `.env` 或脚本。

## 打开隧道

推荐先在本机 `~/.ssh/config` 配置不含密码的主机别名。然后在一个独立终端运行：

```bash
SSH_HOST=<ssh-config-alias> \
SSH_USER=dashboard-tunnel \
LOCAL_DB_PORT=15432 \
scripts/open-readonly-tunnel.sh
```

脚本使用 `BatchMode=yes`，不会接受交互密码；转发两端均限定为 `127.0.0.1`。用 `Ctrl-C` 关闭隧道。

## 验证只读会话

在另一终端执行：

```bash
PGHOST=127.0.0.1 \
PGPORT=15432 \
PGDATABASE=<source_database> \
PGUSER=<dashboard_reader> \
scripts/check-readonly-postgres.sh
```

如核验失败，停止预览，由 DBA 调整权限后重试。不得为了跑通预览改用高权限账号。

## 启动应用（待 Task 1–8 合并后）

当应用工作区和 `.env.example` 已由前置任务交付时：

```bash
cp .env.example .env
pnpm install --frozen-lockfile
set -a
. ./.env
set +a
pnpm dev
```

`set -a` 会把 `.env` 中的变量导出给 API 进程；当前服务不会自动读取根目录 `.env`。`.env` 只指向 `127.0.0.1:15432`，不保存 SSH 密钥或历史 root 密码。实际变量名以已审批的 `.env.example` 为准。

## 预览验收

- 隧道连通时，数据源最新时间与服务器最新消息时间一致，真实项目数与 `group_projects` 当前只读计数一致。
- 真实证据正文只在点击“查看依据”后展开，默认页面只显示摘要和来源数量。
- 报价、财务、库存和排班等尚无真实数据的模块始终显示“演示数据”，不计入真实经营统计。
- 隧道断开时，仪表盘明确显示“真实数据暂不可用”，健康端点为 `degraded`，不把回退数据标为真实。
- API 日志中的数据库语句只能是只读事务控制和 `SELECT`，日志不记录连接串、密码或完整聊天原文。

完整案例、责任人和证据要求见[集成与验收测试矩阵](../data/integration-acceptance-matrix.md)。

# PostgreSQL 只读角色与权限要求

适用于 Phase 1A 本地预览从现有 `wecom_chat` 读取真实数据。本文是 DBA 审核清单，不是变更授权；本任务未创建或修改任何生产角色。

## 必须满足的有效权限

- 使用独立登录角色，不共用采集器、`postgres` 或应用写入账号。
- 角色属性必须为 `NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS`，且不属于任何其他角色，避免通过 `SET ROLE` 提权。
- 数据库权限仅为 `CONNECT`；目标 schema 权限仅为 `USAGE`；经审核表/视图权限仅为 `SELECT`。
- 不得拥有数据库 `CREATE`/`TEMP`、schema `CREATE`、序列使用、函数执行或表的 `INSERT`/`UPDATE`/`DELETE`/`TRUNCATE`/`REFERENCES`/`TRIGGER`权限。
- 连接级默认设置 `default_transaction_read_only=on`；API 每次快照读取仍需显式执行只读事务。
- PostgreSQL 只监听服务器本机；`pg_hba.conf` 只允许经审核的本机来源。不得开放 5432 公网端口。
- 只授权已审核的业务字段或视图。仪表盘不读取 `messages.raw_json`，证据摘要最长 160 个 Unicode 字符。

PostgreSQL 默认可能通过 `PUBLIC` 赋予 `CONNECT`/`TEMP` 或函数 `EXECUTE`。DBA 必须检查“有效权限”，不能只检查直接 `GRANT`。如果撤销 `PUBLIC` 权限会影响现有服务，应先在测试环境评估，不得在本地预览任务中直接修改生产。

## DBA 变更草案（仅供审核，不得直接复制到生产）

```sql
-- 由 DBA 在测试环境替换尖括号占位符，并通过密钥管理系统交付密码。
create role <dashboard_reader> login
  nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls;
alter role <dashboard_reader> set default_transaction_read_only = on;

grant connect on database <source_database> to <dashboard_reader>;
grant usage on schema <source_schema> to <dashboard_reader>;
grant select on table
  <source_schema>.messages,
  <source_schema>.events,
  <source_schema>.todos,
  <source_schema>.risks,
  <source_schema>.digests,
  <source_schema>.group_projects
to <dashboard_reader>;
```

对新表不做宽泛的默认 `SELECT` 授权；新增数据源必须经字段和隐私审核后显式授权。

## 只读核验

先打开 SSH 隧道，再通过环境变量或临时密码提示连接；禁止把密码作为命令行参数。

```bash
PGHOST=127.0.0.1 \
PGPORT=15432 \
PGDATABASE=<source_database> \
PGUSER=<dashboard_reader> \
scripts/check-readonly-postgres.sh
```

通过标准是输出 `PASS: PostgreSQL session and role are read-only`。该脚本只执行元数据 `SELECT` 和 `SHOW` 等价读取，并检查有效表/视图写权限、schema `CREATE`、序列权限、用户函数 `EXECUTE`、角色继承与成员关系。它不创建表、不改角色、不读取聊天内容。

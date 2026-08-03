# 企业微信群会话处理流水线

独立于现有小程序运行，完成：

`企业微信会话存档 → 数据库 → 待办提取 → 每日简报`

当前使用单群配置，数据表保留 `group_id`，未来可扩展到 5 个群。

## 本地跑通

要求 Node.js 22.5 或更高版本，不需要安装数据库和第三方依赖。

```bash
cp .env.example .env
npm run run:once
npm run show
npm test
```

默认读取 `fixtures/messages.json`，数据写入 `data/wecom-chat.db`。重复运行不会重复写入消息或待办。

未配置 AI 时使用本地规则提取器，便于先验收整条链路；配置 `AI_BASE_URL`、`AI_API_KEY` 和 `AI_MODEL` 后切换为 OpenAI 兼容模型接口。

## 阿里云 PostgreSQL

生产环境将新会话明文直接写入阿里云服务器上的 PostgreSQL：

```env
DATABASE_DRIVER=postgres
POSTGRES_URL=postgresql://wecom_pipeline:密码@127.0.0.1:5432/wecom_chat
```

系统会自动创建消息、媒体、事件、进度、待办、简报、Agent任务和处理游标表。
生产系统不再使用 CloudBase，也不迁移 CloudBase 中的历史聊天内容。

## 正式会话存档接入

企业微信会话内容的解密依赖官方 Finance SDK。为避免把原生 SDK 与业务逻辑耦合，本服务通过一个命令行适配器调用它：

```env
ARCHIVE_PROVIDER=command
WECOM_ARCHIVE_COMMAND=/opt/wecom/bin/archive-adapter
```

服务调用形式：

```bash
/opt/wecom/bin/archive-adapter fetch --seq 0 --limit 1000
```

适配器必须在标准输出返回已经解密、标准化的 JSON 数组：

```json
[
  {
    "msg_id": "唯一消息ID",
    "seq": 1,
    "group_id": "企业微信客户群ID",
    "sender_id": "发送者ID",
    "sender_name": "发送者姓名",
    "sent_at": "2026-07-23T10:00:00+08:00",
    "msg_type": "text",
    "content": "消息正文"
  }
]
```

CorpID、会话存档 Secret、RSA 私钥等由适配器从腾讯云环境变量或密钥管理读取，不得写入本项目或输出到日志。

## 腾讯云运行

将目录部署到现有腾讯云服务器，复制 `.env.example` 为 `.env` 并配置后运行：

```bash
npm start
```

生产环境建议交给 systemd 或现有进程管理器守护。服务默认每分钟拉取一次。简报和待办状态均为 `pending_review`。

## 客户群群发任务

启用后，服务会在生成简报后调用企业微信
`externalcontact/add_msg_template` 创建客户群群发任务。消息不会由服务器直接发入外部群，
仍需指定群主每天在企业微信客户端点击一次确认。

```env
WECOM_CORP_ID=企业ID
WECOM_APP_SECRET=应用Secret
WECOM_SENDER_USER_ID=群主企业微信userid
WECOM_GROUP_SEND_ENABLED=false
```

上线时应先保持 `false`。确认应用可见范围包含群主、服务器 IP 已加入企业可信 IP 后，
再在服务器密钥文件中改为 `true`。服务按“群 ID + 简报日期”记录已创建任务，重启或重复
执行不会重复创建。

## 尚需正式环境提供

- 企业微信 CorpID
- 会话存档 Secret
- RSA 私钥
- 目标客户群 ID
- 已配置为可信 IP 的腾讯云服务器
- 官方 Finance SDK 及与服务器架构匹配的动态库
- 如需 AI：模型地址、模型名和 API Key

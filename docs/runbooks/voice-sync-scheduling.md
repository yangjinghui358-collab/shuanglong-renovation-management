# 语音转写自动调度

本变更只提供仓库内的部署基线，不会自动连接或修改服务器。

## 调度保证

- `shuanglong-voice-sync.timer` 每五分钟触发一次语音同步。
- `shuanglong-agent-review.service` 同时 `Requires` 并排序在语音同步之后；每次 Agent 审核前，systemd 必须先成功完成语音同步。同步失败时审核不会启动。
- oneshot unit 自带互斥；数据库领取任务使用 `FOR UPDATE SKIP LOCKED`。`msg_id + media_type` 唯一键防止重复任务，`transcribed` 记录不会再次领取。
- 转写完成状态与 `messages.content` 在同一数据库事务内提交，Agent 不会读取到只完成一半的结果。
- 每条任务最多尝试 5 次，失败按 5、10、20、40 分钟退避。进程异常遗留超过 15 分钟的处理中任务可被重新领取。
- 目标群仍有未完成语音（包括等待退避或已达上限）时，本轮 unit 非零退出，因此 Agent 不会在缺失语音上下文时审核。可通过 `systemctl status`、`systemctl --failed` 和 journal 观察；日志只输出计数，不输出凭据、媒体标识、音频或转写正文。

## 部署前检查（本次未执行）

1. 备份数据库与现有 unit，确认 `/etc/wecom-chat-pipeline/secrets.env` 为 root 所有且权限 `0600`。
2. 发布代码并先执行初始化流程，使 `media.attempts`、`next_attempt_at`、`updated_at` 和队列索引就绪。
3. 将两个 voice unit 和更新后的 Agent unit 安装到 `/etc/systemd/system/`，执行 `systemd-analyze verify` 后再 `daemon-reload`。
4. 手动运行 `systemctl start shuanglong-voice-sync.service`，核对状态和 journal；只查询目标群的 `media`/`messages` 行，不改动其他业务表。
5. 验证成功后启用 timer：`systemctl enable --now shuanglong-voice-sync.timer shuanglong-agent-review.timer`。

建议验收命令：

```bash
systemctl status shuanglong-voice-sync.service shuanglong-voice-sync.timer
journalctl -u shuanglong-voice-sync.service --since '30 minutes ago'
systemctl list-timers 'shuanglong-*'
```

## 回滚

先停用 voice timer，恢复旧 Agent unit 并执行 `daemon-reload`。新增数据库列和索引可保留，旧代码不会使用；不要删除转写结果或其他生产数据。回滚前后的查询与日志均不得复制 secrets 文件内容。

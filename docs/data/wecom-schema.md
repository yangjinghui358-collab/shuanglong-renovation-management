# WeCom dashboard read schema

Phase 1A reads the existing `wecom_chat` database without modifying it. The adapter expects these fields:

- `messages.sent_at`
- `group_projects.group_id`, `group_projects.project_name`
- `todos.id`, `todos.group_id`, `todos.phase`, `todos.progress`, `todos.created_at`
- `risks.risk_id`, `risks.group_id`, `risks.risk_level`, `risks.created_at`
- `events.event_id`, `events.group_id`, `events.raw_chat`, `events.created_at`
- `digests.id`, `digests.summary`, `digests.updated_at`

This list was verified against production metadata through the restricted tunnel on 2026-08-04. No sample values, message bodies, or credentials are stored in Git.

The dashboard adapter never selects `messages.raw_json`. Every snapshot runs on one checked-out client with `BEGIN`, `SET TRANSACTION READ ONLY`, read-only `SELECT` statements, and `COMMIT` or `ROLLBACK`.

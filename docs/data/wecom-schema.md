# WeCom dashboard read schema

Phase 1A reads the existing `wecom_chat` database without modifying it. The adapter expects these fields:

- `messages.msgtime`
- `group_projects.project_id`, `group_projects.project_name`
- `todos.id`, `todos.project_id`, `todos.stage`, `todos.progress`, `todos.created_at`
- `risks.id`, `risks.project_id`, `risks.risk_level`, `risks.created_at`
- `events.id`, `events.project_id`, `events.raw_chat`, `events.created_at`
- `digests.id`, `digests.title`, `digests.summary`, `digests.created_at`

This list is derived from the approved Phase 1A query contract and is covered by query stubs. It has **not** been verified against production because no safe read-only database credential or active tunnel was available in this workspace. Before real-data integration, inspect `information_schema.columns` through the restricted tunnel, adjust column names only, and do not copy sample values, message bodies, or credentials into Git.

The dashboard adapter never selects `messages.raw_json`. Every snapshot runs on one checked-out client with `BEGIN`, `SET TRANSACTION READ ONLY`, read-only `SELECT` statements, and `COMMIT` or `ROLLBACK`.

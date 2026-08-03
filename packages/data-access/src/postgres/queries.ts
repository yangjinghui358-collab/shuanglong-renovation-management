export const SOURCE_FRESHNESS_SQL = `
  SELECT max(sent_at) AS last_message_at
    FROM messages
`;

export const ACTIVE_PROJECTS_SQL = `
  SELECT gp.group_id AS project_id,
         gp.project_name,
         coalesce(t.phase, '待识别') AS stage,
         coalesce(t.progress, 0) AS progress,
         coalesce(r.risk_level, 'none') AS risk_level,
         t.id::text AS todo_id,
         r.id::text AS risk_id,
         e.id::text AS evidence_id,
         left(e.raw_chat, 160) AS excerpt,
         e.created_at AS occurred_at,
         null::text AS sender_name
    FROM group_projects gp
    LEFT JOIN LATERAL (
      SELECT todo.id, todo.phase, todo.progress
        FROM todos todo
       WHERE todo.group_id = gp.group_id
       ORDER BY todo.created_at DESC NULLS LAST, todo.id DESC
       LIMIT 1
    ) t ON true
    LEFT JOIN LATERAL (
      SELECT risk.risk_id AS id, risk.risk_level
        FROM risks risk
       WHERE risk.group_id = gp.group_id
       ORDER BY risk.created_at DESC NULLS LAST, risk.risk_id DESC
       LIMIT 1
    ) r ON true
    LEFT JOIN LATERAL (
      SELECT event.event_id AS id, event.raw_chat, event.created_at
        FROM events event
       WHERE event.group_id = gp.group_id
       ORDER BY event.created_at DESC NULLS LAST, event.event_id DESC
       LIMIT 1
    ) e ON true
`;

export const LATEST_DIGEST_SQL = `
  SELECT id::text AS digest_id,
         'AI 经营简报'::text AS title,
         summary,
         updated_at AS created_at
    FROM digests
   ORDER BY updated_at DESC
   LIMIT 1
`;

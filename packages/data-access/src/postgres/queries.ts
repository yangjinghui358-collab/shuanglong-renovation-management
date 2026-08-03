export const SOURCE_FRESHNESS_SQL = `
  SELECT max(msgtime) AS last_message_at
    FROM messages
`;

export const ACTIVE_PROJECTS_SQL = `
  SELECT gp.project_id,
         gp.project_name,
         coalesce(t.stage, '待识别') AS stage,
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
      SELECT todo.id, todo.stage, todo.progress
        FROM todos todo
       WHERE todo.project_id = gp.project_id
       ORDER BY todo.created_at DESC NULLS LAST, todo.id DESC
       LIMIT 1
    ) t ON true
    LEFT JOIN LATERAL (
      SELECT risk.id, risk.risk_level
        FROM risks risk
       WHERE risk.project_id = gp.project_id
       ORDER BY risk.created_at DESC NULLS LAST, risk.id DESC
       LIMIT 1
    ) r ON true
    LEFT JOIN LATERAL (
      SELECT event.id, event.raw_chat, event.created_at
        FROM events event
       WHERE event.project_id = gp.project_id
       ORDER BY event.created_at DESC NULLS LAST, event.id DESC
       LIMIT 1
    ) e ON true
`;

export const LATEST_DIGEST_SQL = `
  SELECT id::text AS digest_id,
         title,
         summary,
         created_at
    FROM digests
   ORDER BY created_at DESC
   LIMIT 1
`;

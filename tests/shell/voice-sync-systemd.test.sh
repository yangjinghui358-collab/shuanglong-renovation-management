#!/usr/bin/env bash
set -euo pipefail

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
voice_service="$root_dir/infra/systemd/shuanglong-voice-sync.service"
voice_timer="$root_dir/infra/systemd/shuanglong-voice-sync.timer"
agent_service="$root_dir/infra/systemd/shuanglong-agent-review.service"
sync_script="$root_dir/apps/wecom-pipeline/scripts/sync-voice-transcripts.mjs"

grep -q '^Type=oneshot$' "$voice_service"
grep -q '^EnvironmentFile=/etc/wecom-chat-pipeline/secrets.env$' "$voice_service"
grep -q '^ProtectSystem=strict$' "$voice_service"
grep -q '^UMask=0077$' "$voice_service"
grep -q '^Persistent=true$' "$voice_timer"
grep -q '^Requires=shuanglong-voice-sync.service$' "$agent_service"
grep -q 'After=.*shuanglong-voice-sync.service' "$agent_service"
grep -q 'FOR UPDATE SKIP LOCKED' "$sync_script"
grep -q 'attempts<5' "$sync_script"
grep -q 'if (unresolved > 0) process.exitCode = 1' "$sync_script"
grep -q "client.query('BEGIN')" "$sync_script"
grep -q "client.query('COMMIT')" "$sync_script"

if grep -Eq 'Environment=(AI_API_KEY|POSTGRES_URL|WECOM_SECRET)=' "$voice_service"; then
  echo 'credential value must not be embedded in the unit' >&2
  exit 1
fi

echo 'voice sync systemd policy: ok'

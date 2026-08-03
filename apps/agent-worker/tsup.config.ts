import { defineConfig } from "tsup";

export default defineConfig({
  entry: { "sync-review-candidates": "src/sync-review-candidates.mjs", "agent-dispatcher": "src/agent-dispatcher.mjs", "chat-review": "../wecom-pipeline/scripts/run-agent-review.mjs" },
  format: ["cjs"],
  platform: "node",
  target: "node22",
  clean: true,
  outDir: "dist",
  noExternal: [/.*/],
});

import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/server.ts"],
  format: ["cjs"],
  platform: "node",
  target: "node22",
  clean: true,
  outDir: "dist",
  noExternal: [/.*/],
});

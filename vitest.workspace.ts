import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
  "packages/contracts",
  "packages/data-access",
  "apps/api",
  "apps/web",
]);

#!/usr/bin/env bash
set -euo pipefail

node <<'NODE'
const { readFileSync } = require("node:fs");

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const shellGate = pkg.scripts?.["test:shell"] ?? "";
const releaseGate = pkg.scripts?.verify ?? "";
const requiredShellChecks = [
  "check-readonly-postgres.test.sh",
  "open-readonly-tunnel.test.sh",
  "nginx-api-port.test.sh",
];

for (const check of requiredShellChecks) {
  if (!shellGate.includes(check)) {
    throw new Error(`test:shell does not run ${check}`);
  }
}

for (const command of ["typecheck", "test", "test:shell", "build", "test:e2e"]) {
  if (!releaseGate.includes(command)) {
    throw new Error(`verify does not run ${command}`);
  }
}
NODE

echo "PASS: standard release gate includes all required checks"

# Phase 1A Real-Data Owner Dashboard Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a locally previewable, responsive “双龙装饰 · AI 经营管理中心” owner dashboard that reads the existing server PostgreSQL data through a read-only connection and clearly labels demo-only modules.

**Architecture:** Create a pnpm monorepo with a React/Vite web app, a Fastify read API, shared domain contracts, and a data-access package. The API composes a read-only `wecom_chat` adapter with deterministic demo fixtures for capabilities that have no production records yet; the UI never connects to PostgreSQL directly. Keep the existing WeCom collector unchanged.

**Tech Stack:** Node.js 22 LTS, pnpm workspaces, TypeScript 5, React 19, Vite, React Router, TanStack Query, Ant Design 6, ECharts, Fastify 5, `pg`, Zod, Vitest, Testing Library, Playwright.

## Global Constraints

- Brand copy is exactly “双龙装饰 · AI 经营管理中心”.
- Production domain remains `https://admin.shuanglongzhuangshi.cn`.
- Existing WeCom collection code and schema are read-only for Phase 1A.
- PostgreSQL must never be exposed publicly; local access uses an SSH tunnel and a database account limited to `SELECT`.
- Real, demo, AI-inferred, pending-confirmation, confirmed, rejected, and archived data must have visibly distinct status labels.
- The owner dashboard defaults to summaries and evidence excerpts; full message content is only shown after explicit expansion.
- Existing real project data is shown as-is; missing quotation, finance, inventory, and scheduling capabilities use deterministic demo data marked “演示数据”.
- Desktop uses the approved “高管工作台” layout; mobile uses a task-first stacked layout.
- No write operation against the production database is permitted in Phase 1A.
- Secrets belong in local `.env` or server environment configuration and never enter Git.
- Every task follows red-green-refactor and ends with its own commit.

## Delivery Boundary

This plan delivers the first independently testable subproject from the approved specification: the real-data local preview. It does not implement production write workflows, SMS MFA, customer-facing design approval links, OSS uploads, inventory mutations, or production deployment. Those belong to Phase 1B and Phase 1C plans after this preview is accepted.

## File Structure

```text
.
├── apps/
│   ├── api/
│   │   ├── src/config/env.ts                 # Runtime validation and secret loading
│   │   ├── src/modules/dashboard/route.ts    # GET /api/dashboard/owner
│   │   ├── src/modules/health/route.ts       # Health and source freshness
│   │   ├── src/app.ts                        # Fastify composition
│   │   └── src/server.ts                     # Process entrypoint
│   └── web/
│       ├── src/app/router.tsx                # Application routes
│       ├── src/app/providers.tsx             # Query and theme providers
│       ├── src/components/                   # Focused reusable UI components
│       ├── src/features/dashboard/           # Owner dashboard feature
│       ├── src/features/evidence/            # Evidence drawer
│       ├── src/lib/api.ts                     # Typed API client
│       ├── src/styles/tokens.css              # Graphite/gold design tokens
│       ├── src/App.tsx
│       └── src/main.tsx
├── packages/
│   ├── contracts/src/dashboard.ts            # Shared Zod schemas and types
│   └── data-access/src/
│       ├── ports/dashboard-reader.ts          # Data-source interface
│       ├── postgres/wecom-dashboard-reader.ts # Read-only SQL adapter
│       ├── demo/demo-operations-reader.ts     # Deterministic demo records
│       └── compose-dashboard.ts               # Real/demo aggregation
├── scripts/open-readonly-tunnel.sh            # Safe SSH tunnel helper
├── tests/e2e/owner-dashboard.spec.ts           # Desktop/mobile browser tests
├── .env.example
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── vitest.workspace.ts
```

---

### Task 1: Workspace, Contracts, and Test Harness

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `vitest.workspace.ts`
- Create: `packages/contracts/package.json`
- Create: `packages/contracts/src/dashboard.ts`
- Test: `packages/contracts/src/dashboard.test.ts`

**Interfaces:**
- Produces: `DataStatus`, `OwnerDashboard`, `OwnerDashboardSchema`, and `DashboardEvidence` from `@shuanglong/contracts`.
- Consumes: none.

- [ ] **Step 1: Write the failing contract test**

```ts
import { describe, expect, it } from "vitest";
import { OwnerDashboardSchema } from "./dashboard";

describe("OwnerDashboardSchema", () => {
  it("rejects a demo card without an explicit demo label", () => {
    const result = OwnerDashboardSchema.safeParse({
      generatedAt: "2026-08-03T07:00:00+08:00",
      sourceFreshness: { lastMessageAt: null, status: "demo" },
      digest: { title: "今日简报", summary: "演示内容", status: "demo" },
      metrics: [{ key: "finance", label: "本月收入", value: "¥0", status: "demo" }],
      projects: [], materials: [], leads: [], approvals: [],
    });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test and verify the missing module failure**

Run: `pnpm vitest packages/contracts/src/dashboard.test.ts --run`

Expected: FAIL because `./dashboard` does not exist.

- [ ] **Step 3: Add workspace configuration and the shared schema**

```ts
import { z } from "zod";

export const DataStatusSchema = z.enum([
  "real", "demo", "ai_inferred", "pending_confirmation",
  "confirmed", "rejected", "archived",
]);
export type DataStatus = z.infer<typeof DataStatusSchema>;

const LabeledDataSchema = z.object({
  status: DataStatusSchema,
  statusLabel: z.string().min(1),
});

export const DashboardEvidenceSchema = z.object({
  id: z.string(),
  sourceType: z.enum(["message", "digest", "todo", "risk", "event", "demo"]),
  excerpt: z.string(),
  occurredAt: z.string().nullable(),
  senderName: z.string().nullable(),
});
export type DashboardEvidence = z.infer<typeof DashboardEvidenceSchema>;

export const OwnerDashboardSchema = z.object({
  generatedAt: z.string(),
  sourceFreshness: z.object({ lastMessageAt: z.string().nullable() }).merge(LabeledDataSchema),
  digest: z.object({ title: z.string(), summary: z.string(), evidence: z.array(DashboardEvidenceSchema).default([]) }).merge(LabeledDataSchema),
  metrics: z.array(z.object({ key: z.string(), label: z.string(), value: z.string(), trend: z.string().optional() }).merge(LabeledDataSchema)),
  projects: z.array(z.object({ id: z.string(), name: z.string(), stage: z.string(), progress: z.number().min(0).max(100), riskLevel: z.enum(["none", "low", "medium", "high"]), evidence: z.array(DashboardEvidenceSchema) }).merge(LabeledDataSchema)),
  materials: z.array(z.object({ id: z.string(), projectName: z.string(), materialName: z.string(), state: z.string(), expectedAt: z.string().nullable() }).merge(LabeledDataSchema)),
  leads: z.array(z.object({ id: z.string(), customerName: z.string(), stage: z.string(), probability: z.number().min(0).max(100), nextActionAt: z.string().nullable() }).merge(LabeledDataSchema)),
  approvals: z.array(z.object({ id: z.string(), type: z.string(), title: z.string(), amount: z.number().nullable() }).merge(LabeledDataSchema)),
});
export type OwnerDashboard = z.infer<typeof OwnerDashboardSchema>;
```

Create root scripts: `dev`, `build`, `test`, `typecheck`, and `test:e2e`. Pin installed major versions in `package.json` and commit the generated `pnpm-lock.yaml`.

- [ ] **Step 4: Run contract tests and type checking**

Run: `pnpm vitest packages/contracts/src/dashboard.test.ts --run && pnpm -r typecheck`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json vitest.workspace.ts packages/contracts
git commit -m "chore: scaffold dashboard preview workspace"
```

### Task 2: Deterministic Demo Operations Reader

**Files:**
- Create: `packages/data-access/package.json`
- Create: `packages/data-access/src/ports/dashboard-reader.ts`
- Create: `packages/data-access/src/demo/demo-operations-reader.ts`
- Test: `packages/data-access/src/demo/demo-operations-reader.test.ts`

**Interfaces:**
- Consumes: `OwnerDashboard` fields and `DataStatus` from `@shuanglong/contracts`.
- Produces: `DashboardReader` and `createDemoOperationsReader(now: Date): DashboardReader`.

- [ ] **Step 1: Write the failing demo labeling test**

```ts
import { describe, expect, it } from "vitest";
import { createDemoOperationsReader } from "./demo-operations-reader";

it("marks every unavailable operations record as demo", async () => {
  const reader = createDemoOperationsReader(new Date("2026-08-03T07:00:00+08:00"));
  const snapshot = await reader.read();
  const records = [...snapshot.materials, ...snapshot.leads, ...snapshot.approvals];
  expect(records.length).toBeGreaterThan(0);
  expect(records.every((item) => item.status === "demo" && item.statusLabel === "演示数据")).toBe(true);
});
```

- [ ] **Step 2: Verify the test fails**

Run: `pnpm vitest packages/data-access/src/demo/demo-operations-reader.test.ts --run`

Expected: FAIL because the reader is missing.

- [ ] **Step 3: Define the port and fixtures**

```ts
import type { OwnerDashboard } from "@shuanglong/contracts";

export type DashboardSnapshot = Pick<OwnerDashboard, "digest" | "metrics" | "projects" | "materials" | "leads" | "approvals" | "sourceFreshness">;
export interface DashboardReader { read(): Promise<DashboardSnapshot>; }
```

The demo reader returns stable records for quotation approval, finance approval, inventory, scheduling, material arrival, and lead follow-up. Every record has `status: "demo"` and `statusLabel: "演示数据"`; demo records never contain copied real names or phone numbers.

- [ ] **Step 4: Run the reader test**

Run: `pnpm vitest packages/data-access/src/demo/demo-operations-reader.test.ts --run`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/data-access
git commit -m "feat: add explicitly labeled operations demo data"
```

### Task 3: Read-Only WeCom PostgreSQL Adapter

**Files:**
- Create: `apps/api/src/config/env.ts`
- Create: `packages/data-access/src/postgres/wecom-dashboard-reader.ts`
- Create: `packages/data-access/src/postgres/queries.ts`
- Create: `packages/data-access/src/postgres/row-mappers.ts`
- Test: `packages/data-access/src/postgres/wecom-dashboard-reader.test.ts`
- Create: `.env.example`

**Interfaces:**
- Consumes: `DashboardReader`, `pg.Pool`, and the existing `messages`, `events`, `todos`, `risks`, `digests`, and `group_projects` tables.
- Produces: `createWecomDashboardReader(pool: Pick<Pool, "query">): DashboardReader`.

- [ ] **Step 1: Write a failing adapter test with a query stub**

```ts
it("maps real project and freshness rows without inventing data", async () => {
  const query = vi.fn()
    .mockResolvedValueOnce({ rows: [{ last_message_at: "2026-08-02T22:40:00+08:00" }] })
    .mockResolvedValueOnce({ rows: [{ project_id: "p1", project_name: "测试工地甲", stage: "防水", progress: 62, risk_level: "medium", excerpt: "合成施工事件摘要", occurred_at: "2026-08-02T22:20:00+08:00" }] })
    .mockResolvedValueOnce({ rows: [] })
    .mockResolvedValueOnce({ rows: [] });
  const snapshot = await createWecomDashboardReader({ query } as never).read();
  expect(snapshot.projects[0]).toMatchObject({ name: "测试工地甲", status: "real", statusLabel: "真实数据" });
  expect(snapshot.sourceFreshness.lastMessageAt).toContain("2026-08-02");
});
```

- [ ] **Step 2: Run the test and verify failure**

Run: `pnpm vitest packages/data-access/src/postgres/wecom-dashboard-reader.test.ts --run`

Expected: FAIL because the adapter is missing.

- [ ] **Step 3: Implement parameter-free, read-only aggregate queries**

Use only `SELECT` statements. Put each query in `queries.ts` and reject unexpected table/schema values rather than interpolating identifiers. The project query joins `group_projects` with the latest relevant `events`, `todos`, and `risks`; evidence excerpts are capped at 160 Unicode characters in the mapper. Do not select `messages.raw_json` for the dashboard.

```ts
export const SOURCE_FRESHNESS_SQL = `
  select max(msgtime) as last_message_at from messages
`;

export const ACTIVE_PROJECTS_SQL = `
  select gp.project_id, gp.project_name,
         coalesce(max(t.stage), '待识别') as stage,
         coalesce(max(t.progress), 0) as progress,
         coalesce(max(r.risk_level), 'none') as risk_level,
         left(max(e.raw_chat), 160) as excerpt,
         max(e.created_at) as occurred_at
    from group_projects gp
    left join todos t on t.project_id = gp.project_id
    left join risks r on r.project_id = gp.project_id
    left join events e on e.project_id = gp.project_id
   group by gp.project_id, gp.project_name
`;
```

Before finalizing SQL during execution, introspect the production schema through the read-only tunnel and adjust only column names—not business semantics. Record the verified schema names in `docs/data/wecom-schema.md` without sample message content or secrets.

- [ ] **Step 4: Validate env and enforce read-only sessions**

`env.ts` accepts `WECOM_DATABASE_URL` and sets `options=-c default_transaction_read_only=on`. The adapter starts a transaction with `SET TRANSACTION READ ONLY` for every snapshot read. `.env.example` contains only placeholders.

- [ ] **Step 5: Run tests**

Run: `pnpm vitest packages/data-access/src/postgres/wecom-dashboard-reader.test.ts --run`

Expected: PASS and all captured SQL starts with `SELECT`, `BEGIN`, `SET TRANSACTION READ ONLY`, `COMMIT`, or `ROLLBACK`.

- [ ] **Step 6: Commit**

```bash
git add .env.example apps/api/src/config packages/data-access/src/postgres docs/data/wecom-schema.md
git commit -m "feat: add read-only wecom dashboard adapter"
```

### Task 4: Real/Demo Dashboard Composition and API

**Files:**
- Create: `packages/data-access/src/compose-dashboard.ts`
- Test: `packages/data-access/src/compose-dashboard.test.ts`
- Create: `apps/api/package.json`
- Create: `apps/api/src/modules/dashboard/route.ts`
- Create: `apps/api/src/modules/health/route.ts`
- Create: `apps/api/src/app.ts`
- Create: `apps/api/src/server.ts`
- Test: `apps/api/src/modules/dashboard/route.test.ts`

**Interfaces:**
- Consumes: two `DashboardReader` instances.
- Produces: `composeOwnerDashboard(real, demo, now): Promise<OwnerDashboard>` and `GET /api/dashboard/owner`.

- [ ] **Step 1: Write failing precedence and API tests**

```ts
it("keeps real project data and fills only unavailable domains with demo records", async () => {
  const result = await composeOwnerDashboard(realReader, demoReader, fixedNow);
  expect(result.projects[0].status).toBe("real");
  expect(result.materials[0].status).toBe("demo");
  expect(result.metrics.find((m) => m.key === "active_projects")?.status).toBe("real");
});

it("returns a schema-valid owner snapshot", async () => {
  const response = await app.inject({ method: "GET", url: "/api/dashboard/owner" });
  expect(response.statusCode).toBe(200);
  expect(OwnerDashboardSchema.parse(response.json())).toBeTruthy();
});
```

- [ ] **Step 2: Run tests and verify failure**

Run: `pnpm vitest packages/data-access/src/compose-dashboard.test.ts apps/api/src/modules/dashboard/route.test.ts --run`

Expected: FAIL because composer and API do not exist.

- [ ] **Step 3: Implement composition rules**

Real records always win for a domain when at least one real record exists. Demo data fills only empty domains. Metrics are recomputed from the chosen domain data and inherit its status. The response is parsed by `OwnerDashboardSchema` before returning.

- [ ] **Step 4: Add health and freshness responses**

`GET /api/health` returns `{ status: "ok" | "degraded", database: "connected" | "unavailable", lastMessageAt }`. A database failure returns the demo snapshot with `sourceFreshness.statusLabel = "真实数据暂不可用"` and HTTP 200 for the dashboard, while health returns `degraded`; never silently label fallback data as real.

- [ ] **Step 5: Run API tests**

Run: `pnpm vitest packages/data-access/src/compose-dashboard.test.ts apps/api/src/modules/dashboard/route.test.ts --run`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/data-access/src/compose-dashboard* apps/api
git commit -m "feat: expose composed owner dashboard API"
```

### Task 5: Branded Application Shell

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/index.html`
- Create: `apps/web/src/main.tsx`
- Create: `apps/web/src/App.tsx`
- Create: `apps/web/src/app/providers.tsx`
- Create: `apps/web/src/app/router.tsx`
- Create: `apps/web/src/components/AppShell.tsx`
- Create: `apps/web/src/components/DataStatusTag.tsx`
- Create: `apps/web/src/styles/tokens.css`
- Create: `apps/web/src/styles/global.css`
- Test: `apps/web/src/components/AppShell.test.tsx`

**Interfaces:**
- Consumes: `DataStatus`.
- Produces: `AppShell`, `DataStatusTag`, and application routes.

- [ ] **Step 1: Write the failing shell test**

```tsx
render(<AppShell><div>页面内容</div></AppShell>);
expect(screen.getByText("双龙装饰 · AI 经营管理中心")).toBeVisible();
expect(screen.getByRole("navigation", { name: "主导航" })).toBeVisible();
expect(screen.getByText("老板首页")).toBeVisible();
```

- [ ] **Step 2: Run the test and verify failure**

Run: `pnpm vitest apps/web/src/components/AppShell.test.tsx --run`

Expected: FAIL because the shell is missing.

- [ ] **Step 3: Implement the approved executive-workbench shell**

Use CSS custom properties:

```css
:root {
  --sl-bg: #0f151c;
  --sl-panel: #19232d;
  --sl-panel-raised: #202c37;
  --sl-border: #2c3944;
  --sl-text: #eef3f7;
  --sl-muted: #94a1ad;
  --sl-gold: #c9a45e;
  --sl-success: #5fc99a;
  --sl-warning: #e2ae55;
  --sl-danger: #ef737b;
  --sl-radius: 14px;
}
```

Navigation items are 老板首页、工地管理、主材采购、客户销售、设计报价、财务中心、库存管理、员工排班、AI 待确认、系统设置. Phase 1A unavailable pages render a deliberate preview state, not an empty page.

- [ ] **Step 4: Implement status labels**

`DataStatusTag` maps statuses exactly: `real → 真实数据`, `demo → 演示数据`, `ai_inferred → AI 推测`, `pending_confirmation → 待确认`, `confirmed → 已确认`, `rejected → 已驳回`, `archived → 已归档`. Color alone is never the only distinction.

- [ ] **Step 5: Run component tests and accessibility checks**

Run: `pnpm vitest apps/web/src/components/AppShell.test.tsx --run`

Expected: PASS with navigation accessible by role and keyboard.

- [ ] **Step 6: Commit**

```bash
git add apps/web
git commit -m "feat: add shuanglong executive app shell"
```

### Task 6: Desktop Owner Dashboard

**Files:**
- Create: `apps/web/src/lib/api.ts`
- Create: `apps/web/src/features/dashboard/useOwnerDashboard.ts`
- Create: `apps/web/src/features/dashboard/OwnerDashboardPage.tsx`
- Create: `apps/web/src/features/dashboard/DigestCard.tsx`
- Create: `apps/web/src/features/dashboard/MetricGrid.tsx`
- Create: `apps/web/src/features/dashboard/ProjectAttentionList.tsx`
- Create: `apps/web/src/features/dashboard/ApprovalQueue.tsx`
- Create: `apps/web/src/features/dashboard/OpportunityList.tsx`
- Create: `apps/web/src/features/dashboard/dashboard.css`
- Test: `apps/web/src/features/dashboard/OwnerDashboardPage.test.tsx`

**Interfaces:**
- Consumes: `GET /api/dashboard/owner` and `OwnerDashboard`.
- Produces: `/` owner dashboard route and its focused cards.

- [ ] **Step 1: Write the failing dashboard rendering test**

```tsx
server.use(http.get("/api/dashboard/owner", () => HttpResponse.json(fixture)));
render(<TestProviders><OwnerDashboardPage /></TestProviders>);
expect(await screen.findByText("AI 经营简报")).toBeVisible();
expect(screen.getByText("需要关注的工地")).toBeVisible();
expect(screen.getAllByText("演示数据").length).toBeGreaterThan(0);
expect(screen.getByText("测试工地甲")).toBeVisible();
```

- [ ] **Step 2: Run the test and verify failure**

Run: `pnpm vitest apps/web/src/features/dashboard/OwnerDashboardPage.test.tsx --run`

Expected: FAIL because dashboard components are missing.

- [ ] **Step 3: Implement typed data loading and loading/error states**

`fetchOwnerDashboard()` fetches `/api/dashboard/owner`, parses with `OwnerDashboardSchema`, and throws a Chinese user-facing error when validation fails. TanStack Query keeps the previous snapshot during refresh and displays the last message time.

- [ ] **Step 4: Build the approved first viewport**

Order is: AI digest → core metrics → project attention list and owner approvals → opportunity list. Risk projects sort high-to-low and then by delay; approvals show type, title, amount, and data status. Do not invent charts when one number or a short list communicates the fact more clearly.

- [ ] **Step 5: Run dashboard tests**

Run: `pnpm vitest apps/web/src/features/dashboard/OwnerDashboardPage.test.tsx --run`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib apps/web/src/features/dashboard
git commit -m "feat: build real-data owner dashboard"
```

### Task 7: Evidence Drawer and Source Transparency

**Files:**
- Create: `apps/web/src/features/evidence/EvidenceDrawer.tsx`
- Create: `apps/web/src/features/evidence/EvidenceList.tsx`
- Modify: `apps/web/src/features/dashboard/DigestCard.tsx`
- Modify: `apps/web/src/features/dashboard/ProjectAttentionList.tsx`
- Test: `apps/web/src/features/evidence/EvidenceDrawer.test.tsx`

**Interfaces:**
- Consumes: `DashboardEvidence[]`.
- Produces: `EvidenceDrawer({ open, onClose, title, evidence })`.

- [ ] **Step 1: Write a failing evidence privacy test**

```tsx
render(<EvidenceDrawer open={false} onClose={vi.fn()} title="施工依据" evidence={evidence} />);
expect(screen.queryByText("合成施工事件摘要")).not.toBeVisible();
await user.click(screen.getByRole("button", { name: "查看依据" }));
expect(screen.getByText("合成施工事件摘要")).toBeVisible();
```

- [ ] **Step 2: Run and verify failure**

Run: `pnpm vitest apps/web/src/features/evidence/EvidenceDrawer.test.tsx --run`

Expected: FAIL because the evidence UI is missing.

- [ ] **Step 3: Implement explicit expansion**

Dashboard cards show only the summary and source count. The drawer appears only after “查看依据”; it shows source type, sender display name, occurred time, and a capped excerpt. No `raw_json` or hidden metadata is rendered.

- [ ] **Step 4: Run evidence tests**

Run: `pnpm vitest apps/web/src/features/evidence/EvidenceDrawer.test.tsx --run`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/evidence apps/web/src/features/dashboard
git commit -m "feat: add traceable dashboard evidence"
```

### Task 8: Mobile Task-First Layout

**Files:**
- Create: `apps/web/src/components/MobileTabBar.tsx`
- Modify: `apps/web/src/components/AppShell.tsx`
- Modify: `apps/web/src/features/dashboard/dashboard.css`
- Test: `apps/web/src/components/MobileTabBar.test.tsx`
- Test: `tests/e2e/owner-dashboard.spec.ts`

**Interfaces:**
- Consumes: existing routes and dashboard cards.
- Produces: mobile bottom navigation and responsive dashboard behavior.

- [ ] **Step 1: Write failing mobile navigation and viewport tests**

```ts
test("mobile shows the task-first order without horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("navigation", { name: "手机导航" })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
});
```

- [ ] **Step 2: Run and verify failure**

Run: `pnpm test:e2e --grep "mobile shows"`

Expected: FAIL because mobile navigation is missing.

- [ ] **Step 3: Implement responsive behavior**

Below 768px, hide the desktop sidebar, show bottom tabs 首页、工地、客户、待办、我的, stack dashboard cards, keep tap targets at least 44px, and pin no business-critical content behind hover. Above 1200px, use the approved two-column executive layout.

- [ ] **Step 4: Run component and E2E tests**

Run: `pnpm vitest apps/web/src/components/MobileTabBar.test.tsx --run && pnpm test:e2e --grep "mobile shows"`

Expected: PASS at 390×844 and desktop 1440×1000.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components apps/web/src/features/dashboard/dashboard.css tests/e2e
git commit -m "feat: add mobile owner workflow"
```

### Task 9: Safe Tunnel, Local Preview, and Final Verification

**Files:**
- Create: `scripts/open-readonly-tunnel.sh`
- Create: `docs/runbooks/local-preview.md`
- Create: `docs/runbooks/production-readiness.md`
- Modify: `package.json`
- Test: `tests/e2e/owner-dashboard.spec.ts`

**Interfaces:**
- Consumes: SSH host configuration supplied outside Git, local PostgreSQL port, API and web dev servers.
- Produces: one documented command sequence for safe local preview and a Phase 1C deployment checklist.

- [ ] **Step 1: Write the tunnel safety test**

Add a shell test that runs `bash -n scripts/open-readonly-tunnel.sh` and asserts the script binds only to `127.0.0.1`, rejects empty `SSH_HOST`, and never accepts a password argument.

- [ ] **Step 2: Implement the SSH helper**

```bash
#!/usr/bin/env bash
set -euo pipefail
: "${SSH_HOST:?Set SSH_HOST in your shell}"
: "${SSH_USER:?Set a restricted SSH tunnel user in your shell}"
: "${LOCAL_DB_PORT:=15432}"
exec ssh -N -o ExitOnForwardFailure=yes \
  -L "127.0.0.1:${LOCAL_DB_PORT}:127.0.0.1:5432" \
  "${SSH_USER}@${SSH_HOST}"
```

The runbook requires SSH keys and a dedicated database account granted `CONNECT`, `USAGE`, and `SELECT` only. It explicitly forbids copying the historical root password into `.env` or scripts.

- [ ] **Step 3: Document the preview sequence**

The runbook contains:

```bash
cp .env.example .env
SSH_HOST=<ssh-config-alias> SSH_USER=dashboard-tunnel scripts/open-readonly-tunnel.sh
pnpm install
pnpm dev
```

It explains that real source freshness and verified real projects appear only when the tunnel is connected; demo labels remain on unavailable domains.

- [ ] **Step 4: Run the complete verification suite**

Run: `pnpm typecheck && pnpm test && pnpm build && pnpm test:e2e`

Expected: all commands exit 0; E2E verifies desktop, mobile, real/demo labels, evidence expansion, degraded database state, and no horizontal overflow.

- [ ] **Step 5: Perform browser acceptance against the real read-only source**

With the tunnel open, verify:

- source freshness equals the latest server message time;
- the real project count equals the current `group_projects` count;
- real-project evidence opens only after clicking “查看依据”;
- quotation, finance, inventory, and scheduling cards are labeled “演示数据”;
- no SQL statement other than read-only transaction control and `SELECT` appears in API logs.

- [ ] **Step 6: Commit**

```bash
git add scripts docs/runbooks package.json tests/e2e
git commit -m "docs: add safe local preview workflow"
```

## Phase 1A Completion Gate

Do not start Phase 1B until the owner accepts the local preview. Acceptance requires:

- the approved B-layout visual direction is recognizable;
- real server records are read-only and traceable;
- missing domains are visibly demo-only;
- desktop and mobile flows pass automated tests;
- the local database connection uses SSH forwarding and a read-only PostgreSQL role;
- no production password or message body is committed to Git.

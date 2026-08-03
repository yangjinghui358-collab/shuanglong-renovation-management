import type { Pool, PoolClient } from "pg";

import type { DashboardReader, DashboardSnapshot } from "../ports/dashboard-reader";
import {
  ACTIVE_PROJECTS_SQL,
  LATEST_DIGEST_SQL,
  SOURCE_FRESHNESS_SQL,
} from "./queries";
import {
  mapDigest,
  mapProjectRows,
  mapSourceFreshness,
  type DigestRow,
  type ProjectRow,
  type SourceFreshnessRow,
} from "./row-mappers";

type QueryOnlyPool = Pick<Pool, "query"> & Partial<Pick<Pool, "connect">>;

function isPoolClient(
  executor: QueryOnlyPool | PoolClient,
): executor is PoolClient {
  return "release" in executor && typeof executor.release === "function";
}

export function createWecomDashboardReader(pool: QueryOnlyPool): DashboardReader {
  return {
    async read(): Promise<DashboardSnapshot> {
      const executor = pool.connect ? await pool.connect() : pool;

      try {
        await executor.query("BEGIN");
        await executor.query("SET TRANSACTION READ ONLY");

        const freshnessResult = await executor.query<SourceFreshnessRow>(
          SOURCE_FRESHNESS_SQL,
        );
        const projectsResult = await executor.query<ProjectRow>(
          ACTIVE_PROJECTS_SQL,
        );
        const digestResult = await executor.query<DigestRow>(LATEST_DIGEST_SQL);

        await executor.query("COMMIT");

        return {
          sourceFreshness: mapSourceFreshness(freshnessResult.rows[0]),
          digest: mapDigest(digestResult.rows[0]),
          metrics: [],
          projects: mapProjectRows(projectsResult.rows),
          materials: [],
          leads: [],
          approvals: [],
        };
      } catch (error) {
        try {
          await executor.query("ROLLBACK");
        } catch {
          // Preserve the original read error; a broken connection may also reject rollback.
        }
        throw error;
      } finally {
        if (isPoolClient(executor)) executor.release();
      }
    },
  };
}

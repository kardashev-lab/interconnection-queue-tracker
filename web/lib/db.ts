import fs from "node:fs";
import path from "node:path";
import pg from "pg";
import type { LiveTotals, QueueProject, QueueRow } from "./types";

function resolveCuratedPath(): string {
  if (process.env.CURATED_PATH) {
    return process.env.CURATED_PATH;
  }

  const localPath = path.join(/* turbopackIgnore: true */ process.cwd(), "data", "curated.json");
  if (fs.existsSync(localPath)) {
    return localPath;
  }

  return path.join(/* turbopackIgnore: true */ process.cwd(), "..", "data", "curated.json");
}

let pool: pg.Pool | null = null;
let schemaKnownReady = false;

function getPool(): pg.Pool | null {
  if (!process.env.DATABASE_URL) return null;
  if (!pool) {
    pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
    pool.on("error", (err) => console.error("Postgres pool error:", err.message));
  }
  return pool;
}

// Exposed for lib/interconnection-timelines.ts, which runs its own
// aggregation query against ercot_gis_snapshots (a table this app only
// reads, owned by services/fetcher/backfill_gis.py).
export function getTimelinePool(): pg.Pool | null {
  return getPool();
}

// The fetcher owns the schema (services/fetcher/schema.sql); the web app only
// reads. Before the first fetch run the tables won't exist yet, so check once
// and let callers fall back to curated data instead of erroring.
async function schemaReady(db: pg.Pool): Promise<boolean> {
  if (schemaKnownReady) return true;
  const { rows } = await db.query(
    "SELECT to_regclass('queue_market_snapshots') AS snapshots, to_regclass('queue_projects') AS projects",
  );
  schemaKnownReady = Boolean(rows[0]?.snapshots && rows[0]?.projects);
  return schemaKnownReady;
}

function formatSnapshot(row: Record<string, unknown>): QueueRow {
  return {
    id: String(row.id),
    market: String(row.market),
    category: String(row.category),
    headline: row.headline ? String(row.headline) : undefined,
    status: row.status ? String(row.status) : undefined,
    pressure: Number(row.pressure),
    updated: row.updated ? String(row.updated).slice(0, 10) : null,
    queueMw: row.queue_mw != null ? Number(row.queue_mw) : undefined,
    requestCount: row.request_count != null ? Number(row.request_count) : undefined,
    mix: (row.mix as Record<string, number> | null) ?? undefined,
    metrics: (row.metrics as QueueRow["metrics"]) ?? undefined,
    summary: row.summary ? String(row.summary) : undefined,
    sourceLabel: row.source_label ? String(row.source_label) : undefined,
    sourceUrl: row.source_url ? String(row.source_url) : undefined,
    dataMode: row.data_mode as QueueRow["dataMode"],
  };
}

export function loadCuratedFallback(): QueueRow[] {
  try {
    const curatedPath = resolveCuratedPath();
    const resolved = path.isAbsolute(curatedPath)
      ? curatedPath
      : path.resolve(/* turbopackIgnore: true */ process.cwd(), curatedPath);
    if (!fs.existsSync(resolved)) {
      console.error("Curated fallback not found:", resolved);
      return [];
    }
    return JSON.parse(fs.readFileSync(resolved, "utf8")) as QueueRow[];
  } catch (err) {
    console.error("Failed to load curated fallback:", err);
    return [];
  }
}

export async function fetchQueueRows(): Promise<QueueRow[] | null> {
  const db = getPool();
  if (!db) return null;

  if (!(await schemaReady(db))) return null;
  const { rows } = await db.query(
    "SELECT * FROM queue_market_snapshots ORDER BY pressure DESC, market ASC",
  );
  return rows.map(formatSnapshot);
}

export async function hasLiveData(): Promise<boolean> {
  const db = getPool();
  if (!db) return false;
  if (!(await schemaReady(db))) return false;
  const { rows } = await db.query(
    "SELECT COUNT(*)::int AS n FROM queue_market_snapshots WHERE data_mode = 'live'",
  );
  return rows[0].n > 0;
}

function formatProject(row: Record<string, unknown>): QueueProject {
  return {
    market: String(row.market),
    queueId: String(row.queue_id),
    projectName: row.project_name ? String(row.project_name) : null,
    mw: row.mw != null ? Number(row.mw) : null,
    fuel: row.fuel ? String(row.fuel) : null,
    status: row.status ? String(row.status) : null,
    state: row.state ? String(row.state) : null,
    county: row.county ? String(row.county) : null,
  };
}

export async function fetchProjects(market?: string): Promise<QueueProject[]> {
  const db = getPool();
  if (!db) return [];

  if (!(await schemaReady(db))) return [];
  const params: unknown[] = [];
  let where = "";
  if (market) {
    params.push(market);
    where = "WHERE market = $1";
  }

  const { rows } = await db.query(
    `SELECT market, queue_id, project_name, mw, fuel, status, state, county
     FROM queue_projects
     ${where}
     ORDER BY mw DESC NULLS LAST, queue_id ASC`,
    params,
  );
  return rows.map(formatProject);
}

export async function fetchLiveTotals(): Promise<LiveTotals | null> {
  const db = getPool();
  if (!db) return null;

  if (!(await schemaReady(db))) return null;
  const { rows } = await db.query(`
    SELECT
      COUNT(*)::int AS project_count,
      COALESCE(SUM(mw), 0)::float AS total_mw,
      MAX(fetched_at)::text AS last_fetched,
      ARRAY_AGG(DISTINCT market ORDER BY market) AS markets
    FROM queue_projects
  `);

  const row = rows[0];
  if (!row || row.project_count === 0) return null;

  return {
    projectCount: row.project_count,
    totalMw: Number(row.total_mw),
    lastFetched: row.last_fetched,
    markets: (row.markets as string[] | null)?.filter(Boolean) ?? [],
  };
}

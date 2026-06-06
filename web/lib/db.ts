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
let schemaReady: Promise<void> | null = null;

function getPool(): pg.Pool | null {
  if (!process.env.DATABASE_URL) return null;
  if (!pool) {
    pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
    pool.on("error", (err) => console.error("Postgres pool error:", err.message));
  }
  return pool;
}

async function ensureSchema(): Promise<void> {
  const db = getPool();
  if (!db) return;

  if (!schemaReady) {
    schemaReady = (async () => {
      await db.query(`
        CREATE TABLE IF NOT EXISTS queue_projects (
          market TEXT NOT NULL,
          queue_id TEXT NOT NULL,
          project_name TEXT,
          mw NUMERIC,
          fuel TEXT,
          status TEXT,
          queue_date DATE,
          county TEXT,
          state TEXT,
          fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          PRIMARY KEY (market, queue_id)
        );
      `);
      await db.query(`
        CREATE TABLE IF NOT EXISTS queue_market_snapshots (
          id TEXT PRIMARY KEY,
          market TEXT NOT NULL,
          category TEXT NOT NULL,
          headline TEXT,
          status TEXT,
          pressure INTEGER NOT NULL DEFAULT 0,
          updated DATE,
          queue_mw NUMERIC,
          request_count INTEGER,
          mix JSONB,
          metrics JSONB,
          summary TEXT,
          source_label TEXT,
          source_url TEXT,
          data_mode TEXT NOT NULL DEFAULT 'curated',
          fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);
      await seedCuratedIfEmpty(db);
    })();
  }

  await schemaReady;
}

async function seedCuratedIfEmpty(db: pg.Pool): Promise<void> {
  const { rows } = await db.query("SELECT COUNT(*)::int AS n FROM queue_market_snapshots");
  if (rows[0].n > 0) return;

  const curated = loadCuratedFallback();
  for (const row of curated) {
    await upsertSnapshot(db, row);
  }
}

function toSnapshotRow(row: QueueRow) {
  return {
    id: row.id,
    market: row.market,
    category: row.category,
    headline: row.headline ?? null,
    status: row.status ?? "Active",
    pressure: row.pressure ?? 0,
    updated: row.updated ?? null,
    queue_mw: row.queueMw ?? null,
    request_count: row.requestCount ?? null,
    mix: row.mix ? JSON.stringify(row.mix) : null,
    metrics: row.metrics ? JSON.stringify(row.metrics) : null,
    summary: row.summary ?? null,
    source_label: row.sourceLabel ?? null,
    source_url: row.sourceUrl ?? null,
    data_mode: row.dataMode ?? "curated",
  };
}

async function upsertSnapshot(db: pg.Pool, row: QueueRow): Promise<void> {
  const s = toSnapshotRow(row);
  await db.query(
    `INSERT INTO queue_market_snapshots (
       id, market, category, headline, status, pressure, updated,
       queue_mw, request_count, mix, metrics, summary,
       source_label, source_url, data_mode, fetched_at
     ) VALUES (
       $1, $2, $3, $4, $5, $6, $7,
       $8, $9, $10::jsonb, $11::jsonb, $12,
       $13, $14, $15, NOW()
     )
     ON CONFLICT (id) DO UPDATE SET
       market = EXCLUDED.market,
       category = EXCLUDED.category,
       headline = EXCLUDED.headline,
       status = EXCLUDED.status,
       pressure = EXCLUDED.pressure,
       updated = EXCLUDED.updated,
       queue_mw = EXCLUDED.queue_mw,
       request_count = EXCLUDED.request_count,
       mix = EXCLUDED.mix,
       metrics = EXCLUDED.metrics,
       summary = EXCLUDED.summary,
       source_label = EXCLUDED.source_label,
       source_url = EXCLUDED.source_url,
       data_mode = EXCLUDED.data_mode,
       fetched_at = NOW()`,
    [
      s.id,
      s.market,
      s.category,
      s.headline,
      s.status,
      s.pressure,
      s.updated,
      s.queue_mw,
      s.request_count,
      s.mix,
      s.metrics,
      s.summary,
      s.source_label,
      s.source_url,
      s.data_mode,
    ],
  );
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

  await ensureSchema();
  const { rows } = await db.query(
    "SELECT * FROM queue_market_snapshots ORDER BY pressure DESC, market ASC",
  );
  return rows.map(formatSnapshot);
}

export async function hasLiveData(): Promise<boolean> {
  const db = getPool();
  if (!db) return false;
  await ensureSchema();
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

  await ensureSchema();
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

  await ensureSchema();
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

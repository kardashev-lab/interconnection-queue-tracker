-- Canonical schema for the interconnection queue tracker.
-- The fetcher owns DDL; the web app only reads (see web/lib/db.ts).

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

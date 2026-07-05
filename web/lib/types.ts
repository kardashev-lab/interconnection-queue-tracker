export type DataMode = "live" | "curated";

export interface QueueRow {
  id: string;
  market: string;
  category: string;
  headline?: string;
  status?: string;
  pressure: number;
  updated?: string | null;
  queueMw?: number;
  requestCount?: number;
  mix?: Record<string, number>;
  metrics?: { label: string; value: string }[];
  summary?: string;
  sourceLabel?: string;
  sourceUrl?: string;
  dataMode?: DataMode;
}

export interface QueueProject {
  market: string;
  queueId: string;
  projectName?: string | null;
  mw?: number | null;
  fuel?: string | null;
  status?: string | null;
  state?: string | null;
  county?: string | null;
}

export interface LiveTotals {
  projectCount: number;
  totalMw: number;
  lastFetched: string | null;
  markets: string[];
}

export interface QueuePayload {
  source: "database" | "curated-fallback" | "static";
  rows: QueueRow[];
  live: boolean;
  projects: QueueProject[];
  liveTotals: LiveTotals | null;
}

// ERCOT's monthly Large Load Working Group status update -- see
// kardashev-data's ingest/ercot_large_load.py for how this is extracted.
export interface ErcotLargeLoadSnapshot {
  snapshotMonth: string;
  reportDate: string | null;
  totalMw: number | null;
  colocatedMw: number | null;
  standaloneMw: number | null;
  byStatus: Record<string, number> | null;
  bySizeBucket: Record<string, { count: number; mw: number }> | null;
  byType: Record<string, { pct: number; mw: number | null }> | null;
  byZone: Record<string, number> | null;
  approvedToEnergizeMw: number | null;
  planningStudiesApprovedMw: number | null;
  sourceUrl: string | null;
}

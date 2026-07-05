import type { ErcotLargeLoadSnapshot } from "./types";

const KARDASHEV_DATA_URL = process.env.KARDASHEV_DATA_URL ?? "https://data.kardashevlabs.org";

interface RawSnapshot {
  snapshot_month: string;
  report_date: string | null;
  total_mw: number | null;
  colocated_mw: number | null;
  standalone_mw: number | null;
  by_status: Record<string, number> | null;
  by_size_bucket: Record<string, { count: number; mw: number }> | null;
  by_type: Record<string, { pct: number; mw: number | null }> | null;
  by_zone: Record<string, number> | null;
  approved_to_energize_mw: number | null;
  planning_studies_approved_mw: number | null;
  source_url: string | null;
}

function toSnapshot(row: RawSnapshot): ErcotLargeLoadSnapshot {
  return {
    snapshotMonth: row.snapshot_month,
    reportDate: row.report_date,
    totalMw: row.total_mw,
    colocatedMw: row.colocated_mw,
    standaloneMw: row.standalone_mw,
    byStatus: row.by_status,
    bySizeBucket: row.by_size_bucket,
    byType: row.by_type,
    byZone: row.by_zone,
    approvedToEnergizeMw: row.approved_to_energize_mw,
    planningStudiesApprovedMw: row.planning_studies_approved_mw,
    sourceUrl: row.source_url,
  };
}

export async function getErcotLargeLoadHistory(): Promise<ErcotLargeLoadSnapshot[]> {
  try {
    const res = await fetch(`${KARDASHEV_DATA_URL}/ercot/large-load/history`, {
      next: { revalidate: 0 },
    });
    if (!res.ok) return [];
    const rows = (await res.json()) as RawSnapshot[];
    return rows.map(toSnapshot);
  } catch (err) {
    console.error("ERCOT large-load fetch failed:", err);
    return [];
  }
}

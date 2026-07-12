import { getTimelinePool } from "./db";
import type {
  FuelTimelineStat,
  InterconnectionTimelines,
  PendingQueueStat,
  TimelineProject,
  ZoneTimelineStat,
} from "./types";

const DATE_RE = /^\d{4}-\d{2}-\d{2}/;
const NOW = new Date("2026-06-01");

function parseDate(value: string | null): Date | null {
  if (!value || !DATE_RE.test(value)) return null;
  const d = new Date(value.slice(0, 10));
  return Number.isNaN(d.getTime()) ? null : d;
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / 86_400_000);
}

function parseMw(value: number | string | null): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

interface RawRow {
  queue_id: string;
  zone: string | null;
  fuel: string | null;
  project_name: string | null;
  capacity_mw: number | string | null;
  snapshot_month: string;
  screening_study_started: string | null;
  ia_signed: string | null;
  approved_for_energization: string | null;
  projected_cod: string | null;
}

interface ProjectAgg {
  queueId: string;
  zone: string | null;
  fuel: string | null;
  projectName: string | null;
  capacityMw: number | null;
  screeningStudyStarted: Date | null;
  iaSigned: Date | null;
  approvedForEnergization: Date | null;
  firstSeenProjectedCod: Date | null;
}

let cache: { at: number; data: InterconnectionTimelines } | null = null;
const CACHE_MS = 15 * 60 * 1000;

export async function getInterconnectionTimelines(): Promise<InterconnectionTimelines> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.data;

  const data = await computeTimelines();
  cache = { at: Date.now(), data };
  return data;
}

async function computeTimelines(): Promise<InterconnectionTimelines> {
  const empty: InterconnectionTimelines = {
    available: false,
    asOfMonth: null,
    energizedProjectCount: 0,
    zoneStats: [],
    fuelStats: [],
    pendingStats: [],
    pendingTotalCount: 0,
    pendingTotalMw: 0,
    projects: [],
  };

  const db = getTimelinePool();
  if (!db) return empty;

  const tableCheck = await db.query("SELECT to_regclass('ercot_gis_snapshots') AS t");
  if (!tableCheck.rows[0]?.t) return empty;

  const { rows } = await db.query<RawRow>(
    `SELECT queue_id, zone, fuel, project_name, capacity_mw, snapshot_month,
            screening_study_started, ia_signed, approved_for_energization, projected_cod
     FROM ercot_gis_snapshots
     ORDER BY queue_id, snapshot_month ASC`,
  );

  if (rows.length === 0) return empty;

  const byProject = new Map<string, RawRow[]>();
  for (const row of rows) {
    const list = byProject.get(row.queue_id);
    if (list) list.push(row);
    else byProject.set(row.queue_id, [row]);
  }

  const projects: ProjectAgg[] = [];
  let asOfMonth = "";
  for (const [queueId, snapshots] of byProject) {
    const latest = snapshots[snapshots.length - 1];
    if (latest.snapshot_month > asOfMonth) asOfMonth = latest.snapshot_month;

    let screeningStudyStarted: Date | null = null;
    let iaSigned: Date | null = null;
    let approvedForEnergization: Date | null = null;
    for (const s of snapshots) {
      const ss = parseDate(s.screening_study_started);
      if (ss && (!screeningStudyStarted || ss > screeningStudyStarted)) screeningStudyStarted = ss;
      const ia = parseDate(s.ia_signed);
      if (ia && (!iaSigned || ia > iaSigned)) iaSigned = ia;
      const en = parseDate(s.approved_for_energization);
      if (en && (!approvedForEnergization || en > approvedForEnergization)) approvedForEnergization = en;
    }

    projects.push({
      queueId,
      zone: latest.zone,
      fuel: latest.fuel,
      projectName: latest.project_name,
      capacityMw: parseMw(latest.capacity_mw),
      screeningStudyStarted,
      iaSigned,
      approvedForEnergization,
      firstSeenProjectedCod: parseDate(snapshots[0].projected_cod),
    });
  }

  const energized = projects.filter((p) => p.approvedForEnergization != null);

  const zoneGroups = new Map<string, ProjectAgg[]>();
  const fuelGroups = new Map<string, ProjectAgg[]>();
  for (const p of energized) {
    if (p.zone) {
      const list = zoneGroups.get(p.zone) ?? [];
      list.push(p);
      zoneGroups.set(p.zone, list);
    }
    if (p.fuel) {
      const list = fuelGroups.get(p.fuel) ?? [];
      list.push(p);
      fuelGroups.set(p.fuel, list);
    }
  }

  function fullProcessDays(p: ProjectAgg): number | null {
    if (!p.approvedForEnergization || !p.screeningStudyStarted) return null;
    const d = daysBetween(p.approvedForEnergization, p.screeningStudyStarted);
    return d >= 0 && d <= 6000 ? d : null;
  }
  function buildPhaseDays(p: ProjectAgg): number | null {
    if (!p.approvedForEnergization || !p.iaSigned) return null;
    const d = daysBetween(p.approvedForEnergization, p.iaSigned);
    return d >= 0 && d <= 6000 ? d : null;
  }
  function codSlipDays(p: ProjectAgg): number | null {
    if (!p.approvedForEnergization || !p.firstSeenProjectedCod) return null;
    const d = daysBetween(p.approvedForEnergization, p.firstSeenProjectedCod);
    return d >= -2000 && d <= 6000 ? d : null;
  }

  const zoneStats: ZoneTimelineStat[] = Array.from(zoneGroups.entries())
    .map(([zone, list]) => ({
      zone,
      projectCount: list.length,
      fullProcessMedianDays: median(list.map(fullProcessDays).filter((v): v is number => v != null)),
      buildPhaseMedianDays: median(list.map(buildPhaseDays).filter((v): v is number => v != null)),
      codSlipMedianDays: median(list.map(codSlipDays).filter((v): v is number => v != null)),
    }))
    .sort((a, b) => (a.fullProcessMedianDays ?? 0) - (b.fullProcessMedianDays ?? 0));

  const fuelStats: FuelTimelineStat[] = Array.from(fuelGroups.entries())
    .map(([fuel, list]) => ({
      fuel,
      projectCount: list.length,
      fullProcessMedianDays: median(list.map(fullProcessDays).filter((v): v is number => v != null)),
    }))
    .filter((f) => f.projectCount >= 10)
    .sort((a, b) => (a.fullProcessMedianDays ?? 0) - (b.fullProcessMedianDays ?? 0));

  const pending = projects.filter((p) => p.approvedForEnergization == null && p.screeningStudyStarted != null);
  const pendingByZone = new Map<string, ProjectAgg[]>();
  for (const p of pending) {
    if (!p.zone) continue;
    const list = pendingByZone.get(p.zone) ?? [];
    list.push(p);
    pendingByZone.set(p.zone, list);
  }
  const pendingStats: PendingQueueStat[] = Array.from(pendingByZone.entries())
    .map(([zone, list]) => {
      const years = list
        .map((p) => (p.screeningStudyStarted ? daysBetween(NOW, p.screeningStudyStarted) / 365 : null))
        .filter((v): v is number => v != null && v >= 0 && v <= 20);
      return {
        zone,
        projectCount: list.length,
        totalMw: list.reduce((sum, p) => sum + (p.capacityMw ?? 0), 0),
        medianYearsWaiting: median(years),
      };
    })
    .sort((a, b) => (b.medianYearsWaiting ?? 0) - (a.medianYearsWaiting ?? 0));

  const timelineProjects: TimelineProject[] = projects.map((p) => ({
    queueId: p.queueId,
    projectName: p.projectName,
    zone: p.zone,
    fuel: p.fuel,
    capacityMw: p.capacityMw,
    screeningStudyStarted: p.screeningStudyStarted?.toISOString().slice(0, 10) ?? null,
    iaSigned: p.iaSigned?.toISOString().slice(0, 10) ?? null,
    approvedForEnergization: p.approvedForEnergization?.toISOString().slice(0, 10) ?? null,
    projectedCod: p.firstSeenProjectedCod?.toISOString().slice(0, 10) ?? null,
    status: p.approvedForEnergization ? "energized" : "pending",
  }));

  return {
    available: true,
    asOfMonth,
    energizedProjectCount: energized.length,
    zoneStats,
    fuelStats,
    pendingStats,
    pendingTotalCount: pending.length,
    pendingTotalMw: pending.reduce((sum, p) => sum + (p.capacityMw ?? 0), 0),
    projects: timelineProjects,
  };
}

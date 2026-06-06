import { marketMeta } from "./markets";
import { fipsForStateAbbr, normalizeStateAbbr } from "./state-geo";
import type { QueueProject, QueueRow } from "./types";

export interface MarketStats {
  market: string;
  projectCount: number;
  totalMw: number;
  avgMw: number;
  mix: Record<string, number>;
  topFuel: { name: string; mw: number; share: number } | null;
  cleanShare: number;
  snapshot: QueueRow | null;
}

export interface QueueInsight {
  label: string;
  value: string;
  detail?: string;
}

const CLEAN_FUELS = ["solar", "wind", "battery", "storage", "bess", "hydro", "geothermal", "nuclear"];

function normalizeFuel(fuel: string): string {
  const key = fuel.toLowerCase().trim();
  // ISO-NE and other markets publish short fuel codes in queue feeds.
  if (key === "bat" || key === "bess") return "Storage";
  if (key === "wnd") return "Wind";
  if (key === "nuc") return "Nuclear";
  if (key === "sun" || key === "sol" || key === "pv") return "Solar";
  if (key === "wat" || key === "hyr" || key === "hyd") return "Hydro";
  if (key === "nat" || key === "ng" || key === "lng") return "Gas";
  if (key === "col") return "Coal";
  if (key === "oil" || key === "dsl" || key === "dfo") return "Oil";
  if (key.includes("solar") || key.includes("pv")) return "Solar";
  if (key.includes("wind")) return "Wind";
  if (key.includes("battery") || key.includes("storage") || key.includes("bess")) return "Storage";
  if (key.includes("gas") || key.includes("natural")) return "Gas";
  if (key.includes("nuclear")) return "Nuclear";
  if (key.includes("hydro")) return "Hydro";
  if (key.includes("coal")) return "Coal";
  if (key.includes("geothermal")) return "Geothermal";
  if (key.includes("oil") || key.includes("diesel")) return "Oil";
  if (key.includes("hybrid")) return "Hybrid";
  return fuel.trim() || "Other";
}

function normalizeMix(mix: Record<string, number>): Record<string, number> {
  const normalized: Record<string, number> = {};
  for (const [fuel, mw] of Object.entries(mix)) {
    const name = normalizeFuel(fuel);
    normalized[name] = (normalized[name] ?? 0) + mw;
  }
  return normalized;
}

function isCleanFuel(fuel: string): boolean {
  const key = fuel.toLowerCase();
  return CLEAN_FUELS.some((token) => key.includes(token));
}

function mixFromProjects(projects: QueueProject[]): Record<string, number> {
  const mix: Record<string, number> = {};
  for (const project of projects) {
    if (!project.fuel || !project.mw) continue;
    const fuel = normalizeFuel(project.fuel);
    mix[fuel] = (mix[fuel] ?? 0) + project.mw;
  }
  return mix;
}

function cleanShareFromMix(mix: Record<string, number>): number {
  const total = Object.values(mix).reduce((sum, mw) => sum + mw, 0);
  if (total <= 0) return 0;
  const clean = Object.entries(mix)
    .filter(([fuel]) => isCleanFuel(fuel))
    .reduce((sum, [, mw]) => sum + mw, 0);
  return Math.round((clean / total) * 100);
}

function topFuelFromMix(mix: Record<string, number>) {
  const entries = Object.entries(mix).sort((a, b) => b[1] - a[1]);
  if (!entries.length) return null;
  const total = entries.reduce((sum, [, mw]) => sum + mw, 0);
  const [name, mw] = entries[0];
  return { name, mw, share: total > 0 ? Math.round((mw / total) * 100) : 0 };
}

export function liveSnapshotForMarket(rows: QueueRow[], market: string): QueueRow | null {
  return (
    rows.find(
      (row) =>
        row.market === market &&
        row.dataMode === "live" &&
        /generator|generation/i.test(row.category),
    ) ?? null
  );
}

export function computeMarketStats(
  market: string,
  projects: QueueProject[],
  rows: QueueRow[],
): MarketStats {
  const marketProjects = projects.filter((project) => project.market === market);
  const snapshot = liveSnapshotForMarket(rows, market);
  const computedMix = mixFromProjects(marketProjects);
  const rawMix =
    snapshot?.mix && Object.keys(snapshot.mix).length > 0 ? snapshot.mix : computedMix;
  const mix = normalizeMix(rawMix);

  const totalMw = marketProjects.reduce((sum, project) => sum + (project.mw ?? 0), 0);
  const projectCount = marketProjects.length;

  return {
    market,
    projectCount,
    totalMw,
    avgMw: projectCount > 0 ? totalMw / projectCount : 0,
    mix,
    topFuel: topFuelFromMix(mix),
    cleanShare: cleanShareFromMix(mix),
    snapshot,
  };
}

export function computeAllMarketStats(
  markets: string[],
  projects: QueueProject[],
  rows: QueueRow[],
): MarketStats[] {
  return markets.map((market) => computeMarketStats(market, projects, rows));
}

export function computeNationalInsights(
  stats: MarketStats[],
  curatedRows: QueueRow[],
): QueueInsight[] {
  if (!stats.length) return [];

  const insights: QueueInsight[] = [];
  const totalMw = stats.reduce((sum, stat) => sum + stat.totalMw, 0);
  const totalProjects = stats.reduce((sum, stat) => sum + stat.projectCount, 0);
  const nationalMix: Record<string, number> = {};

  for (const stat of stats) {
    for (const [fuel, mw] of Object.entries(stat.mix)) {
      nationalMix[fuel] = (nationalMix[fuel] ?? 0) + mw;
    }
  }

  const cleanShare = cleanShareFromMix(nationalMix);
  const topFuel = topFuelFromMix(nationalMix);
  const byMw = [...stats].sort((a, b) => b.totalMw - a.totalMw);
  const byCount = [...stats].sort((a, b) => b.projectCount - a.projectCount);

  insights.push({
    label: "US queue total",
    value: `${(totalMw / 1000).toFixed(0)} GW`,
    detail: `${totalProjects.toLocaleString()} active projects across ${stats.length} ISO/RTO markets`,
  });

  if (topFuel) {
    insights.push({
      label: "Leading technology",
      value: topFuel.name,
      detail: `${topFuel.share}% of queued MW nationally`,
    });
  }

  insights.push({
    label: "Clean + storage share",
    value: `${cleanShare}%`,
    detail: "Solar, wind, storage, hydro, geothermal, and nuclear",
  });

  if (byMw[0]) {
    insights.push({
      label: "Largest queue by MW",
      value: byMw[0].market,
      detail: `${(byMw[0].totalMw / 1000).toFixed(0)} GW · ${marketMeta(byMw[0].market).region}`,
    });
  }

  if (byCount[0] && byCount[0].market !== byMw[0]?.market) {
    insights.push({
      label: "Most projects",
      value: byCount[0].market,
      detail: `${byCount[0].projectCount.toLocaleString()} requests · avg ${Math.round(byCount[0].avgMw)} MW`,
    });
  }

  const largeLoad = curatedRows.find((row) => /large load/i.test(row.category));
  if (largeLoad?.queueMw) {
    insights.push({
      label: "Large-load signal",
      value: largeLoad.market,
      detail: largeLoad.headline ?? `${(largeLoad.queueMw / 1000).toFixed(0)} GW of data-center-scale demand reported separately`,
    });
  }

  const transition = curatedRows.find((row) => /transition|cycle 1/i.test(row.category));
  if (transition) {
    insights.push({
      label: "Queue reform",
      value: transition.market,
      detail: transition.headline ?? "Post-reform cycle data published separately from legacy queue",
    });
  }

  return insights;
}

export function marketHeadline(stat: MarketStats): string {
  if (stat.topFuel && stat.cleanShare >= 50) {
    return `${stat.topFuel.name} leads at ${stat.topFuel.share}% of queue MW; ${stat.cleanShare}% is clean or storage.`;
  }
  if (stat.topFuel) {
    return `${stat.topFuel.name} dominates the queue at ${stat.topFuel.share}% of capacity.`;
  }
  return `${stat.projectCount.toLocaleString()} projects waiting to interconnect.`;
}

export function countProjectsByFips(
  projects: QueueProject[],
  market?: string,
): Record<string, number> {
  const scoped =
    market && market !== "all" ? projects.filter((project) => project.market === market) : projects;

  const counts: Record<string, number> = {};
  for (const project of scoped) {
    const abbr = normalizeStateAbbr(project.state);
    if (!abbr) continue;
    const fips = fipsForStateAbbr(abbr);
    if (!fips) continue;
    counts[fips] = (counts[fips] ?? 0) + 1;
  }
  return counts;
}

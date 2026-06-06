import type { QueueRow } from "./types";

const MARKET_ORDER = ["ERCOT", "MISO", "PJM", "CAISO", "SPP", "NYISO", "ISO-NE"];

export type MarketSource = {
  label: string;
  url: string;
};

export function sortMarkets(markets: string[]): string[] {
  return [...markets].sort((a, b) => {
    const ai = MARKET_ORDER.indexOf(a);
    const bi = MARKET_ORDER.indexOf(b);
    if (ai === -1 && bi === -1) return a.localeCompare(b);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
}

export const MARKET_META: Record<
  string,
  {
    region: string;
    fullName: string;
    mapFill: string;
    stripe: string;
    icon: string;
    /** Logo width ÷ height for layout (official wordmarks are wide). */
    iconAspect: number;
    sourceLabel: string;
    sourceUrl: string;
  }
> = {
  ERCOT: {
    region: "Texas",
    fullName: "Electric Reliability Council of Texas",
    mapFill: "#b8714a",
    stripe: "#b8714a",
    icon: "/images/markets/ercot.png",
    iconAspect: 330 / 122,
    sourceLabel: "ERCOT GIS Report (EMIL pg7-200-er)",
    sourceUrl: "https://www.ercot.com/mp/data-products/data-product-details?id=pg7-200-er",
  },
  MISO: {
    region: "Midwest & South Central",
    fullName: "Midcontinent Independent System Operator",
    mapFill: "#6b8fa3",
    stripe: "#6b8fa3",
    icon: "/images/markets/miso.webp",
    iconAspect: 1383 / 521,
    sourceLabel: "MISO GI interactive queue",
    sourceUrl:
      "https://www.misoenergy.org/planning/generator-interconnection/GI_Queue/gi-interactive-queue/",
  },
  PJM: {
    region: "Mid-Atlantic",
    fullName: "PJM Interconnection",
    mapFill: "#8b7aa8",
    stripe: "#8b7aa8",
    icon: "/images/markets/pjm.png",
    iconAspect: 263 / 97,
    sourceLabel: "PJM interconnection queue",
    sourceUrl: "https://www.pjm.com/planning/service-requests",
  },
  CAISO: {
    region: "California",
    fullName: "California Independent System Operator",
    mapFill: "#6a9580",
    stripe: "#6a9580",
    icon: "/images/markets/caiso.png",
    iconAspect: 330 / 97,
    sourceLabel: "CAISO public queue report",
    sourceUrl: "https://www.caiso.com/library/public-queue-report",
  },
  SPP: {
    region: "Great Plains",
    fullName: "Southwest Power Pool",
    mapFill: "#9a8f7a",
    stripe: "#9a8f7a",
    icon: "/images/markets/spp.png",
    iconAspect: 400 / 158,
    sourceLabel: "SPP generation interconnection queue",
    sourceUrl: "https://opsportal.spp.org/Studies/GISummary",
  },
  NYISO: {
    region: "New York",
    fullName: "New York Independent System Operator",
    mapFill: "#7a8fa8",
    stripe: "#7a8fa8",
    icon: "/images/markets/nyiso.png",
    iconAspect: 330 / 59,
    sourceLabel: "NYISO interconnection queue",
    sourceUrl: "https://www.nyiso.com/interconnections",
  },
  "ISO-NE": {
    region: "New England",
    fullName: "ISO New England",
    mapFill: "#8a7a9a",
    stripe: "#8a7a9a",
    icon: "/images/markets/iso-ne.png",
    iconAspect: 188 / 90,
    sourceLabel: "ISO-NE interconnection queue",
    sourceUrl: "https://www.iso-ne.com/system-planning/interconnection-service/",
  },
};

/** Retired ISO URLs still stored in older snapshots. */
const SOURCE_URL_OVERRIDES: Record<string, string> = {
  "https://www.pjm.com/planning/service-requests/interconnection-queues.aspx":
    "https://www.pjm.com/planning/service-requests",
};

function normalizeSourceUrl(url: string): string {
  return SOURCE_URL_OVERRIDES[url] ?? url;
}

export function marketMeta(market: string) {
  return (
    MARKET_META[market] ?? {
      region: "United States",
      fullName: market,
      mapFill: "#a8a29e",
      stripe: "#787774",
      icon: "",
      iconAspect: 2.5,
      sourceLabel: "",
      sourceUrl: "",
    }
  );
}

/** Prefer live snapshot source from DB; fall back to static market metadata. */
export function marketSource(market: string, rows?: QueueRow[]): MarketSource | null {
  const liveRow = rows?.find(
    (row) =>
      row.market === market &&
      row.dataMode === "live" &&
      row.sourceUrl &&
      /generator|generation/i.test(row.category),
  );
  if (liveRow?.sourceUrl) {
    return {
      label: liveRow.sourceLabel ?? liveRow.sourceUrl,
      url: normalizeSourceUrl(liveRow.sourceUrl),
    };
  }

  const meta = MARKET_META[market];
  if (meta?.sourceUrl) {
    return { label: meta.sourceLabel, url: normalizeSourceUrl(meta.sourceUrl) };
  }

  return null;
}

export function marketSourcesForMarkets(
  markets: string[],
  rows?: QueueRow[],
): Array<{ market: string; source: MarketSource }> {
  return markets
    .map((market) => {
      const source = marketSource(market, rows);
      return source ? { market, source } : null;
    })
    .filter((entry): entry is { market: string; source: MarketSource } => entry != null);
}

export function shortCategory(category: string): string {
  return category
    .replace("Generator interconnection queue", "Generation")
    .replace("Generation queue", "Generation")
    .replace("Large load queue", "Large load")
    .replace("Large load requirements", "Large load")
    .replace("Generator queue report", "Generation report")
    .replace("Transition queue", "Transition")
    .replace("Cycle 1 new process", "Cycle 1");
}

export function groupByMarket(rows: QueueRow[]): Map<string, QueueRow[]> {
  const grouped = new Map<string, QueueRow[]>();
  for (const row of rows) {
    const list = grouped.get(row.market) ?? [];
    list.push(row);
    grouped.set(row.market, list);
  }

  for (const list of grouped.values()) {
    list.sort((a, b) => {
      if (a.dataMode === "live" && b.dataMode !== "live") return -1;
      if (b.dataMode === "live" && a.dataMode !== "live") return 1;
      return (b.queueMw ?? 0) - (a.queueMw ?? 0);
    });
  }

  return new Map(
    [...grouped.entries()].sort(([a], [b]) => {
      const ai = MARKET_ORDER.indexOf(a);
      const bi = MARKET_ORDER.indexOf(b);
      if (ai === -1 && bi === -1) return a.localeCompare(b);
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    }),
  );
}

/** Muted fuel swatches for data viz — desaturated, not neon */
export function fuelColor(fuel: string): string {
  const key = fuel.toLowerCase().trim();
  if (key === "bat" || key === "bess") return "bg-[#a89bb8]";
  if (key === "wnd") return "bg-[#8fafc4]";
  if (key === "nuc") return "bg-[#7a9a7e]";
  if (key === "sun" || key === "sol") return "bg-[#d4a574]";
  if (key === "wat" || key === "hyr" || key === "hyd") return "bg-[#7aabb8]";
  if (key === "nat" || key === "ng") return "bg-[#c4a484]";
  if (key === "col") return "bg-[#9a9590]";
  if (key.includes("solar") || key.includes("pv")) return "bg-[#d4a574]";
  if (key.includes("wind")) return "bg-[#8fafc4]";
  if (key.includes("battery") || key.includes("storage") || key.includes("bess")) return "bg-[#a89bb8]";
  if (key.includes("gas") || key.includes("natural")) return "bg-[#c4a484]";
  if (key.includes("nuclear")) return "bg-[#7a9a7e]";
  if (key.includes("hydro")) return "bg-[#7aabb8]";
  if (key.includes("coal")) return "bg-[#9a9590]";
  return "bg-[#b8b4af]";
}

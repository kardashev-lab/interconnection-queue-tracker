/** FIPS state codes → ISO/RTO markets we track on this site. */
export const TRACKED_MARKETS = [
  "CAISO",
  "ERCOT",
  "MISO",
  "PJM",
  "SPP",
  "NYISO",
  "ISO-NE",
] as const;
export type TrackedMarket = (typeof TRACKED_MARKETS)[number];

/**
 * States served by each tracked ISO/RTO (full or partial).
 * Sources: PJM territory served, MISO about, SPP/FERC RTO guide, CAISO/ERCOT/NYISO/ISO-NE.
 * Many states overlap — e.g. IL/IN/MI/KY are both PJM and MISO; AR/LA/MO are MISO and SPP.
 */
const MARKET_FOOTPRINTS: Record<TrackedMarket, readonly string[]> = {
  CAISO: ["06", "32"], // CA, NV (southern NV in CAISO BA)
  ERCOT: ["48"], // Texas
  MISO: [
    "01", // AL (Entergy)
    "05", // AR
    "17", // IL
    "18", // IN
    "19", // IA
    "21", // KY
    "22", // LA
    "26", // MI
    "27", // MN
    "28", // MS
    "29", // MO
    "38", // ND
    "46", // SD
    "48", // TX (east)
    "55", // WI
  ],
  PJM: [
    "10", // DE
    "11", // DC
    "17", // IL
    "18", // IN
    "21", // KY
    "24", // MD
    "26", // MI
    "34", // NJ
    "37", // NC
    "39", // OH
    "42", // PA
    "47", // TN
    "51", // VA
    "54", // WV
  ],
  SPP: [
    "05", // AR
    "19", // IA
    "20", // KS
    "22", // LA
    "27", // MN
    "29", // MO
    "30", // MT
    "31", // NE
    "35", // NM
    "38", // ND
    "40", // OK
    "46", // SD
    "48", // TX (panhandle)
    "56", // WY
  ],
  NYISO: ["36"],
  "ISO-NE": ["09", "23", "25", "33", "44", "50"],
};

function buildFipsToMarkets(): Record<string, TrackedMarket[]> {
  const map = new Map<string, Set<TrackedMarket>>();

  for (const market of TRACKED_MARKETS) {
    for (const fips of MARKET_FOOTPRINTS[market]) {
      const normalized = fips.padStart(2, "0");
      const set = map.get(normalized) ?? new Set<TrackedMarket>();
      set.add(market);
      map.set(normalized, set);
    }
  }

  const result: Record<string, TrackedMarket[]> = {};
  for (const [fips, markets] of map) {
    result[fips] = [...markets].sort(
      (a, b) => TRACKED_MARKETS.indexOf(a) - TRACKED_MARKETS.indexOf(b),
    );
  }
  return result;
}

export const FIPS_TO_MARKETS: Record<string, readonly TrackedMarket[]> = buildFipsToMarkets();

/** @deprecated Prefer marketsForState — kept for callers expecting a single value. */
export function marketForState(fips: string): TrackedMarket | null {
  return marketsForState(fips)[0] ?? null;
}

export function marketsForState(fips: string): readonly TrackedMarket[] {
  return FIPS_TO_MARKETS[fips.padStart(2, "0")] ?? [];
}

export function formatMarketsForState(
  fips: string,
  marketFilter?: string,
): string {
  const markets = marketsForState(fips);
  if (marketFilter && marketFilter !== "all") {
    return markets.includes(marketFilter as TrackedMarket) ? marketFilter : "";
  }
  return markets.join(" · ");
}

export function isCoveredState(
  fips: string,
  market?: string,
  countsByFips?: Record<string, number>,
): boolean {
  const normalized = fips.padStart(2, "0");
  const markets = FIPS_TO_MARKETS[normalized] ?? [];
  const hasProjects = (countsByFips?.[normalized] ?? 0) > 0;

  if (market && market !== "all") {
    if (markets.includes(market as TrackedMarket)) return true;
    return hasProjects;
  }

  return markets.length > 0 || hasProjects;
}

export function coveredFipsForFilter(
  market?: string,
  countsByFips?: Record<string, number>,
): Set<string> {
  const covered = new Set<string>();

  for (const fips of Object.keys(FIPS_TO_MARKETS)) {
    if (isCoveredState(fips, market, countsByFips)) {
      covered.add(fips);
    }
  }

  if (countsByFips) {
    for (const [fips, count] of Object.entries(countsByFips)) {
      if (count > 0 && isCoveredState(fips, market, countsByFips)) {
        covered.add(fips.padStart(2, "0"));
      }
    }
  }

  return covered;
}

export function coveredStateCount(countsByFips?: Record<string, number>): number {
  return coveredFipsForFilter(undefined, countsByFips).size;
}

export const US_STATES_GEO_URL =
  "https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json";

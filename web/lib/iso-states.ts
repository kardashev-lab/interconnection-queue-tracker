/** FIPS state codes → primary ISO/RTO for map coloring (approximate footprints). */
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
 * Approximate primary ISO/RTO per state for map shading.
 * Dual-service states pick the operator that typically holds the GI queue
 * (see PJM / MISO / SPP territory maps). States with live project data
 * are also shaded even if absent here — see isCoveredState().
 */
export const FIPS_TO_MARKET: Record<string, TrackedMarket> = {
  // CAISO
  "06": "CAISO",
  "32": "CAISO",
  // ERCOT
  "48": "ERCOT",
  // MISO (Midwest + South)
  "01": "MISO",
  "05": "MISO",
  "17": "MISO",
  "18": "MISO",
  "19": "MISO",
  "22": "MISO",
  "26": "MISO",
  "27": "MISO",
  "28": "MISO",
  "29": "MISO",
  "30": "MISO",
  "38": "MISO",
  "46": "MISO",
  "55": "MISO",
  // PJM
  "10": "PJM",
  "11": "PJM",
  "21": "PJM",
  "24": "PJM",
  "34": "PJM",
  "37": "PJM",
  "39": "PJM",
  "42": "PJM",
  "47": "PJM",
  "51": "PJM",
  "54": "PJM",
  // ISO-NE
  "09": "ISO-NE",
  "23": "ISO-NE",
  "25": "ISO-NE",
  "33": "ISO-NE",
  "44": "ISO-NE",
  "50": "ISO-NE",
  // NYISO
  "36": "NYISO",
  // SPP
  "20": "SPP",
  "31": "SPP",
  "35": "SPP",
  "40": "SPP",
  "56": "SPP",
};

export function marketForState(fips: string): TrackedMarket | null {
  return FIPS_TO_MARKET[fips.padStart(2, "0")] ?? null;
}

export function isCoveredState(
  fips: string,
  market?: string,
  countsByFips?: Record<string, number>,
): boolean {
  const normalized = fips.padStart(2, "0");
  const iso = FIPS_TO_MARKET[normalized];
  const hasProjects = (countsByFips?.[normalized] ?? 0) > 0;

  if (market && market !== "all") {
    if (iso === market) return true;
    return hasProjects;
  }

  return iso != null || hasProjects;
}

export function coveredFipsForFilter(
  market?: string,
  countsByFips?: Record<string, number>,
): Set<string> {
  const covered = new Set<string>();

  for (const fips of Object.keys(FIPS_TO_MARKET)) {
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

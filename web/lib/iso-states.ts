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

/** us-atlas states-10m.json uses numeric FIPS ids as `id`. */
export const FIPS_TO_MARKET: Record<string, TrackedMarket> = {
  "06": "CAISO",
  "32": "CAISO",
  "48": "ERCOT",
  "05": "MISO",
  "17": "MISO",
  "18": "MISO",
  "19": "MISO",
  "26": "MISO",
  "27": "MISO",
  "29": "MISO",
  "22": "MISO",
  "28": "MISO",
  "30": "MISO",
  "38": "MISO",
  "46": "MISO",
  "55": "MISO",
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
  "09": "ISO-NE",
  "23": "ISO-NE",
  "25": "ISO-NE",
  "33": "ISO-NE",
  "44": "ISO-NE",
  "50": "ISO-NE",
  "36": "NYISO",
  "20": "SPP",
  "31": "SPP",
  "40": "SPP",
  "08": "SPP",
  "16": "SPP",
  "35": "SPP",
};

export function marketForState(fips: string): TrackedMarket | null {
  return FIPS_TO_MARKET[fips.padStart(2, "0")] ?? null;
}

/** States included in the 7 tracked ISO/RTO footprints (approximate). */
export function isCoveredState(fips: string, market?: string): boolean {
  const normalized = fips.padStart(2, "0");
  const iso = FIPS_TO_MARKET[normalized];
  if (!iso) return false;
  if (market && market !== "all") return iso === market;
  return true;
}

export function coveredFipsForFilter(market?: string): Set<string> {
  if (market && market !== "all") {
    return new Set(
      Object.entries(FIPS_TO_MARKET)
        .filter(([, iso]) => iso === market)
        .map(([fips]) => fips),
    );
  }
  return new Set(Object.keys(FIPS_TO_MARKET));
}

export const US_STATES_GEO_URL =
  "https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json";

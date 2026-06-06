import {
  fetchLiveTotals,
  fetchProjects,
  fetchQueueRows,
  hasLiveData,
  loadCuratedFallback,
} from "./db";
import type { QueuePayload } from "./types";

export async function getQueuePayload(): Promise<QueuePayload> {
  try {
    const rows = await fetchQueueRows();
    if (rows?.length) {
      const [live, projects, liveTotals] = await Promise.all([
        hasLiveData(),
        fetchProjects(),
        fetchLiveTotals(),
      ]);
      return { source: "database", rows, live, projects, liveTotals };
    }
  } catch (err) {
    console.error("Queue fetch failed:", err);
  }

  const fallback = loadCuratedFallback();
  return {
    source: "curated-fallback",
    rows: fallback,
    live: false,
    projects: [],
    liveTotals: null,
  };
}

"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { AppLogo } from "@/components/app-logo";
import { MarketOverview } from "@/components/market-overview";
import { ProjectsTable } from "@/components/projects-table";
import { ProjectHeatmapMap } from "@/components/project-heatmap-map";
import { QueueBriefing } from "@/components/queue-briefing";
import { QueueHero } from "@/components/queue-hero";
import { QueueSignals } from "@/components/queue-signals";
import { MarketIcon } from "@/components/market-icon";
import { ErcotLargeLoad } from "@/components/ercot-large-load";
import {
  computeAllMarketStats,
  computeNationalInsights,
} from "@/lib/analytics";
import { sortMarkets } from "@/lib/markets";
import type { ErcotLargeLoadSnapshot, QueuePayload } from "@/lib/types";

export function QueueTracker({
  initial,
  ercotLargeLoad,
}: {
  initial: QueuePayload;
  ercotLargeLoad: ErcotLargeLoadSnapshot[];
}) {
  const [marketFilter, setMarketFilter] = useState<string>("all");
  const [showLookup, setShowLookup] = useState(false);

  const liveTotals = initial.liveTotals;
  const liveMarkets = useMemo(
    () => sortMarkets(liveTotals?.markets ?? []),
    [liveTotals?.markets],
  );

  const curatedRows = useMemo(() => {
    const liveSet = new Set(liveMarkets);
    return initial.rows.filter((row) => {
      if (row.dataMode === "live") return false;
      if (liveSet.has(row.market) && /generator|generation|cycle|transition/i.test(row.category)) {
        return false;
      }
      return true;
    });
  }, [initial.rows, liveMarkets]);

  const marketStats = useMemo(
    () => computeAllMarketStats(liveMarkets, initial.projects, initial.rows),
    [liveMarkets, initial.projects, initial.rows],
  );

  const insights = useMemo(
    () => computeNationalInsights(marketStats, curatedRows),
    [marketStats, curatedRows],
  );

  const hasProjects = initial.projects.length > 0;
  const hasLiveDashboard = hasProjects && liveTotals != null;

  return (
    <div className="min-h-dvh">
      <QueueHero liveTotals={liveTotals} liveMarkets={liveMarkets} />

      {/* Canvas break between header photo and body background */}
      <div className="h-4 bg-[#f7f6f3] sm:h-5" aria-hidden />

      <main className="mx-auto max-w-5xl space-y-10 px-5 py-8">
        {hasLiveDashboard ? (
          <>
            <QueueBriefing liveTotals={liveTotals} insights={insights} />

            <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-stretch">
              <div className="surface flex flex-col border border-[#eaeaea] p-4">
                <ProjectHeatmapMap
                  className="flex min-h-0 flex-1 flex-col"
                  projects={initial.projects}
                  market={marketFilter}
                />
              </div>

              <div className="surface flex flex-col overflow-hidden border border-[#eaeaea]">
                <div className="relative h-44 w-full lg:min-h-44 lg:flex-1">
                  <Image
                    src="/images/hero-header.jpg"
                    alt="Utility-scale solar and wind generation across open landscape"
                    fill
                    className="object-cover object-center"
                    sizes="(max-width: 1024px) 100vw, 420px"
                  />
                </div>
                <div className="shrink-0 px-5 py-4">
                  <h2 className="font-label">Why this matters</h2>
                  <ul className="mt-4 space-y-4 text-base leading-relaxed text-[#5f5c58]">
                  <li>
                    Interconnection queues are the bottleneck for new generation and large loads.
                    MW sitting in queue ≠ MW getting built. Study timelines and withdrawal rates
                    determine what actually connects.
                  </li>
                  <li>
                    Fuel mix shows where the grid is headed: solar, wind, and storage dominate most
                    queues, but gas and hybrid projects still account for meaningful capacity.
                  </li>
                  <li>
                    ISOs run different processes. PJM&apos;s transition cycle, ERCOT&apos;s large-load
                    queue, and MISO&apos;s reliability rules can matter as much as the raw project list.
                  </li>
                  </ul>
                </div>
              </div>
            </section>

            <MarketOverview
              stats={marketStats}
              rows={initial.rows}
              activeMarket={marketFilter}
              onSelectMarket={(market) => {
                setMarketFilter(market);
                setShowLookup(true);
              }}
            />

            {curatedRows.length > 0 && <QueueSignals rows={curatedRows} />}

            <section>
              <div className="flex flex-col gap-3 border-b border-[#eaeaea] pb-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="font-display text-2xl text-[#2f3437]">Project lookup</h2>
                  <p className="mt-1.5 text-base text-[#5f5c58]">
                    Search individual queue entries when you need a specific project, ID, or status.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowLookup((open) => !open)}
                  className="min-h-11 border border-[#eaeaea] bg-white px-4 py-2.5 text-sm text-[#2f3437] hover:bg-[#f7f6f3] active:scale-[0.98]"
                >
                  {showLookup ? "Hide table" : "Show project table"}
                </button>
              </div>

              {showLookup && (
                <>
                  <nav
                    className="mt-4 flex gap-0 overflow-x-auto border-b border-[#eaeaea] [-webkit-overflow-scrolling:touch] sm:flex-wrap sm:overflow-visible"
                    aria-label="Filter by ISO"
                    role="tablist"
                  >
                    <MarketTab
                      active={marketFilter === "all"}
                      onClick={() => setMarketFilter("all")}
                    >
                      All
                    </MarketTab>
                    {liveMarkets.map((market) => (
                      <MarketTab
                        key={market}
                        active={marketFilter === market}
                        onClick={() => setMarketFilter(market)}
                      >
                        <MarketIcon market={market} size={16} />
                        {market}
                      </MarketTab>
                    ))}
                  </nav>

                  <div className="surface mt-4 border border-[#eaeaea] px-5 py-5">
                    <ProjectsTable
                      key={marketFilter}
                      projects={initial.projects}
                      market={marketFilter}
                    />
                  </div>
                </>
              )}
            </section>
          </>
        ) : (
          <>
            {curatedRows.length > 0 && <QueueSignals rows={curatedRows} />}
            <EmptyState
              hasSnapshots={initial.rows.length > 0}
              hasCurated={curatedRows.length > 0}
              source={initial.source}
            />
          </>
        )}

        <ErcotLargeLoad snapshots={ercotLargeLoad} />
      </main>

      <footer className="surface mt-12 border-t border-[#eaeaea]">
        <div className="mx-auto max-w-5xl px-5 py-5">
          <div className="flex items-center gap-2">
            <AppLogo size={24} />
            <span className="text-xs font-medium text-[#2f3437]">US Interconnection Queue</span>
          </div>
          <div className="mt-3 text-xs leading-relaxed text-[#787774]">
          <p>
            Data from public ISO/RTO interconnection queue reports, fetched directly from each market&apos;s public data source (see source links per market).
          </p>
          <p className="mt-2">
            This site is not affiliated with, endorsed by, or operated by any ISO, RTO, or Grid
            Status.
          </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function EmptyState({
  hasSnapshots,
  hasCurated,
  source,
}: {
  hasSnapshots: boolean;
  hasCurated: boolean;
  source: QueuePayload["source"];
}) {
  const title = hasSnapshots
    ? "Project data not loaded yet"
    : "No queue data loaded";
  const detail = hasSnapshots
    ? "Market snapshots are available, but the project table is empty. Run the fetcher to load live ISO queue entries."
    : hasCurated
      ? "Curated market signals are shown above. Run the fetcher to load live project-level queue data."
      : "Start Postgres and run the fetcher to load live ISO queue snapshots and project tables.";

  return (
    <div className="surface border border-[#eaeaea] px-6 py-10 text-center">
      <p className="text-sm font-medium text-[#2f3437]">{title}</p>
      <p className="mt-2 text-sm text-[#787774]">{detail}</p>
      {source === "curated-fallback" && (
        <p className="mt-2 text-xs text-[#787774]">
          Database unavailable. Showing static fallback only.
        </p>
      )}
      <pre className="mx-auto mt-4 max-w-lg overflow-x-auto border border-[#eaeaea] bg-[#f7f6f3] px-4 py-3 text-left font-metric text-xs text-[#2f3437]">
        docker compose up -d postgres{"\n"}
        docker compose --profile fetch run --rm fetcher
      </pre>
    </div>
  );
}

function MarketTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`-mb-px inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-3 text-sm transition-colors active:scale-[0.98] sm:px-4 ${
        active
          ? "border-[#2f3437] font-medium text-[#2f3437]"
          : "border-transparent text-[#787774] hover:text-[#2f3437]"
      }`}
    >
      {children}
    </button>
  );
}

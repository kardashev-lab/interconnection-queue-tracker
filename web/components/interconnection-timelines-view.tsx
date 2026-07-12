"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AppLogo } from "@/components/app-logo";
import { fuelColor } from "@/lib/markets";
import { formatCount, formatDate, formatMw } from "@/lib/format";
import type { InterconnectionTimelines, TimelineProject } from "@/lib/types";

function formatDays(days: number | null): string {
  if (days == null) return "—";
  const years = days / 365;
  return `${years.toFixed(1)} yr`;
}

function zoneLabel(zone: string): string {
  return zone
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ERCOT's GIS report uses its own three-letter fuel codes (WIN, OTH, etc.)
// which don't all match the queue-wide fuelColor() codes (e.g. wnd for wind).
function gisFuelColor(fuel: string): string {
  const key = fuel.toLowerCase().trim();
  if (key === "win") return "bg-[#8fafc4]";
  if (key === "oth") return "bg-[#b8b4af]";
  return fuelColor(fuel);
}

export function InterconnectionTimelinesView({ data }: { data: InterconnectionTimelines }) {
  if (!data.available) {
    return (
      <div className="min-h-dvh">
        <main className="mx-auto max-w-3xl px-5 py-16 text-center">
          <p className="font-label">Interconnection timelines</p>
          <h1 className="mt-4 font-display text-3xl text-[#2f3437]">Data not available yet</h1>
          <p className="mt-3 text-base text-[#5f5c58]">
            This page reads from a backfilled table that hasn&apos;t been populated in this
            environment. Check back soon.
          </p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-dvh">
      <header className="border-b border-[#eaeaea]">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
          <Link href="/" className="flex items-center gap-2">
            <AppLogo size={24} />
            <span className="text-xs font-medium text-[#2f3437]">US Interconnection Queue</span>
          </Link>
          <Link href="/" className="text-xs text-[#787774] underline">
            Back to national queue
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-10 px-5 py-10">
        <section>
          <p className="font-label">ERCOT · built from 97 months of public filings</p>
          <h1 className="mt-3 font-display text-3xl text-[#2f3437] sm:text-4xl">
            How long does interconnection actually take?
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-[#5f5c58]">
            Every ERCOT Generator Interconnection Status report published since December 2018,
            {" "}{data.energizedProjectCount} projects tracked from screening study through
            energization, broken down by zone and fuel type. This is measured time, not a filed
            estimate.
          </p>
        </section>

        <HeadlineStats data={data} />
        <ZoneTable data={data} />
        <FuelTable data={data} />
        <PendingQueue data={data} />
        <ProjectExplorer projects={data.projects} />

        <p className="text-xs text-[#b8b4af]">
          Source: ERCOT Generator Interconnection Status (GIS) Report, reportTypeId 15933,
          published monthly. As of {formatDate(data.asOfMonth ? `${data.asOfMonth}-01` : null)}.
          Durations use each project&apos;s latest known milestone date across all monthly
          filings; a small number of implausible durations (negative or over 16 years, usually
          re-filed queue IDs) are excluded.
        </p>
      </main>

      <footer className="surface mt-4 border-t border-[#eaeaea]">
        <div className="mx-auto max-w-5xl px-5 py-5">
          <div className="flex items-center gap-2">
            <AppLogo size={24} />
            <span className="text-xs font-medium text-[#2f3437]">US Interconnection Queue</span>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-[#787774]">
            This site is not affiliated with, endorsed by, or operated by ERCOT.
          </p>
        </div>
      </footer>
    </div>
  );
}

function HeadlineStats({ data }: { data: InterconnectionTimelines }) {
  const fastestZone = data.zoneStats[0];
  const slowestZone = data.zoneStats[data.zoneStats.length - 1];
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      <div className="surface border border-[#eaeaea] p-4">
        <p className="font-label">Projects tracked</p>
        <p className="font-metric mt-2 text-2xl text-[#2f3437]">
          {formatCount(data.energizedProjectCount)}
        </p>
        <p className="mt-1 text-xs text-[#787774]">energized since 2018</p>
      </div>
      <div className="surface border border-[#eaeaea] p-4">
        <p className="font-label">Fastest zone</p>
        <p className="font-metric mt-2 text-2xl text-[#2f3437]">
          {fastestZone ? formatDays(fastestZone.fullProcessMedianDays) : "—"}
        </p>
        <p className="mt-1 text-xs text-[#787774]">{fastestZone ? zoneLabel(fastestZone.zone) : ""} median</p>
      </div>
      <div className="surface border border-[#eaeaea] p-4">
        <p className="font-label">Slowest zone</p>
        <p className="font-metric mt-2 text-2xl text-[#2f3437]">
          {slowestZone ? formatDays(slowestZone.fullProcessMedianDays) : "—"}
        </p>
        <p className="mt-1 text-xs text-[#787774]">{slowestZone ? zoneLabel(slowestZone.zone) : ""} median</p>
      </div>
      <div className="surface border border-[#eaeaea] p-4">
        <p className="font-label">Stuck in queue</p>
        <p className="font-metric mt-2 text-2xl text-[#2f3437]">{formatMw(data.pendingTotalMw)}</p>
        <p className="mt-1 text-xs text-[#787774]">
          {formatCount(data.pendingTotalCount)} projects, not yet energized
        </p>
      </div>
    </div>
  );
}

function ZoneTable({ data }: { data: InterconnectionTimelines }) {
  return (
    <section>
      <div className="border-b border-[#eaeaea] pb-4">
        <h2 className="font-display text-2xl text-[#2f3437]">By load zone</h2>
        <p className="mt-1.5 text-base text-[#5f5c58]">
          Median time from screening study started to approved for energization.
        </p>
      </div>
      <div className="surface mt-4 overflow-x-auto border border-[#eaeaea]">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[#eaeaea] font-label">
              <th className="px-4 py-3 font-medium">Zone</th>
              <th className="px-4 py-3 text-right font-medium">Projects</th>
              <th className="px-4 py-3 text-right font-medium">Full process</th>
              <th className="px-4 py-3 text-right font-medium">IA signed → energized</th>
              <th className="px-4 py-3 text-right font-medium">COD slippage</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#eaeaea]">
            {data.zoneStats.map((z) => (
              <tr key={z.zone} className="hover:bg-[#f7f6f3]/60">
                <td className="px-4 py-3 text-[#2f3437]">{zoneLabel(z.zone)}</td>
                <td className="px-4 py-3 text-right font-metric text-[#787774]">
                  {formatCount(z.projectCount)}
                </td>
                <td className="px-4 py-3 text-right font-metric text-[#2f3437]">
                  {formatDays(z.fullProcessMedianDays)}
                </td>
                <td className="px-4 py-3 text-right font-metric text-[#2f3437]">
                  {formatDays(z.buildPhaseMedianDays)}
                </td>
                <td className="px-4 py-3 text-right font-metric text-[#b06a5a]">
                  {z.codSlipMedianDays != null ? `+${formatDays(z.codSlipMedianDays)}` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function FuelTable({ data }: { data: InterconnectionTimelines }) {
  return (
    <section>
      <div className="border-b border-[#eaeaea] pb-4">
        <h2 className="font-display text-2xl text-[#2f3437]">By fuel type</h2>
        <p className="mt-1.5 text-base text-[#5f5c58]">
          Fuel types with at least 10 energized projects in the dataset.
        </p>
      </div>
      <div className="surface mt-4 overflow-x-auto border border-[#eaeaea]">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[#eaeaea] font-label">
              <th className="px-4 py-3 font-medium">Fuel</th>
              <th className="px-4 py-3 text-right font-medium">Projects</th>
              <th className="px-4 py-3 text-right font-medium">Full process (median)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#eaeaea]">
            {data.fuelStats.map((f) => (
              <tr key={f.fuel} className="hover:bg-[#f7f6f3]/60">
                <td className="px-4 py-3 text-[#2f3437]">
                  <span className="inline-flex items-center gap-1.5">
                    <span className={`size-2 rounded-sm ${gisFuelColor(f.fuel)}`} />
                    {f.fuel}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-metric text-[#787774]">
                  {formatCount(f.projectCount)}
                </td>
                <td className="px-4 py-3 text-right font-metric text-[#2f3437]">
                  {formatDays(f.fullProcessMedianDays)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function PendingQueue({ data }: { data: InterconnectionTimelines }) {
  return (
    <section>
      <div className="border-b border-[#eaeaea] pb-4">
        <h2 className="font-display text-2xl text-[#2f3437]">Currently stuck in queue</h2>
        <p className="mt-1.5 text-base text-[#5f5c58]">
          Projects that have started the process but haven&apos;t reached energization yet.
        </p>
      </div>
      <div className="surface mt-4 overflow-x-auto border border-[#eaeaea]">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[#eaeaea] font-label">
              <th className="px-4 py-3 font-medium">Zone</th>
              <th className="px-4 py-3 text-right font-medium">Projects</th>
              <th className="px-4 py-3 text-right font-medium">Capacity</th>
              <th className="px-4 py-3 text-right font-medium">Median years waiting</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#eaeaea]">
            {data.pendingStats.map((p) => (
              <tr key={p.zone} className="hover:bg-[#f7f6f3]/60">
                <td className="px-4 py-3 text-[#2f3437]">{zoneLabel(p.zone)}</td>
                <td className="px-4 py-3 text-right font-metric text-[#787774]">
                  {formatCount(p.projectCount)}
                </td>
                <td className="px-4 py-3 text-right font-metric text-[#2f3437]">
                  {formatMw(p.totalMw)}
                </td>
                <td className="px-4 py-3 text-right font-metric text-[#2f3437]">
                  {p.medianYearsWaiting != null ? `${p.medianYearsWaiting.toFixed(1)} yr` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

const PAGE_SIZE = 50;

function ProjectExplorer({ projects }: { projects: TimelineProject[] }) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "energized" | "pending">("all");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return projects.filter((p) => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (!q) return true;
      return (
        p.projectName?.toLowerCase().includes(q) ||
        p.queueId.toLowerCase().includes(q) ||
        p.fuel?.toLowerCase().includes(q) ||
        p.zone?.toLowerCase().includes(q)
      );
    });
  }, [projects, query, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <section>
      <div className="flex flex-col gap-4 border-b border-[#eaeaea] pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-display text-2xl text-[#2f3437]">Look up a project</h2>
          <p className="mt-1.5 text-base text-[#5f5c58]">
            {formatCount(filtered.length)} of {formatCount(projects.length)} tracked projects
          </p>
        </div>
        <div className="flex w-full gap-2 sm:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as "all" | "energized" | "pending");
              setPage(1);
            }}
            className="min-h-11 border border-[#eaeaea] bg-white px-3 py-2.5 text-sm text-[#2f3437] outline-none focus:border-[#2f3437]"
          >
            <option value="all">All statuses</option>
            <option value="energized">Energized</option>
            <option value="pending">Pending</option>
          </select>
          <label className="w-full sm:max-w-xs">
            <span className="sr-only">Search projects</span>
            <input
              type="search"
              placeholder="Search name, ID, fuel, zone…"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              className="min-h-11 w-full border border-[#eaeaea] bg-white px-3 py-2.5 text-base text-[#2f3437] outline-none placeholder:text-[#b8b4af] focus:border-[#2f3437] sm:text-sm"
            />
          </label>
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="py-10 text-center text-sm text-[#787774]">No projects match your search.</p>
      ) : (
        <div className="surface mt-4 overflow-x-auto border border-[#eaeaea]">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[#eaeaea] font-label">
                <th className="px-4 py-3 font-medium">Project</th>
                <th className="px-4 py-3 font-medium">Queue ID</th>
                <th className="px-4 py-3 font-medium">Zone</th>
                <th className="px-4 py-3 font-medium">Fuel</th>
                <th className="px-4 py-3 text-right font-medium">MW</th>
                <th className="px-4 py-3 font-medium">Screening started</th>
                <th className="px-4 py-3 font-medium">Energized</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#eaeaea]">
              {visible.map((p) => (
                <tr key={p.queueId} className="hover:bg-[#f7f6f3]/60">
                  <td className="max-w-xs px-4 py-3 text-[#2f3437]">{p.projectName || "—"}</td>
                  <td className="px-4 py-3 font-metric text-xs text-[#787774]">{p.queueId}</td>
                  <td className="px-4 py-3 text-[#787774]">{p.zone ? zoneLabel(p.zone) : "—"}</td>
                  <td className="px-4 py-3">
                    {p.fuel ? (
                      <span className="inline-flex items-center gap-1.5 text-[#2f3437]">
                        <span className={`size-2 rounded-sm ${gisFuelColor(p.fuel)}`} />
                        {p.fuel}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-metric text-[#2f3437]">
                    {p.capacityMw ? formatMw(p.capacityMw) : "—"}
                  </td>
                  <td className="px-4 py-3 text-[#787774]">{formatDate(p.screeningStudyStarted)}</td>
                  <td className="px-4 py-3 text-[#787774]">
                    {p.approvedForEnergization ? formatDate(p.approvedForEnergization) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between border-t border-[#eaeaea] pt-4">
          <p className="font-metric text-xs text-[#787774]">
            Page {formatCount(currentPage)} of {formatCount(totalPages)}
          </p>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="min-h-11 border border-[#eaeaea] bg-white px-4 py-2 text-xs text-[#2f3437] hover:bg-[#f7f6f3] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="min-h-11 border border-[#eaeaea] bg-white px-4 py-2 text-xs text-[#2f3437] hover:bg-[#f7f6f3] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

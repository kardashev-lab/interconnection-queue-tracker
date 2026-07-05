import { formatMw, formatDate } from "@/lib/format";
import type { ErcotLargeLoadSnapshot } from "@/lib/types";

// Palette matching this app's existing warm-editorial theme (see fuel-mix-bar.tsx).
const TYPE_COLORS: Record<string, string> = {
  data_center: "bg-[#2f3437]",
  crypto: "bg-[#c98ba6]",
  industrial: "bg-[#9d8ec7]",
  data_center_crypto: "bg-[#d99a62]",
  hydrogen: "bg-[#6ea3cf]",
  none: "bg-[#eaeaea]",
};

const STATUS_LABELS: Record<string, string> = {
  no_studies_submitted: "No studies submitted",
  under_ercot_review: "Under ERCOT review",
  planning_studies_approved: "Planning studies approved",
  approved_to_energize_not_operational: "Approved, not yet operational",
  observed_energized: "Energized",
};

const TYPE_LABELS: Record<string, string> = {
  data_center: "Data center",
  crypto: "Crypto",
  industrial: "Industrial",
  data_center_crypto: "Data center + crypto",
  hydrogen: "Hydrogen",
  none: "None disclosed",
};

function monthLabel(iso: string): string {
  const d = new Date(iso.length === 7 ? `${iso}-01` : iso);
  return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

export function ErcotLargeLoad({ snapshots }: { snapshots: ErcotLargeLoadSnapshot[] }) {
  if (snapshots.length === 0) return null;

  const latest = snapshots[snapshots.length - 1];
  const prior = snapshots.length > 1 ? snapshots[snapshots.length - 2] : null;
  const momChange =
    prior?.totalMw && latest.totalMw
      ? ((latest.totalMw - prior.totalMw) / prior.totalMw) * 100
      : null;

  const dataCenterPct = latest.byType?.data_center?.pct ?? null;
  const maxMonthMw = Math.max(...snapshots.map((s) => s.totalMw ?? 0));

  return (
    <section>
      <div className="flex flex-col gap-1.5 border-b border-[#eaeaea] pb-4">
        <h2 className="font-display text-2xl text-[#2f3437]">ERCOT large load queue</h2>
        <p className="text-base text-[#5f5c58]">
          Data centers, crypto miners, and other large loads requesting interconnection in
          Texas &mdash; from ERCOT&apos;s Large Load Working Group monthly status update.
        </p>
      </div>

      {/* Headline stats */}
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="surface border border-[#eaeaea] p-4">
          <p className="font-label">Total queue</p>
          <p className="font-metric mt-2 text-2xl text-[#2f3437]">{formatMw(latest.totalMw ?? 0)}</p>
          {momChange !== null && (
            <p className={`mt-1 text-xs ${momChange >= 0 ? "text-[#8a9a6e]" : "text-[#b06a5a]"}`}>
              {momChange >= 0 ? "▲" : "▼"} {Math.abs(momChange).toFixed(1)}% vs prior month
            </p>
          )}
        </div>
        <div className="surface border border-[#eaeaea] p-4">
          <p className="font-label">Data centers</p>
          <p className="font-metric mt-2 text-2xl text-[#2f3437]">
            {dataCenterPct !== null ? `${dataCenterPct.toFixed(1)}%` : "—"}
          </p>
          <p className="mt-1 text-xs text-[#787774]">of tracked queue MW</p>
        </div>
        <div className="surface border border-[#eaeaea] p-4">
          <p className="font-label">Standalone</p>
          <p className="font-metric mt-2 text-2xl text-[#2f3437]">{formatMw(latest.standaloneMw ?? 0)}</p>
        </div>
        <div className="surface border border-[#eaeaea] p-4">
          <p className="font-label">Co-located</p>
          <p className="font-metric mt-2 text-2xl text-[#2f3437]">{formatMw(latest.colocatedMw ?? 0)}</p>
        </div>
      </div>

      {/* Growth over time */}
      {snapshots.length > 1 && (
        <div className="surface mt-6 border border-[#eaeaea] p-4">
          <p className="font-label mb-4">Queue growth (co-located vs. standalone)</p>
          <div className="flex h-40 items-end gap-2">
            {snapshots.map((s) => {
              const total = s.totalMw ?? 0;
              const standaloneH = maxMonthMw > 0 ? ((s.standaloneMw ?? 0) / maxMonthMw) * 100 : 0;
              const colocatedH = maxMonthMw > 0 ? ((s.colocatedMw ?? 0) / maxMonthMw) * 100 : 0;
              return (
                <div key={s.snapshotMonth} className="flex flex-1 flex-col items-center gap-1.5">
                  <div className="flex w-full flex-1 flex-col justify-end" title={formatMw(total)}>
                    <div className="w-full bg-[#c98ba6]" style={{ height: `${colocatedH}%` }} />
                    <div className="w-full bg-[#2f3437]" style={{ height: `${standaloneH}%` }} />
                  </div>
                  <span className="text-[10px] text-[#b8b4af]">{monthLabel(s.snapshotMonth)}</span>
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex gap-4 text-xs text-[#5f5c58]">
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-sm bg-[#2f3437]" /> Standalone
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-sm bg-[#c98ba6]" /> Co-located
            </span>
          </div>
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* By project type */}
        {latest.byType && (
          <div className="surface border border-[#eaeaea] p-4">
            <p className="font-label mb-3">By project type</p>
            <div className="flex h-1.5 overflow-hidden bg-[#f7f6f3]">
              {Object.entries(latest.byType)
                .sort((a, b) => b[1].pct - a[1].pct)
                .map(([type, { pct }]) => (
                  <div
                    key={type}
                    className={TYPE_COLORS[type] ?? "bg-[#eaeaea]"}
                    style={{ width: `${pct}%` }}
                    title={`${TYPE_LABELS[type] ?? type}: ${pct}%`}
                  />
                ))}
            </div>
            <ul className="mt-3 space-y-1.5 text-sm">
              {Object.entries(latest.byType)
                .sort((a, b) => b[1].pct - a[1].pct)
                .filter(([, { pct }]) => pct > 0)
                .map(([type, { pct, mw }]) => (
                  <li key={type} className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-[#2f3437]">
                      <span className={`size-2 shrink-0 rounded-sm ${TYPE_COLORS[type] ?? "bg-[#eaeaea]"}`} />
                      {TYPE_LABELS[type] ?? type}
                    </span>
                    <span className="font-metric text-[#5f5c58]">
                      {mw != null ? formatMw(mw) : `${pct}%`}
                    </span>
                  </li>
                ))}
            </ul>
          </div>
        )}

        {/* By status */}
        {latest.byStatus && (
          <div className="surface border border-[#eaeaea] p-4">
            <p className="font-label mb-3">Where projects stand</p>
            <ul className="space-y-1.5 text-sm">
              {Object.entries(latest.byStatus).map(([status, mw]) => (
                <li key={status} className="flex items-center justify-between">
                  <span className="text-[#2f3437]">{STATUS_LABELS[status] ?? status}</span>
                  <span className="font-metric text-[#5f5c58]">{formatMw(mw)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* By zone */}
        {latest.byZone && (
          <div className="surface border border-[#eaeaea] p-4">
            <p className="font-label mb-3">By load zone</p>
            <ul className="space-y-1.5 text-sm">
              {Object.entries(latest.byZone).map(([zone, mw]) => (
                <li key={zone} className="flex items-center justify-between">
                  <span className="text-[#2f3437]">{zone.replace(/_/g, " ").toUpperCase()}</span>
                  <span className="font-metric text-[#5f5c58]">{formatMw(mw)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <p className="mt-4 text-xs text-[#b8b4af]">
        Source: ERCOT Large Load Working Group, {formatDate(latest.reportDate)}
        {latest.sourceUrl && (
          <>
            {" · "}
            <a href={latest.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline">
              view report
            </a>
          </>
        )}
      </p>
    </section>
  );
}

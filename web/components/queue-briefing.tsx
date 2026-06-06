import { formatCount, formatDate, formatMw } from "@/lib/format";
import type { QueueInsight } from "@/lib/analytics";
import type { LiveTotals } from "@/lib/types";

export function QueueBriefing({
  liveTotals,
  insights,
}: {
  liveTotals: LiveTotals;
  insights: QueueInsight[];
}) {
  return (
    <section className="surface border border-[#eaeaea]">
      <div className="border-b border-[#eaeaea] px-5 py-4">
        <h2 className="text-[10px] font-medium uppercase tracking-[0.12em] text-[#787774]">
          What&apos;s happening
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[#2f3437]">
          The US interconnection queue totals{" "}
          <span className="font-metric">{formatMw(liveTotals.totalMw)}</span> across{" "}
          <span className="font-metric">{formatCount(liveTotals.projectCount)}</span> active projects.
          Queues are dominated by renewables and storage, but study timelines, withdrawal rates, and
          large-load demand vary sharply by ISO.
        </p>
        <p className="mt-2 font-metric text-xs text-[#787774]">
          Updated {formatDate(liveTotals.lastFetched)}
        </p>
      </div>

      <dl className="grid divide-y divide-[#eaeaea] sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-3">
        {insights.map((insight) => (
          <div key={insight.label} className="px-5 py-4 sm:border-r sm:border-[#eaeaea] last:border-r-0">
            <dt className="text-[10px] font-medium uppercase tracking-[0.12em] text-[#787774]">
              {insight.label}
            </dt>
            <dd className="mt-1 font-metric text-lg text-[#2f3437]">{insight.value}</dd>
            {insight.detail && (
              <dd className="mt-1 text-xs leading-relaxed text-[#787774]">{insight.detail}</dd>
            )}
          </div>
        ))}
      </dl>
    </section>
  );
}

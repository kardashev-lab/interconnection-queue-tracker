import { MarketIcon } from "@/components/market-icon";
import { formatCount, formatMw } from "@/lib/format";
import { shortCategory } from "@/lib/markets";
import type { QueueRow } from "@/lib/types";

export function QueueSignals({ rows }: { rows: QueueRow[] }) {
  if (!rows.length) return null;

  return (
    <section>
      <div className="mb-4">
        <h2 className="font-display text-2xl text-[#2f3437]">Other queue signals</h2>
        <p className="mt-1.5 max-w-2xl text-base leading-relaxed text-[#5f5c58]">
          Large-load demand, post-reform cycles, and report-only queues that aren&apos;t in the
          standard generator tables.
        </p>
      </div>

      <ul className="surface divide-y divide-[#eaeaea] border border-[#eaeaea]">
        {rows.map((row) => (
          <li key={row.id} className="px-4 py-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-2.5">
                <MarketIcon market={row.market} size={22} className="mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm text-[#2f3437]">
                    <span className="font-metric">{row.market}</span>
                    <span className="text-[#787774]"> · {shortCategory(row.category)}</span>
                  </p>
                  {row.headline && (
                    <p className="mt-1 text-sm font-medium text-[#2f3437]">{row.headline}</p>
                  )}
                  {row.summary && (
                    <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#787774]">
                      {row.summary}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
                <div className="flex flex-wrap gap-3 font-metric text-xs text-[#2f3437]">
                  {row.queueMw != null && <span>{formatMw(row.queueMw)}</span>}
                  {row.requestCount != null && (
                    <span>{formatCount(row.requestCount)} requests</span>
                  )}
                </div>
                {row.sourceUrl && (
                  <a
                    href={row.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-block py-1 text-xs text-[#1f6c9f] hover:underline"
                  >
                    {row.sourceLabel ?? "Source"}
                  </a>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

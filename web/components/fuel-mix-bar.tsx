import { formatMw } from "@/lib/format";
import { fuelColor } from "@/lib/markets";

export function FuelMixBar({ mix, limit = 8 }: { mix: Record<string, number>; limit?: number }) {
  const entries = Object.entries(mix)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
  const total = entries.reduce((sum, [, mw]) => sum + mw, 0);

  if (!entries.length || total <= 0) {
    return <p className="text-sm text-[#787774]">No capacity breakdown published for this queue.</p>;
  }

  const mixSummary = entries
    .map(([fuel, mw]) => `${fuel} ${Math.round((mw / total) * 100)}%`)
    .join(", ");

  return (
    <div className="space-y-4">
      <div
        className="flex h-1.5 overflow-hidden bg-[#f7f6f3]"
        role="img"
        aria-label={`Fuel mix: ${mixSummary}`}
      >
        {entries.map(([fuel, mw]) => (
          <div
            key={fuel}
            className={`${fuelColor(fuel)} transition-all`}
            style={{ width: `${(mw / total) * 100}%` }}
            title={`${fuel}: ${formatMw(mw)}`}
          />
        ))}
      </div>
      <ul className="divide-y divide-[#eaeaea]">
        {entries.map(([fuel, mw]) => (
          <li
            key={fuel || "other"}
            className="grid grid-cols-[minmax(0,1fr)_5.5rem_2.5rem] items-center gap-x-3 py-2.5 text-sm"
          >
            <span className="flex min-w-0 items-center gap-2">
              <span className={`size-2 shrink-0 rounded-sm ${fuelColor(fuel)}`} />
              <span className="truncate text-[#2f3437]">{fuel || "Other"}</span>
            </span>
            <span className="font-metric text-right text-[#2f3437]">{formatMw(mw)}</span>
            <span className="font-metric text-right text-xs text-[#b8b4af]">
              {Math.round((mw / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

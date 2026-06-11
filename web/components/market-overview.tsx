"use client";

import { FuelMixBar } from "@/components/fuel-mix-bar";
import { MarketIcon } from "@/components/market-icon";
import { formatCount, formatMw } from "@/lib/format";
import { marketHeadline, type MarketStats } from "@/lib/analytics";
import { marketMeta, marketSource } from "@/lib/markets";
import type { QueueRow } from "@/lib/types";

export function MarketOverview({
  stats,
  rows,
  activeMarket,
  onSelectMarket,
}: {
  stats: MarketStats[];
  rows: QueueRow[];
  activeMarket: string;
  onSelectMarket: (market: string) => void;
}) {
  return (
    <section>
      <div className="mb-4">
        <h2 className="font-display text-2xl text-[#2f3437]">Queue by market</h2>
        <p className="mt-1.5 text-base leading-relaxed text-[#5f5c58]">
          Capacity, fuel mix, and project counts from live ISO feeds. Select a market to explore
          projects.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {stats.map((stat) => {
          const meta = marketMeta(stat.market);
          const source = marketSource(stat.market, rows);
          const active = activeMarket === stat.market;

          return (
            <button
              key={stat.market}
              type="button"
              onClick={() => onSelectMarket(stat.market)}
              className={`surface min-h-11 border px-4 py-4 text-left transition-[border-color,box-shadow] hover:border-[#2f3437] hover:shadow-sm active:scale-[0.99] ${
                active ? "border-[#2f3437] shadow-sm" : "border-[#eaeaea]"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <MarketIcon market={stat.market} size={22} />
                  <div>
                    <p className="font-metric text-sm text-[#2f3437]">{stat.market}</p>
                    <p className="text-xs text-[#787774]">{meta.region}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-metric text-sm text-[#2f3437]">{formatMw(stat.totalMw)}</p>
                  <p className="text-xs text-[#787774]">{formatCount(stat.projectCount)} projects</p>
                </div>
              </div>

              <p className="mt-3 text-xs leading-relaxed text-[#787774]">{marketHeadline(stat)}</p>

              <div className="mt-4">
                <FuelMixBar mix={stat.mix} limit={4} />
              </div>

              {source && (
                <p className="mt-3 text-xs">
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(event) => event.stopPropagation()}
                    className="inline-block py-1 text-[#1f6c9f] hover:underline"
                  >
                    {source.label}
                  </a>
                </p>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}

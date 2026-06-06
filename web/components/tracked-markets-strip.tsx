import { MarketIcon } from "@/components/market-icon";
import { marketMeta, sortMarkets } from "@/lib/markets";

export function TrackedMarketsStrip({ markets }: { markets: string[] }) {
  const ordered = sortMarkets(markets);

  return (
    <div
      className="mt-4 flex flex-wrap items-center gap-2"
      aria-label="Tracked ISO/RTO markets"
    >
      {ordered.map((market) => {
        const meta = marketMeta(market);
        return (
          <div
            key={market}
            title={`${market} · ${meta.fullName}`}
            className="inline-flex items-center rounded-full border border-[#eaeaea] bg-white px-3 py-2 shadow-sm"
          >
            <MarketIcon market={market} size={20} />
            <span className="sr-only">{market}</span>
          </div>
        );
      })}
    </div>
  );
}

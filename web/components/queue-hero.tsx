import Image from "next/image";
import { TrackedMarketsStrip } from "@/components/tracked-markets-strip";
import { formatCount, formatDate, formatMw } from "@/lib/format";
import type { LiveTotals } from "@/lib/types";

export function QueueHero({
  liveTotals,
  liveMarkets,
}: {
  liveTotals: LiveTotals | null;
  liveMarkets: string[];
}) {
  return (
    <header className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <Image
          src="/images/hero-transmission.jpg"
          alt=""
          fill
          priority
          className="object-cover object-[center_35%]"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-white from-[38%] via-white/94 to-white/55 sm:from-[42%] sm:via-white/90 sm:to-white/45" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#f7f6f3] via-white/40 to-white/30" />
      </div>

      <div className="relative mx-auto max-w-5xl px-5 py-10 sm:py-12">
        <div className="flex flex-col gap-8">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-stretch lg:gap-10">
            <div className="flex max-w-xl flex-1 flex-col justify-center lg:py-2">
              <h1 className="font-display text-3xl text-[#2f3437] sm:text-4xl">
                US Interconnection Queue
              </h1>
              <p className="mt-3 text-base leading-relaxed text-[#5f5c58]">
                Where new power is waiting to connect — queue size, fuel mix, and market signals
                across ISO/RTO territories.
              </p>
            </div>

            {liveTotals && (
              <div className="surface grid shrink-0 grid-cols-1 divide-y divide-[#eaeaea] border border-[#eaeaea] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                <HeroStat label="Queued" value={formatMw(liveTotals.totalMw)} />
                <HeroStat label="Projects" value={formatCount(liveTotals.projectCount)} />
                <HeroStat label="Markets" value={String(liveMarkets.length)} />
              </div>
            )}
          </div>

          {liveTotals && (
            <div className="space-y-3 border-t border-[#eaeaea] pt-8">
              <p className="text-sm text-[#6b6863]">
                Updated {formatDate(liveTotals.lastFetched)}
              </p>
              <TrackedMarketsStrip markets={liveMarkets} className="sm:flex-nowrap" />
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-h-[5.5rem] flex-col items-center justify-center px-5 py-4 text-center sm:min-h-[6.25rem] sm:px-6">
      <p className="font-label">{label}</p>
      <p className="mt-1.5 font-metric text-2xl text-[#2f3437]">{value}</p>
    </div>
  );
}

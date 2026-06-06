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
    <header className="relative overflow-hidden border-b border-[#eaeaea]">
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
        <div className="absolute inset-0 bg-gradient-to-t from-white/80 via-transparent to-white/30" />
      </div>

      <div className="relative mx-auto max-w-5xl px-5 py-8 sm:py-10">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-xl">
            <h1 className="text-3xl font-medium tracking-tight text-[#2f3437] sm:text-4xl">
              US Interconnection Queue
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-[#787774] sm:text-[15px]">
              Where new power is waiting to connect — queue size, fuel mix, and market signals
              across ISO/RTO territories.
            </p>
          </div>

          {liveTotals && (
            <dl className="surface grid shrink-0 grid-cols-1 divide-y divide-[#eaeaea] border border-[#eaeaea] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              <div className="px-4 py-3.5 sm:px-5">
                <dt className="text-[10px] font-medium uppercase tracking-[0.12em] text-[#787774]">
                  Queued
                </dt>
                <dd className="mt-1 font-metric text-xl text-[#2f3437] sm:text-2xl">
                  {formatMw(liveTotals.totalMw)}
                </dd>
              </div>
              <div className="px-4 py-3.5 sm:px-5">
                <dt className="text-[10px] font-medium uppercase tracking-[0.12em] text-[#787774]">
                  Projects
                </dt>
                <dd className="mt-1 font-metric text-xl text-[#2f3437] sm:text-2xl">
                  {formatCount(liveTotals.projectCount)}
                </dd>
              </div>
              <div className="px-4 py-3.5 sm:px-5">
                <dt className="text-[10px] font-medium uppercase tracking-[0.12em] text-[#787774]">
                  Markets
                </dt>
                <dd className="mt-1 font-metric text-xl text-[#2f3437] sm:text-2xl">
                  {liveMarkets.length}
                </dd>
              </div>
            </dl>
          )}
        </div>

        {liveTotals && (
          <div className="mt-6">
            <p className="font-metric text-xs text-[#787774]">
              Updated {formatDate(liveTotals.lastFetched)}
            </p>
            <TrackedMarketsStrip markets={liveMarkets} />
          </div>
        )}
      </div>
    </header>
  );
}

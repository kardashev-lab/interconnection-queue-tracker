import { marketMeta } from "@/lib/markets";

type MarketIconProps = {
  market: string;
  size?: number;
  className?: string;
};

export function MarketIcon({ market, size = 20, className = "" }: MarketIconProps) {
  const { icon, stripe } = marketMeta(market);

  if (!icon) {
    return (
      <span
        className={`inline-flex shrink-0 items-center justify-center rounded-sm font-metric text-[9px] font-medium text-white ${className}`}
        style={{ width: size, height: size, backgroundColor: stripe }}
        aria-hidden
      >
        {market.slice(0, 2)}
      </span>
    );
  }

  return (
    // Native img: Next/Image blocks SVGs and rasterizes poorly at chip sizes.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={icon}
      alt=""
      className={`block shrink-0 object-contain object-left ${className}`}
      style={{ height: size, width: "auto", maxWidth: size * 5 }}
      aria-hidden
    />
  );
}

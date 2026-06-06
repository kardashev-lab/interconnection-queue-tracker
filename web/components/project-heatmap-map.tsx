"use client";

import { memo, useEffect, useMemo, useState } from "react";
import { ComposableMap, Geographies, Geography } from "react-simple-maps";
import { countProjectsByFips } from "@/lib/analytics";
import { formatCount } from "@/lib/format";
import { coveredFipsForFilter, isCoveredState, marketForState, US_STATES_GEO_URL } from "@/lib/iso-states";
import { FIPS_TO_STATE_NAME, heatColor } from "@/lib/state-geo";
import type { QueueProject } from "@/lib/types";

const UNCOVERED_FILL = "#f7f6f3";

type StateDetail = {
  fips: string;
  name: string;
  detail: string;
};

function stateDetail(
  fips: string,
  name: string,
  market: string | undefined,
  countsByFips: Record<string, number>,
): StateDetail {
  const covered = isCoveredState(fips, market);
  if (!covered) {
    return { fips, name, detail: "Outside tracked ISO/RTO footprint" };
  }
  const count = countsByFips[fips] ?? 0;
  const iso = marketForState(fips);
  return {
    fips,
    name,
    detail: `${formatCount(count)} projects${iso ? ` · ${iso}` : ""}`,
  };
}

export const ProjectHeatmapMap = memo(function ProjectHeatmapMap({
  projects,
  market,
  className = "",
}: {
  projects: QueueProject[];
  market?: string;
  className?: string;
}) {
  const [hover, setHover] = useState<StateDetail | null>(null);
  const [selected, setSelected] = useState<StateDetail | null>(null);

  const coveredFips = useMemo(() => coveredFipsForFilter(market), [market]);

  useEffect(() => {
    setSelected(null);
    setHover(null);
  }, [market]);

  const countsByFips = useMemo(
    () => countProjectsByFips(projects, market),
    [projects, market],
  );

  const maxCount = useMemo(() => {
    const coveredCounts = [...coveredFips].map((fips) => countsByFips[fips] ?? 0);
    return Math.max(0, ...coveredCounts);
  }, [countsByFips, coveredFips]);

  const titled = market && market !== "all" ? `${market} projects by state` : "Projects by state";
  const activeState = selected ?? hover;

  return (
    <div className={`flex min-h-0 flex-col ${className}`}>
      <div className="flex shrink-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-[10px] font-medium uppercase tracking-[0.12em] text-[#787774]">
            {titled}
          </h2>
          <p className="mt-2 min-h-12 text-sm leading-relaxed">
            {activeState ? (
              <span className="font-metric text-[#2f3437]">
                {activeState.name}: {activeState.detail}
              </span>
            ) : (
              <span className="text-[#787774]">
                Heatmap covers ISO/RTO footprint only — gray states are outside tracked markets.
                Tap a state to see project counts.
              </span>
            )}
          </p>
        </div>

        <div className="shrink-0">
          <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-[#787774]">
            Scale (covered states)
          </p>
          <div
            className="mt-1.5 h-2 w-36 border border-[#eaeaea]"
            style={{
              background: "linear-gradient(to right, #ebeae6, #d4c4b0, #1f6c9f, #2f3437)",
            }}
          />
          <div className="mt-1 flex w-36 justify-between font-metric text-[10px] text-[#787774]">
            <span>0</span>
            <span>{formatCount(maxCount)}</span>
          </div>
        </div>
      </div>

      <div className="mt-3 min-h-0 flex-1">
        <ComposableMap
          projection="geoAlbersUsa"
          width={800}
          height={500}
          style={{ width: "100%", height: "100%", minHeight: "280px", display: "block" }}
          aria-label="Heatmap of interconnection queue projects by US state"
        >
          <Geographies geography={US_STATES_GEO_URL}>
            {({ geographies }) =>
              geographies.map((geo) => {
                const fips = String(geo.id).padStart(2, "0");
                const name = FIPS_TO_STATE_NAME[fips] ?? String(geo.properties?.name ?? fips);
                const covered = isCoveredState(fips, market);
                const count = covered ? (countsByFips[fips] ?? 0) : 0;
                const fill = covered ? heatColor(count, maxCount) : UNCOVERED_FILL;
                const isSelected = selected?.fips === fips;

                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    fill={fill}
                    stroke={isSelected ? "#2f3437" : "#eaeaea"}
                    strokeWidth={isSelected ? 1.2 : covered ? 0.6 : 0.4}
                    onMouseEnter={() => {
                      setHover(stateDetail(fips, name, market, countsByFips));
                    }}
                    onMouseLeave={() => setHover(null)}
                    {...({
                      onClick: () => {
                        const detail = stateDetail(fips, name, market, countsByFips);
                        setSelected((current) =>
                          current?.fips === detail.fips ? null : detail,
                        );
                      },
                    } as { onClick: () => void })}
                    style={{
                      default: { outline: "none", cursor: covered ? "pointer" : "default" },
                      hover: {
                        outline: "none",
                        fill: covered ? fill : UNCOVERED_FILL,
                        stroke: covered ? "#2f3437" : "#d8d6d0",
                        strokeWidth: covered ? 0.8 : 0.4,
                      },
                      pressed: { outline: "none" },
                    }}
                  />
                );
              })
            }
          </Geographies>
        </ComposableMap>
      </div>
    </div>
  );
});

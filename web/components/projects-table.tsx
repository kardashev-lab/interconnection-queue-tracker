"use client";

import { useMemo, useState } from "react";
import { MarketIcon } from "@/components/market-icon";
import { formatCount, formatMw } from "@/lib/format";
import { fuelColor } from "@/lib/markets";
import type { QueueProject } from "@/lib/types";

const PAGE_SIZE = 50;

export function ProjectsTable({
  projects,
  market,
}: {
  projects: QueueProject[];
  market: string;
}) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const scoped =
      market === "all" ? projects : projects.filter((p) => p.market === market);
    const q = query.trim().toLowerCase();
    if (!q) return scoped;
    return scoped.filter(
      (p) =>
        p.projectName?.toLowerCase().includes(q) ||
        p.queueId.toLowerCase().includes(q) ||
        p.fuel?.toLowerCase().includes(q) ||
        p.status?.toLowerCase().includes(q) ||
        p.state?.toLowerCase().includes(q) ||
        p.market.toLowerCase().includes(q),
    );
  }, [projects, market, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);

  const pageStart = filtered.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const pageEnd = Math.min(currentPage * PAGE_SIZE, filtered.length);
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const showMarket = market === "all";

  return (
    <section>
      <div className="flex flex-col gap-4 border-b border-[#eaeaea] pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-label">Interconnection queue</h2>
          <p className="mt-1.5 text-base text-[#5f5c58]">
            {formatCount(filtered.length)} projects · sorted by capacity
          </p>
        </div>
        <label className="w-full sm:max-w-xs">
          <span className="sr-only">Search projects</span>
          <input
            id="project-search"
            type="search"
            placeholder="Search name, ID, fuel, state…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            className="min-h-11 w-full border border-[#eaeaea] bg-white px-3 py-2.5 text-base text-[#2f3437] outline-none placeholder:text-[#b8b4af] focus:border-[#2f3437] sm:text-sm"
          />
        </label>
      </div>

      {visible.length === 0 ? (
        <p className="py-10 text-center text-sm text-[#787774]">No projects match your search.</p>
      ) : (
        <>
          <ul className="divide-y divide-[#eaeaea] md:hidden">
            {visible.map((project) => (
              <li key={`${project.market}-${project.queueId}-card`}>
                <ProjectCard project={project} showMarket={showMarket} />
              </li>
            ))}
          </ul>

          <div className="hidden overflow-x-auto md:block">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[#eaeaea] font-label">
                  {showMarket && <th className="py-3 pr-4 font-medium">ISO</th>}
                  <th className="py-3 pr-4 font-medium">Project</th>
                  <th className="py-3 pr-4 font-medium">Queue ID</th>
                  <th className="py-3 pr-4 font-medium text-right">MW</th>
                  <th className="py-3 pr-4 font-medium">Fuel</th>
                  <th className="py-3 pr-4 font-medium">Status</th>
                  <th className="py-3 font-medium">State</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eaeaea]">
                {visible.map((project) => (
                  <tr
                    key={`${project.market}-${project.queueId}`}
                    className="hover:bg-[#f7f6f3]/60"
                  >
                    {showMarket && (
                      <td className="py-3 pr-4">
                        <span className="inline-flex items-center gap-1.5 font-metric text-xs text-[#787774]">
                          <MarketIcon market={project.market} size={16} />
                          {project.market}
                        </span>
                      </td>
                    )}
                    <td className="max-w-xs py-3 pr-4 text-[#2f3437]">
                      {project.projectName || "—"}
                    </td>
                    <td className="py-3 pr-4 font-metric text-xs text-[#787774]">
                      {project.queueId}
                    </td>
                    <td className="py-3 pr-4 text-right font-metric text-[#2f3437]">
                      {project.mw ? formatMw(project.mw) : "—"}
                    </td>
                    <td className="py-3 pr-4">
                      {project.fuel ? (
                        <span className="inline-flex items-center gap-1.5 text-[#2f3437]">
                          <span className={`size-2 rounded-sm ${fuelColor(project.fuel)}`} />
                          {project.fuel}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-3 pr-4 text-[#787774]">{project.status || "—"}</td>
                    <td className="py-3 text-[#787774]">{project.state || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <div className="mt-4 flex flex-col gap-3 border-t border-[#eaeaea] pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="font-metric text-xs text-[#787774]">
          {filtered.length === 0
            ? "0 projects"
            : `${formatCount(pageStart)}-${formatCount(pageEnd)} of ${formatCount(filtered.length)}`}
          {query ? " matching search" : ""}
        </p>

        {totalPages > 1 && (
          <nav className="flex items-center gap-1" aria-label="Pagination">
            <PaginationButton
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
            >
              Previous
            </PaginationButton>
            <span className="px-2 font-metric text-xs text-[#787774]">
              Page {formatCount(currentPage)} of {formatCount(totalPages)}
            </span>
            <PaginationButton
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
            >
              Next
            </PaginationButton>
          </nav>
        )}
      </div>
    </section>
  );
}

function ProjectCard({
  project,
  showMarket,
}: {
  project: QueueProject;
  showMarket: boolean;
}) {
  return (
    <article className="py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {showMarket && (
            <p className="mb-1 inline-flex items-center gap-1.5 font-metric text-xs text-[#787774]">
              <MarketIcon market={project.market} size={16} />
              {project.market}
            </p>
          )}
          <h3 className="text-sm font-medium text-[#2f3437]">
            {project.projectName || "Unnamed project"}
          </h3>
          <p className="mt-0.5 font-metric text-xs text-[#787774]">{project.queueId}</p>
        </div>
        <p className="shrink-0 font-metric text-sm text-[#2f3437]">
          {project.mw ? formatMw(project.mw) : "—"}
        </p>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
        <div>
          <dt className="font-label">Fuel</dt>
          <dd className="mt-0.5 text-[#2f3437]">
            {project.fuel ? (
              <span className="inline-flex items-center gap-1.5">
                <span className={`size-2 rounded-sm ${fuelColor(project.fuel)}`} />
                {project.fuel}
              </span>
            ) : (
              "—"
            )}
          </dd>
        </div>
        <div>
          <dt className="font-label">State</dt>
          <dd className="mt-0.5 text-[#2f3437]">{project.state || "—"}</dd>
        </div>
        <div className="col-span-2">
          <dt className="font-label">Status</dt>
          <dd className="mt-0.5 leading-relaxed text-[#787774]">{project.status || "—"}</dd>
        </div>
      </dl>
    </article>
  );
}

function PaginationButton({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="min-h-11 border border-[#eaeaea] bg-white px-4 py-2 text-xs text-[#2f3437] transition-colors hover:bg-[#f7f6f3] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

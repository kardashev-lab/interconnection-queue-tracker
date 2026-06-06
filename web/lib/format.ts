export function formatMw(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)} TW`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)} GW`;
  return `${new Intl.NumberFormat("en-US").format(Math.round(value))} MW`;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function formatCount(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

export function primarySize(row: { queueMw?: number; requestCount?: number; metrics?: { value: string }[] }): string {
  if (typeof row.queueMw === "number") return formatMw(row.queueMw);
  if (typeof row.requestCount === "number") return `${formatCount(row.requestCount)} req`;
  return row.metrics?.[0]?.value ?? "—";
}

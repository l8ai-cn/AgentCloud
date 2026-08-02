import type { TimeRange, Granularity } from "./usage";

export const validTimeRanges: TimeRange[] = ["7d", "30d", "90d"];
export const validGranularities: Granularity[] = ["day", "week", "month"];

export function isValidTimeRange(v: string | null): v is TimeRange {
  return v !== null && validTimeRanges.includes(v as TimeRange);
}

export function isValidGranularity(v: string | null): v is Granularity {
  return v !== null && validGranularities.includes(v as Granularity);
}

export function getTimeRangeDates(tr: TimeRange): { start: string; end: string } {
  const now = new Date();
  const end = now.toISOString();
  const days = tr === "7d" ? 7 : tr === "30d" ? 30 : 90;
  const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
  return { start, end };
}

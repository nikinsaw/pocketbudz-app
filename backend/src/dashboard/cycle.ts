import { HttpError } from '../errors.js';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface CycleWindow {
  from: string; // first day, inclusive (YYYY-MM-DD)
  to: string; // last day, inclusive
  daysTotal: number;
  daysElapsed: number; // including today, capped at daysTotal
}

const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export function parseISODate(value: string): number {
  const ms = Date.parse(`${value}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(ms) || iso(ms) !== value) {
    throw new HttpError(400, 'Invalid date');
  }
  return ms;
}

// The budget cycle containing `today`, anchored to the household's start day (1-28, so the
// day exists in every month). Mirrors the app's solo logic: if today is before this month's
// start day the cycle began last month. All arithmetic is UTC on plain dates, so the result
// doesn't shift with the server's time zone - the client says what "today" is for the user.
export function cycleWindow(startDay: number, todayISO: string): CycleWindow {
  const today = parseISODate(todayISO);
  const t = new Date(today);
  const startMonth = t.getUTCDate() >= startDay ? t.getUTCMonth() : t.getUTCMonth() - 1;
  const start = Date.UTC(t.getUTCFullYear(), startMonth, startDay);
  const end = Date.UTC(t.getUTCFullYear(), startMonth + 1, startDay); // exclusive
  const daysTotal = Math.round((end - start) / DAY_MS);
  return {
    from: iso(start),
    to: iso(end - DAY_MS),
    daysTotal,
    daysElapsed: Math.min(Math.round((today - start) / DAY_MS) + 1, daysTotal),
  };
}

import { describe, expect, it } from 'vitest';
import { cycleWindow, parseISODate } from './cycle.js';

describe('cycleWindow', () => {
  it('starts on the 1st: the cycle is the calendar month', () => {
    expect(cycleWindow(1, '2026-10-12')).toEqual({ from: '2026-10-01', to: '2026-10-31', daysTotal: 31, daysElapsed: 12 });
  });

  it('on the start day itself, that day is day 1 of the new cycle', () => {
    expect(cycleWindow(15, '2026-10-15')).toEqual({ from: '2026-10-15', to: '2026-11-14', daysTotal: 31, daysElapsed: 1 });
  });

  it('the day before the start day is the last day of the previous cycle', () => {
    expect(cycleWindow(15, '2026-10-14')).toEqual({ from: '2026-09-15', to: '2026-10-14', daysTotal: 30, daysElapsed: 30 });
  });

  it('rolls back across a year boundary', () => {
    expect(cycleWindow(25, '2027-01-10')).toEqual({ from: '2026-12-25', to: '2027-01-24', daysTotal: 31, daysElapsed: 17 });
  });

  it('rolls forward across a year boundary', () => {
    expect(cycleWindow(25, '2026-12-30')).toEqual({ from: '2026-12-25', to: '2027-01-24', daysTotal: 31, daysElapsed: 6 });
  });

  it('handles February, including a leap year, for the largest allowed start day', () => {
    expect(cycleWindow(28, '2026-02-10')).toEqual({ from: '2026-01-28', to: '2026-02-27', daysTotal: 31, daysElapsed: 14 });
    expect(cycleWindow(28, '2026-03-01')).toEqual({ from: '2026-02-28', to: '2026-03-27', daysTotal: 28, daysElapsed: 2 });
    expect(cycleWindow(28, '2028-03-01').daysTotal).toBe(29); // 2028 is a leap year
  });

  it('every day of a year lands in exactly one cycle, and cycles tile with no gap or overlap', () => {
    for (const startDay of [1, 5, 15, 25, 28]) {
      let previous: ReturnType<typeof cycleWindow> | null = null;
      let cycles = 0;
      for (let day = Date.UTC(2026, 0, 1); day < Date.UTC(2027, 0, 1); day += 86400000) {
        const today = new Date(day).toISOString().slice(0, 10);
        const w = cycleWindow(startDay, today);
        expect(w.from <= today && today <= w.to).toBe(true);
        expect(w.daysElapsed).toBeGreaterThanOrEqual(1);
        expect(w.daysElapsed).toBeLessThanOrEqual(w.daysTotal);
        if (previous && w.from !== previous.from) {
          // A new cycle may only begin the day after the previous one ended.
          expect(Date.parse(`${w.from}T00:00:00Z`) - Date.parse(`${previous.to}T00:00:00Z`)).toBe(86400000);
          cycles += 1;
        }
        previous = w;
      }
      expect(cycles).toBeGreaterThanOrEqual(11); // a year crosses at least 11 cycle boundaries
    }
  });
});

describe('parseISODate', () => {
  it('rejects malformed and impossible dates', () => {
    for (const bad of ['2026-02-31', '2026-13-01', 'yesterday', '2026-1-5', '', '2026-10-05T10:00:00Z']) {
      expect(() => parseISODate(bad)).toThrow();
    }
    expect(parseISODate('2026-10-05')).toBe(Date.UTC(2026, 9, 5));
  });
});

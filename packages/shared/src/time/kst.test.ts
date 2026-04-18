import { describe, expect, it } from 'vitest';
import {
  LAUNCH_DATE,
  challengeDayNumber,
  dayDiff,
  getKstToday,
  getKstYesterday,
  toKstDateString,
} from './index.js';

describe('KST time helpers', () => {
  it('converts a UTC instant to the correct KST calendar day', () => {
    // 2026-04-18 14:30 UTC → 2026-04-18 23:30 KST
    const utc = Date.UTC(2026, 3, 18, 14, 30, 0);
    expect(toKstDateString(utc)).toBe('2026-04-18');
  });

  it('rolls to the next day for evening UTC that is past midnight KST', () => {
    // 2026-04-18 16:30 UTC → 2026-04-19 01:30 KST
    const utc = Date.UTC(2026, 3, 18, 16, 30, 0);
    expect(toKstDateString(utc)).toBe('2026-04-19');
  });

  it('getKstToday/Yesterday use the same anchor', () => {
    const now = Date.UTC(2026, 3, 18, 10, 0, 0);
    expect(getKstToday(now)).toBe('2026-04-18');
    expect(getKstYesterday(now)).toBe('2026-04-17');
  });

  it('dayDiff counts calendar days', () => {
    expect(dayDiff('2024-09-15', '2024-09-15')).toBe(0);
    expect(dayDiff('2024-09-15', '2024-09-16')).toBe(1);
    expect(dayDiff('2024-09-15', '2026-04-18')).toBe(580);
  });

  it('challengeDayNumber is 1 on launch date', () => {
    expect(challengeDayNumber(LAUNCH_DATE)).toBe(1);
    expect(challengeDayNumber('2024-09-16')).toBe(2);
  });

  it('rejects invalid date strings', () => {
    expect(() => dayDiff('not-a-date', '2026-04-18')).toThrow(TypeError);
  });
});

// KST (Asia/Seoul) date helpers. The app's game-day concept is anchored to
// KST midnight regardless of where the player is physically located.

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** The official Linkle launch date (KST), used for "Day N" counters. */
export const LAUNCH_DATE = '2024-09-15';

/** Convert any Date (or epoch ms) to the KST calendar day, as YYYY-MM-DD. */
export function toKstDateString(input: Date | number = Date.now()): string {
  const ms = typeof input === 'number' ? input : input.getTime();
  const kst = new Date(ms + KST_OFFSET_MS);
  const yyyy = kst.getUTCFullYear();
  const mm = String(kst.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(kst.getUTCDate()).padStart(2, '0');
  return `${String(yyyy)}-${mm}-${dd}`;
}

/** Today in KST. Pure wrapper around {@link toKstDateString}. */
export function getKstToday(now: number = Date.now()): string {
  return toKstDateString(now);
}

/** Yesterday in KST. */
export function getKstYesterday(now: number = Date.now()): string {
  return toKstDateString(now - 24 * 60 * 60 * 1000);
}

/**
 * Number of calendar days between two KST dates (exclusive of start, inclusive
 * of end). Useful for "오늘의 N번째 챌린지" counters.
 */
export function dayDiff(fromYmd: string, toYmd: string): number {
  const from = Date.parse(`${fromYmd}T00:00:00+09:00`);
  const to = Date.parse(`${toYmd}T00:00:00+09:00`);
  if (Number.isNaN(from) || Number.isNaN(to)) {
    throw new TypeError('Invalid YYYY-MM-DD');
  }
  return Math.round((to - from) / (24 * 60 * 60 * 1000));
}

/** The challenge index since launch (1-based). */
export function challengeDayNumber(ymd: string = getKstToday()): number {
  return dayDiff(LAUNCH_DATE, ymd) + 1;
}

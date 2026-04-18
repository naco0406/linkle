// Per-day game state persisted to localStorage. Zod-validated on read so a
// malformed or stale shape simply resets rather than crashing the app.

import { localDailyStateSchema, type LocalDailyState } from '@linkle/shared';

const KEY = 'linkle:dailyState';

export function loadLocalDailyState(expectedDate: string): LocalDailyState | null {
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    const parsed = localDailyStateSchema.parse(JSON.parse(raw));
    if (parsed.date !== expectedDate) return null;
    return parsed;
  } catch {
    localStorage.removeItem(KEY);
    return null;
  }
}

export function saveLocalDailyState(state: LocalDailyState): void {
  localStorage.setItem(KEY, JSON.stringify(state));
}

export function clearLocalDailyState(): void {
  localStorage.removeItem(KEY);
}

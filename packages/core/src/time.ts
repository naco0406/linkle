const KST_OFFSET_MS = 9 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

/** 그 시각의 한국 날짜 (YYYY-MM-DD). 기기의 시간대와 무관하다 */
export function kstDate(ms: number): string {
  return new Date(ms + KST_OFFSET_MS).toISOString().slice(0, 10)
}

/** 다음 한국 자정의 시각 (ms) */
export function nextKstMidnight(ms: number): number {
  return (Math.floor((ms + KST_OFFSET_MS) / DAY_MS) + 1) * DAY_MS - KST_OFFSET_MS
}

/** 한국 날짜에 n일을 더한다 (YYYY-MM-DD) */
export function addDays(date: string, n: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10)
}

/** 두 한국 날짜 사이의 일수. to가 뒤면 양수 */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to + 'T00:00:00Z') - Date.parse(from + 'T00:00:00Z')) / DAY_MS)
}

const pad = (n: number) => n.toString().padStart(2, '0')

/** 타이머 표시용. 12:34 또는 1:02:03 */
export function formatClock(ms: number): string {
  const total = Math.floor(Math.max(0, ms) / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`
}

/** 결과와 공유 문구용. 기존 링클과 같은 표기: "02분 31초" */
export function formatDurationKo(ms: number): string {
  const total = Math.floor(Math.max(0, ms) / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (h > 0) return `${pad(h)}시간 ${pad(m)}분 ${pad(s)}초`
  if (m > 0) return `${pad(m)}분 ${pad(s)}초`
  return `${pad(s)}초`
}

/** 공유 문구용 짧은 표기. 앞자리 0 없이: "36초", "2분 31초", "1시간 2분 3초" */
export function formatDurationShort(ms: number): string {
  const total = Math.floor(Math.max(0, ms) / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const sec = total % 60
  if (h > 0) return `${h}시간 ${m}분 ${sec}초`
  if (m > 0) return `${m}분 ${sec}초`
  return `${sec}초`
}

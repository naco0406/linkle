import { describe, expect, it } from 'vitest'
import {
  addFlag, applyBack, applyLink, backTarget, checkLog, createRun, currentPage, daysBetween, elapsedMs, emojiOf,
  formatClock, formatDurationKo, kstDate, levelOf, moveCount, nextKstMidnight, pathOf, shareText, stackOf,
  type Level, type MoveEvent, type Puzzle, type Run,
} from './index.ts'

const P = (id: number, title: string) => ({ id, title })
const A = P(1, '불고기'), B = P(2, '소고기'), C = P(3, '가죽'), D = P(4, '신발'), E = P(5, '뉴발란스')
const puzzle: Puzzle = { id: 10, kind: 'daily', number: 123, date: '2026-11-19', start: A, end: E }
const T0 = Date.UTC(2026, 10, 18, 15, 0, 0) // 2026-11-19 00:00 KST
const fresh = () => createRun({ mode: 'daily', puzzle, runId: 'r1', startedAt: T0 })
const link = (run: Run, to: typeof A, at: number, lead?: string) => applyLink(run, { to, via: to.title, at, lead })

describe('이동 로그', () => {
  it('새 Run은 출발 문서에 있고 뒤로 갈 곳이 없다', () => {
    const run = fresh()
    expect(currentPage(run)).toEqual(A)
    expect(backTarget(run)).toBeNull()
    expect(moveCount(run)).toBe(0)
    expect(run.phase).toBe('playing')
  })

  it('링크 이동은 로그에 쌓이고 현재 문서가 바뀐다', () => {
    const run = link(link(fresh(), B, 1000), C, 2500)
    expect(currentPage(run)).toEqual(C)
    expect(backTarget(run)).toEqual(B)
    expect(moveCount(run)).toBe(2)
  })

  it('뒤로가기는 이동 횟수에 들어가고, 바로 전 문서로 간다', () => {
    let run = link(link(fresh(), B, 1000), C, 2000)
    run = applyBack(run, 3000)
    expect(currentPage(run)).toEqual(B)
    expect(moveCount(run)).toBe(3)
    expect(backTarget(run)).toEqual(A)
    run = applyBack(run, 4000)
    expect(currentPage(run)).toEqual(A)
    expect(backTarget(run)).toBeNull()
  })

  it('출발 문서에서의 뒤로가기는 기록되지 않는다', () => {
    const run = fresh()
    expect(applyBack(run, 500)).toBe(run)
  })

  it('뒤로 간 뒤 다른 링크를 타면 스택이 갈라진 곳부터 이어진다', () => {
    let run = link(link(fresh(), B, 1), C, 2)
    run = link(applyBack(run, 3), D, 4)
    expect(stackOf(A, run.events).map(p => p.title)).toEqual(['불고기', '소고기', '신발'])
    expect(pathOf(run).map(s => s.page.title)).toEqual(['불고기', '소고기', '가죽', '소고기', '신발'])
    expect(pathOf(run).map(s => s.back)).toEqual([false, false, false, true, false])
  })

  it('도착 문서의 id에 닿으면 끝난다. 제목이 달라도 id가 같으면 도착이다', () => {
    const run = applyLink(link(fresh(), B, 1000), { to: P(5, 'New Balance'), via: '뉴 발란스', at: 61_000 })
    expect(run.phase).toBe('finished')
    expect(run.finishedAt).toBe(T0 + 61_000)
    expect(run.outbox).toBe('pending')
    expect(elapsedMs(run, T0 + 999_999)).toBe(61_000)
  })

  it('id가 다르면 제목이 같아도 도착이 아니다', () => {
    const run = link(fresh(), P(99, '뉴발란스'), 1000)
    expect(run.phase).toBe('playing')
  })

  it('끝난 Run은 더 움직이지 않는다', () => {
    const done = link(fresh(), E, 1000)
    expect(link(done, B, 2000)).toBe(done)
    expect(applyBack(done, 2000)).toBe(done)
  })

  it('시각이 거꾸로 가면 직전 시각으로 맞춘다', () => {
    const run = link(link(fresh(), B, 5000), C, 3000)
    expect(run.events.map(e => e.at)).toEqual([5000, 5000])
  })

  it('문단은 문서 id로 저장된다', () => {
    const run = link(link(fresh(), B, 1, '소고기: 소의 고기'), C, 2)
    expect(run.leads).toEqual({ 2: '소고기: 소의 고기' })
  })

  it('입력 Run을 바꾸지 않는다', () => {
    const run = fresh()
    link(run, B, 1)
    expect(run.events).toEqual([])
  })

  it('플래그는 한 번만 붙는다', () => {
    const run = addFlag(addFlag(fresh(), 'find'), 'find')
    expect(run.flags).toEqual(['find'])
  })

  it('진행 중의 경과 시간은 넘겨받은 현재 시각 기준이다', () => {
    expect(elapsedMs(fresh(), T0 + 4200)).toBe(4200)
    expect(elapsedMs(fresh(), T0 - 50)).toBe(0)
  })
})

describe('로그 형식 검사', () => {
  const ev = (run: Run) => run.events
  it('정상 로그를 통과시킨다', () => {
    let run = link(link(fresh(), B, 1), C, 2)
    run = link(link(applyBack(run, 3), D, 4), E, 5)
    expect(checkLog(puzzle, ev(run))).toEqual({ ok: true })
  })
  it('빈 로그, 도착하지 않은 로그를 거른다', () => {
    expect(checkLog(puzzle, [])).toEqual({ ok: false, reason: 'empty' })
    expect(checkLog(puzzle, ev(link(fresh(), B, 1)))).toEqual({ ok: false, reason: 'not_finished' })
  })
  it('시각이 거꾸로 가는 로그를 거른다', () => {
    const events: MoveEvent[] = [{ type: 'link', to: B, via: 'x', at: 10 }, { type: 'link', to: E, via: 'x', at: 5 }]
    expect(checkLog(puzzle, events)).toEqual({ ok: false, reason: 'time_not_monotonic@1' })
  })
  it('출발 문서에서의 뒤로가기, 엉뚱한 곳으로의 뒤로가기를 거른다', () => {
    expect(checkLog(puzzle, [{ type: 'back', to: A, at: 1 }])).toMatchObject({ ok: false, reason: 'back_at_start@0' })
    const events: MoveEvent[] = [{ type: 'link', to: B, via: 'x', at: 1 }, { type: 'back', to: C, at: 2 }]
    expect(checkLog(puzzle, events)).toMatchObject({ ok: false, reason: 'back_target_mismatch@1' })
  })
  it('도착한 뒤의 이동을 거른다', () => {
    const events: MoveEvent[] = [{ type: 'link', to: E, via: 'x', at: 1 }, { type: 'link', to: E, via: 'x', at: 2 }]
    expect(checkLog(puzzle, events)).toMatchObject({ ok: false, reason: 'move_after_finish@1' })
  })
})

describe('이모지', () => {
  it('유사도를 20% 단위 5단계로 나눈다', () => {
    expect([-0.3, 0, 0.19, 0.2, 0.59, 0.6, 0.99, 1, 1.7, NaN].map(levelOf)).toEqual([0, 0, 0, 1, 2, 3, 4, 4, 4, 0])
  })
  it('이동 한 번에 이모지 하나: 색, 뒤로가기, 도착', () => {
    let run = link(link(fresh(), B, 1), C, 2)
    run = link(link(applyBack(run, 3), D, 4), E, 5)
    const levels: Record<number, Level> = { 2: 0, 3: 1, 4: 3 }
    expect(emojiOf(run.events, E.id, id => levels[id] ?? null).join('')).toBe('🟥🟧⏪🟩🏁')
  })
  it('유사도를 모르는 문서는 빈 칸으로 둔다', () => {
    const run = link(link(fresh(), B, 1), E, 2)
    expect(emojiOf(run.events, E.id, () => null)).toEqual(['⬜', '🏁'])
  })
})

describe('한국 시간', () => {
  it('UTC 15시가 한국 날짜의 경계다', () => {
    expect(kstDate(T0 - 1)).toBe('2026-11-18')
    expect(kstDate(T0)).toBe('2026-11-19')
  })
  it('다음 자정', () => {
    expect(nextKstMidnight(T0)).toBe(T0 + 86_400_000)
    expect(nextKstMidnight(T0 - 1)).toBe(T0)
    expect(nextKstMidnight(T0 + 3_600_000)).toBe(T0 + 86_400_000)
  })
  it('날짜 사이의 일수', () => {
    expect(daysBetween('2026-11-19', '2026-11-20')).toBe(1)
    expect(daysBetween('2026-02-28', '2026-03-01')).toBe(1)
    expect(daysBetween('2026-11-19', '2026-11-19')).toBe(0)
  })
  it('시간 표기', () => {
    expect(formatClock(0)).toBe('00:00')
    expect(formatClock(151_900)).toBe('02:31')
    expect(formatClock(3_723_000)).toBe('1:02:03')
    expect(formatDurationKo(9_000)).toBe('09초')
    expect(formatDurationKo(151_000)).toBe('02분 31초')
    expect(formatDurationKo(3_723_000)).toBe('01시간 02분 03초')
  })
})

describe('공유 문구', () => {
  const finished = (mode: Run['mode'], p: Puzzle): Run => {
    const run = applyLink(applyLink(createRun({ mode, puzzle: p, runId: 'r', startedAt: T0 }), { to: B, via: 'b', at: 1000 }), { to: E, via: 'e', at: 151_000 })
    return { ...run, emoji: ['🟥', '🏁'] }
  }
  it('오늘의 문제는 기존 링클의 문구를 따른다', () => {
    const run = { ...finished('daily', puzzle), result: { order: 7 } }
    expect(shareText(run, { origin: 'https://linkle.example' })).toBe(
      ['123번째 링클을 클리어했습니다!', '일일 순위 : 7등', '이동 횟수: 2', '소요 시간: 02분 31초', '', '🟥🏁', '', 'https://linkle.example/'].join('\n'),
    )
  })
  it('순서를 아직 모르면 그 줄을 뺀다. 문서 제목은 어디에도 없다', () => {
    const text = shareText(finished('daily', puzzle), { origin: 'https://linkle.example' })
    expect(text).not.toContain('일일 순위')
    for (const t of ['불고기', '소고기', '뉴발란스']) expect(text).not.toContain(t)
  })
  it('지난 문제와 커뮤니티 문제는 구분되고, 커뮤니티는 문제 주소가 들어간다', () => {
    expect(shareText(finished('archive', puzzle), { origin: 'https://x' })).toContain('123번째 링클(지난 문제)')
    const c = shareText(finished('community', { ...puzzle, id: 55, kind: 'community', number: 8, date: null }), { origin: 'https://x' })
    expect(c).toContain('링클 커뮤니티 8번 문제')
    expect(c.endsWith('https://x/community/55')).toBe(true)
  })
  it('끝나지 않은 Run은 공유할 수 없다', () => {
    expect(() => shareText(fresh(), { origin: 'https://x' })).toThrow()
  })
})

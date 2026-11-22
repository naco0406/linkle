import { beforeEach, describe, expect, it } from 'vitest'
import { createRun, type Run } from '@linkle/core'
import { dailyRun, useGame } from './store'

const P = (id: number) => ({ id, title: `문서 ${id}` })
const daily = (date: string, number = 2): Run =>
  createRun({ mode: 'daily', runId: `run-${date}`, startedAt: 1, puzzle: { id: number, kind: 'daily', number, date, start: P(1), end: P(2) } })
const today = (date: string) => ({ date, number: 3, resetsAt: 0, serverNow: Date.now(), finishedCount: 0 })

describe('날짜가 넘어가면', () => {
  beforeEach(() => useGame.setState({ run: null, others: {}, today: null, ended: null }))

  it('어제 풀다 만 오늘의 문제를 끝낸다', () => {
    useGame.setState({ run: daily('2026-11-21') })
    useGame.getState().setToday(today('2026-11-22'))
    expect(useGame.getState().run).toBeNull()
  })
  it('오늘 푸는 중인 판은 그대로 둔다', () => {
    useGame.setState({ run: daily('2026-11-22', 3) })
    useGame.getState().setToday(today('2026-11-22'))
    expect(useGame.getState().run?.runId).toBe('run-2026-11-22')
  })
  it('자정 전에 보낸 요청의 답이 늦게 와도 새 날의 판을 지우지 않는다', () => {
    useGame.setState({ run: daily('2026-11-22', 3) })
    useGame.getState().setToday(today('2026-11-21'))
    expect(useGame.getState().run?.runId).toBe('run-2026-11-22')
  })
  it('끝낸 판은 홈에서 알리고, 새 판을 시작하면 알림을 거둔다', () => {
    useGame.setState({ run: daily('2026-11-21') })
    useGame.getState().setToday(today('2026-11-22'))
    expect(useGame.getState().ended?.number).toBe(2)
    useGame.getState().begin('daily', daily('2026-11-22', 3), Date.now())
    expect(useGame.getState().ended).toBeNull()
  })
  it('서버에 오늘 문제가 없어도 어제 판은 끝낸다', () => {
    useGame.setState({ run: daily('2020-01-01') })
    useGame.getState().setNoPuzzle()
    expect(useGame.getState().run).toBeNull()
  })
  it('서버 답을 받기 전에도 지난 날짜의 게임 화면은 띄우지 않되, 판은 지우지 않는다', () => {
    useGame.setState({ run: daily('2020-01-01') })
    expect(dailyRun(useGame.getState())).toBeNull()
    expect(useGame.getState().run).not.toBeNull()
  })
  it('기기 시계가 앞서도 서버가 오늘이라고 하면 게임 화면을 보인다', () => {
    useGame.setState({ run: daily('2020-01-01'), today: today('2020-01-01') })
    expect(dailyRun(useGame.getState())?.runId).toBe('run-2020-01-01')
  })
  it('푸는 중인 지난 문제는 건드리지 않는다', () => {
    useGame.setState({ others: { 1: { ...daily('2026-11-20', 1), mode: 'archive' } } })
    useGame.getState().setToday(today('2026-11-22'))
    expect(useGame.getState().others['1']).toBeDefined()
  })
})

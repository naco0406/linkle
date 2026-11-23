import { describe, expect, it } from 'vitest'
import { canPublish, isChallengeCode, newCode, titleProblem } from './friends.ts'
import { runKindFor } from './rules.ts'
import { allowed } from './room-core.ts'

describe('친구에게 내기', () => {
  it('날짜, 연도, 목록, 동음이의 문서는 문제로 쓰지 않는다', () => {
    expect(titleProblem('2026년')).toBe('year')
    expect(titleProblem('2월 22일')).toBe('date')
    expect(titleProblem('대한민국의 섬 목록')).toBe('list')
    expect(titleProblem('수성 (동음이의)')).toBe('disambig')
    expect(titleProblem('반도체')).toBeNull()
  })
  it('친구 5명 이상, 도착률 20% 이상이면 커뮤니티에 올릴 수 있다', () => {
    expect(canPublish(4, 4)).toBe(false)
    expect(canPublish(5, 0)).toBe(false)
    expect(canPublish(5, 1)).toBe(true)
  })
  it('초안은 출제자만 풀 수 있고, 링크가 있는 사람만 푸는 문제는 누구나 푼다', () => {
    const me = '11111111-1111-4111-8111-111111111111'
    const other = '22222222-2222-4222-8222-222222222222'
    const draft = { kind: 'community' as const, date: null, status: 'draft', authorId: me }
    expect(runKindFor(draft, '2026-11-23', me)).toEqual({ mode: 'community', ranked: false })
    expect(runKindFor(draft, '2026-11-23', other)).toBeNull()
    expect(runKindFor({ ...draft, status: 'unlisted' }, '2026-11-23', other)).toEqual({ mode: 'community', ranked: true })
    expect(runKindFor({ ...draft, kind: 'random', authorId: null, status: 'published' }, '2026-11-23', other)).toEqual({ mode: 'community', ranked: false })
  })
  it('도전장 코드는 헷갈리는 글자를 쓰지 않는다', () => {
    for (let i = 0; i < 50; i++) expect(isChallengeCode(newCode())).toBe(true)
    expect(isChallengeCode('O0I1LA')).toBe(false)
  })
})

describe('같이 달리기: 방장이 고를 수 있는 문제', () => {
  const host = '11111111-1111-4111-8111-111111111111'
  const row = (over: Record<string, unknown>) => ({ id: 1, kind: 'official', number: 1, date: null, start_id: 1, start_title: 'a', end_id: 2, end_title: 'b', status: 'published', author_id: null, difficulty: null, ...over }) as Parameters<typeof allowed>[0]
  const rules = (source: 'community' | 'archive' | 'mine') => ({ source, difficulty: null, puzzleId: 1, win: 'first' as const, limit: 10 })
  it('오늘과 앞으로의 오늘의 문제는 고를 수 없다', () => {
    expect(allowed(row({ kind: 'daily', date: '2026-11-22' }), rules('archive'), host, '2026-11-23')).toBe(true)
    expect(allowed(row({ kind: 'daily', date: '2026-11-23' }), rules('archive'), host, '2026-11-23')).toBe(false)
  })
  it('내가 낸 문제는 방장이 낸 것만', () => {
    expect(allowed(row({ kind: 'community', author_id: host, status: 'unlisted' }), rules('mine'), host, '2026-11-23')).toBe(true)
    expect(allowed(row({ kind: 'community', author_id: 'x', status: 'unlisted' }), rules('mine'), host, '2026-11-23')).toBe(false)
    expect(allowed(row({ kind: 'community', status: 'unlisted' }), rules('community'), host, '2026-11-23')).toBe(false)
  })
})

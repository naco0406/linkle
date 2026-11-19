import { readFileSync } from 'node:fs'
import { parseHTML } from 'linkedom'
import { describe, expect, it } from 'vitest'
import { cleanPage, defaultPolicy, fetchPage, isMainNamespace, pageHtmlUrl, titleFromHref, WikiError } from './index.ts'

// 2026-11-19에 받은 한국어 위키백과 "불고기" 문서 (CC BY-SA 4.0)
const raw = readFileSync(new URL('./fixtures/bulgogi.html', import.meta.url), 'utf8')
const parse = (html: string) => parseHTML(html).document as unknown as Document
const clean = (policy = defaultPolicy) => cleanPage(parse(raw), policy)
const dom = (html: string) => parse(`<!doctype html><html><body>${html}</body></html>`)

describe('문서 정리', () => {
  const page = clean()
  const out = dom(page.html)

  it('문서 id와 제목을 머리 부분에서 읽는다', () => {
    expect(page.id).toBe(7761)
    expect(page.title).toBe('불고기')
    expect(page.styleHref).toMatch(/^https:\/\/ko\.wikipedia\.org\/w\/load\.php\?/)
  })

  it('원문에는 지울 것들이 실제로 들어 있다', () => {
    const src = parse(raw)
    expect(src.querySelectorAll('.navbox a').length).toBeGreaterThan(50)
    expect(src.querySelectorAll('a.new').length).toBeGreaterThan(10)
    expect(src.querySelectorAll('.hatnote').length).toBeGreaterThan(0)
    expect(Array.from(src.querySelectorAll('h2')).map(h => h.textContent)).toEqual(expect.arrayContaining(['같이 보기', '각주']))
  })

  it('같이 보기·각주 섹션과 탐색 상자, 안내문, 각주 번호가 없다', () => {
    const headings = Array.from(out.querySelectorAll('h2')).map(h => h.textContent)
    expect(headings).toEqual(expect.arrayContaining(['이름', '역사', '종류']))
    expect(headings).not.toContain('같이 보기')
    expect(headings).not.toContain('각주')
    for (const sel of ['.navbox', '.hatnote', 'sup.reference', '.mw-references-wrap', 'script'])
      expect(out.querySelectorAll(sel).length, sel).toBe(0)
  })

  it('어떤 링크에도 href가 없다', () => {
    expect(out.querySelectorAll('a').length).toBeGreaterThan(20)
    expect(out.querySelectorAll('a[href]').length).toBe(0)
    expect(out.querySelectorAll('[href]').length).toBe(0)
  })

  it('남은 링크는 모두 일반 문서로 가고, 없는 문서와 자기 자신은 빠진다', () => {
    const titles = Array.from(out.querySelectorAll('a')).map(a => a.getAttribute('data-title'))
    expect(titles.every(t => typeof t === 'string' && t.length > 0)).toBe(true)
    expect(titles.every(t => isMainNamespace(t!))).toBe(true)
    expect(titles).not.toContain('불고기')
    expect(out.querySelectorAll('a.new').length).toBe(0)
    expect(new Set(titles)).toEqual(new Set(page.links))
    expect(page.links).toContain('쇠고기')
  })

  it('이미지는 남기되 파일 문서로 가는 링크는 벗긴다', () => {
    expect(out.querySelectorAll('img').length).toBeGreaterThan(0)
    expect(out.querySelectorAll('a img').length).toBe(0)
    expect(Array.from(out.querySelectorAll('img')).every(i => i.getAttribute('src')!.startsWith('https://'))).toBe(true)
  })

  it('편집용 속성을 지워 크기를 줄인다', () => {
    expect(out.querySelectorAll('[data-mw]').length).toBe(0)
    expect(page.html.length).toBeLessThan(raw.length * 0.6)
  })

  it('첫 문단을 글자로 뽑는다. 스타일 코드는 섞이지 않는다', () => {
    expect(page.leadText.startsWith('불고기')).toBe(true)
    expect(page.leadText).not.toContain('{')
    expect(page.leadText.length).toBeGreaterThan(50)
  })

  it('정책으로 동음이의 링크와 특정 제목을 막을 수 있다', () => {
    const strict = clean({ ...defaultPolicy, link: { allowMissing: false, allowDisambiguation: false, blockedTitles: ['쇠고기'] } })
    expect(strict.links).not.toContain('쇠고기')
    expect(dom(strict.html).querySelectorAll('a.mw-disambig').length).toBe(0)
  })
})

describe('링크 규칙', () => {
  const page = (body: string) =>
    cleanPage(parse(`<html><head><title>가</title><meta property="mw:pageId" content="1"/></head><body><section data-mw-section-id="0"><p>${body}</p></section></body></html>`))

  it('종류별로 통과와 차단을 가른다', () => {
    const p = page(
      [
        '<a rel="mw:WikiLink" href="./나">일반</a>',
        '<a rel="mw:WikiLink" href="./다_라#마">위치 포함</a>',
        '<a rel="mw:WikiLink" href="./스타워즈:_새로운_희망">콜론 있는 일반 문서</a>',
        '<a rel="mw:WikiLink" href="./틀:정보">틀</a>',
        '<a rel="mw:WikiLink" href="./특수:검색">특수</a>',
        '<a rel="mw:WikiLink" href="./분류:음식">분류</a>',
        '<a rel="mw:WikiLink" href="./파일:A.jpg" class="mw-file-description"><img src="//x/a.jpg"/></a>',
        '<a rel="mw:WikiLink" href="./없음" class="new">없는 문서</a>',
        '<a rel="mw:WikiLink" href="./가#절">자기 자신</a>',
        '<a rel="mw:WikiLink/Interwiki" href="https://en.wikipedia.org/wiki/X">다른 언어</a>',
        '<a rel="mw:ExtLink" href="https://example.com">바깥</a>',
        '<a href="#cite_note-1">각주</a>',
      ].join(' '),
    )
    expect(p.links).toEqual(['나', '다 라', '스타워즈: 새로운 희망'])
    expect(p.html).not.toContain('href')
    expect(p.html).toContain('바깥')
    expect(p.html).toContain('없는 문서')
  })

  it('실행 가능한 속성을 지운다', () => {
    const p = page('<img src="//x/a.jpg" onerror="alert(1)"/><span onclick="x()">글</span>')
    expect(p.html).not.toMatch(/onerror|onclick/)
  })

  it('href에서 제목을 꺼낸다', () => {
    expect(titleFromHref('./서울특별시')).toEqual({ title: '서울특별시', fragment: false })
    expect(titleFromHref('./1988%EB%85%84_하계_올림픽#개요')).toEqual({ title: '1988년 하계 올림픽', fragment: true })
    expect(titleFromHref('https://example.com')).toBeNull()
    expect(titleFromHref('./%E0%A4%A')).toEqual({ title: '%E0%A4%A', fragment: false })
  })

  it('이름공간을 구분한다', () => {
    expect(['불고기', '스타워즈: 새로운 희망', ':콜론으로 시작'].map(isMainNamespace)).toEqual([true, true, true])
    expect(['틀:정보', '틀토론:정보', '특수:검색', '파일:A.jpg', '위키백과:정책', 'Category:Food', '사용자토론:가'].map(isMainNamespace)).toEqual(
      Array(7).fill(false),
    )
  })
})

describe('문서 요청', () => {
  const respond = (status: number, body = '', headers: Record<string, string> = {}) =>
    (async () => new Response(body, { status, headers })) as unknown as typeof fetch

  it('제목의 공백을 밑줄로 바꾸고 인코딩한다', () => {
    expect(pageHtmlUrl('1988년 하계 올림픽')).toBe(`https://ko.wikipedia.org/w/rest.php/v1/page/${encodeURIComponent('1988년_하계_올림픽')}/html`)
    expect(pageHtmlUrl('AC/DC')).toContain('AC%2FDC')
  })
  it('받은 문서를 정리해 돌려준다', async () => {
    const page = await fetchPage('불고기', { parse, fetch: respond(200, raw) })
    expect(page.id).toBe(7761)
  })
  it('없는 문서, 요청 제한, 그 밖의 오류를 구분한다', async () => {
    await expect(fetchPage('x', { parse, fetch: respond(404) })).rejects.toMatchObject({ kind: 'missing' })
    await expect(fetchPage('x', { parse, fetch: respond(429, '', { 'retry-after': '12' }) })).rejects.toMatchObject({ kind: 'rate_limited', retryAfter: 12 })
    await expect(fetchPage('x', { parse, fetch: respond(503) })).rejects.toMatchObject({ kind: 'http', status: 503 })
    await expect(fetchPage('x', { parse, fetch: respond(200, '<html></html>') })).rejects.toBeInstanceOf(WikiError)
  })
})

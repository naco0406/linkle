import { defaultPolicy, isMainNamespace, type Policy } from './policy.ts'

export const WIKI_ORIGIN = 'https://ko.wikipedia.org'

export type CleanPage = {
  /** 넘겨주기를 거친 최종 문서의 id. 도착 판정에 쓴다 */
  id: number
  title: string
  /** 정리한 본문. 링크에는 href가 없고 data-title만 있다 */
  html: string
  /** 첫 문단의 글자. 유사도 계산에 쓴다 */
  leadText: string
  /** 위키백과가 이 문서에 쓰는 스타일시트 주소 */
  styleHref: string | null
  /** 이 문서에서 누를 수 있는 링크의 제목(중복 없음) */
  links: string[]
}

/** Parsoid의 href("./제목#위치")에서 문서 제목을 꺼낸다 */
export function titleFromHref(href: string): { title: string; fragment: boolean } | null {
  if (!href.startsWith('./')) return null
  const raw = href.slice(2)
  const hash = raw.indexOf('#')
  const path = hash < 0 ? raw : raw.slice(0, hash)
  let title: string
  try {
    title = decodeURIComponent(path)
  } catch {
    title = path
  }
  title = title.replaceAll('_', ' ').trim()
  return title ? { title, fragment: hash >= 0 } : null
}

function unwrap(el: Element): void {
  el.replaceWith(...Array.from(el.childNodes))
}

function textOf(el: Element): string {
  const copy = el.cloneNode(true) as Element
  copy.querySelectorAll('style, script').forEach(n => n.remove())
  return (copy.textContent ?? '').replace(/\s+/g, ' ').trim()
}

/**
 * Parsoid HTML 문서를 게임용으로 정리한다. 넘겨받은 Document를 직접 고친다.
 * 브라우저에서는 DOMParser로, Node에서는 같은 DOM API를 주는 파서로 만든 Document를 넘긴다.
 */
export function cleanPage(doc: Document, policy: Policy = defaultPolicy): CleanPage {
  const meta = (prop: string) => doc.querySelector(`meta[property="${prop}"]`)?.getAttribute('content') ?? null
  const id = Number(meta('mw:pageId'))
  const title = (doc.querySelector('title')?.textContent ?? '').trim()
  if (!Number.isInteger(id) || id <= 0 || !title) throw new Error('wiki: page id or title missing')
  const sheet = doc.querySelector('head link[rel="stylesheet"]')?.getAttribute('href') ?? null
  const styleHref = sheet ? new URL(sheet, WIKI_ORIGIN).href : null

  const body = doc.body

  // 1. 섹션 단위로 지운다
  const drop = new Set(policy.dropSections)
  for (const section of Array.from(body.querySelectorAll('section'))) {
    const heading = section.querySelector('h1, h2, h3, h4, h5, h6')
    if (heading && heading.closest('section') === section && drop.has(textOf(heading))) section.remove()
  }

  // 2. 요소 단위로 지운다
  body.querySelectorAll(policy.dropSelectors.join(', ')).forEach(el => el.remove())

  // 3. 링크를 다시 쓴다. 통과한 링크는 href를 없애고 data-title만 남긴다
  const blocked = new Set(policy.link.blockedTitles)
  const links = new Set<string>()
  for (const a of Array.from(body.querySelectorAll('a'))) {
    const target = a.getAttribute('rel') === 'mw:WikiLink' ? titleFromHref(a.getAttribute('href') ?? '') : null
    const cls = a.classList
    const ok =
      target !== null &&
      target.title !== title &&
      isMainNamespace(target.title) &&
      !cls.contains('mw-selflink') &&
      (policy.link.allowMissing || !cls.contains('new')) &&
      (policy.link.allowDisambiguation || !cls.contains('mw-disambig')) &&
      !blocked.has(target.title)
    if (!ok) {
      unwrap(a)
      continue
    }
    for (const name of a.getAttributeNames()) if (name !== 'class') a.removeAttribute(name)
    a.setAttribute('data-title', target.title)
    a.setAttribute('role', 'link')
    a.setAttribute('tabindex', '0')
    links.add(target.title)
  }

  // 4. 필요 없는 속성과, 혹시 남아 있을 실행 가능한 속성을 지운다
  for (const el of Array.from(body.querySelectorAll('*'))) {
    for (const name of el.getAttributeNames()) {
      if (name === 'data-mw' || name === 'about' || name.startsWith('on')) el.removeAttribute(name)
    }
  }
  for (const img of Array.from(body.querySelectorAll('img'))) {
    const src = img.getAttribute('src')
    if (src?.startsWith('//')) img.setAttribute('src', `https:${src}`)
    img.removeAttribute('srcset')
    img.setAttribute('loading', 'lazy')
    img.setAttribute('draggable', 'false')
  }

  // 5. 첫 문단
  const lead = Array.from(body.querySelectorAll('section[data-mw-section-id="0"] p'))
  const leadText = (lead.length ? lead : Array.from(body.querySelectorAll('p')))
    .map(textOf)
    .filter(Boolean)
    .join(' ')
    .slice(0, 600)

  return { id, title, html: body.innerHTML, leadText, styleHref, links: [...links] }
}

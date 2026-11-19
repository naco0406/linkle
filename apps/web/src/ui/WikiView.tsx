import { useEffect, useRef } from 'react'
import type { CleanPage } from '@linkle/wiki'

// 위키백과 스타일과 앱 스타일이 서로 섞이지 않게 Shadow DOM 안에 그린다.
const OWN_STYLE = `
  :host { display: block; }
  .mw-parser-output {
    font-family: -apple-system, BlinkMacSystemFont, 'Pretendard Variable', Pretendard, system-ui, sans-serif;
    font-size: 16px; line-height: 1.65; color: #202122; overflow-wrap: anywhere;
  }
  h1.title { font-family: 'Linux Libertine', Georgia, 'Times New Roman', serif; font-size: 1.8em; font-weight: 400;
    margin: 0 0 .5em; padding-bottom: .15em; border-bottom: 1px solid #a2a9b1; line-height: 1.3; }
  a[data-title] { color: #3366cc; cursor: pointer; text-decoration: none; }
  a[data-title]:hover, a[data-title]:focus-visible { text-decoration: underline; }
  a[data-title]:focus-visible { outline: 2px solid #3366cc; outline-offset: 2px; border-radius: 2px; }
  img { max-width: 100%; height: auto; -webkit-user-drag: none; }
  table { max-width: 100%; }
  .infobox, table.wikitable { display: block; overflow-x: auto; }
  @media (max-width: 640px) {
    .infobox, .mw-parser-output figure[typeof~='mw:File/Thumb'], .mw-parser-output .tright, .mw-parser-output .tleft {
      float: none !important; margin: .5em auto !important; width: auto !important; max-width: 100% !important; }
  }
`

type Props = {
  page: CleanPage
  /** 링크를 눌렀을 때. 넘겨받는 값은 링크가 가리키는 제목이다 */
  onNavigate: (title: string) => void
}

export function WikiView({ page, onNavigate }: Props) {
  const host = useRef<HTMLDivElement>(null)
  const navigate = useRef(onNavigate)
  navigate.current = onNavigate

  useEffect(() => {
    const el = host.current
    if (!el) return
    const root = el.shadowRoot ?? el.attachShadow({ mode: 'open' })
    const sheet = page.styleHref ? `<link rel="stylesheet" href="${page.styleHref.replaceAll('"', '&quot;')}">` : ''
    root.innerHTML = `${sheet}<style>${OWN_STYLE}</style><div class="mw-body-content mw-parser-output" lang="ko" dir="ltr"><h1 class="title"></h1>${page.html}</div>`
    root.querySelector('h1.title')!.textContent = page.title
  }, [page])

  useEffect(() => {
    const root = host.current?.shadowRoot
    if (!root) return
    const titleOf = (e: Event) => (e.target as Element | null)?.closest?.('a[data-title]')?.getAttribute('data-title') ?? null
    const onClick = (e: Event) => {
      const title = titleOf(e)
      if (title) {
        e.preventDefault()
        navigate.current(title)
      }
    }
    const onKey = (e: Event) => {
      if ((e as KeyboardEvent).key === 'Enter') onClick(e)
    }
    root.addEventListener('click', onClick)
    root.addEventListener('keydown', onKey)
    return () => {
      root.removeEventListener('click', onClick)
      root.removeEventListener('keydown', onKey)
    }
  }, [])

  return <div ref={host} />
}

import type { ReactNode } from 'react'
import { ChevronLeft, ExternalLink } from 'lucide-react'
import { Link } from 'react-router'
import { Card } from '../ui/cards'
import { CC_BY_SA } from '../ui/license'

// 출처와 라이선스 (/about). 위키백과 글(CC BY-SA 4.0)의 출처와 게임에 맞게 바꾼 점만 적는다.

export function About() {
  return (
    <main className="mx-auto flex w-full max-w-[440px] flex-1 flex-col px-4 min-[360px]:px-5 pb-6 pt-[env(safe-area-inset-top)]">
      <header className="flex h-14 items-center">
        <Link to="/" className="press -ml-2 flex h-10 items-center gap-0.5 rounded-full pl-1 pr-3 text-[15px] font-medium text-ink">
          <ChevronLeft className="h-5 w-5" aria-hidden />홈
        </Link>
      </header>
      <h1 className="font-brand text-[44px] font-normal leading-[48px] text-primary">Linkle</h1>
      <p className="mt-1 text-[16px] leading-6 text-ink">매일 위키피디아 탐험하기</p>

      <Section title="위키백과 글">
        <Card>
          <p className="text-[15px] leading-[24px] text-ink">
            게임에 나오는 문서는 <b className="font-semibold">한국어 위키백과</b>에서 그때그때 가져와요. 글은 위키백과 기여자들이 썼고{' '}
            <Ext href={CC_BY_SA.url}>{CC_BY_SA.name}</Ext> 라이선스를 따라요.
          </p>
          <h3 className="mb-1 mt-4 text-[14px] font-semibold text-ink">게임에 맞게 바꾼 점</h3>
          <ul className="list-disc space-y-1 pl-5 text-[14px] leading-[21px] text-ink-2">
            <li>각주, 참고 문헌, 같이 보기, 외부 링크 문단을 뺐어요.</li>
            <li>탐색 상자, 안내 틀, 편집 링크, 소리와 영상을 뺐어요.</li>
            <li>없는 문서와 일반 문서가 아닌 곳(분류, 틀, 파일 등)으로 가는 링크는 글자만 남겼어요.</li>
          </ul>
        </Card>
      </Section>
    </main>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-7">
      <h2 className="mb-2 px-1 text-[17px] font-bold leading-[25px] text-ink">{title}</h2>
      {children}
    </section>
  )
}

function Ext({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 font-medium text-primary underline-offset-2 hover:underline">
      {children}
      <ExternalLink className="h-3 w-3" aria-hidden />
    </a>
  )
}

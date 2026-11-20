import type { ReactNode } from 'react'
import { ChevronLeft, ExternalLink } from 'lucide-react'
import { Link } from 'react-router'
import { Card } from '../ui/cards'
import { CC_BY_SA } from '../ui/license'

// 링클 정보와 라이선스 (/about).
// 위키백과 글(CC BY-SA 4.0)의 출처와 바꾼 점, 함께 쓰는 글꼴·아이콘·라이브러리의 라이선스, 만든 사람을 적는다.

const OFL = 'https://openfontlicense.org'

type Item = { name: string; by?: string; license: string; url: string }

const FONTS_AND_CODE: Item[] = [
  { name: 'Pretendard', by: '길형진', license: 'SIL OFL 1.1', url: 'https://github.com/orioncactus/pretendard' },
  { name: 'Rhodium Libre', by: 'James Puckett', license: 'SIL OFL 1.1', url: 'https://fonts.google.com/specimen/Rhodium+Libre' },
  { name: 'Lucide', by: 'Lucide Contributors', license: 'ISC', url: 'https://lucide.dev/license' },
  { name: 'React · React Router', by: 'Meta · Remix', license: 'MIT', url: 'https://react.dev' },
  { name: 'Zustand', by: 'Poimandres', license: 'MIT', url: 'https://github.com/pmndrs/zustand' },
  { name: 'Tailwind CSS', by: 'Tailwind Labs', license: 'MIT', url: 'https://tailwindcss.com' },
]

const CREDITS: [string, string][] = [
  ['기획 · 디자인', '임민서'],
  ['개발', '고영'],
  ['기술 고문', '서동휘'],
]

export function About() {
  return (
    <main className="mx-auto flex w-full max-w-[440px] flex-1 flex-col px-5 pb-6 pt-[env(safe-area-inset-top)]">
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
            <li>탐색 상자, 안내 틀, 편집 링크, 소리·영상을 뺐어요.</li>
            <li>없는 문서와 일반 문서가 아닌 곳(분류, 틀, 파일 등)으로 가는 링크는 글자만 남겼어요.</li>
          </ul>
          <p className="mt-3 text-[14px] leading-[21px] text-ink-2">
            원문과 기여자 목록은 도착 화면과 어제의 기록에서 문서 이름을 누르면 볼 수 있어요. 게임 중에는 원문으로 나가는 링크를 두지 않아요.
          </p>
        </Card>
      </Section>

      <Section title="색 이모지를 만드는 모델">
        <Card>
          <p className="text-[15px] leading-[24px] text-ink">
            지나온 문서가 목표와 얼마나 가까운지는 기기 안에서 작은 모델로 계산해요. 이 모델은 한국어 위키백과 덤프의 글로 만들었고, 원자료와 같은{' '}
            <Ext href={CC_BY_SA.url}>{CC_BY_SA.name}</Ext>로 나눠요. 계산에 쓰는 문서 첫 문단은 서버로 보내지 않아요.
          </p>
        </Card>
      </Section>

      <Section title="글꼴 · 아이콘 · 라이브러리">
        <Card className="py-2">
          <ul>
            {FONTS_AND_CODE.map(f => (
              <li key={f.name} className="flex min-h-[56px] items-center gap-3 border-t border-[#eef1f5] py-2 first:border-t-0">
                <span className="min-w-0 flex-1">
                  <a href={f.url} target="_blank" rel="noopener noreferrer" className="block truncate text-[15px] font-semibold leading-[22px] text-ink">
                    {f.name}
                  </a>
                  {f.by && <span className="block truncate text-[13px] leading-[18px] text-ink-2">{f.by}</span>}
                </span>
                <span className="flex-none rounded-full bg-secondary px-2.5 py-1 text-[12px] font-semibold text-primary">{f.license}</span>
              </li>
            ))}
          </ul>
        </Card>
        <p className="mt-2 px-1 text-[13px] leading-5 text-ink-2">
          SIL OFL 전문은 <Ext href={OFL}>openfontlicense.org</Ext>에 있어요. 서버는 Cloudflare Workers와 D1에서 돌아가요.
        </p>
      </Section>

      <Section title="만든 사람">
        <Card className="py-2">
          <dl>
            {CREDITS.map(([role, name]) => (
              <div key={role} className="flex h-12 items-center justify-between border-t border-[#eef1f5] first:border-t-0">
                <dt className="text-[15px] text-ink-2">{role}</dt>
                <dd className="text-[15px] font-semibold text-ink">{name}</dd>
              </div>
            ))}
          </dl>
        </Card>
        <p className="mt-2 px-1 text-[13px] leading-5 text-ink-2">
          2024년 9월 15일 처음 공개했고, 2026년 11월에 처음부터 다시 만들었어요. 코드는 <Ext href="https://github.com/naco0406/linkle">GitHub</Ext>에 있어요.
        </p>
      </Section>

      <p className="mt-8 px-1 text-center text-[12px] leading-[18px] text-ink-2">
        위키백과(Wikipedia)는 위키미디어 재단의 등록 상표예요.
        <br />
        링클은 위키미디어 재단과 관계없는 개인 프로젝트예요.
      </p>
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

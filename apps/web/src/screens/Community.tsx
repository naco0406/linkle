import { useState } from 'react'
import { getCommunity, type CommunitySort, type PuzzleCard } from '../game/api'
import { useGame } from '../game/store'
import { useLoad } from '../game/useLoad'
import { Card, TextButton } from '../ui/cards'
import { Badge, DifficultyChip, ListPage, ListRow, Segmented } from '../ui/list'
import { Notice, Skeleton } from './Yesterday'

const SORTS: [CommunitySort, string][] = [
  ['new', '최신'],
  ['popular', '인기'],
  ['hard', '어려운'],
]

/**
 * 커뮤니티. 링클이 낸 문제를 풀고 문제마다 순위를 겨룬다(설계 문서 12.2).
 * 출발·도착은 목록에 없다. 미리 보이면 길을 찾아 두고 시작할 수 있어 시간 순위가 의미를 잃는다.
 */
export function Community() {
  const [sort, setSort] = useState<CommunitySort>('new')
  const [pages, setPages] = useState<number[]>([0])
  return (
    <ListPage title="커뮤니티" desc="링클이 낸 문제를 풀고 순위를 겨뤄요. 처음 도전한 기록만 순위에 올라요.">
      <Segmented
        label="정렬"
        value={sort}
        options={SORTS}
        onChange={v => {
          setSort(v)
          setPages([0])
        }}
      />
      {pages.map((offset, i) => (
        <CommunityPage key={`${sort}:${offset}`} sort={sort} offset={offset} last={i === pages.length - 1} onMore={next => setPages(p => [...p, next])} />
      ))}
    </ListPage>
  )
}

function rate(c: PuzzleCard): string {
  return c.plays === 0 ? '아직 도전한 사람이 없어요' : `도전 ${c.plays.toLocaleString('ko-KR')}명 · 클리어 ${Math.round((c.clears / c.plays) * 100)}%`
}

function CommunityPage({ sort, offset, last, onMore }: { sort: CommunitySort; offset: number; last: boolean; onMore: (next: number) => void }) {
  const { data, error, reload } = useLoad(`community:${sort}:${offset}`, () => getCommunity(sort, offset))
  const others = useGame(s => s.others)
  if (!data)
    return error ? (
      <Notice title="목록을 불러오지 못했어요" body="잠시 뒤에 다시 시도해 주세요.">
        <TextButton onClick={reload} className="-ml-4 mt-2">
          다시 불러오기
        </TextButton>
      </Notice>
    ) : (
      <Skeleton />
    )
  if (offset === 0 && data.items.length === 0) return <Notice title="아직 문제가 없어요" body="링클이 낸 문제가 곧 올라와요." />
  return (
    <>
      <Card className={`!py-1 ${offset > 0 ? 'mt-3' : ''}`}>
        <ul>
          {data.items.map(c => {
            const mine = others[String(c.id)]
            const rank = mine?.phase === 'finished' ? mine.result?.rank : undefined
            return (
              <ListRow
                key={c.id}
                to={`/community/${c.id}`}
                lead={<Badge top={`#${c.number}`} />}
                title={
                  <span className="flex items-center gap-1.5">
                    <span className="truncate">{c.kind === 'official' ? '링클이 낸 문제' : `${c.author}님의 문제`}</span>
                    <DifficultyChip value={c.difficulty} />
                  </span>
                }
                sub={rate(c)}
                trail={rank ? `${rank}위` : mine?.phase === 'finished' ? '완료' : mine?.phase === 'playing' ? '푸는 중' : undefined}
              />
            )
          })}
        </ul>
      </Card>
      {last && data.next !== null && (
        <TextButton onClick={() => onMore(data.next!)} className="mx-auto mt-2">
          더 보기
        </TextButton>
      )}
    </>
  )
}

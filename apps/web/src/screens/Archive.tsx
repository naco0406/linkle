import { Fragment, useState } from 'react'
import { Check } from 'lucide-react'
import { formatClock, type Run } from '@linkle/core'
import { getArchive, type ArchiveItem } from '../game/api'
import { useStats } from '../game/stats'
import { useGame } from '../game/store'
import { useLoad } from '../game/useLoad'
import { Card, TextButton } from '../ui/cards'
import { Badge, ListPage, ListRow } from '../ui/list'
import { Notice, Skeleton } from './Yesterday'

/** 그날 내가 푼 결과. 그날 오늘의 문제로 풀었거나, 지난 문제로 다시 푼 것 */
export function useMyDayResult(): (item: { id: number; date: string | null }) => { moves: number; ms: number } | null {
  const recent = useStats(s => s.stats.recent)
  const others = useGame(s => s.others)
  return item => {
    const day = item.date ? recent[item.date] : undefined
    if (day) return day
    const run: Run | undefined = others[String(item.id)]
    return run?.phase === 'finished' && run.finishedAt ? { moves: run.events.length, ms: run.finishedAt - run.startedAt } : null
  }
}

/**
 * 지난 문제. 지나간 오늘의 문제를 다시 푼다.
 * 출발·도착은 목록에 없다. 푼 문제에는 내 결과를 붙인다. 연속 기록과 순위에는 들어가지 않는다(설계 문서 12.1).
 */
export function Archive() {
  const [pages, setPages] = useState<(number | null)[]>([null])
  return (
    <ListPage title="지난 문제" desc="지나간 오늘의 문제를 다시 풀어요. 연속 기록과 순위에는 들어가지 않아요.">
      {pages.map((before, i) => (
        <ArchivePage key={before ?? 'first'} before={before} last={i === pages.length - 1} onMore={next => setPages(p => [...p, next])} />
      ))}
    </ListPage>
  )
}

function ArchivePage({ before, last, onMore }: { before: number | null; last: boolean; onMore: (next: number) => void }) {
  const { data, error, reload } = useLoad(`archive:${before}`, () => getArchive(before))
  const mine = useMyDayResult()
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
  if (before === null && data.items.length === 0)
    return <Notice title="아직 지난 문제가 없어요" body="오늘의 문제가 내일부터 여기에 쌓여요." />

  // 달마다 묶는다
  const months: [string, ArchiveItem[]][] = []
  for (const item of data.items) {
    const m = `${Number(item.date.slice(0, 4))}년 ${Number(item.date.slice(5, 7))}월`
    if (months.at(-1)?.[0] !== m) months.push([m, []])
    months.at(-1)![1].push(item)
  }
  return (
    <>
      {months.map(([month, items]) => (
        <Fragment key={month}>
          <h2 className="mb-2 mt-3 px-1 text-[14px] font-semibold text-ink-2 first:mt-0">{month}</h2>
          <Card className="!py-1">
            <ul>
              {items.map(item => {
                const r = mine(item)
                const d = new Date(`${item.date}T00:00:00Z`)
                return (
                  <ListRow
                    key={item.id}
                    to={`/archive/${item.id}`}
                    lead={<Badge top={d.getUTCDate()} bottom={'일월화수목금토'[d.getUTCDay()]} />}
                    title={`#${item.number} · ${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일`}
                    sub={r ? `${r.moves}번 · ${formatClock(r.ms)}에 도착했어요` : item.finished > 0 ? `${item.finished.toLocaleString('ko-KR')}명이 도착했어요` : '아직 아무도 도착하지 못했어요'}
                    trail={r && <Check className="h-[18px] w-[18px]" strokeWidth={2.5} aria-label="푼 문제" />}
                  />
                )
              })}
            </ul>
          </Card>
        </Fragment>
      ))}
      {last && data.next !== null && (
        <TextButton onClick={() => onMore(data.next!)} className="mx-auto mt-2">
          더 보기
        </TextButton>
      )}
    </>
  )
}

import { formatClock } from '@linkle/core'
import { getBoard, type BoardRow } from '../game/api'
import { useLoad } from '../game/useLoad'
import { Card, TextButton } from './cards'
import { CardTitle } from '../screens/Yesterday'

const MEDAL = ['bg-[#f5c542] text-white', 'bg-[#b8c3cf] text-white', 'bg-[#d89a62] text-white']

function Row({ r }: { r: BoardRow }) {
  return (
    <li className={`-mx-2 flex h-12 items-center gap-3 rounded-xl px-2 ${r.me ? 'bg-secondary' : ''}`}>
      <span className={`grid h-7 w-7 flex-none place-items-center rounded-full text-[13px] font-bold tabular-nums ${MEDAL[r.rank - 1] ?? 'text-ink-2'}`}>{r.rank}</span>
      <span className="min-w-0 flex-1">
        <span className={`block truncate text-[15px] leading-5 ${r.me ? 'font-semibold text-primary' : 'font-medium text-ink'}`}>
          {r.name}
          {r.me && <span className="ml-1 text-[13px] font-medium text-ink-2">(나)</span>}
        </span>
        {!r.verified && <span className="block text-[12px] leading-4 text-ink-2">기록 확인 중</span>}
      </span>
      <span className="flex-none text-right text-[14px] tabular-nums text-ink">
        <b className="font-semibold text-primary">{r.moves}번</b> · {formatClock(r.ms)}
      </span>
    </li>
  )
}

/**
 * 문제별 순위표. 이동이 적은 순, 같으면 서버가 잰 시간이 짧은 순.
 * 처음 도전한 기록만 오른다. 위키백과에서 경로를 확인하기 전에는 "기록 확인 중"으로 보인다.
 */
export function BoardCard({ puzzleId, refresh = '' }: { puzzleId: number; refresh?: string }) {
  const { data, error, reload } = useLoad(`board:${puzzleId}:${refresh}`, () => getBoard(puzzleId))
  return (
    <Card aria-label="순위표">
      <CardTitle side={data ? `${data.total.toLocaleString('ko-KR')}명` : undefined}>순위표</CardTitle>
      {!data ? (
        error ? (
          <TextButton onClick={reload} className="-ml-4">
            다시 불러오기
          </TextButton>
        ) : (
          <div className="h-24 animate-pulse rounded-xl bg-secondary" />
        )
      ) : data.total === 0 ? (
        <p className="text-[15px] leading-[22px] text-ink-2">아직 도착한 사람이 없어요. 첫 기록을 남겨 보세요.</p>
      ) : (
        <ol className="grid gap-0.5">
          {data.top.map(r => (
            <Row key={`${r.rank}-${r.name}`} r={r} />
          ))}
          {data.me && !data.top.some(r => r.me) && (
            <>
              <li className="py-1 text-center text-[13px] leading-4 text-ink-2" aria-hidden>
                ···
              </li>
              <Row r={data.me} />
            </>
          )}
        </ol>
      )}
    </Card>
  )
}

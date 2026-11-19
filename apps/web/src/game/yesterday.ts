import { useEffect, useState } from 'react'
import { kstDate, type Yesterday } from '@linkle/core'
import { getYesterday } from './api'
import { now, useGame } from './store'

// 어제의 기록은 하루 동안 거의 바뀌지 않는다. 한 번 받으면 날짜가 바뀔 때까지 다시 받지 않는다.
// 기록을 확인하는 중이었다면 몇 분 뒤에 다시 받을 수 있게 한다.
let cache: { key: string; at: number; promise: Promise<Yesterday> } | null = null
const RECHECK_MS = 5 * 60 * 1000

function load(key: string): Promise<Yesterday> {
  const stale = cache && cache.key === key && Date.now() - cache.at > RECHECK_MS
  if (!cache || cache.key !== key || stale) {
    const entry = {
      key,
      at: Date.now(),
      promise: getYesterday().then(y => {
        // 다 정해진 기록은 오래 들고 있는다
        if (y.status === 'ready' && !y.verifying) entry.at = Infinity
        return y
      }),
    }
    entry.promise.catch(() => {
      if (cache === entry) cache = null
    })
    cache = entry
  }
  return cache.promise
}

export function useYesterday(): { data: Yesterday | null; error: boolean; retry: () => void } {
  const key = useGame(s => s.today?.date) ?? kstDate(now())
  const [state, setState] = useState<{ data: Yesterday | null; error: boolean }>({ data: null, error: false })
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let alive = true
    load(key)
      .then(data => alive && setState({ data, error: false }))
      .catch(() => alive && setState(s => ({ data: s.data, error: true })))
    return () => {
      alive = false
    }
  }, [key, attempt])
  return { ...state, retry: () => setAttempt(n => n + 1) }
}

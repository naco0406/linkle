import { useCallback, useEffect, useState } from 'react'

/**
 * 화면에서 한 번 받아 오는 값. key가 바뀌면 다시 받는다.
 * 받는 중에는 이전 값을 그대로 두어 화면이 깜빡이지 않게 한다.
 */
export function useLoad<T>(key: string, load: () => Promise<T>): { data: T | null; error: boolean; loading: boolean; reload: () => void } {
  const [state, setState] = useState<{ key: string; data: T | null; error: boolean; loading: boolean }>({ key, data: null, error: false, loading: true })
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let alive = true
    setState(s => ({ key, data: s.key === key ? s.data : null, error: false, loading: true }))
    load()
      .then(data => alive && setState({ key, data, error: false, loading: false }))
      .catch(() => alive && setState(s => ({ ...s, error: true, loading: false })))
    return () => {
      alive = false
    }
    // load는 매번 새 함수라 key로만 다시 받는다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, attempt])
  const reload = useCallback(() => setAttempt(n => n + 1), [])
  return { data: state.data, error: state.error, loading: state.loading, reload }
}

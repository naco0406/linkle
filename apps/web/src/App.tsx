import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { useGame } from './game/store'
import { Game } from './screens/Game'
import { Home } from './screens/Home'

/** 오늘의 게임. 어느 화면을 보일지는 주소가 아니라 Run의 상태가 정한다 */
function Daily() {
  const run = useGame(s => s.run)
  return run?.phase === 'playing' ? <Game run={run} /> : <Home run={run} />
}

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Daily />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

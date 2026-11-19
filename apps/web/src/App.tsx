import { CalendarDays, Users } from 'lucide-react'
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router'
import { useGame } from './game/store'
import { Arrival } from './screens/Arrival'
import { Game } from './screens/Game'
import { Home } from './screens/Home'
import { Soon } from './screens/Soon'
import { Yesterday } from './screens/Yesterday'
import { TabBar } from './ui/TabBar'

/** 오늘의 게임. 어느 화면을 보일지는 주소가 아니라 Run의 상태가 정한다 */
function Daily() {
  const run = useGame(s => s.run)
  const arrivalSeen = useGame(s => s.arrivalSeen)
  if (run?.phase === 'playing') return <Game run={run} />
  // 도착한 직후에는 도착 화면이 먼저 나온다. 닫으면 홈이다
  if (run?.phase === 'finished' && arrivalSeen !== run.runId) return <Arrival run={run} />
  return <Home run={run} />
}

/**
 * 탭이 있는 화면들의 바깥 틀. 게임 중에는 탭을 치운다:
 * 게임 화면은 Header와 Footer가 자리를 다 쓰고, 문서에 집중해야 한다.
 */
function Shell() {
  // 게임 중과 도착 화면에서는 탭을 치운다
  const immersive = useGame(s => s.run?.phase === 'playing' || (s.run?.phase === 'finished' && s.arrivalSeen !== s.run.runId))
  const { pathname } = useLocation()
  const tabs = !(immersive && pathname === '/')
  return (
    <div className="shell" data-tabs={tabs ? 'on' : 'off'}>
      <Outlet />
      {tabs && <TabBar />}
    </div>
  )
}

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Shell />}>
          <Route path="/" element={<Daily />} />
          <Route path="/yesterday" element={<Yesterday />} />
          <Route path="/archive" element={<Soon icon={CalendarDays} title="지난 문제" body="지나간 오늘의 문제를 다시 풀 수 있게 준비하고 있어요." />} />
          <Route path="/community" element={<Soon icon={Users} title="커뮤니티" body="서로 낸 문제를 풀고 기록을 겨루는 곳을 준비하고 있어요." />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

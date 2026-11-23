import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router'
import { dailyRun, useGame, useImmersive } from './game/store'
import { Arrival } from './screens/Arrival'
import { Game } from './screens/Game'
import { Me } from './screens/Me'
import { Home } from './screens/Home'
import { About } from './screens/About'
import { Archive } from './screens/Archive'
import { Community } from './screens/Community'
import { PuzzlePage } from './screens/Puzzle'
import { Yesterday } from './screens/Yesterday'
import { ChallengePage } from './screens/Challenge'

import { TabBar } from './ui/TabBar'

// 관리자 화면은 따로 받는다. 일반 방문자의 첫 화면을 무겁게 하지 않는다
const Admin = lazy(() => import('./screens/Admin').then(m => ({ default: m.Admin })))
// 같이 달리기 방과 출제 화면도 따로 받는다(QR 읽기, 룰렛 등). 커뮤니티에서 들어갈 때만 받는다
const RoomPage = lazy(() => import('./screens/Room').then(m => ({ default: m.RoomPage })))
const MakePage = lazy(() => import('./screens/Make').then(m => ({ default: m.MakePage })))
const MinePage = lazy(() => import('./screens/Make').then(m => ({ default: m.MinePage })))
const MinePuzzlePage = lazy(() => import('./screens/Make').then(m => ({ default: m.MinePuzzlePage })))
const later = (el: React.ReactNode) => <Suspense fallback={null}>{el}</Suspense>

/** 오늘의 게임. 어느 화면을 보일지는 주소가 아니라 Run의 상태가 정한다 */
function Daily() {
  const run = useGame(dailyRun)
  const seen = useGame(s => s.seen)
  if (run?.phase === 'playing') return <Game run={run} />
  // 도착한 직후에는 도착 화면이 먼저 나온다. 닫으면 홈이다
  if (run?.phase === 'finished' && !seen.includes(run.runId)) return <Arrival run={run} />
  return <Home run={run} />
}

/**
 * 탭이 있는 화면들의 바깥 틀. 게임 중에는 탭을 치운다:
 * 게임 화면은 Header와 Footer가 자리를 다 쓰고, 문서에 집중해야 한다.
 */
function Shell() {
  // 게임 중과 도착 화면에서는 탭을 치운다
  const daily = useGame(s => {
    const run = dailyRun(s)
    return run?.phase === 'playing' || (run?.phase === 'finished' && !s.seen.includes(run.runId))
  })
  // 지난 문제·커뮤니티 화면은 게임 중이거나 막 도착했을 때 스스로 알린다
  const other = useImmersive(s => s.on)
  const { pathname } = useLocation()
  const tabs = !(daily && pathname === '/') && !other
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
          <Route path="/archive" element={<Archive />} />
          <Route path="/archive/:id" element={<PuzzlePage key="archive" kind="archive" />} />
          <Route path="/community" element={<Community />} />
          <Route path="/community/new" element={later(<MakePage />)} />
          <Route path="/community/mine" element={later(<MinePage />)} />
          <Route path="/community/mine/:id" element={later(<MinePuzzlePage />)} />
          <Route path="/community/:id" element={<PuzzlePage key="community" kind="community" />} />
          <Route path="/c/:code" element={<ChallengePage />} />
          <Route path="/room/:code" element={later(<RoomPage />)} />
          <Route path="/me" element={<Me />} />
          <Route path="/about" element={<About />} />
        </Route>
        <Route
          path="/admin"
          element={
            <Suspense fallback={null}>
              <Admin />
            </Suspense>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

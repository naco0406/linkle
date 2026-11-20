import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { startPwa } from './game/pwa'
import { startSync } from './game/sync'
import './index.css'

// 서버와 맞추는 일(완료 제출, 날짜 확인)은 화면과 따로 돈다
startSync()
// 홈 화면에 추가할 수 있게 서비스 워커를 올리고 설치 창을 받아 둔다
startPwa()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { startSync } from './game/sync'
import './index.css'

// 서버와 맞추는 일(완료 제출, 날짜 확인)은 화면과 따로 돈다
startSync()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

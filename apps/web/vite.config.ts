import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// ws: 같이 달리기 방(/api/rooms/:code/ws)은 WebSocket이다
const api = { target: process.env.API_TARGET ?? 'http://127.0.0.1:8801', ws: true }

/**
 * 방문 통계(GA4). Google 태그 관리자 컨테이너 안에 GA4 태그(G-EBJNTJQE1X)가 들어 있고,
 * 화면 이동(주소 변경)도 그 태그가 페이지 조회로 센다.
 * 운영 빌드에만 넣는다. 개발 서버의 방문이 섞이지 않게. 관리자 화면(/admin)은 세지 않는다.
 */
const GTM_ID = 'GTM-WGWM22L3'
function analytics(): Plugin {
  return {
    name: 'linkle-analytics',
    apply: 'build',
    transformIndexHtml: () => [
      {
        tag: 'script',
        injectTo: 'head-prepend',
        children: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());if(!location.pathname.startsWith('/admin')){var s=document.createElement('script');s.async=true;s.src='https://www.googletagmanager.com/gtm.js?id=${GTM_ID}';document.head.appendChild(s)}`,
      },
    ],
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), analytics()],
  build: { target: 'es2022' },
  server: { proxy: { '/api': api } },
  preview: { proxy: { '/api': api } },
})

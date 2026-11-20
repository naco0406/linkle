import { create } from 'zustand'

// 홈 화면에 추가(PWA). 서비스 워커를 올리고, 설치를 권할 수 있는지 알려 준다.
//   prompt     안드로이드 크롬 등: 브라우저가 설치 창을 띄울 수 있다
//   ios        아이폰 사파리: 직접 띄울 수 없어 공유 메뉴에서 추가하는 방법을 알려 준다
//   installed  이미 홈 화면에서 열었다
//   none       설치할 수 없거나 브라우저가 아직 허락하지 않았다

type InstallPrompt = Event & { prompt(): Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }
export type InstallMode = 'prompt' | 'ios' | 'installed' | 'none'

type PwaState = { deferred: InstallPrompt | null; installed: boolean }

const usePwa = create<PwaState>(() => ({ deferred: null, installed: standalone() }))

function standalone(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
}

function iosSafari(): boolean {
  const ua = navigator.userAgent
  const ios = /iPhone|iPad|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1)
  // 아이폰의 크롬·카카오톡 같은 앱 안 브라우저는 홈 화면 추가 메뉴가 다르거나 없다
  return ios && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|KAKAOTALK|NAVER|Instagram|FBAN|Line/.test(ua)
}

export function startPwa() {
  if (typeof window === 'undefined') return
  window.addEventListener('beforeinstallprompt', e => {
    // 브라우저가 알아서 띄우는 배너 대신, 내 기록 화면의 버튼으로만 권한다
    e.preventDefault()
    usePwa.setState({ deferred: e as InstallPrompt })
  })
  window.addEventListener('appinstalled', () => usePwa.setState({ deferred: null, installed: true }))
  // 홈 화면에서 연 앱은 기록이 지워지지 않게 오래 둘 저장소를 청한다. 브라우저 탭에서는 묻지 않는다(파이어폭스는 허락 창을 띄운다)
  if (standalone()) void navigator.storage?.persist?.().catch(() => {})
  // 개발 서버에서는 올리지 않는다. 고친 코드가 캐시에 가려지지 않게
  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => void navigator.serviceWorker.register('/sw.js').catch(() => {}))
  }
}

export function useInstall(): { mode: InstallMode; install(): Promise<void> } {
  const { deferred, installed } = usePwa()
  const mode: InstallMode = installed ? 'installed' : deferred ? 'prompt' : iosSafari() ? 'ios' : 'none'
  return {
    mode,
    install: async () => {
      if (!deferred) return
      await deferred.prompt()
      const { outcome } = await deferred.userChoice
      // 한 번 쓴 설치 창은 다시 띄울 수 없다
      usePwa.setState({ deferred: null, installed: outcome === 'accepted' })
    },
  }
}

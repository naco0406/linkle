// 앱 안 브라우저(카카오톡 등)에서 열면 저장소가 따로라 기기 id와 이름이 새로 생긴다(설계 문서 16.3.1).
// 바깥 브라우저로 여는 길은 usagi-volleyball의 inApp.ts에서 옮겼다. 링크는 앱마다 다르고 문서로 정해진 것이 아니라, 안 되면 앱의 메뉴를 안내한다.

export type Platform = 'ios' | 'android' | 'desktop'
export type InApp = { name: string; browser: string; open: ((url: string) => void) | null; steps: [string, string] }

export function platformOf(ua = navigator.userAgent, touch = navigator.maxTouchPoints): Platform {
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && touch > 1)) return 'ios'
  return /Android/i.test(ua) ? 'android' : 'desktop'
}

export function detectInApp(ua = navigator.userAgent, platform = platformOf(ua)): InApp | null {
  if (platform === 'desktop') return null
  const name = /KAKAOTALK/i.test(ua)
    ? '카카오톡'
    : /\bLine\//i.test(ua)
      ? 'LINE'
      : /Instagram/i.test(ua)
        ? '인스타그램'
        : /FBAN|FBAV|FB_IAB/i.test(ua)
          ? '페이스북'
          : /NAVER\(inapp/i.test(ua)
            ? '네이버'
            : /everytimeApp/i.test(ua)
              ? '에브리타임'
              : /; wv\)/.test(ua)
                ? '앱'
                : platform === 'ios' && !/Safari\//.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua)
                  ? '앱'
                  : null
  if (!name) return null
  const browser = platform === 'android' ? 'Chrome' : 'Safari'
  const meta = name === '인스타그램' || name === '페이스북'
  const steps: [string, string] =
    platform === 'android'
      ? ['오른쪽 위 ⋮ 단추를 눌러요', '‘다른 브라우저로 열기’를 골라요']
      : meta
        ? ['오른쪽 위 ⋯ 단추를 눌러요', '‘외부 브라우저에서 열기’를 골라요']
        : name === '카카오톡'
          ? ['아래쪽 공유 단추를 눌러요', '‘Safari로 열기’를 골라요']
          : ['⋯ 단추나 공유 단추를 눌러요', '‘Safari로 열기’를 골라요']
  if (meta && platform === 'ios') return { name, browser, open: null, steps }
  return { name, browser, steps, open: url => (location.href = externalUrl(name, platform, url)) }
}

export function externalUrl(name: string, platform: Platform, url: string): string {
  const u = new URL(url)
  if (name === '카카오톡') return `kakaotalk://web/openExternal?url=${encodeURIComponent(url)}`
  if (name === 'LINE') {
    u.searchParams.set('openExternalBrowser', '1')
    return u.toString()
  }
  if (platform === 'android') return `intent://${u.host}${u.pathname}${u.search}#Intent;scheme=https;package=com.android.chrome;end`
  return `x-safari-${url}`
}

const STAY = 'linkle:inapp-stay'
export const stayedHere = () => {
  try {
    return sessionStorage.getItem(STAY) !== null
  } catch {
    return false
  }
}
export const stayHere = () => {
  try {
    sessionStorage.setItem(STAY, '1')
  } catch {
    // 저장소가 막혔으면 이번 화면에서만
  }
}

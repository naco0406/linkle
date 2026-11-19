import { shareText, type Run } from '@linkle/core'

/** 클립보드 API가 막힌 환경(일부 인앱 브라우저)에서는 예전 방식으로 한 번 더 시도한다 */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const area = document.createElement('textarea')
    area.value = text
    area.setAttribute('readonly', '')
    area.style.cssText = 'position:fixed;top:0;left:0;opacity:0'
    document.body.appendChild(area)
    area.select()
    try {
      return document.execCommand('copy')
    } catch {
      return false
    } finally {
      area.remove()
    }
  }
}

/** 결과 문구를 복사하고, 사용자에게 보여 줄 한 줄을 돌려준다 */
export async function shareRun(run: Run): Promise<string> {
  const ok = await copyText(shareText(run, { origin: window.location.origin }))
  return ok ? '결과를 복사했어요. 붙여 넣어 공유해 보세요.' : '복사하지 못했어요. 브라우저의 복사 권한을 확인해 주세요.'
}

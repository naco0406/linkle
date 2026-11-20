import { shareOf, type Run } from '@linkle/core'

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

/**
 * 서식판(제목에 링크)과 글자판(마지막 줄에 주소)을 함께 복사한다.
 * 붙여 넣는 앱이 서식을 받으면 제목이 하이퍼링크가 되고, 아니면 글자판이 들어간다.
 * 서식 복사를 못 하는 브라우저에서는 글자판만 복사한다.
 */
async function copyRich(text: string, html: string): Promise<boolean> {
  try {
    if (typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) throw new Error('no rich clipboard')
    await navigator.clipboard.write([
      new ClipboardItem({
        'text/plain': new Blob([text], { type: 'text/plain' }),
        'text/html': new Blob([html], { type: 'text/html' }),
      }),
    ])
    return true
  } catch {
    // 권한이 막힌 곳(인앱 브라우저 등): 예전 복사 명령에 두 판을 함께 싣는다
    if (copyByEvent(text, html)) return true
    return copyText(text)
  }
}

function copyByEvent(text: string, html: string): boolean {
  let done = false
  const onCopy = (e: ClipboardEvent) => {
    if (!e.clipboardData) return
    e.clipboardData.setData('text/plain', text)
    e.clipboardData.setData('text/html', html)
    e.preventDefault()
    done = true
  }
  document.addEventListener('copy', onCopy)
  try {
    return document.execCommand('copy') && done
  } catch {
    return false
  } finally {
    document.removeEventListener('copy', onCopy)
  }
}

/** 결과 문구를 복사하고, 사용자에게 보여 줄 한 줄을 돌려준다 */
export async function shareRun(run: Run): Promise<string> {
  const { text, html } = shareOf(run, { origin: window.location.origin })
  const ok = await copyRich(text, html)
  return ok ? '결과를 복사했어요. 붙여 넣어 공유해 보세요.' : '복사하지 못했어요. 브라우저의 복사 권한을 확인해 주세요.'
}

// 받은 도전장(설계 문서 16.2). 링크를 단톡방에서 놓쳐도 커뮤니티에서 다시 찾을 수 있게 이 기기에 남긴다.
// 서버에는 "누가 무엇을 받았는지"가 없다. 열어 본 도전장만 여기에 쌓인다.

export const INBOX_KEY = 'linkle:inbox:v1'
const KEEP = 20

export type InboxItem = { code: string; puzzleId: number; name: string; kind: string; number: number; ms: number; moves: number; at: number }

export function readInbox(): InboxItem[] {
  try {
    const raw = JSON.parse(localStorage.getItem(INBOX_KEY) ?? '[]') as unknown
    return Array.isArray(raw) ? (raw.filter(x => x && typeof x === 'object' && typeof (x as InboxItem).code === 'string') as InboxItem[]) : []
  } catch {
    return []
  }
}

export function remember(item: InboxItem): void {
  try {
    const list = [item, ...readInbox().filter(x => x.code !== item.code)].slice(0, KEEP)
    localStorage.setItem(INBOX_KEY, JSON.stringify(list))
  } catch {
    // 저장하지 못해도 도전장은 그대로 풀 수 있다
  }
}

import { nicknameOf } from '@linkle/core'
/** 익명 기기 id를 저장하는 키. 로그인이 없으므로 이 값이 "같은 사람"의 기준이다 */
export const PLAYER_KEY = 'linkle:player:v1'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

let cached: string | null = null

/** 이 기기의 id. 처음 부를 때 만들어 저장한다 */
export function playerId(): string {
  if (cached) return cached
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(PLAYER_KEY) ?? 'null')
    const id = saved && typeof saved === 'object' ? (saved as { id?: unknown }).id : null
    if (typeof id === 'string' && UUID.test(id)) return (cached = id)
  } catch {
    // 저장소를 읽지 못하거나 값이 깨졌으면 새로 만든다
  }
  cached = newUuid()
  try {
    // 닉네임(무한 모드)이 같은 키에 들어올 수 있게 객체로 저장한다
    localStorage.setItem(PLAYER_KEY, JSON.stringify({ id: cached }))
  } catch {
    // 저장소를 쓸 수 없는 환경(일부 사생활 보호 모드)에서는 탭을 닫을 때까지만 같은 id를 쓴다
  }
  return cached
}

/** 이름 다시 뽑기의 숫자(설계 문서 16.3.1). 같은 키에 함께 둔다 */
export function playerSalt(): number {
  try {
    const saved = JSON.parse(localStorage.getItem(PLAYER_KEY) ?? 'null') as { salt?: unknown } | null
    return typeof saved?.salt === 'number' && Number.isInteger(saved.salt) && saved.salt >= 0 ? saved.salt : 0
  } catch {
    return 0
  }
}

/** 이 기기의 이름. 기기 id와 salt로 정해진다 */
export function myName(): string {
  return nicknameOf(playerId(), playerSalt())
}

/** 이름을 다시 뽑는다. 새 salt를 저장하고 새 이름을 돌려준다(서버에는 따로 알린다) */
export function rerollSalt(): number {
  const salt = (playerSalt() % 999_999) + 1 + Math.floor(Math.random() * 1000)
  try {
    localStorage.setItem(PLAYER_KEY, JSON.stringify({ id: playerId(), salt }))
  } catch {
    // 저장하지 못해도 이번 화면에서는 새 이름을 쓴다
  }
  return salt
}

function newUuid(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  // randomUUID는 https와 localhost에서만 있다. 같은 공유기의 휴대폰에서 http로 열어 볼 때를 위한 대비다
  const b = crypto.getRandomValues(new Uint8Array(16))
  b[6] = (b[6]! & 0x0f) | 0x40
  b[8] = (b[8]! & 0x3f) | 0x80
  const h = Array.from(b, x => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

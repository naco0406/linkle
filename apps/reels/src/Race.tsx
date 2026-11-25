// 두 번째 릴스(같이 달리기): 방 만들기 → QR·링크 → 단톡방에 초대 → 로비가 찬다 → 룰렛 → 달리기 → 먼저 도착 → 한 판 더 → 끝 화면.
// 첫 번째 릴스와 같은 부품(폰 테두리, 앱 전환, 자막 블록, 끝 화면)과 같은 속도(1.2배)를 쓴다.
// 실제 화면은 record/race.ts가 네 명이 한 방에서 달린 판에서 찍은 정지 화면이고, 룰렛만 녹화 영상이다.
import { AbsoluteFill, Easing, Img, interpolate, OffthreadVideo, Sequence, spring, staticFile, useCurrentFrame } from 'remotion'
import race from '../public/rec/race.json'
import { EndTitle, StoryCaption } from './Captions'
import { Chat, type Msg } from './Chat'
import { Phone } from './Phone'
import { CHAT_TOP, DOMAIN, FPS, H, PHONE, PHONE_H, S } from './plan'
import { RACE, RACE_CAPTIONS, RACE_SPEED } from './racePlan'
import { EndCard, Fonts, Tap } from './Reel'
import { Switcher } from './Switcher'
import { C, FONT } from './theme'

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const
const ease = Easing.bezier(0.33, 0, 0.2, 1)
const ramp = (sec: number, a: number, b: number) => interpolate(sec, [a, b], [0, 1], { ...clamp, easing: ease })

const CENTER_TOP = (H - PHONE_H) / 2
const endTitle = RACE_CAPTIONS.find(c => c.endCard)?.text
type Shot = { name: string; taps: Array<{ x: number; y: number; label: string }> }
const SHOTS = race.shots as Shot[]
const tapOf = (name: string) => SHOTS.find(s => s.name === name)?.taps[0] ?? { x: 195, y: 400, label: '' }

/** 링클 화면의 장면 순서: [시작 시각, 정지 화면 이름]. 바뀔 때는 0.16초 겹쳐 바뀐다 */
const SCENES: Array<[number, string]> = [
  [RACE.community, 'community'],
  [RACE.lobbySolo, 'lobby-solo'],
  [RACE.lobbies[0]!, 'lobby-2'],
  [RACE.lobbies[1]!, 'lobby-3'],
  [RACE.lobbies[2]!, 'lobby-4'],
  [RACE.lobbies[3]!, 'lobby-ready'],
  [RACE.race[0]!, 'race-1'],
  [RACE.race[1]!, 'race-2'],
  [RACE.race[2]!, 'race-3'],
  [RACE.results, 'results'],
]
const TAPS: Array<{ at: number; until: number; name: string }> = [
  { at: RACE.makeTap, until: RACE.lobbySolo, name: 'community' },
  { at: RACE.linkTap, until: RACE.switch, name: 'lobby-solo' },
  { at: RACE.goTap, until: RACE.reveal, name: 'lobby-ready' },
  { at: RACE.raceTaps[0]!, until: RACE.race[1]!, name: 'race-1' },
  { at: RACE.raceTaps[1]!, until: RACE.race[2]!, name: 'race-2' },
  { at: RACE.raceTaps[2]!, until: RACE.results, name: 'race-3' },
]
const REVEAL_LEN = (RACE.revealTo - RACE.revealFrom) / RACE.revealRate

export function Race({ captions = true }: { captions?: boolean }) {
  const frame = useCurrentFrame() * RACE_SPEED
  const sec = frame / FPS
  const pop = (at: number) => spring({ frame: frame - Math.round(at * FPS), fps: FPS, config: { damping: 16, stiffness: 170, mass: 0.7 } })

  const chat: Msg[] = [
    { kind: 'text', who: '민서', text: '오늘 링클 벌써 끝남', p: 1 },
    { kind: 'text', who: '진우', text: '나도 심심한데', p: 1 },
    { kind: 'text', who: '동휘', text: '누가 제일 빠른지 붙자', p: 1 },
    { kind: 'text', who: '나', mine: true, text: `링클 같이 달리기 방 ${race.code}\n${DOMAIN}/room/${race.code}`, p: pop(RACE.invite) },
    { kind: 'text', who: '동휘', text: 'ㄱㄱ', p: pop(RACE.replies[0]!) },
    { kind: 'text', who: '민서', text: '들어감', p: pop(RACE.replies[1]!) },
    { kind: 'text', who: '진우', text: '이번엔 안 짐', p: pop(RACE.replies[2]!) },
  ]

  // 폰 자리: 링클 화면은 가운데, 단톡방은 아래 말풍선이 보이게 조금 올린다
  const toChat = ramp(sec, RACE.switch + 1.1, RACE.switch + 1.7) * (1 - ramp(sec, RACE.back, RACE.back + 0.4))
  const top = CENTER_TOP + (CHAT_TOP - CENTER_TOP) * toChat
  // 레이스 바를 크게: 바를 중심으로 키우면서 릴스 위쪽 UI에 가리지 않게 아래로 내린다
  const zp = ramp(sec, RACE.zoom[0]!, RACE.zoom[0]! + 0.5) * (1 - ramp(sec, RACE.zoom[1]!, RACE.zoom[1]! + 0.4))
  const z = 1 + 0.3 * zp // 1.3배: 폰 폭(828px)이 캔버스(1080px)를 넘지 않아 레이스 바 양 끝이 잘리지 않는다
  const barY = top + 80 * S // 레이스 바의 가운데(캔버스 y)
  const drop = (560 - barY) * zp
  const inChat = sec >= RACE.switch && sec < RACE.back + 0.4
  // 다시 링클로: 아이폰에서 앱 사이를 옆으로 넘기듯, 단톡방은 왼쪽으로 나가고 링클이 오른쪽에서 들어온다(겹쳐 흐리지 않는다)
  const backToApp = ramp(sec, RACE.back - 0.05, RACE.back + 0.35)
  const endIn = ramp(sec, RACE.end, RACE.end + 0.45)

  const linkle = <Screens sec={sec} />
  return (
    <AbsoluteFill style={{ background: C.secondary, fontFamily: FONT }}>
      <Fonts />
      <div style={{ position: 'absolute', inset: 0, transform: `translateY(${drop}px) scale(${z})`, transformOrigin: `540px ${barY}px` }}>
        <Phone top={top} background={C.white}>
          {inChat ? (
            <>
              <div style={{ position: 'absolute', inset: 0, transform: `translateX(${-PHONE.w * 1.06 * backToApp}px)` }}>
                <Switcher sec={sec} at={RACE.switch} linkle={linkle} chat={<ChatScreen msgs={chat} />} />
              </div>
              {backToApp > 0 && <div style={{ position: 'absolute', inset: 0, transform: `translateX(${PHONE.w * 1.06 * (1 - backToApp)}px)` }}>{linkle}</div>}
            </>
          ) : (
            linkle
          )}
        </Phone>
      </div>

      {captions && RACE_CAPTIONS.filter(c => !c.endCard).map((c, i) => <StoryCaption key={i} sec={sec} from={c.from} to={c.to} text={c.text} bottom={!c.top} />)}

      {endIn > 0 && <EndCard sec={sec} opacity={endIn} start={RACE.end} question={captions && endTitle ? <EndTitle text={endTitle} /> : null} />}
    </AbsoluteFill>
  )
}

function ChatScreen({ msgs }: { msgs: Msg[] }) {
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, width: 390, height: 844, transform: `scale(${S})`, transformOrigin: '0 0' }}>
      <Chat msgs={msgs} domain={DOMAIN} date="11월 26일 목요일" />
    </div>
  )
}

/** 링클 화면: 정지 화면을 차례로, 룰렛 구간만 영상으로 */
function Screens({ sec }: { sec: number }) {
  const inReveal = sec >= RACE.reveal && sec < RACE.reveal + REVEAL_LEN
  return (
    <div style={{ position: 'absolute', inset: 0, background: C.white }}>
      {SCENES.map(([at, name], i) => {
        const next = SCENES[i + 1]?.[0] ?? Infinity
        if (sec < at - 0.01 || sec > next + 0.2) return null
        if (next === RACE.back && sec >= next - 0.05) return null
        // 단톡방에서 돌아오는 장면은 앞 장면(방을 막 만든 화면)을 거치지 않고 바로 보인다
        const o = i === 0 || at === RACE.back ? 1 : ramp(sec, at, at + 0.16)
        return <Img key={name} src={staticFile(`rec/race-${name}.png`)} style={{ position: 'absolute', inset: 0, width: PHONE.w, height: PHONE_H, opacity: o }} />
      })}
      <Sequence from={Math.round((RACE.reveal / RACE_SPEED) * FPS)} durationInFrames={Math.round((REVEAL_LEN / RACE_SPEED) * FPS)} layout="none">
        <OffthreadVideo
          src={staticFile('rec/race-reveal.mp4')}
          trimBefore={Math.round(RACE.revealFrom * FPS)}
          playbackRate={RACE.revealRate * RACE_SPEED}
          muted
          style={{ position: 'absolute', inset: 0, width: PHONE.w, height: PHONE_H, opacity: inReveal ? 1 : 0 }}
        />
      </Sequence>
      {TAPS.map((t, i) => {
        const p = tapOf(t.name)
        return <Tap key={i} sec={sec} at={t.at} until={t.until} x={p.x * S} y={p.y * S} />
      })}
    </div>
  )
}

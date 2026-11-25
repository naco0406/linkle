// 첫 번째 릴스(이야기판): 꼬들·꼬맨틀 → 파도타기 → 매일 한 문제 → 그래서 만든 링클
// → 실제 플레이의 끝(도착, 결과 공유) → 앱 전환 → 대화방에 붙여 넣고 보내기 → 끝 화면.
// 게임 방법 전체는 두 번째 릴스(LinkleReelC)에서 다룬다. captions를 끄면 자막 없는 판(편집용)이 나온다.
import { AbsoluteFill, Easing, Img, interpolate, spring, staticFile, useCurrentFrame } from 'remotion'
import { Chat, COMPOSE_AT, type Msg } from './Chat'
import { Daily, Made, Wave } from './Intro'
import { CHAT_TOP, DOMAIN, FPS, H, PHONE, PHONE_H, recTap, S } from './plan'
import { Phone } from './Phone'
import { EndCard, Fonts, FRIENDS, Logo, Tap, TITLE } from './Reel'
import { SPEED, STORY, STORY_CAPTIONS } from './storyPlan'
import { EndTitle, StoryCaption } from './Captions'
import { C, FONT, NAMU } from './theme'

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const
const ease = Easing.bezier(0.33, 0, 0.2, 1)
const ramp = (sec: number, a: number, b: number) => interpolate(sec, [a, b], [0, 1], { ...clamp, easing: ease })

// 내 결과. 두 번째 릴스의 실제 녹화와 같은 값이다
const MY = { score: '5번 30초', emoji: '🟥🟧⏪🟧🏁' }

const endTitle = STORY_CAPTIONS.find(c => c.endCard)?.text
const SHARE_TEXT = [TITLE, MY.score, '', MY.emoji, '', DOMAIN].join('\n')

/** 폰이 올라오면 실제 화면의 정지 장면 셋으로 넘긴다(record/stills.ts가 녹화에서 뽑은 것). 누른 자리는 녹화의 탭 자리다 */
const goalTap = recTap('뉴발란스')
const shareTap = recTap('결과 공유')

export function Story({ captions = true }: { captions?: boolean }) {
  // 모든 장면을 SPEED배로 재생한다(시각표는 1배 기준)
  const frame = useCurrentFrame() * SPEED
  const sec = frame / FPS
  const pop = (at: number) => spring({ frame: frame - Math.round(at * FPS), fps: FPS, config: { damping: 16, stiffness: 170, mass: 0.7 } })

  const before: Msg[] = [
    { kind: 'text', who: '진우', text: '어제 꼬맨틀 진짜 어려웠음', p: 1 },
    { kind: 'text', who: '동휘', text: 'ㅇㅈ 200번 넘게 함', p: 1 },
    { kind: 'text', who: '민서', text: '오늘 꼬들 나왔다', p: 1 },
    { kind: 'text', who: '진우', text: '벌써?', p: 1 },
    { kind: 'text', who: '동휘', text: '나 3줄 컷', p: pop(0.2) },
    { kind: 'text', who: '민서', text: '꼬맨틀은 아직 못 맞힘', p: pop(0.9) },
    { kind: 'text', who: '진우', text: '힌트 좀 줘', p: pop(1.6) },
    { kind: 'text', who: '나', mine: true, text: '난 둘 다 끝냈지롱', p: pop(2.4) },
  ]
  const after: Msg[] = [
    { kind: 'text', who: '진우', text: '어제 링클 마지막에 헤맴', p: 1 },
    { kind: 'text', who: '민서', text: '난 4번 만에 감ㅋㅋ', p: 1 },
    { kind: 'text', who: '동휘', text: '오늘 링클 나왔다', p: 1 },
    { kind: 'text', who: '민서', text: '다 풀면 결과 올려', p: 1 },
    ...FRIENDS.map(f => ({ kind: 'result' as const, who: f.who, title: TITLE, score: f.score, emoji: f.emoji, p: 1 })),
    { kind: 'result', who: '나', mine: true, title: TITLE, score: MY.score, emoji: MY.emoji, p: pop(STORY.mine) },
    { kind: 'text', who: '진우', text: '30초?? 어떻게 감', p: pop(STORY.reply) },
  ]
  const late = sec > STORY.daily

  const gone = ramp(sec, STORY.chatOut - 0.3, STORY.chatOut)
  const rise = ramp(sec, STORY.phoneIn - 0.2, STORY.phoneIn + 0.7)
  // 올라오기 전에는 그리지 않는다. 내려가 있는 거리도 캔버스 높이에 폰 위 여백을 더해, 테두리 끝이 화면 아래에 걸리지 않게 한다
  const phoneOpacity = late ? (rise > 0 ? 1 : 0) : 1 - gone
  const phoneShift = late ? (1 - rise) * (H + 120) : 40 * gone
  const endIn = ramp(sec, STORY.end, STORY.end + 0.45)

  return (
    <AbsoluteFill style={{ background: C.secondary, fontFamily: FONT }}>
      <Fonts />
      <Wave sec={sec} from={STORY.wave} to={STORY.daily} />
      <Daily sec={sec} from={STORY.daily} to={STORY.made} />
      <Made sec={sec} from={STORY.made} to={STORY.phoneIn + 0.3} Logo={Logo} />

      {phoneOpacity > 0 && (
        <div style={{ position: 'absolute', inset: 0, opacity: phoneOpacity, transform: `translateY(${phoneShift}px)` }}>
          <Phone top={CHAT_TOP} background={C.chatBg}>
            {late ? (
              <Switcher sec={sec} linkle={<Stills sec={sec} />} chat={<LateChat sec={sec} msgs={after} />} />
            ) : (
              <Screen>
                <Chat msgs={before} domain={DOMAIN} date="2025년 1월 6일 월요일" />
              </Screen>
            )}
          </Phone>
        </div>
      )}

      {captions && STORY_CAPTIONS.filter(c => !c.endCard).map((c, i) => <StoryCaption key={i} sec={sec} from={c.from} to={c.to} text={c.text} color={c.namu ? NAMU.main : undefined} />)}

      {endIn > 0 && <EndCard sec={sec} opacity={endIn} start={STORY.end} question={captions && endTitle ? <EndTitle text={endTitle} /> : null} />}
    </AbsoluteFill>
  )
}

/** 390×844 CSS 화면을 폰 크기로 키워 담는다 */
function Screen({ children }: { children: React.ReactNode }) {
  return <div style={{ position: 'absolute', left: 0, top: 0, width: 390, height: 844, transform: `scale(${S})`, transformOrigin: '0 0' }}>{children}</div>
}

/** 실제 화면의 정지 장면: 목표 링크가 보이는 문서 → 도착 → 복사 알림. 장면 사이는 짧게 겹쳐 바뀐다 */
function Stills({ sec }: { sec: number }) {
  const t = STORY
  const arrival = ramp(sec, t.arrive, t.arrive + 0.18)
  const copied = ramp(sec, t.shareTap + 0.12, t.shareTap + 0.26)
  const img = (name: string, opacity: number) => <Img src={staticFile(`rec/story-${name}.png`)} style={{ position: 'absolute', inset: 0, width: PHONE.w, height: PHONE_H, opacity }} />
  return (
    <div style={{ position: 'absolute', inset: 0, background: C.white }}>
      {img('goal', 1)}
      {img('arrival', arrival)}
      {img('copied', copied)}
      <Tap sec={sec} at={t.goalTap} until={t.arrive} x={goalTap.x * S} y={goalTap.y * S} />
      <Tap sec={sec} at={t.shareTap} until={t.switch} x={shareTap.x * S} y={shareTap.y * S} />
    </div>
  )
}

/** 결과를 붙여 넣어 보내는 대화방 */
function LateChat({ sec, msgs }: { sec: number; msgs: Msg[] }) {
  const t = STORY
  const compose = {
    text: SHARE_TEXT,
    caret: sec >= t.fieldTap + 0.1 && sec < t.menuTap + 0.15 && Math.floor((sec - t.fieldTap) * 2.4) % 2 === 0,
    menu: ramp(sec, t.fieldTap + 0.2, t.fieldTap + 0.4) * (1 - ramp(sec, t.menuTap + 0.05, t.menuTap + 0.2)),
    grow: ramp(sec, t.menuTap + 0.12, t.menuTap + 0.45) * (1 - ramp(sec, t.sendTap + 0.08, t.sendTap + 0.3)),
    send: ramp(sec, t.menuTap + 0.3, t.menuTap + 0.5) * (1 - ramp(sec, t.sendTap + 0.12, t.sendTap + 0.3)),
  }
  const taps = [
    { at: t.fieldTap, ...COMPOSE_AT.field },
    { at: t.menuTap, ...COMPOSE_AT.menu },
    { at: t.sendTap, ...COMPOSE_AT.send, y: COMPOSE_AT.send.y },
  ]
  return (
    <>
      <Screen>
        <Chat msgs={msgs} domain={DOMAIN} date="11월 23일 월요일" compose={compose} />
      </Screen>
      {taps.map((p, i) => (
        <Tap key={i} sec={sec} at={p.at} until={p.at + 1} x={p.x * S} y={p.y * S} />
      ))}
    </>
  )
}

/**
 * 앱 전환. 링클 화면이 카드로 작아지고(1), 카드들이 오른쪽으로 밀려 왼쪽의 채팅 카드가 가운데로 오고(2), 그 카드가 다시 화면을 채운다(3).
 * 아이폰의 앱 전환 움직임만 빌리고, 실제 앱 아이콘이나 화면은 그리지 않는다.
 */
function Switcher({ sec, linkle, chat }: { sec: number; linkle: React.ReactNode; chat: React.ReactNode }) {
  const s0 = STORY.switch
  const p1 = ramp(sec, s0, s0 + 0.45)
  const p2 = ramp(sec, s0 + 0.5, s0 + 1.1)
  const p3 = ramp(sec, s0 + 1.15, s0 + 1.75)
  if (p1 <= 0) return <>{linkle}</>
  const small = 0.62
  const gap = 44
  const step = PHONE.w * small + gap
  const lScale = 1 - (1 - small) * p1
  const cScale = small + (1 - small) * p3
  const lx = step * p2 + PHONE.w * 0.7 * p3
  const cx = -step * (1 - p2)
  const dy = 36 * p1 * (1 - p3)
  const labels = p1 * (1 - p3)
  const card = (x: number, scale: number, children: React.ReactNode, label: React.ReactNode) => (
    <div style={{ position: 'absolute', inset: 0, transform: `translate(${x}px, ${dy}px) scale(${scale})` }}>
      <div style={{ position: 'absolute', inset: 0, borderRadius: 72, overflow: 'hidden' }}>{children}</div>
      <div style={{ position: 'absolute', left: 0, top: -112, height: 80, display: 'flex', alignItems: 'center', gap: 20, opacity: labels, color: C.white, fontSize: 44, fontWeight: 600 }}>{label}</div>
    </div>
  )
  return (
    <div style={{ position: 'absolute', inset: 0, background: '#243049' }}>
      {card(
        lx,
        lScale,
        linkle,
        <>
          <Logo size={80} />
          Linkle
        </>,
      )}
      {card(
        cx,
        cScale,
        chat,
        <>
          <ChatIcon />
          채팅
        </>,
      )}
    </div>
  )
}

/** 특정 메신저를 닮지 않은 채팅 아이콘 */
function ChatIcon() {
  return (
    <svg width={80} height={80} viewBox="0 0 96 96">
      <rect width="96" height="96" rx="22" fill="#57ab5a" />
      <path d="M26 34a10 10 0 0 1 10-10h24a10 10 0 0 1 10 10v16a10 10 0 0 1-10 10H44l-12 10v-10a10 10 0 0 1-6-9z" fill="#fff" />
    </svg>
  )
}

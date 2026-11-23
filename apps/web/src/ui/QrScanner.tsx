import { useEffect, useRef, useState } from 'react'
import { RotateCw, X } from 'lucide-react'
import { isRoomCode, normalizeRoomCode } from '@linkle/core'

// 친구 QR 찍기(설계 문서 16.3.1). 옆에 있는 친구와 둘 다 방을 만들어 버렸을 때 한 명이 상대 QR을 찍어 그 방으로 옮긴다.
// usagi-volleyball의 QrScanner를 옮겼다. 카메라 화면은 기기 밖으로 나가지 않는다.

const SCAN_EVERY_MS = 120
const SCAN_SIZE = 480

type Stage = 'asking' | 'live' | 'blocked' | 'missing' | 'lost'
const TROUBLE: Partial<Record<Stage, [string, string]>> = {
  blocked: ['카메라를 쓸 수 없어요', '설정에서 카메라를 허용하면 바로 찍을 수 있어요.'],
  missing: ['카메라를 찾지 못했어요', '이 기기에서는 코드로 들어와 주세요.'],
  lost: ['카메라가 꺼졌어요', '다시 켜거나 코드로 들어와 주세요.'],
}

/** QR 글자에서 방 코드를 꺼낸다. 링클 방 주소만 받는다 */
export function roomFromQr(text: string): string | null {
  try {
    const u = new URL(text)
    const m = /^\/room\/([A-Za-z0-9]{4})$/.exec(u.pathname)
    const code = m ? normalizeRoomCode(m[1]!) : ''
    return isRoomCode(code) ? code : null
  } catch {
    return null
  }
}

export function QrScanner({ own, onRoom, onClose }: { own: string; onRoom: (code: string) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null)
  const found = useRef(onRoom)
  found.current = onRoom
  const [stage, setStage] = useState<Stage>('asking')
  const [note, setNote] = useState('')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let stream: MediaStream | undefined
    let timer = 0
    let stopped = false
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = SCAN_SIZE
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!
    const start = async () => {
      setStage('asking')
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new DOMException('No camera', 'NotFoundError')
        const [{ default: jsQR }, camera] = await Promise.all([import('jsqr'), navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' } } })])
        stream = camera
        if (stopped || !video.current) return
        camera.getVideoTracks()[0]!.onended = () => setStage('lost')
        video.current.srcObject = camera
        await video.current.play()
        if (stopped) return
        setStage('live')
        const read = () => {
          const v = video.current
          const side = v ? Math.min(v.videoWidth, v.videoHeight) : 0
          if (v && side) {
            ctx.drawImage(v, (v.videoWidth - side) / 2, (v.videoHeight - side) / 2, side, side, 0, 0, SCAN_SIZE, SCAN_SIZE)
            const text = jsQR(ctx.getImageData(0, 0, SCAN_SIZE, SCAN_SIZE).data, SCAN_SIZE, SCAN_SIZE, { inversionAttempts: 'dontInvert' })?.data
            const room = text ? roomFromQr(text) : null
            if (room && room !== own) {
              navigator.vibrate?.(40)
              found.current(room)
              return
            }
            if (text) setNote(room ? '내 방 QR이에요' : '링클 방 QR이 아니에요')
          }
          timer = window.setTimeout(read, SCAN_EVERY_MS)
        }
        read()
      } catch (e) {
        const name = (e as DOMException)?.name
        if (!stopped) setStage(name === 'NotAllowedError' || name === 'SecurityError' ? 'blocked' : name === 'NotFoundError' || name === 'OverconstrainedError' ? 'missing' : 'lost')
      }
    }
    void start()
    return () => {
      stopped = true
      clearTimeout(timer)
      stream?.getTracks().forEach(t => t.stop())
    }
  }, [attempt, own])

  const trouble = TROUBLE[stage]
  return (
    <div role="dialog" aria-modal="true" aria-label="친구 QR 찍기" className="fixed inset-0 z-50 flex flex-col bg-black">
      <video ref={video} muted playsInline aria-hidden className="absolute inset-0 h-full w-full object-cover" />
      <div className="relative flex h-14 items-center justify-between px-4 pt-[env(safe-area-inset-top)] text-white">
        <b className="text-[17px] font-semibold">친구 QR 찍기</b>
        <button onClick={onClose} aria-label="닫기" className="press grid h-10 w-10 place-items-center rounded-full bg-white/15">
          <X className="h-6 w-6" strokeWidth={1.75} />
        </button>
      </div>
      <div className="relative flex flex-1 flex-col items-center justify-center px-8 text-center text-white">
        {trouble ? (
          <div className="rounded-[20px] bg-white p-6 text-ink">
            <b className="block text-[17px] font-bold">{trouble[0]}</b>
            <p className="mt-1 text-[15px] leading-[22px] text-ink-2">{trouble[1]}</p>
            {stage !== 'missing' && (
              <button onClick={() => setAttempt(n => n + 1)} className="press mx-auto mt-4 flex h-12 items-center gap-1.5 rounded-full bg-secondary px-5 font-semibold text-primary">
                <RotateCw className="h-[18px] w-[18px]" />
                다시 켜기
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="h-60 w-60 rounded-[28px] shadow-[0_0_0_2px_white,0_0_0_9999px_rgb(0_0_0/0.45)]" aria-hidden />
            <p role="status" className="mt-6 text-[15px]">
              {stage === 'asking' ? '카메라를 켜는 중이에요' : note || '친구 화면의 QR을 네모 안에 맞춰요'}
            </p>
          </>
        )}
      </div>
    </div>
  )
}

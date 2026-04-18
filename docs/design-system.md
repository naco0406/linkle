# Linkle — Design System

> 목적: wikirace에서 이미 검증된 디자인 퀄리티를 **토큰으로 고정**하고, 이후 모든 화면이 이 토큰·컴포넌트만으로 조립되도록 한다.
>
> 원칙: 앱 코드에는 **하드코딩된 색/폰트/스페이싱/모션이 존재해서는 안 된다.** 필요하면 토큰을 추가하라.

---

## 1. 브랜드 아이덴티티 요약

- 서비스명: **Linkle** (링클)
- 성격: 아침에 한 판, 가볍게 몰입하는 퍼즐. 블루 계열의 단정하고 신뢰감 있는 톤.
- 타이포 대비: 본문은 현대적인 Pretendard, 로고/강조는 세리프 Rhodium Libre.

---

## 2. 컬러 토큰

### 2.1 코어 팔레트

| 토큰                       | HSL           | HEX (참고) | 용도              |
| -------------------------- | ------------- | ---------- | ----------------- |
| `--linkle`                 | `217 60% 50%` | `#3366CC`  | 브랜드 primary    |
| `--linkle-foreground`      | `0 0% 100%`   | `#FFFFFF`  | primary 위 텍스트 |
| `--background`             | `217 67% 97%` | `#F3F7FF`  | 페이지 배경       |
| `--foreground`             | `220 30% 15%` | `#1A2236`  | 기본 텍스트       |
| `--card`                   | `0 0% 100%`   | `#FFFFFF`  | 카드 배경         |
| `--card-foreground`        | `220 30% 15%` | —          | 카드 위 텍스트    |
| `--muted`                  | `217 30% 92%` | `#E3EAF5`  | 보조/비활성 배경  |
| `--muted-foreground`       | `220 15% 45%` | `#666F85`  | 보조 텍스트       |
| `--accent`                 | `217 60% 94%` | `#E1ECFA`  | 약한 강조 배경    |
| `--border`                 | `217 25% 85%` | `#CDD6E3`  | 경계선            |
| `--input`                  | `217 25% 85%` | —          | 인풋 경계         |
| `--ring`                   | `217 60% 50%` | `#3366CC`  | focus ring        |
| `--destructive`            | `0 70% 50%`   | `#D93535`  | 경고/강제종료     |
| `--destructive-foreground` | `0 0% 100%`   | —          | —                 |

### 2.2 유사도 이모지 매핑

| 구간  | 이모지 |
| ----- | ------ |
| ≥ 0.8 | 🟦     |
| ≥ 0.6 | 🟩     |
| ≥ 0.4 | 🟨     |
| ≥ 0.2 | 🟧     |
| < 0.2 | 🟥     |
| back  | ⏪     |
| goal  | 🏁     |

(코드: `packages/shared/src/emoji/similarityToEmoji.ts`)

---

## 3. 타이포그래피

### 3.1 Font Stacks

```
--font-sans:  "Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont,
              "Apple SD Gothic Neo", "Noto Sans KR", system-ui, sans-serif;
--font-serif: "Rhodium Libre", ui-serif, Georgia, serif;
--font-mono:  ui-monospace, "SF Mono", Menlo, monospace;
```

### 3.2 Type Scale (모바일 기준)

| 토큰        | Tailwind | 용도            |
| ----------- | -------- | --------------- |
| `text-xs`   | 12 / 16  | 보조 메타       |
| `text-sm`   | 14 / 20  | 본문 보조       |
| `text-base` | 16 / 24  | 본문            |
| `text-lg`   | 18 / 28  | 소제목          |
| `text-xl`   | 20 / 28  | 강조            |
| `text-2xl`  | 24 / 32  | 섹션 타이틀     |
| `text-3xl`  | 30 / 36  | 페이지 타이틀   |
| `text-5xl`  | 48 / 1   | 성공 시 큰 숫자 |

### 3.3 Font Weights

- 400 (body), 500 (UI label), 600 (small emphasis), 700 (heading), 800 (display).

---

## 4. 스페이싱 & 레이아웃

- **모바일 퍼스트**. 메인 컨테이너 `max-width: 480px`. 데스크톱에서는 좌우 여백 + 카드 가운데.
- 페이지 패딩: `px-4 py-6` (모바일) → `md:px-6 md:py-10` (데스크톱).
- 카드: `rounded-2xl` (radius lg), `shadow-sm`, 배경 `bg-card`.
- 터치 타겟 최소 `44px` (게임 내 링크는 Wikipedia 렌더 유지라 예외).

### 4.1 Radius 토큰

```
--radius-sm: 0.375rem;
--radius-md: 0.625rem;
--radius-lg: 1rem;
--radius-xl: 1.25rem;
```

### 4.2 Shadow 토큰

- `shadow-card`: `0 1px 2px rgba(26,34,54,0.04), 0 4px 12px rgba(26,34,54,0.06)`

---

## 5. 모션 토큰

| 토큰                | duration             | easing                     | 비고                 |
| ------------------- | -------------------- | -------------------------- | -------------------- |
| `motion-fast`       | 150ms                | `cubic-bezier(.4,0,.2,1)`  | 버튼 hover, focus    |
| `motion-base`       | 250ms                | `cubic-bezier(.4,0,.2,1)`  | 카드, dialog open    |
| `motion-slow`       | 400ms                | `cubic-bezier(.2,.8,.2,1)` | 경로 이동, 화면 전환 |
| `motion-accordion`  | 200ms                | 기본                       | Radix accordion      |
| `motion-gradient-x` | 5s (infinite linear) | —                          | dev 배너             |

- Reduced motion 대응: `@media (prefers-reduced-motion: reduce)` 에서 duration → 0, confetti 비활성.

---

## 6. 컴포넌트 카탈로그

### 6.1 Primitives (shadcn 기반)

- `Button` — variants: `primary` (linkle), `secondary`, `ghost`, `destructive`, `outline`
  - sizes: `sm`, `md`, `lg`, `icon`
- `Card` (`Card`, `CardHeader`, `CardContent`, `CardFooter`)
- `Dialog`, `AlertDialog`, `Drawer` (모바일 알림)
- `Tabs` — 랭킹 3종 정렬, 관리자 메인 탭
- `Tooltip`, `Popover` — `<EmojiReason />` 에서 사용
- `Accordion` — FAQ, help
- `Badge` — 랭크/상태 표시
- `Input`, `Label`, `Textarea`
- `ScrollArea` — 긴 경로
- `Separator`
- `Toast` — 제출 성공/실패 피드백

### 6.2 Composite (Linkle 고유)

- `<PageShell>` — 모바일 퍼스트 카드 래퍼. `title`/`back` prop
- `<TimerPill elapsedMs={} />` — 상단 고정 타이머
- `<PathTrail path={} />` — 페이지 제목 + 화살표 + 뒤로가기 표시 체인. 이모지 없는 순수 구조 버전
- `<EmojiSquareLine result={string} />` — 🟥🟧🟨🟩🟦 공유 시퀀스
- `<EmojiReason entry={OpenAIResponseEntry} />` — Tooltip/Popover 안에 단어+유사도+사유
- `<ChallengeCard startPage endPage />` — 오늘의 챌린지 안내
- `<RankingRow rank nickname moveCount time />`
- `<ForcedEndPanel reason />`
- `<ConfettiOnMount />` — `canvas-confetti` 래퍼 (reduced-motion 존중)

### 6.3 네이밍 규칙

- 파일: PascalCase 컴포넌트당 1파일, 같은 이름의 폴더 허용 (`Button/Button.tsx` + `Button/index.ts`)
- props 타입: `XxxProps`
- variant 열거: `as const` 객체 + `cva`

---

## 7. 아이콘

- `lucide-react` 만 사용. 커스텀 아이콘이 필요하면 `packages/design-system/src/icons/` 에 SVG + React 래퍼.
- 기본 크기 20px (`size={20}`), stroke `1.75`.

---

## 8. 접근성

- 컬러 대비 AA 이상 (특히 `linkle` on white, `muted-foreground` on background).
- 모든 인터랙티브에 `focus-visible` 링 (Tailwind `ring-2 ring-ring ring-offset-2 ring-offset-background`).
- Dialog: Radix `Dialog.Title` / `Dialog.Description` 필수.
- 링크는 `<a>` 유지(Wikipedia HTML). 게임 내 비-링크 영역은 `<div role="none">`.

---

## 9. 금지 사항

- Inline style (`style={{...}}`) 금지. 예외: 진행 바 % 같은 값바인딩 한정.
- 임의 HEX/rgb 직접 사용 금지. 반드시 토큰 통해.
- 하드코딩 px 수치 금지. `4/8/12/16/24/32/48/64` 의 Tailwind 스케일 사용.
- dark mode 토글은 v1 에 미노출. 토큰은 준비해두되 사용자 전환 UI 없음.

---

## 10. 참조 구현 위치

| 자산              | 경로                                                    |
| ----------------- | ------------------------------------------------------- |
| Tailwind preset   | `packages/design-system/src/tailwind-preset.ts`         |
| CSS 변수          | `packages/design-system/src/styles/globals.css`         |
| 폰트 로딩         | `packages/design-system/src/styles/fonts.css`           |
| shadcn primitives | `packages/design-system/src/components/*`               |
| Linkle composite  | `packages/design-system/src/components/linkle/*`        |
| 토큰 TS 상수      | `packages/design-system/src/tokens/*.ts` (JS 측 접근용) |

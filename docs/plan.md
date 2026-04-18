# Linkle — 마스터 플랜

> **목적**: `wikirace` 를 Cloudflare 인프라 위에서 다시 쓰고, 100% 하네스 엔지니어링으로 유지한다. 기존의 디자인 퀄리티는 유지하되, 상태 관리·URL 처리·관리자 기능을 전면 재설계한다.
>
> 이 문서는 **실행 로드맵**이다. 각 Phase 는 순서대로 수행되며, 완료 시 본 문서의 체크박스를 갱신한다.

---

## 0. 설계 원칙 (Non-negotiables)

1. **하네스 엔지니어링 100%** — 모든 변경은 다음을 반드시 통과해야 한다:
   - `typecheck`(strict TS) · `lint`(zero warning) · `format:check`
   - 유닛 테스트 (변경된 파일 영역)
   - Playwright E2E (주요 플로우 smoke)
   - Playwright 비주얼 리그레션 + `@axe-core` a11y
2. **URL은 유일한 소스 오브 트루스** — 모든 주요 화면/상태는 URL·localStorage·서버 중 하나로 복원 가능해야 한다. "뒤로가기/새로고침/직접 URL 입력" 으로 절대 깨지지 않는다.
3. **게임 상태는 명시적 상태 머신** — `idle → loading → playing → submitting → completed | forcedEnd`. 불가능한 전이는 타입 수준에서 차단.
4. **서버 검증을 신뢰한다, 클라이언트는 아니다** — 랭킹 제출·도착 판정·권한 검사는 반드시 Worker 측에서 재수행.
5. **디자인 시스템은 단일 패키지에 응축** — 앱들은 토큰/컴포넌트를 import 만 한다. 앱별 커스텀 CSS 는 금지(필요 시 토큰 확장으로 흡수).
6. **모든 경계에서 Zod 스키마 검증** — API 요청/응답, localStorage 파싱, URL search param.
7. **관리자 앱은 서비스 앱과 완전 분리** — 빌드·라우터·번들 모두 별개. 서비스 번들에 관리자 코드가 포함되지 않는다.

---

## 1. 실행 로드맵

### ✅ Phase 0 — 모노레포 스켈레톤

- [x] pnpm workspaces 루트, `.npmrc`, `.nvmrc`, `.gitignore`
- [x] `tsconfig.base.json` + `@linkle/tsconfig` presets (base/react/worker/node)
- [x] `packages/shared`, `packages/design-system`, `packages/tsconfig`
- [x] `apps/web`, `apps/admin`, `apps/api` 초기 package.json
- [x] `tests/e2e` 스켈레톤
- [x] `lefthook.yml` pre-commit/pre-push
- [x] Prettier 설정

### ✅ Phase 1 — 문서화

- [x] `docs/plan.md` (this file)
- [x] `docs/architecture.md` — 전체 다이어그램, 배포 토폴로지, 데이터 플로우
- [x] `docs/design-system.md` — 토큰, 컴포넌트 카탈로그, 네이밍 규약
- [x] `docs/harness.md` — 품질 게이트, CI, Playwright 정책, 커밋 훅

### ✅ Phase 2 — 공통 하네스 구성

- [x] Root ESLint flat config (typescript-eslint strict + react + react-hooks + a11y)
- [x] Vitest workspace config
- [x] pnpm install 1차 (lockfile 생성)
- [x] lefthook install 확인 smoke

### ✅ Phase 3 — `@linkle/design-system`

- [x] 토큰: color (linkle #3366CC, bg #F3F7FF, HSL 변수), radius, spacing, typography (Pretendard, Rhodium Libre)
- [x] `src/styles/fonts.css` — Pretendard Variable, Rhodium Libre import
- [x] `src/styles/globals.css` — CSS 변수 (라이트 only)
- [x] `tailwind-preset.ts` — 색/폰트/애니메이션 (`gradient-x` 포함) 통합 프리셋
- [x] shadcn 프리미티브: Button, Card, Dialog, Tabs, Badge, Input (Accordion/Tooltip 등은 필요 시 확장)
- [x] 고유 컴포넌트: `PathTrail`, `EmojiSquareLine`, `TimerPill`, `PageShell`, `ChallengeCard`, `ForcedEndPanel`
- [x] `cn()` 유틸

### ✅ Phase 4 — `@linkle/shared`

- [x] 타입: `DailyChallenge`, `PathEntry` 판별 유니온, `Ranking`, `GameStatus`, `LocalDailyState`
- [x] Zod 스키마: API 양측 공유
- [x] `wiki/sanitize.ts` — **DOMParser 기반** 새니타이저 (subpath `@linkle/shared/sanitize`로 분리)
- [x] `wiki/client.ts` — parse API fetch, 에러 타입 명시
- [x] `game/isEndPage.ts` — 3단계 퍼지 매칭
- [x] `game/validatePath.ts` — 구조적 검증
- [x] `emoji/similarity.ts` — `similarityToEmoji`, `renderPathEmoji`, OpenAI 응답→배열 변환
- [x] `time/kst.ts` — KST helpers, `LAUNCH_DATE`
- [x] 모듈별 Vitest 단위 테스트 (48 통과)

### ✅ Phase 5 — `apps/api` (Cloudflare Worker + D1)

- [x] `wrangler.toml`: `linkle-api` worker + D1 바인딩 `DB` + env.staging / env.production
- [x] D1 마이그레이션 `0001_init.sql`: challenges / rankings / statistics / admins + 인덱스
- [x] Hono 라우터: `/v1/health`, `/v1/challenges/*`, `/v1/rankings`(POST/GET), `/v1/statistics/:date`, `/v1/admin/*`
- [x] Zod 요청/응답 스키마 (@linkle/shared 공유)
- [x] CORS 화이트리스트 (env.ALLOWED_ORIGINS)
- [x] 어드민 세션: HttpOnly secure cookie + HS256 JWT + PBKDF2 패스워드
- [x] 서버 측 `isEndPage` 재검증 + UNIQUE 제출 1회 제한
- [x] 라우팅 smoke 테스트 — D1 통합은 Playwright에서 wrangler dev 대상으로 후속
- [ ] OpenAI `ctx.waitUntil` 비동기 채점 — v1.1

### ✅ Phase 6 — `apps/web` (게임)

- [x] Vite + React + Tailwind + React Router data router
- [x] 라우트: `/`, `/play`, `/play/done`, `/ranking`, `/yesterday`, `/about`, `*`
- [x] 상태 머신: Zustand, 판별 유니온 `GameStatus`
- [x] 서버 상태: TanStack Query (`challenge`, `wiki:start`, `rankings`, `statistics`)
- [x] LocalStorage 어댑터 (Zod 파싱, 스키마 불일치 시 초기화)
- [x] 타이머: `useElapsedMs`
- [x] Wikipedia HTML 렌더: DOMParser 기반 sanitize → `dangerouslySetInnerHTML`; `<article>` 단일 delegate 클릭
- [x] `useSearchGuard` — `Ctrl+F` / `Cmd+F` 감지 → 강제 종료
- [x] 접근성: `aria-label`, skip-link, focus ring
- [x] gameStore 유닛 테스트 (7 통과)

### ✅ Phase 7 — `apps/admin`

- [x] 로그인 페이지 (`/login`)
- [x] 대시보드 — 30일 챌린지 캘린더 (비어있는 날/기존 챌린지 구분)
- [x] 챌린지 편집 — 생성/수정/삭제
- [x] 레거시 기능 제거 (JSONTreeView / 프롬프트 테스터 등 없음)
- [ ] 오늘 랭킹 / 통계 뷰 — v1.1

### ✅ Phase 8 — Playwright 하네스

- [x] `playwright.config.ts` — web:mobile / web:desktop / admin projects, webServer 자동 기동
- [x] E2E: home(2) · play(2) · a11y(1) · admin/login(1) — **11/11 통과** (모바일+데스크톱+어드민)
- [x] URL-function matcher 기반 API/Wikipedia route intercept fixture
- [ ] Visual regression 스냅샷 — 다음 iteration
- [ ] Admin CRUD 시나리오 — 다음 iteration

### ✅ Phase 9 — 배포 & CI

- [x] `apps/api` wrangler — production / staging 환경
- [x] `apps/web` / `apps/admin` Cloudflare Pages 설정 (`_redirects`, `_headers`)
- [x] GitHub Actions `.github/workflows/ci.yml` — harness → deploy-api / deploy-web / deploy-admin
- [ ] Cloudflare D1 생성 후 `database_id` 치환 (`wrangler d1 create linkle-db`)
- [ ] Cloudflare secrets: `OPENAI_API_KEY`, `ADMIN_JWT_SECRET` (런칭 직전)

---

## 2. 보류/추후 과제

- 다크모드 UX 결정
- 다국어(ja, en) 지원 여부 (현재는 ko 전용)
- PWA 오프라인 지원 (v1 에서는 manifest/icons 만, SW 는 v1.1)
- 소셜 공유 OG 이미지 서버 렌더 (Workers + `@vercel/og` 대안)
- 경로 무결성 서버 재검증 (두 제목 사이에 실제 링크 존재 여부) — 비용 ↑, 초기에는 길이/시간 기반 이상치 탐지만

---

## 3. 구조·네이밍 규칙

| 항목        | 규칙                                                                                  |
| ----------- | ------------------------------------------------------------------------------------- |
| 패키지 이름 | `@linkle/<area>`                                                                      |
| 라우트 경로 | kebab-case, 단수형 (`/ranking`, `/yesterday`)                                         |
| 파일 이름   | React: PascalCase `Button.tsx`, 훅/유틸: camelCase `useGameTimer.ts`                  |
| 타입        | PascalCase. 유니온 판별자는 `type` 필드                                               |
| Zod 스키마  | `xxxSchema`, 추론 타입은 `type Xxx = z.infer<typeof xxxSchema>`                       |
| 디자인 토큰 | kebab-case CSS 변수 `--linkle-*`, Tailwind 에서 `bg-linkle`, `text-linkle-foreground` |
| 테스트      | `*.test.ts`(유닛), `*.spec.ts`(Playwright)                                            |

---

## 4. 수용 기준 (Definition of Done)

각 Phase 는 아래를 만족해야 완료:

- 해당 영역의 모든 코드가 `pnpm harness` 를 0 warning 으로 통과
- Phase 5 이후로는 관련 E2E가 녹색
- 새로 추가된 public API 에 Zod 스키마와 유닛 테스트 존재
- `docs/` 내 관련 문서가 최신 상태

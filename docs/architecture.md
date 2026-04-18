# Linkle — 아키텍처

## 1. 배포 토폴로지

```
 ┌──────────────────────┐        ┌──────────────────────┐
 │ Cloudflare Pages     │        │ Cloudflare Pages     │
 │ linkle.kr (public)   │        │ admin.linkle.kr      │
 │ apps/web (Vite SPA)  │        │ apps/admin (Vite SPA)│
 └─────────┬────────────┘        └─────────┬────────────┘
           │ fetch                           │ fetch (+JWT cookie)
           ▼                                 ▼
                ┌───────────────────────────────────┐
                │ Cloudflare Worker                 │
                │ api.linkle.kr  (apps/api, Hono)   │
                └─────────┬─────────────────────────┘
                          │ bindings
          ┌───────────────┼──────────────────────┐
          ▼               ▼                      ▼
     ┌─────────┐    ┌──────────┐          ┌─────────────┐
     │ D1 (DB) │    │ KV cache │          │ OPENAI_API  │
     │         │    │ (optional)│          │ (fetch)     │
     └─────────┘    └──────────┘          └─────────────┘
```

- **web**: `linkle.kr` — 메인 서비스. SPA 라우팅 + SPA fallback (`_redirects: /* /index.html 200`).
- **admin**: `admin.linkle.kr` — 관리자. 별도 도메인 · 별도 번들.
- **api**: `api.linkle.kr` — 단일 Worker, Hono 기반. 모든 도메인 로직·외부 호출·시크릿 보유.
- **D1**: 유일한 상태 저장소. Firestore/PocketBase 대체.
- **OpenAI**: 키는 Worker 환경변수, 클라이언트에 노출되지 않음.

## 2. 데이터 플로우

### 2.1 일일 챌린지 조회

```
web.GET /v1/challenges/today
  → Worker.KV.get("challenge:YYYY-MM-DD") (hit/miss)
  → miss 시 D1.SELECT challenges WHERE date=? 후 KV 저장(24h TTL)
  → { startPage, endPage } 반환
```

### 2.2 게임 제출

```
web.POST /v1/rankings  { userId, nickname, moveCount, time, path }
  ← Zod 검증 → isEndPage(path[last], endPage) 서버 재검증 →
    1회성 idempotency 키 체크 (userId+date 중복 불가)
  → D1 트랜잭션: INSERT rankings; UPDATE statistics rollup
  → ctx.waitUntil(async: OpenAI 유사도 분석 → UPDATE rankings.emoji_result)
  → { rank: N, emojiDeferred: true } 즉시 응답
```

### 2.3 어제 통계

```
yesterday.GET /v1/statistics/:date
  → D1.SELECT statistics WHERE challenge_date=?
  → 없으면 lazy 집계 (D1.SELECT rankings ... ORDER BY ...) 후 UPSERT
  → 반환
```

## 3. D1 스키마 (v1)

```sql
-- 0001_init.sql
CREATE TABLE challenges (
  date          TEXT PRIMARY KEY,               -- 'YYYY-MM-DD' (KST)
  start_page    TEXT NOT NULL,
  end_page      TEXT NOT NULL,
  created_at    INTEGER NOT NULL,               -- unix ms
  created_by    TEXT                            -- admin username
);

CREATE TABLE rankings (
  id              TEXT PRIMARY KEY,             -- uuid v7
  challenge_date  TEXT NOT NULL,
  user_id         TEXT NOT NULL,
  nickname        TEXT NOT NULL,
  move_count      INTEGER NOT NULL,             -- 원본 클릭 수 (오프셋 제거)
  time_sec        INTEGER NOT NULL,
  path_json       TEXT NOT NULL,                -- JSON[]
  submitted_at    INTEGER NOT NULL,
  emoji_result    TEXT,                         -- nullable; async 채움
  reason_json     TEXT,                         -- nullable; OpenAI 상세
  FOREIGN KEY (challenge_date) REFERENCES challenges(date),
  UNIQUE (challenge_date, user_id)              -- 1일 1제출
);
CREATE INDEX idx_rankings_date_time   ON rankings(challenge_date, time_sec, move_count);
CREATE INDEX idx_rankings_date_moves  ON rankings(challenge_date, move_count, time_sec);
CREATE INDEX idx_rankings_date_submit ON rankings(challenge_date, submitted_at);

CREATE TABLE statistics (
  challenge_date          TEXT PRIMARY KEY,
  total_count             INTEGER NOT NULL DEFAULT 0,
  shortest_path_ranking   TEXT,                 -- rankings.id
  fastest_time_ranking    TEXT,                 -- rankings.id
  computed_at             INTEGER NOT NULL,
  FOREIGN KEY (challenge_date) REFERENCES challenges(date)
);

CREATE TABLE admins (
  id             TEXT PRIMARY KEY,
  username       TEXT UNIQUE NOT NULL,
  password_hash  TEXT NOT NULL,                 -- bcrypt via Web Crypto + pbkdf2
  created_at     INTEGER NOT NULL
);
```

### 오프셋 제거

과거 `moveCount+1` 저장 정책은 버린다. 새 스키마의 `move_count` 는 "실제 클릭 수". 첫 페이지는 0 이동으로 시작.

### path 표현

```ts
type PathEntry = { type: 'page'; title: string } | { type: 'back' };
type Path = PathEntry[];
```

`path_json` 컬럼에 이 형태의 JSON 배열이 들어간다. 기존 `"뒤로가기"` 문자열 토큰은 폐기.

## 4. Wikipedia HTML 새니타이즈 (선언형)

정규식 → **DOMParser** 로 전환. 정책을 선언형으로 구성해 테스트 가능하게 만든다.

```ts
// packages/shared/src/wiki/policy.ts
export const SANITIZE_POLICY = {
  removeSections: ['같이 보기', '각주', '외부 링크'],
  removeBySelector: [
    '#mw-navigation',
    '#footer',
    '.mw-references-wrap',
    '.mw-editsection',
    '.dablink',
    '.hatnote',
    '.navbox',
    'audio',
    'script',
    'style',
    'noscript',
  ],
  // 내부 링크만 유지
  linkAllow: (href: string) => href.startsWith('/wiki/') && !href.includes(':'),
};
```

`sanitize(html)` 은:

1. `new DOMParser().parseFromString(html, 'text/html')` 로 DOM 화
2. `removeSections` 에 해당하는 `<h2>` 부터 다음 동급 이상 헤더 전까지 `remove()`
3. `removeBySelector` 전부 `remove()`
4. 모든 `<a>` 를 순회:
   - `href` 가 `linkAllow` 를 통과하면 그대로 유지 (단, `target`/`rel` 은 제거)
   - 그 외는 `<span>` 으로 치환 (텍스트 보존, 내비게이션 불가)
5. `element.innerHTML` 을 반환

## 5. 게임 상태 머신

```ts
type GameStatus =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'playing'; currentTitle: string; path: Path; moveCount: number; startedAt: number }
  | { kind: 'submitting'; path: Path; moveCount: number; time: number }
  | {
      kind: 'completed';
      rank: number;
      path: Path;
      moveCount: number;
      time: number;
      emoji: string | null;
    }
  | { kind: 'forcedEnd'; reason: 'search-detected' };
```

- 전이 함수 `reducer(status, event)` 로 구현. 불가능 전이는 타입으로 컴파일 에러.
- URL 과 상태의 관계:
  - `status.kind === 'playing'` ↔ `/play`
  - `status.kind === 'completed'` ↔ `/play/done`
  - 그 외 `kind` 에서 `/play` 접근 시 `/` 로 리다이렉트 (React Router loader 에서 검사)
- LocalStorage 직렬화: Zod 스키마 통과 시에만 복원. 실패 시 전체 초기화.

## 6. URL / 상태 복원 규칙

| URL          | 요구 상태                      | 없으면         |
| ------------ | ------------------------------ | -------------- |
| `/`          | 항상 접근 가능                 | —              |
| `/play`      | `playing`                      | `/` 로 replace |
| `/play/done` | `completed` (오늘 클리어 기록) | `/` 로 replace |
| `/ranking`   | 항상                           | —              |
| `/yesterday` | 항상                           | —              |

완료 후 랭킹 갱신은 query(`?date=YYYY-MM-DD`)로 명시. `/play/done` 을 직접 쳐서 들어오면 LocalStorage 의 오늘 완주 기록에서 복원.

## 7. 인증 (관리자)

- `POST /v1/admin/login` — body `{ username, password }` → 성공 시 `Set-Cookie: linkle_admin=<JWT>; HttpOnly; Secure; SameSite=Lax; Domain=.linkle.kr; Max-Age=86400`
- JWT payload: `{ sub: adminId, iat, exp }`. HS256 with `ADMIN_JWT_SECRET`.
- 관리자 엔드포인트는 모두 `Authorization` 미들웨어로 쿠키 검증.
- Rate limit: Cloudflare Rate Limiting Rules (배포 후 설정, v1.1).

## 8. 보안 노트

- OpenAI 키는 Worker 전용. 클라이언트 공개 금지.
- CORS: `Access-Control-Allow-Origin` 을 `linkle.kr`, `admin.linkle.kr`, `localhost:5173`, `localhost:5174` 에만 허용.
- D1 쿼리는 반드시 prepared statement (`.prepare().bind()`).
- 경로 조작 방지: 제출 시 `path` 의 마지막 엔트리가 `endPage` 인지 서버 재검증.

## 9. 서드파티 최소화

지우는 것들 (wikirace 대비):

- Firebase SDK · PocketBase SDK
- `html2canvas` (공유 이미지는 서버 렌더로 대체 또는 이모지 텍스트 공유만)
- `react-type-animation`, `canvas-confetti` — confetti 는 남기고, 타이핑 효과는 Pretendard + 기본 CSS 전환으로 대체
- `lodash` — 사용처를 개별 유틸로 교체

남기는 것들:

- `@radix-ui/*` (shadcn 베이스)
- `class-variance-authority`, `clsx`, `tailwind-merge`, `tailwindcss-animate`
- `lucide-react`
- `embla-carousel-react` (필요 시)
- `canvas-confetti`

추가:

- `hono`, `zod`, `@tanstack/react-query`, `zustand`, `react-router-dom@7`

# Linkle

> 매일 바뀌는 위키피디아 출발지 → 도착지를, **링크만 타고** 달려라. wikirace의 후계 프로젝트.

## 모노레포 구조

```
linkle/
├── apps/
│   ├── web/       # 게임 (Vite + React, 공용 배포)
│   ├── admin/     # 관리자 대시보드 (Vite + React, 별도 서브도메인)
│   └── api/       # Cloudflare Worker + D1 (Hono)
├── packages/
│   ├── design-system/   # Tailwind preset + shadcn primitives + tokens
│   ├── shared/          # 도메인 타입, Wiki sanitizer, 게임 규칙
│   └── tsconfig/        # 공유 tsconfig presets
├── tests/
│   └── e2e/       # Playwright (cross-app E2E + a11y + visual)
└── docs/          # 계획 / 아키텍처 / 디자인 시스템 / 하네스 정책
```

## 하네스 명령

| 명령                | 역할                                         |
| ------------------- | -------------------------------------------- |
| `pnpm dev`          | 모든 앱 병렬 실행 (web, admin, api)          |
| `pnpm harness`      | typecheck + lint + format:check + unit tests |
| `pnpm harness:full` | 위 + build + E2E                             |
| `pnpm test:e2e`     | Playwright 실행                              |

## 문서

- [`docs/plan.md`](./docs/plan.md) — 마스터 계획
- [`docs/architecture.md`](./docs/architecture.md) — 아키텍처 결정
- [`docs/design-system.md`](./docs/design-system.md) — 디자인 토큰·컴포넌트 정책
- [`docs/harness.md`](./docs/harness.md) — 품질 하네스 정책

## 로컬 풀스택으로 돌리기

```bash
# 1. 로컬 D1 준비 (최초 1회)
pnpm --filter @linkle/api run db:migrate:local
pnpm --filter @linkle/api run db:seed:local
# → admin/1234 계정, 오늘/내일 챌린지(대한민국 → 무궁화) 삽입

# 2. 병렬 실행 — web(5173) + admin(5174) + api(8787)
pnpm dev
```

웹/어드민의 API 기본값은 `http://localhost:8787`. 다른 엔드포인트를 쓰려면
`apps/web/.env.local` / `apps/admin/.env.local` 에 `VITE_API_BASE_URL=...` 추가.

## 배포

Cloudflare Pages(web, admin) + Cloudflare Workers(api) + D1(database).

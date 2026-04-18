# Linkle — 품질 하네스 정책

> 모든 변경은 하네스를 통과해야 한다. 하네스는 **자동화된 게이트**이며, 시니어 엔지니어의 코드 리뷰를 대체하지 않고 **보조**한다.

---

## 1. 하네스 레벨

| 레벨    | 명령                             | 트리거                         | 차단               |
| ------- | -------------------------------- | ------------------------------ | ------------------ |
| L1 빠름 | `pnpm typecheck`                 | 에디터 저장 (LSP) / pre-commit | 에러 1개 이상      |
| L2 린트 | `pnpm lint && pnpm format:check` | pre-commit                     | warning 1개 이상   |
| L3 유닛 | `pnpm test:unit`                 | pre-push / CI                  | 실패 1개 이상      |
| L4 빌드 | `pnpm build`                     | CI                             | 실패               |
| L5 E2E  | `pnpm test:e2e`                  | CI                             | 실패 / 비주얼 diff |
| L6 A11y | `pnpm test:e2e --grep a11y`      | CI                             | axe violations > 0 |

명령 하나로 전부: `pnpm harness` (L1-L3), `pnpm harness:full` (L1-L5).

---

## 2. TypeScript 정책

`tsconfig.base.json` 설정:

- `strict: true`
- `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`, `noImplicitOverride`
- `noFallthroughCasesInSwitch`, `noUncheckedIndexedAccess`
- `exactOptionalPropertyTypes`, `useUnknownInCatchVariables`
- `verbatimModuleSyntax` — 타입 전용 import 강제(`import type`)

규칙:

- `any` 금지. 외부 응답은 **Zod 스키마 통과** 후에만 내부로 진입.
- `as` 단언 최소화. 필요 시 주석으로 사유.
- `enum` 금지(유지보수성·번들 크기) — union of string literals 사용.

---

## 3. ESLint 규칙 핵심

- `@typescript-eslint/strict-type-checked`
- `@typescript-eslint/stylistic-type-checked`
- `eslint-plugin-react` + `react-hooks`
- `eslint-plugin-jsx-a11y`
- 커스텀:
  - `no-restricted-imports`: `firebase`, `pocketbase` 금지 (이제 불필요)
  - `no-restricted-globals`: `fetch` 사용 시 abort signal 강제(추후 rule)
  - `no-console` warn, `error` 만 허용

---

## 4. Git Hooks (lefthook)

`lefthook.yml`:

- **pre-commit** (parallel): typecheck, lint, format:check
- **pre-push**: unit tests

개발자는 절대 `--no-verify` 를 쓰지 않는다. hook 실패는 **근본 원인**을 고쳐서 재커밋.

---

## 5. 테스트 피라미드

```
               ┌─────────────┐
               │  Playwright │  소수 (핵심 플로우)
               └─────────────┘
            ┌───────────────────┐
            │  컴포넌트/훅 테스트  │   중
            └───────────────────┘
        ┌──────────────────────────┐
        │  유틸/도메인 유닛 테스트      │   다수
        └──────────────────────────┘
```

- `@linkle/shared` 는 90%+ 커버리지 목표 (도메인 로직 집중).
- UI 컴포넌트는 **행동 중심** 테스트. `@testing-library/react` + 이벤트 시뮬레이션.
- E2E 는 **스냅샷 위주 금지**. 실제 유저 시나리오 (클릭 → 네트워크 mock → 결과 확인).
- 비주얼 리그레션은 핵심 화면(홈/게임/성공) 만. 나머지는 diff 용인.

---

## 6. Playwright 정책

- 기본 브라우저: Chromium.
- 기본 뷰포트: `iPhone 14` (375×667, DPR 3). 데스크톱은 `1280x800` 별도 project.
- Wikipedia/OpenAI 외부 호출: `page.route()` 로 픽스처(`tests/e2e/fixtures/`) 사용. 실제 API 호출 금지.
- 시간 고정: `page.clock.install()` 로 KST 10시로 고정.
- a11y: 각 주요 페이지에서 `AxeBuilder().analyze()` 실행, violations 0.
- 비주얼 diff threshold: `maxDiffPixelRatio: 0.01`.

---

## 7. 커밋 메시지 규약

Conventional Commits:

- `feat(web): add ranking tabs`
- `fix(shared): handle empty path in isEndPage`
- `refactor(design-system): rename linkle token`
- `docs(plan): update phase 6 checklist`
- `chore(ci): add pnpm cache`
- `test(e2e): cover forced end flow`

Scope 는 앱/패키지 이름 소문자.

---

## 8. PR 체크리스트

PR 템플릿에 반영:

- [ ] `pnpm harness` 통과
- [ ] 관련 E2E 업데이트
- [ ] 새 public API 에 Zod 스키마 & 유닛 테스트
- [ ] `docs/` 갱신 필요 여부 검토
- [ ] 비주얼 스냅샷 갱신 의도적인지
- [ ] 접근성 체크(키보드만으로 주요 플로우 가능?)

---

## 9. CI 잡 (Phase 9 에서 구현)

```yaml
jobs:
  harness:
    steps:
      - checkout
      - setup-pnpm
      - install
      - pnpm typecheck
      - pnpm lint
      - pnpm format:check
      - pnpm test:unit
      - pnpm build
      - pnpm exec playwright install --with-deps chromium
      - pnpm test:e2e
      - upload-artifact: playwright-report
  deploy:
    needs: harness
    if: github.ref == 'refs/heads/main'
    steps:
      - wrangler deploy (apps/api)
      - pages deploy (apps/web)
      - pages deploy (apps/admin)
```

---

## 10. 규칙 변경 절차

하네스 규칙을 완화하려면:

1. 이 문서에 제안 PR (왜 필요한가, 어떤 위험을 허용하나)
2. 승인 후 설정 변경
3. 해당 경로를 커밋 히스토리에 남겨 추적

**절대 말없이 rule 끄지 않기.**

# puzzle-gen

오늘의 문제 후보를 만든다. 원리와 이유는 `docs/DESIGN.md` 7장에 있다.

평소에는 GitHub Actions(`.github/workflows/puzzles.yml`)가 매달 돌린다. 손으로 돌릴 때:

```bash
pnpm --filter puzzle-gen download      # 위키백과 덤프 5개, 약 540 MB → data/
pnpm --filter puzzle-gen build-graph   # 링크 지도 → data/graph/ (1분 안팎, 메모리 4 GB 안팎)
pnpm --filter puzzle-gen generate --count 40   # → out/queue.sql, out/candidates.json
```

로컬 DB에 넣어 보기:

```bash
cd apps/worker && pnpm exec wrangler d1 execute linkle --local --file ../../tools/puzzle-gen/out/queue.sql
```

위키백과 요청은 한 줄로 세워 6.5초 간격으로 보낸다. 연락처가 담긴 User-Agent를 `WIKI_USER_AGENT`로 주면 `WIKI_INTERVAL_MS`를 줄여도 된다.

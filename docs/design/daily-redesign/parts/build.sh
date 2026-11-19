#!/bin/bash
# 보드를 조립하고(틀 + 키트 + 본문 + 레퍼런스), 아이콘과 핀을 구운 뒤 검사한다.
set -e
cd "$(dirname "$0")/.."
SK=${SK:?"SK=<ui-proposal-board 스킬 폴더>"}
export PW=${PW:?"PW=<playwright 패키지 폴더>"}
rm -f .base.html && node "$SK/scripts/new_board.mjs" .base.html >/dev/null
python3 - <<'PY'
import re
base = open('.base.html').read()
head = base[:base.index('<style id="kit">')]
head = head.replace('<title>{제품} {화면 묶음} — 화면 시안 · {YYYY-MM-DD}</title>', '<title>링클 오늘의 게임 — 화면 시안 · 2026-11-19</title>')
head = head.replace('<style>\n/* ①', '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Rhodium+Libre&display=swap">\n<style>\n/* ①', 1)
kit = open('parts/kit.css').read().replace('url(../shots/', 'url(shots/')
body = open('parts/body.html').read().replace('<!--REFS-->', open('parts/refs.html').read())
open('board.html', 'w').write(head + '<style id="kit">\n' + kit + '</style>\n</head>\n<body>\n' + body + '\n</body></html>\n')
PY
rm -f .base.html
node "$SK/scripts/icons.mjs" board.html --from "$LUCIDE"
node "$SK/scripts/place_pins.mjs" board.html
node "$SK/scripts/check_board.mjs" board.html --out check --terms parts/terms.txt

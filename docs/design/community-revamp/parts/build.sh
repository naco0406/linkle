#!/bin/bash
# 보드를 조립하고(틀 + 키트 + 본문 + 화면), 아이콘과 핀을 구운 뒤 검사한다.
#   SK=<ui-proposal-board 스킬 폴더> PW=<playwright 패키지 폴더> LUCIDE=<lucide-react 패키지 폴더> bash parts/build.sh
set -e
cd "$(dirname "$0")/.."
SK=${SK:?"SK=<ui-proposal-board 스킬 폴더>"}
export PW=${PW:?"PW=<playwright 패키지 폴더>"}
LUCIDE=${LUCIDE:?"LUCIDE=<lucide-react 패키지 폴더>"}
rm -f .base.html && node "$SK/scripts/new_board.mjs" .base.html >/dev/null
python3 - <<'PY'
import re
base = open('.base.html').read()
head = base[:base.index('<style id="kit">')]
head = re.sub(r'<title>.*?</title>', '<title>링클 커뮤니티 재기획 — 화면 시안 · 2026-11-26</title>', head, count=1, flags=re.S)
fonts = ('<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">\n'
         '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Rhodium+Libre&amp;display=swap">\n')
head = head.replace('<style>', fonts + '<style>', 1)
head = re.sub(r'--bd-font:[^;]*;', '--bd-font: "Pretendard Variable", Pretendard, Inter, system-ui, sans-serif;', head, count=1)
kit = open('parts/kit.css').read()
body = open('parts/body.html').read()
strip = lambda s: re.sub(r'\s+data-pin(?:-[a-z]+)?="[^"]*"', '', s)
def screen(name, pins=True):
    s = open(f'parts/s/{name}.html').read()
    s = re.sub(r'<!--S0:([\w-]+)-->', lambda m: strip(screen(m.group(1))), s)
    return s if pins else strip(s)
phone = lambda inner, fid='', h=800: f'<div class="bd-frame-wrap"><div class="bd-frame phone"{fid}><div class="bd-status"><span>9:41</span><span class="island"></span><span class="bat"></span></div><div class="bd-screen" style="height:{h}px">{inner}</div></div></div>'
body = re.sub(r'<!--P:([\w-]+)(?::(\d+))?-->', lambda m: phone(screen(m.group(1)), f' id="f-{m.group(1)}"', int(m.group(2) or 800)), body)
body = re.sub(r'<!--P0:([\w-]+)-->', lambda m: phone(screen(m.group(1), False)), body)
body = re.sub(r'<!--IMG:([\w-]+)(?::(\d+))?-->', lambda m: phone(f'<img src="shots/{m.group(1)}.png" alt="">', '', int(m.group(2) or 800)), body)
open('board.html', 'w').write(head + '<style id="kit">\n' + kit + '</style>\n</head>\n<body>\n' + body + '\n')
PY
rm -f .base.html
node "$SK/scripts/icons.mjs" board.html --from "$LUCIDE"
node "$SK/scripts/place_pins.mjs" board.html || echo "(핀 경고가 있어요)"
node "$SK/scripts/check_board.mjs" board.html --out check --terms parts/terms.txt

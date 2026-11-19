"""글꼴에서 L 글자의 윤곽선을 꺼내, 96×96 칸의 정가운데에 놓는 SVG path를 만든다. usage: glyph.py <font.ttf>"""
import sys, json
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.boundsPen import BoundsPen
f = TTFont(sys.argv[1]); gs = f.getGlyphSet(); name = f.getBestCmap()[ord('L')]
bp = BoundsPen(gs); gs[name].draw(bp); x0, y0, x1, y1 = bp.bounds
pen = SVGPathPen(gs); gs[name].draw(pen)
S, H = 96, 44.0                      # 칸 크기, 글자 높이
k = H / (y1 - y0); w = (x1 - x0) * k
tx = (S - w) / 2 - x0 * k; ty = (S + H) / 2 + y0 * k   # y축을 뒤집는다
print(json.dumps({"upm": f['head'].unitsPerEm, "bounds": [x0, y0, x1, y1], "ink": [round((S - w) / 2, 2), round((S - H) / 2, 2), round(w, 2), H],
                  "transform": f"translate({tx:.3f} {ty:.3f}) scale({k:.5f} {-k:.5f})", "d": pen.getCommands()}))

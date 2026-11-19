"""학습된 모델을 웹용 파일로 내보내고, TypeScript 구현과 비교할 고정 예시를 만든다.
usage: export_web.py <models_dir> <data_dir> <V> <d> <out_model_dir> <out_fixture_json>

embed-v1.json: 어휘와 설정.  embed-v1.bin: 행별 눈금(float32 × V) 뒤에 토큰 벡터 표(int8 × V × d).
"""
import sys, json, numpy as np
from tokenizers import Tokenizer

models, data, V, d, out_dir, fixture = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4]), sys.argv[5], sys.argv[6]
MAX_TOKENS, LO, HI = 192, 0.27, 0.65

tok = Tokenizer.from_file(f"{models}/tok{V}.json")
Wq = np.load(f"{models}/student_{V}_{d}.int8.npy")
scale = np.load(f"{models}/student_{V}_{d}.scale.npy").astype("<f4").reshape(-1)
fit = json.load(open(f"{models}/student_{V}_{d}.json"))["fit"]
vocab = [t for t, _ in sorted(tok.get_vocab().items(), key=lambda kv: kv[1])]
assert len(vocab) == V == Wq.shape[0] and Wq.shape[1] == d

json.dump({"v": 1, "dim": d, "maxTokens": MAX_TOKENS, "maxWordChars": 40, "unk": "[UNK]", "prefix": "##",
           "fit": fit, "lo": LO, "hi": HI, "vocab": vocab},
          open(f"{out_dir}/embed-v1.json", "w"), ensure_ascii=False, separators=(",", ":"))
with open(f"{out_dir}/embed-v1.bin", "wb") as w:
    w.write(scale.tobytes()); w.write(Wq.astype("i1").tobytes())

# 고정 예시: 지난 실험의 문단 30개, 위키백과 문단 150개, 까다로운 문자열
texts = [v["text"] for v in json.load(open(f"{data}/leads_teacher.json")).values()]
with open(f"{data}/docs.jsonl") as f:
    for i, l in enumerate(f):
        if i >= 150: break
        texts.append(json.loads(l)["text"])
texts += [
    "", " ", "Hello, World! IT'S 2026.", "세종(世宗, 1397년 5월 7일 ~ 1450년)은 조선의 제4대 국왕이다.",
    "ＦＵＬＬ　ｗｉｄｔｈ　문자와 줄바꿈\n탭\t섞임", "가" * 45 + " 긴단어", "Ünïcödé ÀÉÎ straße ǅ", "$100 + 50% = <b>~^`|</b>",
    "ㅋㅋㅋ ㅠㅠ 한글자모", "日本語のテキスト と 中文文本", "a​b\u0000c�d\u0007e", "이모지 😀 테스트 🏁", "'따옴표' “둥근” «기메» — 대시…",
]

def encode(text):
    ids = tok.encode(text).ids[:MAX_TOKENS]
    v = (Wq[ids].astype(np.float32) * scale[ids][:, None]).sum(0) if ids else np.zeros(d, np.float32)
    n = np.linalg.norm(v)
    return ids, (v / n if n > 0 else v)

enc = [encode(t) for t in texts]
sims = [float(enc[i][1] @ enc[i + 1][1]) for i in range(len(enc) - 1)]
json.dump({"texts": texts, "ids": [e[0] for e in enc], "head": [[round(float(x), 6) for x in e[1][:6]] for e in enc],
           "sims": [round(s, 6) for s in sims]}, open(fixture, "w"), ensure_ascii=False, separators=(",", ":"))
print("vocab", V, "dim", d, "fit", fit, "fixtures", len(texts))

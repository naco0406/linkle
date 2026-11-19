"""위키백과 parquet에서 '제목: 첫 300자'를 뽑아 JSONL로 저장한다.
usage: prep.py <data_dir> <out_jsonl> <n_docs>
"""
import sys, glob, json, re, random
import pyarrow.parquet as pq

data_dir, out_path, n = sys.argv[1], sys.argv[2], int(sys.argv[3])
ws = re.compile(r"\s+")
rows = []
total = 0
for f in sorted(glob.glob(data_dir + "/20231101.ko/*.parquet")):
    t = pq.read_table(f, columns=["id", "title", "text"])
    ids, titles, texts = t["id"].to_pylist(), t["title"].to_pylist(), t["text"].to_pylist()
    for i, ti, tx in zip(ids, titles, texts):
        total += 1
        if "동음이의" in ti or ti.endswith("목록") or ti.startswith("목록"):
            continue
        body = ws.sub(" ", tx).strip()
        if len(body) < 150:
            continue
        # 본문 길이를 주목도의 대용으로 쓴다 (긴 문서일수록 게임에 나올 법한 문서)
        rows.append((int(i), ti, body[:300], len(tx)))
print("articles", total, "kept", len(rows), file=sys.stderr)

# 길이 상위 문서를 우선 포함: 상위 n*0.7 + 나머지에서 무작위 n*0.3
rows.sort(key=lambda r: -r[3])
head = rows[: int(n * 0.7)]
rest = rows[int(n * 0.7):]
random.seed(0)
tail = random.sample(rest, n - len(head))
pick = head + tail
random.shuffle(pick)
with open(out_path, "w") as w:
    for i, ti, lead, ln in pick:
        w.write(json.dumps({"id": i, "title": ti, "text": ti + ": " + lead, "len": ln}, ensure_ascii=False) + "\n")
print("wrote", len(pick), file=sys.stderr)

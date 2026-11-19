"""문단으로 WordPiece 어휘를 학습하고, 모든 문단을 토큰 id 배열로 저장한다.
usage: tok.py <docs.jsonl> <out_dir> <vocab_size> [extra_json ...]
"""
import sys, json, numpy as np
from tokenizers import Tokenizer, models, normalizers, pre_tokenizers, trainers

docs_path, out_dir, V = sys.argv[1], sys.argv[2], int(sys.argv[3])
texts = [json.loads(l)["text"] for l in open(docs_path)]
tok = Tokenizer(models.WordPiece(unk_token="[UNK]", max_input_chars_per_word=40))
# strip_accents=False: 한글이 자모로 풀리지 않게 한다
tok.normalizer = normalizers.BertNormalizer(clean_text=True, handle_chinese_chars=True, strip_accents=False, lowercase=True)
tok.pre_tokenizer = pre_tokenizers.BertPreTokenizer()
trainer = trainers.WordPieceTrainer(vocab_size=V, special_tokens=["[PAD]", "[UNK]"], min_frequency=3, continuing_subword_prefix="##")
tok.train_from_iterator(texts, trainer)
tok.save(f"{out_dir}/tok{V}.json")
L = 192
enc = tok.encode_batch(texts)
ids = np.zeros((len(texts), L), dtype=np.int32)
lens = []
for i, e in enumerate(enc):
    x = e.ids[:L]
    ids[i, : len(x)] = x
    lens.append(len(e.ids))
np.save(f"{out_dir}/ids{V}.npy", ids)
lens = np.array(lens)
unk = sum(e.ids.count(1) for e in enc) / lens.sum()
print(f"V={tok.get_vocab_size()} mean_len={lens.mean():.1f} p95={np.percentile(lens,95):.0f} unk_rate={unk:.4f}")
print(enc[0].tokens[:40])

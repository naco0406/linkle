// EmbeddingGemma(q4)로 문단 벡터를 만든다. 여러 프로세스로 나눠 돌린다.
// usage: node teacher.mjs <in_jsonl> <out_prefix> <shard> <nshards> [limit]
import { AutoModel, AutoTokenizer } from '@huggingface/transformers';
import fs from 'node:fs';
const [inPath, outPrefix, shardS, nS, limitS] = process.argv.slice(2);
const shard = +shardS, n = +nS, limit = limitS ? +limitS : Infinity;
const lines = fs.readFileSync(inPath, 'utf8').split('\n').filter(Boolean);
const mine = lines.map((l, i) => [i, l]).filter(([i]) => i % n === shard).slice(0, limit);
const id = 'onnx-community/embeddinggemma-300m-ONNX';
const tok = await AutoTokenizer.from_pretrained(id);
const model = await AutoModel.from_pretrained(id, { dtype: 'q4', session_options: { intraOpNumThreads: 2 } });
const B = 8, D = 768;
const out = fs.openSync(`${outPrefix}.${shard}.f32`, 'w');
const idx = fs.openSync(`${outPrefix}.${shard}.idx`, 'w');
const t0 = performance.now();
for (let s = 0; s < mine.length; s += B) {
  const batch = mine.slice(s, s + B);
  const texts = batch.map(([, l]) => 'task: sentence similarity | query: ' + JSON.parse(l).text);
  const inputs = await tok(texts, { padding: true, truncation: true, max_length: 256 });
  const { sentence_embedding } = await model(inputs);
  fs.writeSync(out, Buffer.from(new Float32Array(sentence_embedding.data).buffer));
  fs.writeSync(idx, batch.map(([i]) => i).join('\n') + '\n');
  if ((s / B) % 100 === 0) console.log(shard, s, mine.length, ((s + B) / ((performance.now() - t0) / 1000)).toFixed(1), 'docs/s');
}
console.log('done', shard, mine.length, ((performance.now() - t0) / 1000).toFixed(0), 's');

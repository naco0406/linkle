// 범용: jsonl의 text를 순서대로 임베딩해 f32로 저장. model=gemma|e5
import { AutoModel, AutoTokenizer, pipeline } from '@huggingface/transformers';
import fs from 'node:fs';
const [inPath, outPath, which, device, Bs] = process.argv.slice(2);
const B = +Bs;
const texts = fs.readFileSync(inPath, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l).text);
const out = fs.openSync(outPath, 'w');
let run;
if (which === 'e5') {
  const p = await pipeline('feature-extraction', 'Xenova/multilingual-e5-small', { dtype: 'q8', device });
  run = async (b) => (await p(b.map(t => 'query: ' + t), { pooling: 'mean', normalize: true })).data;
} else {
  const id = 'onnx-community/embeddinggemma-300m-ONNX';
  const tok = await AutoTokenizer.from_pretrained(id);
  const model = await AutoModel.from_pretrained(id, { dtype: 'q4', device });
  run = async (b) => (await model(await tok(b.map(t => 'task: sentence similarity | query: ' + t), { padding: true, truncation: true, max_length: 256 }))).sentence_embedding.data;
}
const t0 = performance.now();
for (let s = 0; s < texts.length; s += B) {
  fs.writeSync(out, Buffer.from(new Float32Array(await run(texts.slice(s, s + B))).buffer));
  if ((s / B) % 50 === 0) console.log(s, texts.length, ((s + B) / ((performance.now() - t0) / 1000)).toFixed(1), '/s');
}
console.log('done', texts.length, ((performance.now() - t0) / 1000).toFixed(0), 's');

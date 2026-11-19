// GPU로 문서 목록의 뒤쪽부터 거꾸로 처리한다 (CPU 프로세스는 앞에서부터).
import { AutoModel, AutoTokenizer } from '@huggingface/transformers';
import fs from 'node:fs';
const [inPath, outPrefix, stopS] = process.argv.slice(2);
const lines = fs.readFileSync(inPath, 'utf8').split('\n').filter(Boolean);
const id = 'onnx-community/embeddinggemma-300m-ONNX';
const tok = await AutoTokenizer.from_pretrained(id);
const model = await AutoModel.from_pretrained(id, { dtype: 'q4', device: 'webgpu' });
const B = 16;
const out = fs.openSync(`${outPrefix}.5.f32`, 'w'), idx = fs.openSync(`${outPrefix}.5.idx`, 'w');
const t0 = performance.now(); let n = 0;
for (let e = lines.length; e > +stopS; e -= B) {
  const ii = []; for (let i = e - 1; i >= Math.max(e - B, 0); i--) ii.push(i);
  const texts = ii.map(i => 'task: sentence similarity | query: ' + JSON.parse(lines[i]).text);
  const inputs = await tok(texts, { padding: true, truncation: true, max_length: 256 });
  const { sentence_embedding } = await model(inputs);
  fs.writeSync(out, Buffer.from(new Float32Array(sentence_embedding.data).buffer));
  fs.writeSync(idx, ii.join('\n') + '\n');
  n += ii.length; if ((n / B) % 100 === 0) console.log(n, (n / ((performance.now() - t0) / 1000)).toFixed(1), 'docs/s');
}
console.log('done', n);

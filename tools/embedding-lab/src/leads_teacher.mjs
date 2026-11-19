// 지난 실험의 예시 30개(leads.json)를 같은 큰 모델로 임베딩해 저장한다.
// usage: node leads_teacher.mjs <leads.json> <out.json>
import { AutoModel, AutoTokenizer } from '@huggingface/transformers';
import fs from 'node:fs';
const [inPath, outPath] = process.argv.slice(2);
const leads = JSON.parse(fs.readFileSync(inPath, 'utf8'));
const id = 'onnx-community/embeddinggemma-300m-ONNX';
const tok = await AutoTokenizer.from_pretrained(id);
const model = await AutoModel.from_pretrained(id, { dtype: 'q4' });
const out = {};
for (const [k, text] of Object.entries(leads)) {
  const inputs = await tok(['task: sentence similarity | query: ' + text], { padding: true, truncation: true, max_length: 256 });
  const { sentence_embedding } = await model(inputs);
  out[k] = { text, vec: Array.from(sentence_embedding.data) };
}
fs.writeFileSync(outPath, JSON.stringify(out));
console.log('ok', Object.keys(out).length);

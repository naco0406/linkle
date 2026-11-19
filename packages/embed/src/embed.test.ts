import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { cosine, embed, loadModel, makeLead, score, tokenize, type ModelMeta } from './index.ts'

const here = (p: string) => new URL(p, import.meta.url)
const meta = JSON.parse(readFileSync(here('../model/embed-v1.json'), 'utf8')) as ModelMeta
const binFile = readFileSync(here('../model/embed-v1.bin'))
const bin = binFile.buffer.slice(binFile.byteOffset, binFile.byteOffset + binFile.byteLength) as ArrayBuffer
const model = loadModel(meta, bin)

// 파이썬(tokenizers + numpy)으로 만든 결과. tools/embedding-lab/src/export_web.py
const parity = JSON.parse(readFileSync(here('./fixtures/parity.json'), 'utf8')) as {
  texts: string[]; ids: number[][]; head: number[][]; sims: number[]
}

describe('파이썬 구현과의 일치', () => {
  it('토큰 id가 모든 예시에서 같다', () => {
    const diff = parity.texts
      .map((t, i) => ({ i, t, got: tokenize(t, model.vocab, meta.maxTokens), want: parity.ids[i]! }))
      .filter(r => r.got.join(',') !== r.want.join(','))
    expect(diff.map(r => ({ i: r.i, text: r.t.slice(0, 40) }))).toEqual([])
  })

  it('벡터가 같다', () => {
    parity.texts.forEach((t, i) => {
      const v = embed(model, t)
      parity.head[i]!.forEach((x, k) => expect(v[k]!).toBeCloseTo(x, 4))
    })
  })

  it('유사도가 같다', () => {
    const vs = parity.texts.map(t => embed(model, t))
    parity.sims.forEach((s, i) => expect(cosine(vs[i]!, vs[i + 1]!)).toBeCloseTo(s, 4))
  })
})

describe('유사도', () => {
  const lead = (t: string) => parity.texts.find(x => x.startsWith(t + ':'))!
  it('뉴발란스에는 나이키가 불고기보다 가깝다', () => {
    const [nike, shoes, bulgogi] = score(model, lead('뉴발란스'), [lead('나이키'), lead('신발'), lead('불고기')])
    expect(nike!).toBeGreaterThan(shoes!)
    expect(shoes!).toBeGreaterThan(bulgogi!)
  })
  it('점수는 0과 1 사이다', () => {
    for (const s of score(model, lead('세종'), parity.texts.slice(0, 30))) {
      expect(s).toBeGreaterThanOrEqual(0)
      expect(s).toBeLessThanOrEqual(1)
    }
  })
  it('빈 문단도 오류 없이 처리한다', () => {
    expect(Array.from(embed(model, '')).every(x => x === 0)).toBe(true)
    expect(score(model, '', ['불고기'])[0]).toBeGreaterThanOrEqual(0)
  })
})

describe('문단 형식', () => {
  it('제목 뒤에 본문 앞 300자를 붙이고 공백을 정리한다', () => {
    expect(makeLead('불고기', '  불고기는\n한국 요리다.  ')).toBe('불고기: 불고기는 한국 요리다.')
    expect(makeLead('가', '나'.repeat(500))).toHaveLength(3 + 300)
  })
})

import { tokenize, type Vocab } from './tokenize.ts'

/** embed-v1.json의 내용 */
export type ModelMeta = {
  v: 1
  dim: number
  maxTokens: number
  maxWordChars: number
  unk: string
  prefix: string
  /** 초소형 모델의 값을 큰 모델 눈금으로 옮기는 일차식 [a, b] */
  fit: [number, number]
  /** 큰 모델 눈금에서 🟥의 바닥과 🟦의 천장 */
  lo: number
  hi: number
  vocab: string[]
}

export type EmbedModel = {
  meta: ModelMeta
  vocab: Vocab
  /** 행마다의 눈금 */
  scale: Float32Array
  /** 토큰 벡터 표. 차원당 1바이트 */
  table: Int8Array
}

/** bin: 행별 눈금(float32 × V) 뒤에 토큰 벡터 표(int8 × V × dim) */
export function loadModel(meta: ModelMeta, bin: ArrayBuffer): EmbedModel {
  const V = meta.vocab.length
  if (bin.byteLength !== V * 4 + V * meta.dim) throw new Error('embed model: size mismatch')
  const ids = new Map<string, number>()
  meta.vocab.forEach((t, i) => ids.set(t, i))
  const unkId = ids.get(meta.unk)
  if (unkId === undefined) throw new Error('embed model: no unk token')
  return {
    meta,
    vocab: { ids, unkId, prefix: meta.prefix, maxWordChars: meta.maxWordChars },
    scale: new Float32Array(bin.slice(0, V * 4)),
    table: new Int8Array(bin, V * 4, V * meta.dim),
  }
}

/** 문단을 길이 1인 벡터로 바꾼다. 토큰 벡터를 더하기만 한다 */
export function embed(model: EmbedModel, text: string): Float32Array {
  const { dim, maxTokens } = model.meta
  const v = new Float32Array(dim)
  for (const id of tokenize(text, model.vocab, maxTokens)) {
    const s = model.scale[id]!
    const base = id * dim
    for (let k = 0; k < dim; k++) v[k]! += model.table[base + k]! * s
  }
  let norm = 0
  for (let k = 0; k < dim; k++) norm += v[k]! * v[k]!
  norm = Math.sqrt(norm)
  if (norm > 0) for (let k = 0; k < dim; k++) v[k]! /= norm
  return v
}

export function cosine(a: Float32Array, b: Float32Array): number {
  let s = 0
  for (let k = 0; k < a.length; k++) s += a[k]! * b[k]!
  return s
}

/** 두 벡터의 유사도를 0~1로 편 값. 0.2 단위가 색 한 칸이다 */
export function score01(model: EmbedModel, a: Float32Array, b: Float32Array): number {
  const { fit, lo, hi } = model.meta
  const onTeacherScale = fit[0] * cosine(a, b) + fit[1]
  return Math.min(1, Math.max(0, (onTeacherScale - lo) / (hi - lo)))
}

/** 도착 문서의 문단과 각 문서의 문단 사이의 유사도 (0~1) */
export function score(model: EmbedModel, target: string, pages: readonly string[]): number[] {
  const t = embed(model, target)
  return pages.map(p => score01(model, t, embed(model, p)))
}

/** 모델에 넣는 문단의 형식. 학습 때와 같아야 한다 */
export function makeLead(title: string, body: string): string {
  return `${title}: ${body.replace(/\s+/g, ' ').trim().slice(0, 300)}`
}

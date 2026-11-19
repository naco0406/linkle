// 학습에 쓴 토크나이저(tokenizers 라이브러리의 BertNormalizer + BertPreTokenizer + WordPiece)와
// 같은 결과를 내야 한다. 고정 예시(fixtures/parity.json)로 일치를 확인한다.

export type Vocab = {
  ids: Map<string, number>
  unkId: number
  prefix: string
  maxWordChars: number
}

const CONTROL = /\p{C}/u
const SPACE = /\p{White_Space}/u
const PUNCT = /[!-/:-@[-`{-~]|\p{P}/u

function isCjkIdeograph(cp: number): boolean {
  return (
    (cp >= 0x4e00 && cp <= 0x9fff) || (cp >= 0x3400 && cp <= 0x4dbf) || (cp >= 0x20000 && cp <= 0x2a6df) ||
    (cp >= 0x2a700 && cp <= 0x2b73f) || (cp >= 0x2b740 && cp <= 0x2b81f) || (cp >= 0x2b920 && cp <= 0x2ceaf) ||
    (cp >= 0xf900 && cp <= 0xfaff) || (cp >= 0x2f800 && cp <= 0x2fa1f)
  )
}

/** 제어 문자를 지우고, 공백을 하나의 종류로 맞추고, 한자 앞뒤를 띄우고, 소문자로 바꾼다 */
export function normalize(text: string): string {
  let out = ''
  for (const ch of text) {
    const cp = ch.codePointAt(0)!
    if (cp === 0 || cp === 0xfffd) continue
    if (ch === '\t' || ch === '\n' || ch === '\r') out += ' '
    else if (CONTROL.test(ch)) continue
    else if (SPACE.test(ch)) out += ' '
    else if (isCjkIdeograph(cp)) out += ` ${ch} `
    else out += ch
  }
  return out.toLowerCase()
}

/** 공백으로 나누고, 문장 부호는 글자 하나씩 떼어 낸다 */
export function preTokenize(text: string): string[] {
  const words: string[] = []
  let cur = ''
  const flush = () => {
    if (cur) words.push(cur)
    cur = ''
  }
  for (const ch of text) {
    if (SPACE.test(ch)) flush()
    else if (PUNCT.test(ch)) {
      flush()
      words.push(ch)
    } else cur += ch
  }
  flush()
  return words
}

/** 어휘에서 가장 긴 조각부터 맞춰 나간다. 한 조각이라도 없으면 단어 전체가 [UNK]다 */
export function wordPiece(word: string, vocab: Vocab, out: number[]): void {
  const chars = Array.from(word)
  if (chars.length > vocab.maxWordChars) {
    out.push(vocab.unkId)
    return
  }
  const pieces: number[] = []
  let start = 0
  while (start < chars.length) {
    let end = chars.length
    let found = -1
    while (start < end) {
      const piece = (start > 0 ? vocab.prefix : '') + chars.slice(start, end).join('')
      const id = vocab.ids.get(piece)
      if (id !== undefined) {
        found = id
        break
      }
      end--
    }
    if (found < 0) {
      out.push(vocab.unkId)
      return
    }
    pieces.push(found)
    start = end
  }
  for (const id of pieces) out.push(id)
}

export function tokenize(text: string, vocab: Vocab, maxTokens: number): number[] {
  const out: number[] = []
  for (const word of preTokenize(normalize(text))) {
    wordPiece(word, vocab, out)
    if (out.length >= maxTokens) break
  }
  return out.length > maxTokens ? out.slice(0, maxTokens) : out
}

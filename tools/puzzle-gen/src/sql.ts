import { createReadStream } from 'node:fs'
import { createInterface } from 'node:readline'
import { createGunzip } from 'node:zlib'

// MediaWiki SQL 덤프(.sql.gz)를 한 행씩 읽는다.
// 줄 단위로 읽어 값 목록을 풀어 넣는다.

export type Value = string | number | null

/** 행마다 부른다. 같은 배열을 계속 다시 쓰므로 그 자리에서 읽고 버려야 한다 */
export type OnRow = (row: Value[], col: Record<string, number>) => void

const ESC: Record<string, string> = { n: '\n', r: '\r', t: '\t', '0': '\0', Z: '\x1a' }

/**
 * 한 줄(INSERT ... VALUES (...),(...);)의 값들을 푼다. 시작 위치는 첫 '(' 앞이다.
 * 문자열은 작은따옴표와 백슬래시 이스케이프, 숫자는 그대로, NULL은 null.
 */
export function parseValues(line: string, start: number, row: Value[], emit: () => void): void {
  const n = line.length
  let i = start
  while (i < n) {
    if (line.charCodeAt(i) !== 40 /* ( */) {
      i++
      continue
    }
    i++
    row.length = 0
    for (;;) {
      const c = line.charCodeAt(i)
      if (c === 39 /* ' */) {
        i++
        let s = ''
        let from = i
        for (;;) {
          const d = line.charCodeAt(i)
          if (d === 92 /* \ */) {
            s += line.slice(from, i)
            const e = line[i + 1]!
            s += ESC[e] ?? e
            i += 2
            from = i
          } else if (d === 39) {
            s += line.slice(from, i)
            i++
            break
          } else i++
        }
        row.push(s)
      } else if (c === 78 /* N */ && line.startsWith('NULL', i)) {
        row.push(null)
        i += 4
      } else {
        let j = i
        while (j < n) {
          const d = line.charCodeAt(j)
          if (d === 44 /* , */ || d === 41 /* ) */) break
          j++
        }
        row.push(Number(line.slice(i, j)))
        i = j
      }
      const sep = line.charCodeAt(i)
      i++
      if (sep === 41) break
    }
    emit()
  }
}

/** CREATE TABLE에서 열 이름을 순서대로 읽는다 */
export function columnsOf(createTable: string): Record<string, number> {
  const col: Record<string, number> = {}
  let k = 0
  for (const m of createTable.matchAll(/^\s+`(\w+)`\s/gm)) col[m[1]!] = k++
  return col
}

export async function scanDump(file: string, onRow: OnRow): Promise<number> {
  const lines = createInterface({ input: createReadStream(file).pipe(createGunzip()), crlfDelay: Infinity })
  let create = ''
  let inCreate = false
  let col: Record<string, number> = {}
  let rows = 0
  const row: Value[] = []
  const emit = () => {
    rows++
    onRow(row, col)
  }
  for await (const line of lines) {
    if (line.startsWith('CREATE TABLE')) {
      inCreate = true
      create = ''
    }
    if (inCreate) {
      create += line + '\n'
      if (line.startsWith(')')) {
        inCreate = false
        col = columnsOf(create)
      }
      continue
    }
    // 예전 덤프는 INSERT 한 줄에 행을 모두 썼고, 지금 덤프는 INSERT 다음 줄부터 행마다 한 줄씩 쓴다. 둘 다 받는다
    if (line.startsWith('INSERT INTO')) parseValues(line, line.indexOf('VALUES') + 6, row, emit)
    else if (line.charCodeAt(0) === 40 /* ( */) parseValues(line, 0, row, emit)
  }
  return rows
}

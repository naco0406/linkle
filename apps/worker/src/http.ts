/** 4xx로 끝낼 요청. code가 그대로 `{ error: code }`로 나간다 */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly detail?: string,
  ) {
    super(code)
  }
}

/** API 응답은 캐시하지 않는다. 서버 시각과 완료 인원이 매번 달라진다 */
export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })

/**
 * 본문을 JSON으로 읽는다. 상한을 넘으면 끝까지 읽지 않고 그만둔다.
 * 큰 본문을 읽고 풀어 보는 것만으로 요청당 CPU 10 ms를 쓸 수 있기 때문이다.
 */
export async function readJson(request: Request, maxBytes: number): Promise<unknown> {
  if (Number(request.headers.get('content-length') ?? 0) > maxBytes) throw new HttpError(413, 'too_large')
  const reader = request.body?.getReader()
  if (!reader) throw new HttpError(400, 'invalid_json')
  const bytes = new Uint8Array(maxBytes)
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    if (size + value.byteLength > maxBytes) {
      void reader.cancel()
      throw new HttpError(413, 'too_large')
    }
    bytes.set(value, size)
    size += value.byteLength
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes.subarray(0, size)))
  } catch {
    throw new HttpError(400, 'invalid_json')
  }
}

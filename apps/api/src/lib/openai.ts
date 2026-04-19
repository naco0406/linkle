import { z } from 'zod';
import { openAiReasonEntrySchema, type OpenAiReasonEntry } from '@linkle/shared';

/**
 * Thin wrapper around the OpenAI Chat Completions API, scoped to the one
 * thing we need: per-word semantic similarity scores against a reference.
 *
 * We keep the call in-band (the submit endpoint blocks on this) because the
 * UX goal is "emoji strip appears on the done screen immediately". Cloudflare
 * Workers have plenty of headroom for a ~3s GPT-5.4-mini round-trip.
 *
 * On timeout or any hard error we throw; the caller decides how to degrade
 * (typically: persist the ranking without emoji and tell the client `null`).
 */

export interface ScoreOptions {
  readonly apiKey: string;
  readonly model: string;
  readonly timeoutMs?: number;
}

const payloadSchema = z.object({
  results: z.array(openAiReasonEntrySchema),
});

export async function scoreSimilarity(
  referenceWord: string,
  words: readonly string[],
  { apiKey, model, timeoutMs = 15_000 }: ScoreOptions,
): Promise<OpenAiReasonEntry[]> {
  if (words.length === 0) return [];

  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        response_format: { type: 'json_object' },
        temperature: 0.3,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: renderUserMessage(referenceWord, words) },
        ],
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new OpenAiError(`OpenAI ${String(res.status)}: ${body.slice(0, 200)}`);
    }

    const raw: { choices?: { message?: { content?: string } }[] } = await res.json();
    const content = raw.choices?.[0]?.message?.content;
    if (!content) throw new OpenAiError('OpenAI response missing content');

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch (err) {
      throw new OpenAiError(
        `OpenAI response was not JSON: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    const validated = payloadSchema.safeParse(parsed);
    if (!validated.success) {
      throw new OpenAiError(
        `OpenAI JSON did not match schema: ${validated.error.issues.map((i) => i.message).join('; ')}`,
      );
    }

    if (validated.data.results.length !== words.length) {
      throw new OpenAiError(
        `OpenAI returned ${String(validated.data.results.length)} entries, expected ${String(words.length)}`,
      );
    }

    return validated.data.results;
  } finally {
    clearTimeout(timer);
  }
}

export class OpenAiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OpenAiError';
  }
}

// ─── prompt ───────────────────────────────────────────────────────────────

function renderUserMessage(referenceWord: string, words: readonly string[]): string {
  const list = words.map((w, i) => `  ${String(i)}: ${w}`).join('\n');
  return `참조 단어: "${referenceWord}"\n\n비교 단어 (입력 순서 유지):\n${list}`;
}

const SYSTEM_PROMPT = `당신은 한국어 단어/어구 사이의 깊은 의미·문맥적 유사도를 평가하는 전문가입니다.

주어진 참조 단어 하나와 비교 단어 목록을 받으면, 각 비교 단어가 참조 단어와 얼마나 의미적으로 가까운지 0 과 1 사이의 소수로 평가하고 그 이유를 한국어 한 문장으로 요약합니다.

### 출력 형식
반드시 다음 JSON 스키마를 만족하는 객체 하나만 반환합니다:

{
  "results": [
    {
      "index": <정수, 0부터 시작>,
      "word": "<입력 단어를 그대로 복사>",
      "similarity": <0 이상 1 이하의 소수>,
      "reason": "<한 문장 한국어 설명>"
    },
    ...
  ]
}

### 유사도 기준
- 1.0  — 동일하거나 매우 높은 의미적 일치
- 0.8 ~ 0.99 — 매우 강한 주제적·개념적 연결
- 0.6 ~ 0.79 — 분명한 주제적 연관
- 0.4 ~ 0.59 — 중간 수준의 연관, 간접 관계
- 0.2 ~ 0.39 — 약한 연관, 주변부 연결
- 0.01 ~ 0.19 — 매우 약한 연관
- 0.0  — 의미적 연관 없음

### 평가 고려 요소
- 주제·개념·범주의 포함 관계
- 역사적·문화적·사회적 맥락
- 인물·사건의 동시대성, 공통된 활동 영역
- 어원·언어적 연결

### 필수 규칙
1. 입력 순서와 개수를 반드시 유지
2. word 필드는 입력 단어를 토씨도 바꾸지 말고 그대로 복사
3. reason 은 간결한 한 문장 한국어
4. JSON 이외의 텍스트 금지
5. 비한국어 단어가 섞여 있어도 동일 기준으로 평가`;

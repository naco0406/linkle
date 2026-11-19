# embedding-lab

초소형 한국어 임베딩 모델 실험(2026-11-19). 결과와 해석은 `docs/DESIGN.md` 14.5에 있다.

## 들어 있는 것

| 경로 | 내용 |
|---|---|
| `models/student_16000_128.*`, `tok16000.json` | 2.0 MB 모델 (어휘 1.6만 × 128차원, 차원당 1바이트) |
| `models/student_32000_256.*`, `tok32000.json` | 8.2 MB 모델 (어휘 3.2만 × 256차원) |
| `data/` | 기준 벡터와 문단. git에 올리지 않는다 (약 560 MB) |
| `src/` | 아래 순서로 실행하는 스크립트 |

모델 파일: `*.int8.npy`는 토큰 벡터 표, `*.scale.npy`는 행마다의 눈금, `*.json`의 `fit`은 큰 모델 눈금으로 옮기는 보정 계수 `[a, b]`다.

문서 벡터 = 토큰 벡터(`int8 × scale`)의 합을 길이 1로 맞춘 것. 유사도 = 두 벡터의 내적 × a + b.

## 다시 돌리는 순서

1. 한국어 위키백과 데이터(`wikimedia/wikipedia`, `20231101.ko`)를 받는다.
2. `prep.py <data_dir> docs.jsonl 120000`: 문서마다 "제목: 첫 300자"를 뽑는다.
3. `teacher.mjs`(CPU, 5개로 나눠 실행)와 `teacher_gpu.mjs`(WebGPU): EmbeddingGemma 300m(q4)로 기준 벡터를 만든다. `@huggingface/transformers` 4.x가 필요하다. M5에서 합쳐 초당 약 20문서.
4. `tok.py docs.jsonl <out> 16000`: WordPiece 어휘와 토큰 id 배열.
5. `gen_embed.mjs tokens16000.jsonl tokvec16000.f32 gemma webgpu 64`: 토큰 하나씩의 벡터(초기값).
6. `train.py <out> <out>/teacher 16000:128:999999 --epochs 12 --init --lr 0.002 --save 16000:128`: 학습과 평가.

문서 목록의 앞 6,000개는 평가, 다음 3,000개는 보정에만 쓰고 학습에서 뺀다.

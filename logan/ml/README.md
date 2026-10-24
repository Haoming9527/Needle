# Needle local decision layer / 로컬 판단 계층

Review-branch delivery (`codex/logan-decision-review`): the module and adapter are ready for review; merging and calling them from HM/Ryan's existing flows are separate integration steps.

검토 브랜치 결과물입니다. 모듈·어댑터를 검토할 수 있으며 병합과 HM/Ryan 기존 흐름에서의 호출은 별도 연동 단계입니다.

The default `small` backend is a working local text classifier and semantic ranker. It takes **already extracted evidence plus the selected target product**. It does not download videos, transcribe audio, run OCR, identify visual products or collect browser data. HM supplies capture/extracted evidence; Logan supplies matching/routing; Ryan owns seller intent and dashboards.

기본 `small` 백엔드는 로컬 텍스트 분류기·의미 기반 정렬기입니다. **이미 추출된 근거와 선택한 대상 상품**을 입력받습니다. 영상 다운로드·음성 전사·OCR·시각적 상품 식별·브라우저 수집은 수행하지 않습니다. HM은 캡처·추출 근거, Logan은 매칭·분기, Ryan은 셀러 의도·대시보드를 담당합니다.

```text
HM: capture → transcript / OCR / vision description + selected product
                               ↓
                  Logan: local decision service
        ┌──────────────────────┼──────────────────────┐
   review_analysis       product_search             clarify
  attribute evidence     existing /discover      existing /clarify
        ↓                       ↓                      ↓
   consumer evidence/search flow → Ryan's separate intent collection
```

Review analysis applies to content evaluating the selected target. A product appearing in unrelated content should take the search route; appearance is not endorsement. Missing/ambiguous targets require clarification. These are model decisions, not guaranteed detections.

리뷰 분기는 선택 상품을 평가하는 내용에 사용합니다. 무관한 콘텐츠에 상품이 등장하면 검색으로 보내며 단순 노출을 추천·긍정 평가로 해석하지 않습니다. 대상이 없거나 모호하면 추가 확인합니다. 모델 판단이므로 항상 정확한 탐지는 아닙니다.

## Run / 실행

Commands run from the repository root. Tested on Apple M2, 16 GB, Python 3.12; packages are pinned in `requirements.txt`.

저장소 루트 기준입니다. Apple M2·16GB·Python 3.12에서 확인했으며 패키지는 `requirements.txt`에 고정했습니다.

```sh
python3.12 -m venv .needle-ml
.needle-ml/bin/python -m pip install -r logan/ml/requirements.txt
.needle-ml/bin/python logan/ml/prepare.py
.needle-ml/bin/python logan/ml/service.py --backend small --port 4321
```

`prepare.py` downloads [multilingual-e5-small](https://huggingface.co/intfloat/multilingual-e5-small) revision `614241f622f53c4eeff9890bdc4f31cfecc418b3` into `.needle-cache/e5`. Base files are about 493 MB; trained Needle heads are 316,774 bytes. Download needs internet; inference needs no network/API key. Committed heads are ready, so retraining is optional. MPS is automatic on supported Macs; use `--device cpu` otherwise. CPU speed was not benchmarked.

`prepare.py`는 위 고정 리비전을 `.needle-cache/e5`에 받습니다. 기반 파일은 약 493MB, 학습된 Needle 헤드는 316,774바이트입니다. 다운로드에는 인터넷이 필요하지만 추론에는 네트워크·API 키가 필요 없습니다. 포함된 헤드를 바로 사용하므로 재학습은 선택 사항입니다. 지원 Mac은 MPS를 자동 사용하며 그 외에는 `--device cpu`를 사용합니다. CPU 속도는 측정하지 않았습니다.

In another terminal / 별도 터미널:

```sh
curl http://127.0.0.1:4321/health
curl -X POST http://127.0.0.1:4321/v1/decide \
  -H 'Content-Type: application/json' \
  -d '{"text":"I tested these headphones for two weeks. They are comfortable but the controls are inconvenient.","target":{"name":"headphones"},"sourceKind":"transcript","requestId":"demo-1"}'
```

Direct diagnostic inference without HTTP / HTTP 없는 진단용 직접 추론:

This CLI applies model confidence gates, but bypasses HTTP missing-target/context guards. Its result is not the complete serving policy; use `/v1/decide` for integration checks.

이 CLI는 모델의 점수 임계값을 적용하지만 HTTP의 대상 누락·문맥 초과 규칙은 거치지 않습니다. 전체 서비스 정책의 결과가 아니므로 연동 검사는 `/v1/decide`를 사용하세요.

```sh
.needle-ml/bin/python logan/ml/small_model.py predict \
  --product headphones \
  --text 'I tested these headphones for two weeks. They are comfortable.'
```

## HTTP contract / HTTP 계약

The server binds to `127.0.0.1`. Call from the existing backend using `../decision-client.mjs`; this is not a public cross-origin browser API. JSON bodies are limited to 64,000 bytes. On failure, preserve existing behavior. `NEEDLE_DECISION_URL` defaults to `http://127.0.0.1:4321`; the JS client also accepts a `baseUrl` option.

서버는 `127.0.0.1`에 바인딩합니다. 기존 백엔드에서 `../decision-client.mjs`로 호출하며 공개 교차 출처 브라우저 API가 아닙니다. JSON 본문은 64,000바이트까지입니다. 실패 시 기존 동작을 유지하세요. `NEEDLE_DECISION_URL` 기본값은 `http://127.0.0.1:4321`이며 JS의 `baseUrl` 옵션도 지원합니다.

### `POST /v1/decide`

| Field / 필드 | Contract / 계약 |
| --- | --- |
| `text` | Extracted evidence, 1–12,000 characters / 추출 근거 1–12,000자 |
| `target.name` | Selected product name, up to 300 characters; blank forces clarification / 선택 상품명 최대 300자, 없으면 추가 확인 |
| `sourceKind` | `text`, `transcript`, `ocr`, `vision_description`; metadata only, no extraction performed / 추출 방식 표시이며 추출 실행 아님 |
| `requestId` | Optional ID, returned up to 100 characters / 선택 요청 ID, 최대 100자 반환 |

Response: `route`, `raw_route`, `scores`, `confidence`, `abstained`, `attributes`, `next_action`, `cache_hit` and timing. Scores are uncalibrated; they are not purchase probabilities. The service caches up to 128 identical text/target pairs. Missing targets or excess context force `clarify`: **256 tokens for E5**, **128 for the delivered CLM configuration**. Accepted character count does not imply the whole input fits the model.

응답에는 분기·원시 분기·점수·추가 확인 여부·속성·다음 동작·캐시 여부·시간이 포함됩니다. 점수는 확률 보정되지 않았으며 구매 확률이 아닙니다. 동일 텍스트·상품 쌍을 최대 128개 캐시합니다. 대상 누락·문맥 초과 시 `clarify`로 보내며 한도는 **E5 256토큰**, **제공 CLM 구성 128토큰**입니다. 입력 글자 수 허용이 모델에 모두 들어간다는 뜻은 아닙니다.

| Route / 분기 | `next_action` |
| --- | --- |
| `review_analysis` | `analyze_target_review_evidence` / 대상 리뷰의 속성 근거 제안 |
| `product_search` | `call_existing_needle_discover` / 원래 선택 정보를 유지해 기존 검색 호출 |
| `clarify` | `request_target_or_better_capture` / 기존 추가 질문 유지 |

Review attributes can contain `name`, `polarity`, original source-sentence `quote`, `score`, and `target_grounding: "model_inferred_unverified"`. Six attributes: price, design, convenience, performance, durability, comfort. Empty output does not prove absence of relevant opinions. Entity association, sarcasm and mixed polarity remain unreliable.

리뷰 속성은 이름·극성·원문 문장 인용·점수·`target_grounding: "model_inferred_unverified"`를 포함할 수 있습니다. 속성은 가격·미감·편의성·성능·내구성·착용감입니다. 빈 결과가 관련 의견이 없다는 증거는 아닙니다. 다른 상품과의 구분·반어법·혼합 감정에는 취약합니다.

### `POST /v1/rank` — small backend only / small 전용

```json
{
  "query": "comfortable headphones for travel",
  "candidates": [
    {"id": "evidence-1", "text": "Comfortable on a long flight."},
    {"id": "evidence-2", "text": "A recipe for tomato soup."}
  ]
}
```

Query: up to 2,000 characters. Candidates: up to 50, with unique nonempty IDs. `text`, `description`, then `title` is used in priority order. Returns original IDs, cosine `semantic_score` and `fine_tuned_retrieval: false`. This ranks supplied evidence, not internet results, verified identity, creator ROI or intent. Preserve provenance, offer IDs, prices and exact/likely/similar tiers; do not reorder saved checkout sessions.

질의는 최대 2,000자, 후보는 고유한 비어 있지 않은 ID를 가진 최대 50개입니다. `text` → `description` → `title` 순으로 사용합니다. 원래 ID·코사인 점수·`fine_tuned_retrieval: false`를 반환합니다. 전달된 근거의 관련도이며 인터넷 검색·동일성 확정·크리에이터 ROI·의도 예측이 아닙니다. 출처·상품 ID·가격·동일 상품 등급을 보존하고 저장된 결제 세션은 재정렬하지 마세요.

## Reproduce / 재현

Only classification heads are trained on frozen E5 embeddings. This is **head fine-tuning**, not full E5/8B training. Reproduce in a separate directory to preserve the delivered heads:

고정 E5 임베딩 위의 분류 헤드만 학습합니다. **헤드 파인튜닝**이며 E5/8B 전체 학습이 아닙니다. 제공 헤드를 보존하려면 별도 폴더에서 재현하세요.

```sh
.needle-ml/bin/python logan/ml/small_model.py train \
  --train logan/ml/data/train.jsonl \
  --validation logan/ml/data/validation.jsonl \
  --attributes-train logan/ml/data/attributes_train.jsonl \
  --output /tmp/needle-e5-reproduction
.needle-ml/bin/python logan/ml/small_model.py evaluate \
  --evaluation logan/ml/data/eval_handwritten.jsonl \
  --output /tmp/needle-e5-reproduction \
  --report /tmp/needle-e5-repeat-evaluation.json
```

The evaluation CLI refuses to overwrite existing reports unless explicitly overridden. Preserve the first committed evaluation; do not tune on its 60 examples or describe repeated use as a new untouched test. `test_service.py` tests the small HTTP backend at 4321 and also refuses to overwrite its existing report; see `reports/service_evaluation.json` for the completed run.

평가 CLI는 명시적 옵션 없이는 보고서를 덮어쓰지 않습니다. 최초 커밋된 평가를 보존하고 그 60개로 튜닝하거나 반복 사용을 새로운 미사용 평가라고 표현하지 마세요. `test_service.py`는 4321의 small HTTP 백엔드를 검사하며 기존 보고서도 덮어쓰지 않습니다. 완료 결과는 `reports/service_evaluation.json`입니다.

The original BM25/lexicon baseline is `../algorithm.mjs`. The model-card zero-shot comparator is **E5 similarity to three action descriptions**, not BM25. See [MODEL_CARD.md](MODEL_CARD.md) for splits, measurements and limitations.

기존 BM25·사전 기준선은 `../algorithm.mjs`입니다. 모델 카드의 zero-shot 비교는 **E5와 세 행동 설명의 유사도**이며 BM25가 아닙니다. 분할·측정·한계는 [MODEL_CARD.md](MODEL_CARD.md)를 확인하세요.

## Experimental CLM backend / 실험용 CLM 백엔드

`clm_model.py` and `service.py --backend clm` provide a separate optional route path whose local training, held-out evaluation and HTTP smoke test are complete. Only the final state/action projection layers were fine-tuned: 1,573,888 parameters, a 6,296,040-byte artifact. The 4-bit Qwen3-8B encoder and earlier head layers remain frozen. This is partial-head fine-tuning, not full 8B training. Default remains `small`, which was more accurate and faster in this experiment.

`clm_model.py`와 `service.py --backend clm`은 로컬 학습·미사용 평가·HTTP 실행 검사를 완료한 별도 선택형 분기 경로입니다. 마지막 상태/행동 투영층 1,573,888개 파라미터만 학습했고 결과물은 6,296,040바이트입니다. 4비트 Qwen3-8B 인코더와 앞쪽 헤드는 고정했습니다. 8B 전체가 아닌 부분 헤드 파인튜닝입니다. 이번 실험에서 더 정확하고 빨랐던 `small`을 기본값으로 유지합니다.

Training used a deterministic 120-row subset, validation 72 rows and the frozen synthetic 60-row evaluation. Original CLM heads scored 38/60 (63.3%); trained raw heads 42/60 (70.0%); gated serving policy 41/60 (68.3%). Warm uncached inference: p50 1,718.00 ms, p95 2,066.36 ms. The separate repeated-embedding RAM-cache benchmark was p50 1.32 ms; this is not new-input inference speed. See [CLM evaluation](reports/clm_evaluation.json) and [model card](MODEL_CARD.md).

결정적으로 선택한 학습 120개·검증 72개·고정 합성 평가 60개를 사용했습니다. 원본 CLM 헤드 38/60(63.3%), 학습 후 원시 헤드 42/60(70.0%), 임계값 적용 서비스 정책 41/60(68.3%)입니다. 캐시 없는 워밍업 후 추론은 p50 1,718.00ms·p95 2,066.36ms입니다. 동일 임베딩 RAM 캐시 반복 검사의 p50 1.32ms는 새 입력의 추론 속도가 아닙니다. [CLM 평가](reports/clm_evaluation.json)와 [모델 카드](MODEL_CARD.md)를 확인하세요.

| Component / 구성 | Pinned revision / 고정 리비전 |
| --- | --- |
| [Contrastive-LM/CLM-v0.1-8B](https://huggingface.co/Contrastive-LM/CLM-v0.1-8B) | `e939398d4556fcd9400c76fa8c5a513202f42b0a` |
| [mlx-community/Qwen3-8B-4bit](https://huggingface.co/mlx-community/Qwen3-8B-4bit) | `545dc4251c05440727734bcd94334791f6ab0192` |

On Apple Silicon, after the basic virtual-environment setup, install the pinned MLX dependencies and download the optional large weights. Run on a separate port:

Apple Silicon에서 기본 가상환경을 준비한 뒤 고정 MLX 의존성·선택형 대형 가중치를 설치하고 별도 포트로 실행합니다.

```sh
.needle-ml/bin/python -m pip install -r logan/ml/requirements-clm.txt
.needle-ml/bin/python logan/ml/prepare.py --clm
.needle-ml/bin/python logan/ml/service.py --backend clm --port 4322
```

`requirements-clm.txt` pins MLX 0.32.4 and mlx-lm 0.32.2. CLM supplies routes only: attributes are unavailable and `/v1/rank` returns 501. Keep E5 on 4321 for ranking; direct `decideContent` to `http://127.0.0.1:4322` with its `baseUrl` option when testing CLM. `--device` applies only to E5. Avoid concurrent GPU-heavy experiments on this laptop.

`requirements-clm.txt`는 MLX 0.32.4·mlx-lm 0.32.2를 고정합니다. CLM은 분기 전용이며 속성은 없고 `/v1/rank`는 501입니다. 정렬은 4321의 E5를 사용하고 CLM 검사 시 `decideContent`의 `baseUrl`을 `http://127.0.0.1:4322`로 지정합니다. `--device`는 E5 전용입니다. 이 노트북에서 GPU를 크게 쓰는 실험을 동시에 실행하지 마세요.

The recorded [HTTP smoke test](reports/clm_http_smoke.json) returned 200 for health and a review decision. It is one fixture, not another 60-example HTTP accuracy benchmark. Quantized MLX results do not establish reference BF16 parity. No controlled Jev comparison was performed. CLM's original model, heads and architecture are credited to [Contrastive-LM/CLM](https://github.com/Contrastive-LM/CLM), released under [Apache-2.0](https://github.com/Contrastive-LM/CLM/blob/main/LICENSE); see the [attribution in the model card](MODEL_CARD.md#clm-attribution--clm-출처).

기록된 [HTTP 검사](reports/clm_http_smoke.json)는 상태 확인·리뷰 판단에서 200을 반환했습니다. 한 예시의 실행 검사이며 별도의 HTTP 60문항 정확도 평가는 아닙니다. 양자화 MLX 결과가 원본 BF16과 같다는 근거는 없으며 Jev 통제 비교도 하지 않았습니다. 원본 모델·헤드·구조의 출처는 Apache-2.0으로 공개한 [Contrastive-LM/CLM](https://github.com/Contrastive-LM/CLM)이며 상세 출처는 모델 카드에 기록했습니다.

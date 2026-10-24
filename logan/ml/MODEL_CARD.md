# Needle Small Decision v1 — model card / 모델 카드

## Status / 상태

Delivered on `codex/logan-decision-review` for review, not as a production rollout. / `codex/logan-decision-review` 검토 브랜치 결과물이며 운영 배포를 뜻하지 않습니다.

**Locally trained text-routing prototype; experimental attributes.** Extracted text plus a selected product is routed to review analysis, incidental product search, or clarification. It also scores supplied text candidates by semantic relevance. It does not extract media, verify product identity, rank creators by ROI, predict purchases or establish customer retention gains.

**로컬에서 학습한 텍스트 분기 프로토타입이며 속성 분석은 실험 단계입니다.** 추출 텍스트·선택 상품을 리뷰 분석·단순 노출 상품 검색·추가 확인으로 분기하고 전달된 후보의 관련도를 계산합니다. 미디어 추출·상품 동일성 검증·크리에이터 ROI·구매 예측·고객 유지율 향상을 검증한 모델이 아닙니다.

HM owns landing/search/capture and upstream extraction integration; Ryan owns seller dashboard/merchant intent; Logan owns matching/routing. Existing team routes remain unchanged.

HM은 랜딩·검색·캡처·상위 추출 연동, Ryan은 셀러 대시보드·판매자 의도, Logan은 매칭·판단을 담당하며 기존 팀 라우트는 변경하지 않습니다.

## Model and training / 모델·학습

| Item / 항목 | Value / 값 |
| --- | --- |
| Encoder / 인코더 | [intfloat/multilingual-e5-small](https://huggingface.co/intfloat/multilingual-e5-small) |
| Revision / 리비전 | `614241f622f53c4eeff9890bdc4f31cfecc418b3` |
| Parameters / 파라미터 | 117,653,760, all frozen / 전체 고정 |
| Embedding / 임베딩 | Masked mean pooling + L2 normalization, query/passage prefixes / 마스크 평균 풀링·정규화·질의/문서 접두사 |
| Context, batch / 문맥·배치 | 256 tokens, batch 8 / 256토큰·배치 8 |
| Trained heads / 학습 대상 | Logistic route head + 6 independent attribute heads / 로지스틱 분기 헤드·독립 속성 헤드 6개 |
| Route classes / 분기 | `review_analysis`, `product_search`, `clarify` |
| Attribute polarities / 속성 극성 | `none`, `positive`, `negative`, `neutral` |
| Attributes / 속성 | price, design, convenience, performance, durability, comfort / 가격·미감·편의성·성능·내구성·착용감 |
| Head artifact / 헤드 | JSON coefficients, 316,774 bytes; no pickle / JSON 계수, pickle 미사용 |
| Base files / 기반 파일 | 492,794,646 bytes locally / 로컬 기준 |
| Seed / 시드 | 153 |
| Hardware / 하드웨어 | Apple M2, 16 GB; MPS; 2 PyTorch CPU threads |
| Training time / 학습 시간 | 7.351 s, excluding download and Python startup / 다운로드·Python 시작 제외 |

Regularization `C ∈ {1, 10, 100}` was selected on validation only. Route threshold 0.45, top-two margin 0.08, and attribute output threshold 0.65 were fixed before independent evaluation. Scores are uncalibrated classifier outputs, not purchase probability.

정규화 `C ∈ {1, 10, 100}`은 검증 데이터에서만 선택했습니다. 분기 임계값 0.45·상위 두 점수 차이 0.08·속성 출력 임계값 0.65는 독립 평가 전에 고정했습니다. 점수는 확률 보정되지 않은 분류 출력이며 구매 확률이 아닙니다.

Only heads were trained. **These E5 results are not full-encoder or CLM-8B fine-tuning results.** Semantic ranking uses frozen pretrained E5 cosine similarity, without Needle relevance-label training.

헤드만 학습했습니다. **이 E5 결과는 인코더 전체·CLM-8B 파인튜닝 결과가 아닙니다.** 의미 기반 정렬은 고정 사전학습 E5의 코사인 유사도이며 Needle 관련도 정답으로 학습하지 않았습니다.

## Data and protocol / 데이터·평가 방법

All examples are synthetic EN/KO text, not real customer/video captures. Route training: 360 rows; validation: 72. Two templates per language/class are held out, but product families and synthetic authoring style overlap. Attributes: 570 training sentences, 114 keyboard-family validation sentences. Attribute templates remain shared across this product split, so near-perfect validation does not indicate generalization.

모든 예시는 합성 한영 텍스트이며 실제 고객·영상 캡처가 아닙니다. 분기 학습 360개·검증 72개입니다. 언어·클래스별 두 템플릿을 검증용으로 남겼지만 상품군·합성 작성 방식은 겹칩니다. 속성 학습 570문장·키보드 상품군 검증 114문장입니다. 속성 분할에도 템플릿이 공유되므로 매우 높은 검증 수치는 일반화를 의미하지 않습니다.

Evaluation was authored independently of the template generator: 60 synthetic scenarios, 30 EN + 30 KO, 20 per route. Heads were frozen before reading it; its labels were not used to change weights or thresholds. The report records dataset/head hashes. This small development test is not an external benchmark or reliable production estimate.

평가는 템플릿 생성과 독립적으로 작성한 합성 60개 시나리오이며 한영 각 30개·분기별 20개입니다. 읽기 전에 헤드를 고정했고 그 정답으로 가중치·임계값을 바꾸지 않았습니다. 보고서에 데이터·헤드 해시를 기록했습니다. 소규모 개발 테스트이며 외부 벤치마크·신뢰할 상용 성능 추정은 아닙니다.

## Routing results / 분기 결과

| Method / 방식 | Correct / 정답 | Accuracy / 정확도 | Macro-F1 |
| --- | ---: | ---: | ---: |
| E5 zero-shot action similarity / E5 행동 설명 유사도 | 33/60 | 55.0% | 0.5515 |
| Trained head raw argmax / 학습 헤드 최대 점수 | 56/60 | 93.3% | 0.9332 |
| Head + confidence/margin gate / 점수·마진 기반 추가 확인 | 55/60 | 91.7% | 0.9166 |
| HTTP service + target/context guards / HTTP 서비스·대상/문맥 규칙 | 56/60 | 93.3% | 0.9333 |

These are different policies. Missing-target/context guards change the confusion matrix; equal raw/service correct counts do not mean identical predictions. The original BM25/lexicon HookRank is a separate baseline, not the zero-shot comparator above.

서로 다른 정책입니다. 대상·문맥 규칙으로 오분류 행렬이 달라지며 원시 모델·서비스의 정답 수가 같아도 예측은 동일하지 않습니다. 기존 BM25·사전 HookRank는 위 zero-shot 비교 대상과 다른 기준선입니다.

Gated model language results: EN 28/30, macro-F1 0.9333; KO 27/30, macro-F1 0.8997. One request abstained. This is insufficient evidence of general language parity.

임계값 적용 모델은 영어 28/30·macro-F1 0.9333, 한국어 27/30·0.8997입니다. 1개는 임계값으로 추가 확인을 선택했습니다. 전반적 언어 성능 동등성을 판단하기에는 부족합니다.

HTTP confusion matrix, rows true and columns predicted / HTTP 오분류 행렬, 행 정답·열 예측:

| True → predicted / 정답 → 예측 | review_analysis | product_search | clarify |
| --- | ---: | ---: | ---: |
| review_analysis | 20 | 0 | 0 |
| product_search | 0 | 18 | 2 |
| clarify | 0 | 2 | 18 |

Reports / 보고서: [training](models/training_report.json), [frozen evaluation](models/evaluation_report.json), [HTTP evaluation](reports/service_evaluation.json).

## Attributes: weak and experimental / 속성: 아직 약한 실험 단계

The independent set yields 162 sentences per head, evaluated before the 0.65 output gate. Mean macro-F1 is **0.424**. Accuracy is dominated by `none`; it must not be advertised as successful aspect extraction. Some polarity classes have few or no positive examples. End-to-end quote precision/recall and target-entity grounding were not evaluated.

독립 평가의 속성별 문장은 162개이며 출력 임계값 0.65 적용 전 결과입니다. 평균 macro-F1은 **0.424**입니다. 정확도는 `none`에 좌우되므로 속성 추출 성공률로 홍보하면 안 됩니다. 일부 극성 예시는 매우 적거나 없고 전체 인용 정밀도·재현율·대상 상품 연결 정확도는 평가하지 않았습니다.

| Attribute / 속성 | Macro-F1 |
| --- | ---: |
| Price / 가격 | 0.280 |
| Design / 미감 | 0.481 |
| Convenience / 편의성 | 0.609 |
| Performance / 성능 | 0.296 |
| Durability / 내구성 | 0.442 |
| Comfort / 착용감 | 0.435 |

Quotes are original sentences, not verified minimal spans. Opinions about other objects can be assigned to the target. Outputs mark `target_grounding: "model_inferred_unverified"`. The gate can omit clear opinions or admit wrong ones; a direct mixed-opinion review returned empty attributes in a smoke check. Review outputs before using them as seller evidence.

인용은 원문 문장이며 검증된 최소 근거 구간이 아닙니다. 다른 물체의 의견을 대상에 잘못 연결할 수 있어 `target_grounding: "model_inferred_unverified"`를 표시합니다. 임계값 때문에 명확한 의견을 누락하거나 틀린 의견이 통과할 수 있고 직접 검사한 혼합 의견 리뷰에서 빈 속성도 나왔습니다. 셀러 근거로 사용하기 전 검토가 필요합니다.

## Latency / 속도

| Measurement / 측정 | p50 | p95 | Scope / 범위 |
| --- | ---: | ---: | --- |
| Model route-only / 모델 분기만 | 12.03 ms | 33.79 ms | 20 EN, warm, uncached, serial / 영어 20개·워밍업 후·캐시 없음·직렬 |
| Actual HTTP / 실제 HTTP | 10.37 ms | 39.57 ms | 30 EN + 30 KO, zero cache hits; attributes on reviews / 한영 각 30개·캐시 적중 없음·리뷰 시 속성 포함 |
| HTTP EN / HTTP 영어 | 11.89 ms | 69.11 ms | 30 requests / 30개 |
| HTTP KO / HTTP 한국어 | 8.65 ms | 30.62 ms | 30 requests / 30개 |

The first HTTP request took 486.80 ms; percentiles do not describe worst-case latency. Route-only used the first 20 evaluation rows, all English; it is not bilingual. Separate runs cannot establish that HTTP is faster. Model construction after Python imports took 2.109 s; the base download is excluded.

첫 HTTP 요청은 486.80ms였으며 백분위는 최악의 지연을 뜻하지 않습니다. 분기 전용 측정은 평가 첫 20개로 모두 영어라 한영 측정이 아닙니다. 별도 실행이므로 HTTP가 더 빠르다는 결론은 낼 수 없습니다. Python import 후 모델 생성은 2.109초였고 기반 모델 다운로드는 제외했습니다.

All times exclude capture, transcription/OCR, visual identity, external search/network APIs and downstream LLMs. No throughput/load, battery/thermal or controlled Jev comparison was performed. “Faster than Jev” and end-to-end millisecond video analysis are unsupported claims.

모든 시간에서 캡처·전사/OCR·시각 식별·외부 검색/API·후속 LLM은 제외됩니다. 부하·처리량·배터리·발열·Jev 통제 비교는 하지 않았습니다. “Jev보다 빠르다”나 “영상 전체를 밀리초 단위로 분석한다”는 주장은 근거가 없습니다.

## Limits and next validation / 한계·다음 검증

- E5 is text-only with 256-token context; send focused evidence. HTTP asks for clarification on truncation. The separate CLM configuration uses 128 tokens. / E5는 텍스트 전용·256토큰 문맥이므로 대상 중심 근거를 전달하며 초과 시 추가 확인합니다. 별도 CLM 구성은 128토큰입니다.
- Synthetic examples do not validate noisy ASR/OCR, sarcasm, multiple products or domain shifts. Collect consented real cases with independent labels. / 합성 예시로 전사/OCR 오류·반어법·다중 상품·분야 변화를 검증하지 못합니다. 동의 기반 실사례·독립 라벨이 필요합니다.
- Similarity does not establish identity, intent or commercial value. Preserve identity tiers and saved checkout records. Ryan's intent signals remain separate. / 관련도는 동일성·의도·상업 가치가 아닙니다. 동일 상품 등급·저장 결제를 보존하고 Ryan 의도 신호와 분리합니다.
- No real retention, sales lift or creator ROI measurement exists. / 실제 유지율·판매 증대·크리에이터 ROI 측정은 없습니다.
- The separate CLM-8B experiment is complete below. E5 metrics must never be relabeled as CLM results. / 별도 CLM-8B 실험은 아래와 같이 완료했습니다. E5 수치를 CLM 결과로 표시하면 안 됩니다.

Base-weight terms follow the upstream license/model card. The repository includes small JSON heads and synthetic fixtures; large downloaded weights and embedding caches stay local, outside Git.

기반 가중치 조건은 원본 라이선스·모델 카드를 따릅니다. 저장소에는 작은 JSON 헤드·합성 데이터를 포함하며 대형 다운로드 가중치·임베딩 캐시는 로컬에만 보관합니다.

## Completed CLM experiment / 완료한 CLM 실험

This separate path uses the released CLM state/action heads with a frozen community MLX 4-bit Qwen3-8B backbone. Only `state_head.out` and `action_head.out` weights/biases were trained: **1,573,888 parameters**, saved as **6,296,040 bytes** of safetensors. Encoder, head input/hidden/layernorm layers and logit scale remain frozen. This is partial projection-head fine-tuning, not whole-8B or full-head training. Context is 128 tokens; inputs over the limit abstain. The quantized backbone is not verified equivalent to the reference BF16 encoder.

별도 CLM 경로는 공개 상태/행동 헤드와 고정된 커뮤니티 MLX 4비트 Qwen3-8B를 사용합니다. `state_head.out`·`action_head.out`의 가중치·편향 **1,573,888개**만 학습하고 **6,296,040바이트** safetensors로 저장했습니다. 인코더·앞쪽 헤드·layernorm·logit scale은 고정했습니다. 8B 전체나 헤드 전체가 아닌 마지막 투영층의 부분 학습입니다. 문맥은 128토큰이며 초과 시 추가 확인합니다. 양자화 기반 모델이 원본 BF16과 같다는 검증은 없습니다.

| Configuration / 설정 | Value / 값 |
| --- | --- |
| Original heads / 원본 헤드 | `Contrastive-LM/CLM-v0.1-8B` @ `e939398d4556fcd9400c76fa8c5a513202f42b0a` |
| Frozen encoder / 고정 인코더 | `mlx-community/Qwen3-8B-4bit` @ `545dc4251c05440727734bcd94334791f6ab0192` |
| Data / 데이터 | 120 train, 72 validation, 60 held-out synthetic EN/KO / 합성 한영 학습 120·검증 72·평가 60 |
| Training subset / 학습 부분집합 | SHA256 order, 20 examples per language/class cell / SHA256 순서로 언어·클래스별 20개 |
| Selection / 선택 | Best validation macro-F1; epoch 16 of 60; no held-out tuning / 검증 macro-F1 기준 60회 중 16회, 평가 정답 튜닝 없음 |
| Hyperparameters / 설정 | Seed 153, learning rate 0.0001, label smoothing 0.05, weight decay 0.001 |
| Serving gates / 서비스 임계값 | Score 0.55, top-two margin 0.10 / 점수 0.55·상위 점수 차이 0.10 |
| Training run / 학습 실행 | 220.42 s including local encoding; downloads excluded / 로컬 인코딩 포함·다운로드 제외 |
| Peak recorded MLX allocation / 기록된 MLX 최대 할당 | About 4.86 GB; not total process/system RAM / 약 4.86GB, 전체 프로세스·시스템 RAM 아님 |

Validation raw macro-F1 improved from 0.4176 to 0.5472, which promoted the tuned heads within the CLM path. The gated validation macro-F1 was only 0.3980; promotion was based on raw validation, not a claim that the guarded policy improved. The independent synthetic holdout remained unchanged.

검증의 원시 macro-F1이 0.4176→0.5472로 개선되어 CLM 경로 안에서 학습 헤드를 선택했습니다. 임계값 적용 검증 macro-F1은 0.3980에 그쳤습니다. 선택 기준은 원시 검증이며 추가 확인 정책까지 개선됐다는 주장은 아닙니다. 독립 합성 평가는 변경하지 않았습니다.

| CLM policy / CLM 정책 | Correct / 정답 | Accuracy / 정확도 | Macro-F1 |
| --- | ---: | ---: | ---: |
| Released heads, zero-shot / 공개 헤드 | 38/60 | 63.3% | 0.6220 |
| Fine-tuned final projections, raw / 마지막 투영층 학습·원시 | 42/60 | 70.0% | 0.7046 |
| Tuned gates/selected model policy / 임계값 적용·선택 모델 정책 | 41/60 | 68.3% | 0.6818 |

Raw language results after training: EN 24/30 (80.0%); KO 18/30 (60.0%). Before training: EN 24/30; KO 14/30. The 60-row gated score is a model-level evaluation, not a full HTTP-service policy benchmark. A separate [HTTP smoke test](reports/clm_http_smoke.json) verified a successful health request and one `review_analysis` response (200), with a repeat hitting the service cache. Attributes/ranking remain unavailable in CLM.

학습 후 원시 언어별 결과는 영어 24/30(80.0%), 한국어 18/30(60.0%)이며 이전에는 영어 24/30·한국어 14/30입니다. 60개 임계값 결과는 모델 수준 평가이지 전체 HTTP 정책 평가는 아닙니다. 별도 [HTTP 실행 검사](reports/clm_http_smoke.json)는 상태 확인·리뷰 분기 1건의 200 응답과 반복 요청 캐시 적중을 확인했습니다. CLM은 속성·정렬을 제공하지 않습니다.

| CLM timing / CLM 시간 | p50 | p95 | Scope / 범위 |
| --- | ---: | ---: | --- |
| Warm uncached / 워밍업 후 캐시 없음 | 1,718.00 ms | 2,066.36 ms | 20 serial EN inputs, tokenizer + 8B encoder + heads; actions cached / 영어 20개 직렬, 토크나이저·8B·헤드 포함, 행동 임베딩 캐시 |
| Repeated RAM embedding cache / 동일 RAM 임베딩 캐시 반복 | 1.32 ms | 2.67 ms | Same state repeatedly; encoder skipped, heads executed / 동일 상태 반복, 인코더 생략·헤드 실행 |

The cache-hit number is not new-input inference latency. Cold 8B loading was not timed; the report's 0.117 s initialization covers heads/cached actions only. Capture/transcription, external search and downstream work remain excluded. The one HTTP smoke request took 1,042 ms, but a single fixture is not a latency distribution.

캐시 적중 수치는 새 입력 추론 속도가 아닙니다. 8B 최초 로딩은 측정하지 않았으며 보고서의 0.117초 초기화는 헤드·캐시된 행동만 포함합니다. 캡처·전사·외부 검색·후속 작업은 제외됩니다. HTTP 실행 검사의 단일 요청은 1,042ms였지만 한 예시는 지연 분포가 아닙니다.

**Keep E5 as default:** in this particular task, laptop and synthetic test, E5 achieved better routing accuracy and much lower uncached latency. CLM is an optional research path showing that local partial-head training is feasible; it did not provide a speed or quality advantage here. Training sizes differ (E5 360, CLM 120), so this is a comparison of the delivered configurations, not a controlled architecture benchmark. Neither result establishes superiority over Jev.

**E5 기본값을 유지합니다.** 이번 과제·노트북·합성 평가에서는 E5의 분기 정확도가 더 높고 캐시 없는 지연이 훨씬 짧았습니다. CLM은 로컬 부분 헤드 학습 가능성을 보여주는 선택형 실험 경로이며 이번에는 속도·품질 이점이 없었습니다. 학습 수가 E5 360·CLM 120으로 달라 제공 구성의 비교이지 통제된 구조 비교는 아닙니다. 어느 결과도 Jev보다 우수함을 입증하지 않습니다.

Reports / 보고서: [CLM training](reports/clm_training.json), [CLM frozen evaluation](reports/clm_evaluation.json), [CLM HTTP smoke](reports/clm_http_smoke.json). Run instructions and pinned dependencies are in [README.md](README.md#experimental-clm-backend--실험용-clm-백엔드).

## CLM attribution / CLM 출처

The original model and projection-head design are from **Contrastive-LM/CLM**, by Jacky Kwok and collaborators. Needle's `ProjectionHead` compatibility implementation follows that released architecture/checkpoint; Needle adds the MLX quantized backbone adapter, task-specific final-layer training, fixtures and service integration. It does not claim the original CLM architecture as Needle's invention. Official sources: [code](https://github.com/Contrastive-LM/CLM), [model card](https://huggingface.co/Contrastive-LM/CLM-v0.1-8B), [fine-tuning guide](https://github.com/Contrastive-LM/CLM/blob/main/docs/FINETUNING.md). Code and CLM weights are released under [Apache-2.0](https://github.com/Contrastive-LM/CLM/blob/main/LICENSE); a copy is included in [CLM-APACHE-2.0.txt](CLM-APACHE-2.0.txt).

원본 모델·투영 헤드 구조는 Jacky Kwok과 공동 저자의 **Contrastive-LM/CLM**에서 왔습니다. Needle의 `ProjectionHead` 호환 구현은 공개 구조·체크포인트를 따르며 MLX 양자화 연결·과제별 마지막 층 학습·데이터·서비스 연동을 추가했습니다. 원본 CLM 구조를 Needle의 발명으로 주장하지 않습니다. 공식 코드·모델 카드·학습 가이드를 위에 연결했고 Apache-2.0 라이선스 사본을 함께 포함했습니다.

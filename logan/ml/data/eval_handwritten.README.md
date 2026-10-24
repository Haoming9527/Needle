# Independent handwritten evaluation fixtures / 독립 수작업 평가 예시

`eval_handwritten.jsonl` contains 60 independently authored synthetic examples: 10 examples for each of three routes in English and Korean. The author did not inspect the training data. These are diagnostic fixtures, not real customer videos, platform reviews, or a representative public benchmark.

평가 파일은 영어·한국어 각 30개, 경로별 각 10개로 총 60개의 독립적으로 작성한 합성 예시입니다. 작성자는 학습 데이터를 보지 않았습니다. 실제 고객 영상·플랫폼 리뷰 또는 실사용 분포를 대표하는 공개 벤치마크가 아닙니다.

## Label policy / 라벨 기준

- `review_analysis`: the requested product itself is evaluated. Attribute quotes are exact substrings from the text. Positive, negative and explicitly uncertain/neutral statements are distinguished. Promotional claims are not treated as a user's observed product experience.
- `product_search`: the target product is sufficiently specified and the user asks to identify/search for it, while the surrounding content does not review that target. A review of another product remains irrelevant to the selected target.
- `clarify`: the product/selection or necessary context is missing, conflicting, ambiguous, irrelevant, or insufficient. Isolated adjectives are not enough to invent a product verdict.

영상 내 상품이 실제 평가된 경우에만 리뷰 분석으로 분류합니다. 다른 상품의 리뷰, 배경 노출, 광고 문구만 있는 경우에는 선택한 상품에 대한 사용자 후기로 취급하지 않습니다. 대상·문맥이 부족하면 확인 질문 경로로 분류합니다.

## Deliberate coverage / 의도한 검증 범위

English/Korean negation, mixed-language informal requests, unreviewed background products, another-product review traps, ad claims versus firsthand testing, multiple objects with a lost selection, missing capture/transcript, irrelevant lyrics, and instruction-like text appearing inside captured content.

## Use and limitations / 사용 및 한계

Keep this file out of training and model selection. Freeze the candidate and thresholds before evaluating. Report macro F1, per-route confusion counts, per-language results and sample size alongside accuracy. If errors are used to alter the model, this becomes a development set; create a new untouched test set before claiming a final result. Attribute evaluation requires separate exact-quote and polarity checks; router accuracy does not establish extraction quality.

This small, deliberately explicit fixture set may overestimate real-video performance. It contains user intent and textual observations rather than raw audio/image inputs. It does not test OCR, ASR, visual product identification, live retrieval, customer retention, conversion, or commercial lift. A high score must not be described as production accuracy or as proof of speed superiority over another model.

학습·모델 선택에 넣지 말고 모델과 기준을 고정한 후 평가하세요. 오류를 보고 모델을 수정하면 이 파일은 개발셋이 됩니다. 실제 영상의 불완전한 전사·OCR·암묵적 문맥과 다른 명시적인 예시이므로 좋은 점수를 실서비스 정확도·매출 개선으로 설명하면 안 됩니다.

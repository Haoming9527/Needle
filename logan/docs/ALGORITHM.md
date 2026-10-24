# Needle HookRank v1 / 구매 이유 기반 검색

## Pipeline / 처리 흐름

Captured content → team extraction/normalization → `{productId,text,url,...}` → Logan lexical retrieval → attribute evidence → preference-weighted ranking → consumer explanation → explicit user signal → seller aggregate feed.

캡처 → 팀의 추출/정규화 → 공통 텍스트 레코드 → 검색 → 속성 근거 → 선호 가중 정렬 → 소비자 설명 → 직접 선택 신호 → 셀러 집계.

The current module consumes text. It does not claim to transcribe audio, understand raw screenshots, or operate LLM agents. HM/Ryan supply those upstream outputs. No extra LLM call is required for deterministic ranking. A future decision model can route ambiguous evidence to an extraction model, but the current implementation does not label rules as d1-ultra output.

현재 모듈은 텍스트를 입력받습니다. 음성 전사·이미지 이해·에이전트 실행은 팀 상위 파이프라인의 영역입니다. 규칙 기반 결과를 d1-ultra 판단으로 표시하지 않습니다.

## Formula / 계산

For each query term, BM25 uses `k1=1.2, b=0.75` and positive smoothed IDF. Retrieval is exact Unicode token based; query scores are divided by the maximum within the candidate set.

For attribute a: `A[a] = max(0, (distinct_positive_phrases - distinct_negative_phrases) / (1 + positive + negative))`.

`affinity = weighted_mean(A[a], selected preferences)`.

With query + preferences: `score = round(65 * normalized_BM25 + 35 * affinity)`.
Only query: 100 × normalized BM25. Only preferences: 100 × affinity. Neither: stable ID ordering with zero score. Query terms must match for retrieval; a different product ID is excluded when a product filter is supplied. Scores are relative relevance, never purchase likelihood.

속성 반복은 동일 표현을 한 번만 세어 과장 효과를 제한합니다. 부정어는 가까운 문맥에서 검사합니다. 콘텐츠 전체가 같은 중복 레코드는 한 번만 정렬합니다. 사용자가 선택한 콘텐츠를 그 자체의 검색 점수에 다시 더하지 않아 단순 인기 순환을 피합니다.

## Limits and validation / 한계와 검증

- Handwritten lexicon, not trained POS tagging or multilingual embeddings. Korean inflections/query synonym coverage is limited; this is not general sentiment understanding.
- Sarcasm, mixed clauses, double negation and implicit negatives need labeled-data evaluation. Negation is a heuristic, not a guarantee.
- No cross-product identity inference. Product IDs must be aligned upstream.
- No creator fee/attribution dataset: do not label content fit as cost efficiency.
- Demo signal persistence is one local workspace, not a person-level profile system. Avoid multi-user interpretations.
- Next evaluation: manually label EN/KO review relevance and attribute polarity; hold out creators/products; measure nDCG@5, precision@5 and polarity precision/recall; compare BM25 alone against weighted attributes. No benchmark performance is claimed.

## References / 참고

- Stanford, Introduction to Information Retrieval, Okapi BM25: https://nlp.stanford.edu/IR-book/html/htmledition/okapi-bm25-a-non-binary-model-1.html
- Pontiki et al., SemEval-2014 Task 4: Aspect Based Sentiment Analysis: https://aclanthology.org/S14-2004/

These inform the design; this module is an original deterministic implementation, not a reproduction of a trained research model.

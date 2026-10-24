# Needle HookRank v1

HookRank is deterministic evidence ranking, not a trained model or a purchase-probability estimator. Implementation: `../algorithm.mjs`.

## Inputs and computation

Records contain a product ID, title, content text, and provenance. Optional inputs are a query, product filter, and explicit positive preference weights for price, design, convenience, performance, durability, and comfort.

1. Filter product IDs when requested, then deduplicate identical normalized content within a product. Different products retain separate records.
2. Normalize Unicode with NFKC and lowercase. Split tokens using Unicode letter/number sequences. Query tokens use exact token matching; there is no translation, stemming, or semantic embedding.
3. Compute BM25-style query relevance over title plus text with `k1 = 1.2` and `b = 0.75`.
4. Extract English/Korean phrases for six attributes. Nearby English/Korean negation changes evidence polarity. This is a small heuristic lexicon, not general language understanding.
5. For each attribute, count distinct positive and negative matched phrases. Attribute score is `max(0, (positive - negative) / (1 + positive + negative))`. Repeating the same phrase does not increase this value.
6. Cap each active positive preference weight at five. Affinity is the weighted average of attribute scores.
7. With query and preferences, score is rounded `65 * normalized BM25 + 35 * affinity`. Query alone uses `100 * normalized BM25`; preferences alone use `100 * affinity`. With neither, scores are zero and IDs break ties.
8. When a query exists, discard records without any query-token match. Sort score descending, then ID ascending.

BM25 normalization uses the largest score in the current candidate set. Scores therefore change when candidates change and should not be compared as calibrated measurements across different searches.

## Explanations and limits

Output includes BM25/affinity components, extracted attributes, matched phrases, negation polarity, and source metadata. Listing descriptions adapted from Needle `SearchResponse` remain listings; they are not represented as independent reviews.

The bilingual lexicon does not make queries cross-lingual. Keyword overlap can miss meaning, sarcasm, negation scope, morphological variations, and synonyms. Sample content is illustrative. Current evidence does not establish causal influence, commercial uplift, or the customer's actual intent.

Recommended next validation: human-labelled bilingual relevance examples, negation/error cases, pairwise ranking judgments, and comparison against an unpersonalized baseline. These are proposed experiments, not completed evaluations.

## Local checks

Run `npm test` from `logan/`. Tests cover preference-induced rank changes, selected negation cases, duplicate/repeated-expression saturation, query filtering, listing provenance, packaged assets, reversible local signals, access guards, and missing-file recovery. Server tests use a temporary loopback workspace and never call external search services.

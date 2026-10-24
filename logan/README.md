# Needle · Logan module / Logan 담당 모듈

This delivery is prepared on `codex/logan-decision-review` for team review. It is not an assertion that the matching service is merged into `main` or connected to the production/team UI.

이 결과물은 팀 검토용 기능 브랜치로 전달합니다. 매칭 서비스가 `main`에 병합되었거나 운영·팀 UI에 이미 연결되었다는 뜻은 아닙니다.

Logan's current deliverable is the **matching and decision layer**: decide whether captured content reviews the selected product, merely contains it, or needs clarification; then expose evidence relevance scores to the team's backend. The delivered small model has locally trained classification heads on a frozen multilingual E5 encoder. Semantic ranking uses pretrained E5 cosine similarity and has not been separately trained.

Logan의 현재 담당은 **매칭·판단 계층**입니다. 수집한 내용이 선택 상품의 리뷰인지, 단순 노출인지, 추가 확인이 필요한지 분기하고 팀 백엔드에 근거의 관련도 점수를 제공합니다. 경량 모델은 다국어 E5 인코더를 고정하고 분류 헤드만 로컬에서 학습했습니다. 의미 기반 정렬은 사전학습 E5의 코사인 유사도를 사용하며 별도로 학습하지 않았습니다.

## Team boundaries / 팀 역할

| Owner / 담당 | Current scope / 현재 범위 |
| --- | --- |
| HM (Haoming) | Landing/search, Chrome extension and capture, upstream multimodal extraction integration / 랜딩·검색, Chrome 확장프로그램·캡처, 상위 멀티모달 추출 연동 |
| Ryan | Seller dashboard and merchant/marketplace intent collection / 셀러 대시보드, 판매자·마켓플레이스용 의도 수집 |
| Logan | Matching, content routing, experimental attribute evidence, local API adapter / 매칭, 콘텐츠 분기, 실험 단계의 속성 근거 분석, 로컬 API 어댑터 |

This follows the latest team clarification. Earlier consumer/seller screens in `public/` remain as a reference demo; they do not redefine HM's or Ryan's ownership. This module does not change the team's extension, `/discover`, `/clarify`, intent scoring or checkout. Calling the adapter from the team backend remains an explicit integration step.

최신 팀 협의 기준입니다. `public/`의 기존 구매자·셀러 화면은 참고용 데모로 보존했으며 HM·Ryan의 담당을 대체하지 않습니다. 확장프로그램, `/discover`, `/clarify`, 의도 점수, 결제는 변경하지 않습니다. 팀 백엔드에서 어댑터를 호출하는 연동 단계가 필요합니다.

## Learned matching service / 학습된 매칭 서비스

See [ML setup and HTTP contracts](ml/README.md) and [model card, measurements and limits](ml/MODEL_CARD.md).

[ML 설치·HTTP 계약](ml/README.md), [모델 카드·실측·한계](ml/MODEL_CARD.md)를 확인하세요.

From the repository root, with Python 3.12 / 저장소 루트에서 Python 3.12로 실행:

```sh
python3.12 -m venv .needle-ml
.needle-ml/bin/python -m pip install -r logan/ml/requirements.txt
.needle-ml/bin/python logan/ml/prepare.py
.needle-ml/bin/python logan/ml/service.py --backend small --port 4321
```

The checked-in trained heads are ready to load; no training or API key is required to run E5. Preparation downloads the pinned public base into `.needle-cache/`. Inference stays local. MPS is selected on supported Macs, otherwise CPU.

학습된 헤드가 포함되어 있으므로 E5 실행을 위해 재학습·API 키가 필요하지 않습니다. 준비 단계에서 고정 버전의 공개 기반 모델을 `.needle-cache/`에 받습니다. 추론은 로컬이며 지원되는 Mac은 MPS, 그 외에는 CPU를 사용합니다.

```js
import { decideContent, rankEvidence } from './logan/decision-client.mjs';

const decision = await decideContent({
  text: 'I tested these headphones for two weeks. They are comfortable.',
  target: { name: 'headphones' },
  sourceKind: 'transcript'
});
// review_analysis | product_search | clarify

const { ranking } = await rankEvidence('comfortable travel headphones', [
  { id: 'original-evidence-id', text: 'Comfortable on a long flight.' }
]);
```

`NEEDLE_DECISION_URL` defaults to `http://127.0.0.1:4321`; the client also accepts a `baseUrl` option. Catch service errors and retain existing discovery/clarification. Preserve original offer IDs, prices, provenance and exact/likely/similar identity tiers. Do not reorder saved checkout sessions.

`NEEDLE_DECISION_URL`의 기본값은 `http://127.0.0.1:4321`이며 `baseUrl` 옵션으로도 지정합니다. 서비스 오류 시 기존 검색·추가 질문을 유지하세요. 원래 상품 ID·가격·출처·동일 상품 판정 등급을 보존하고 저장된 결제 세션의 순서는 변경하지 마세요.

## Honest status / 현재 수준

- Original HookRank: BM25, bilingual lexicons and negation rules; a baseline, not a trained model. / 기존 HookRank는 BM25·한영 사전·부정 표현 규칙 기반 기준선이며 학습 모델이 아닙니다.
- E5: real local head training and a frozen synthetic test. The HTTP service correctly routed **56/60 (93.3%)**, including clarification guards. This is not a real-video/customer benchmark. / 실제 로컬 헤드 학습과 고정 합성 평가를 완료했습니다. 추가 확인 규칙을 포함한 HTTP 서비스는 **56/60(93.3%)**을 맞혔습니다. 실제 영상·고객 성능을 뜻하지 않습니다.
- Attribute extraction remains weak: six-head mean macro-F1 **0.424**. Quotes and polarities are experimental suggestions requiring review. / 속성 분석은 6개 헤드 평균 macro-F1 **0.424**로 아직 약합니다. 인용문·긍부정 판단은 검토가 필요합니다.
- CLM-8B: local final-projection fine-tuning and HTTP smoke test completed. Raw routing improved from 38/60 to 42/60; the gated policy scored 41/60. Warm uncached median was 1,718 ms. E5 was more accurate and faster in this experiment, so it remains the default. No Jev comparison was performed. / CLM-8B는 마지막 투영층의 로컬 학습과 HTTP 실행 검사를 완료했습니다. 원시 분기는 38/60→42/60, 임계값 적용 시 41/60입니다. 캐시 없는 워밍업 후 중앙값은 1,718ms였습니다. 이번 실험에서는 E5가 더 정확하고 빨라 기본값을 유지합니다. Jev 비교는 하지 않았습니다.

## Earlier UI demo / 기존 UI 데모

The earlier English-default EN/KO demo runs independently with Node.js 22.13+ (tested with 24), without third-party Node dependencies for this submodule:

기존 영어 기본·EN/KO 데모는 Node.js 22.13 이상(24에서 확인)으로 별도 실행합니다. 이 데모 하위 모듈에는 외부 Node 패키지가 필요하지 않습니다.

```sh
cd logan
npm start
# http://127.0.0.1:4320
npm test
```

It includes reference consumer search, platform filters, buying attributes, “This convinced me,” group-buy interest, and seller signal summaries. Marks persist locally and do not place orders. Illustrative reviews/authors are fictional. It is not a production multi-user SaaS. To use real discovery, run the repository API using the root README (default 4318); this demo forwards explicit text searches only.

구매자 검색·플랫폼 필터·구매 속성·“이것 때문에 끌렸어요”·공동구매 관심·셀러 신호 요약을 제공하는 참고 화면입니다. 표시는 로컬 저장되며 주문을 실행하지 않습니다. 예시 리뷰·작성자는 가상이고 다중 사용자 상용 SaaS가 아닙니다. 실제 검색은 루트 README에 따라 기존 API(기본 4318)를 별도로 실행하며 이 데모는 명시적 텍스트 검색만 전달합니다.

| Variable / 환경변수 | Purpose / 용도 |
| --- | --- |
| `LOGAN_PORT` | Demo port, default 4320 / 데모 포트 |
| `NEEDLE_API_URL` | Team API, default `http://127.0.0.1:4318` / 기존 팀 API |
| `LOGAN_DATA_DIR` | Local persistence, default `logan/data/`, Git ignored / 로컬 임시 저장소 |
| `LOGAN_IMPORT_TOKEN` | Private server-side demo ingestion token; never commit / 데모 수집용 서버 토큰, 커밋 금지 |

## Files / 파일

| File / 파일 | Purpose / 용도 |
| --- | --- |
| `ml/small_model.py`, `ml/models/` | E5 runtime, learned heads, frozen reports / E5 런타임·학습 헤드·고정 평가 |
| `ml/service.py`, `decision-client.mjs` | Local decision/ranking API and JS adapter / 로컬 판단·정렬 API·JS 어댑터 |
| `ml/clm_model.py` | Separate experimental CLM implementation / 별도 실험용 CLM 구현 |
| `algorithm.mjs`, `docs/ALGORITHM.md` | Original lexical baseline / 기존 어휘 기반 기준선 |
| `server.mjs`, `public/`, `sample.mjs` | Earlier bilingual reference demo / 기존 한영 참고 데모 |
| `docs/INTEGRATION.md` | Earlier demo endpoint contracts / 기존 데모 연동 계약 |

No credentials, meeting transcripts or Discord screenshots are included. The existing hosted Wavelength site is not replaced by this local module.

인증정보·회의록 원문·Discord 스크린샷은 포함하지 않습니다. 기존 Wavelength 배포 사이트를 이 로컬 모듈로 교체하지 않습니다.

# Needle · Logan module / Logan 담당 모듈

English-first consumer experience, seller insights, and explainable search ranking. EN/KO toggle included. No dependencies to install for this module.

영어 기본 소비자 화면, 셀러 인사이트, 설명 가능한 검색 정렬 모듈입니다. EN/KO 전환을 제공하며 이 모듈은 별도 패키지 설치가 필요 없습니다.

## Run / 실행

Node.js 22.13+ (tested with 24).

```sh
cd logan
npm start
# http://127.0.0.1:4320
npm test
```

To connect the team's existing search/vision backend, also run the repository's existing API in a second terminal using its README instructions. It listens on port 4318 by default. Logan's server forwards only the user's explicit search to `/discover`, consumes `shared/types.ts` SearchResponse, and ranks returned product descriptions. Images, extraction, models, database and checkout in the root project are unchanged.

팀 검색/비전 백엔드 연결 시 저장소 루트 README에 따라 기존 API를 별도 터미널에서 실행합니다(기본 4318). 사용자 검색을 `/discover`로 전달하고 `SearchResponse`의 상품 설명을 정렬합니다. 루트 프로젝트의 이미지·수집·모델·DB·결제 코드는 수정하지 않았습니다.

Environment / 환경변수:
- `LOGAN_PORT`: default 4320.
- `NEEDLE_API_URL`: default `http://127.0.0.1:4318`. Server-side configuration only.
- `LOGAN_DATA_DIR`: local scratch persistence, default `logan/data/` (Git ignored).
- `LOGAN_IMPORT_TOKEN`: required for team ingestion. Set privately on the server; never commit it.

## Scope / 범위

- Consumer / 구매자: content search, platform filter, six buying attributes, evidence, “This convinced me”, group-buy interest, purchase intention. Marks toggle and persist. These actions do not place orders.
- Seller / 셀러: product URL mapping, signal counts, selected reasons, content source table, aggregate JSON feed. Single local workspace; not production multi-user SaaS or customer counting.
- Algorithm / 알고리즘: Needle HookRank v1, BM25 + bilingual attribute lexicon, local negation rules, repeated-expression saturation, exact normalized-content deduplication, explicit preference weights. No claim of trained AI, causal lift, guaranteed ROI or purchase probability.
- Data / 데이터: clearly labeled illustrative reviews; imported source content; product-listing results kept distinct from reviews. Demo author names and quotes are fictional. External content remains in its original language.
- Team boundary / 팀 경계: HM owns extension/capture per Logan's instruction. Ryan's exact ownership remains to be confirmed. Proposed data normalization/storage/integration handoff is described in docs. No extension or collector implementation was added.

The currently hosted Wavelength site was not replaced. This is the portable Needle module requested for the team's final local integration.
기존 Wavelength 배포 사이트는 변경하지 않았습니다. 팀 로컬 통합을 위한 Needle 모듈입니다.

## Files / 파일

- `algorithm.mjs`: pure rank/extract functions + existing API adapter.
- `server.mjs`: loopback-only demo server and integration API.
- `public/`: EN/KO consumer and seller views.
- `sample.mjs`: illustrative fixtures.
- `docs/INTEGRATION.md`: endpoint contracts, boundaries, team handoff.
- `docs/ALGORITHM.md`: formula, references, limits, next experiments.

No API credentials, meeting transcripts, Discord screenshots or personal data are included.
API 키, 회의록 원문, Discord 스크린샷, 개인정보는 포함하지 않았습니다.

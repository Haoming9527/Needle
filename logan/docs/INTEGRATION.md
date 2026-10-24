# Team handoff / 팀 통합

## Confirmed vs proposed / 확정과 제안

- Logan: search/matching and better consumer information are explicitly requested in Ryan's Discord message. Consumer/seller web UI is also Logan's current requested scope.
- HM: extension + screenshot/multimodal capture, per Logan's assignment.
- Ryan: data normalization/storage, backend coordination and final integration are a proposed split, **not a verified named assignment in the speaker-unlabeled transcript**.
- Local execution was discussed. Which teammate hosts it still needs agreement.

Logan은 검색·매칭 및 소비자 정보/웹 화면을 구현합니다. HM은 확장/캡처 담당입니다. Ryan의 세부 역할과 최종 호스트는 확인이 필요합니다. 이 문서를 이미 합의된 개인별 업무 배정으로 취급하지 마세요.

## Existing team backend

Logan's UI → POST `/api/discover` → existing API `POST http://127.0.0.1:4318/discover` with `{selection:{text},mode}` → existing SearchResponse → `fromSearchResponse()` → `rank()`.

Existing offers remain product listings. This module neither relabels listings as customer reviews nor invents observed prices. No modifications are required to the extension for this standalone flow. To rank extension results directly, import `rank` and `fromSearchResponse` from `logan/algorithm.mjs` in the owning backend and apply them to the existing response. The owner should decide where to surface the additional evidence fields.

## Collection handoff

`POST /api/import`, `Content-Type: application/json`, `Authorization: Bearer $LOGAN_IMPORT_TOKEN`.

```json
{"records":[{"id":"team-example-1","productId":"headphones","title":"User review","text":"Comfortable but not affordable.","url":"https://example.com/review","platform":"YouTube","creator":"Author name","kind":"review"}]}
```

This is a schema example, not a real review. `id` must start `team-`; batches are atomic validation, max 200 records, text max 20,000 characters; repeated IDs update existing records. `origin` is set to `imported` by the server. Keep audio transcription/OCR in `text`; maintain raw media and richer metadata in the team-owned system. Do not send secrets or unnecessary personal data.

For current demo tabs, map productId to `headphones`, `chair`, `tent`, `laptop`; extend `sample.mjs` products deliberately when integrating the team's catalog. No fuzzy product identity mapping is assumed.

## Other endpoints

- `GET /api/state`: local demo workspace and labeled records.
- `POST /api/rank`: `{query, weights:{price:3}, productId?}` → results with components, attributes and evidence. No model calls.
- `POST /api/events`: `{recordId, attribute, action, remove?}`. Actions: `convinced`, `group_interest`, `buy_intent`, `explore`. Unique record/action in this local workspace; not global user tracking.
- `POST /api/listings`: `{productId,url,remove?}` stores mapping; no crawl.
- `GET /api/insights?productId=headphones`: aggregate reasons/actions/platforms/origins. No raw URL, text or identity in the feed.

The server binds to loopback and rejects foreign origins/hosts. This is a local demonstration boundary, not a production auth system. Use the team's database/auth adapters before multi-user deployment. Keys remain server-side and are not included in the delivery.

## Run together / 함께 실행

1. Team: follow root README and run existing API on 4318.
2. Logan: `cd logan && npm start` → 4320.
3. Open 4320; review demo content and connected product search.
4. Set import token locally and ingest normalized content.
5. Verify product IDs and raw-source permissions, then integrate the pure algorithm where the team needs it.

No final server ownership or production deployment is silently assumed.

## Connected intent demo boundary

The root app's SQLite intent memory, collections and conditional group pledges remain independent of Logan's local JSON events. HookRank ranks relevance; it does not estimate purchase readiness. Connect them only through explicit product-ID mapping and a user-controlled sharing boundary. The root connected demo walkthrough is in `../../docs/CONNECTED_DEMO.md`. No cursor browsing evidence is currently exported to sellers.

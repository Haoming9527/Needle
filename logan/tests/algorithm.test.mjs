import test from "node:test";
import assert from "node:assert/strict";
import { extract, rank, fromSearchResponse } from "../algorithm.mjs";
const record = (id, text) => ({
  id,
  productId: "lunch",
  title: "Lunch box",
  text,
});
test("explicit preferences reorder evidence and expose score components", () => {
  const records = [
    record("a", "Beautiful minimal design."),
    record("b", "Portable and easy to carry."),
  ];
  assert.equal(rank(records, { weights: { convenience: 3 } })[0].id, "b");
  assert.equal(rank(records, { weights: { design: 3 } })[0].id, "a");
  assert.ok(
    rank(records, { weights: { design: 3 } })[0].components.affinity > 0,
  );
});
test("negation suppresses positive attributes in English and Korean", () => {
  assert.equal(extract("Not affordable. 저렴하지 않다.").scores.price, 0);
  assert.ok(extract("Affordable. 저렴하다.").scores.price > 0);
});
test("duplicate content and repeated phrases cannot inflate evidence", () => {
  const once = extract("Portable.").scores.convenience;
  assert.equal(
    extract("Portable. Portable. Portable.").scores.convenience,
    once,
  );
  assert.equal(
    rank([record("a", "Portable"), record("b", "  PORTABLE  ")]).length,
    1,
  );
});
test("query filtering excludes irrelevant content and adapter preserves listing provenance", () => {
  assert.deepEqual(
    rank([record("a", "Portable"), record("b", "Comfortable")], {
      query: "portable",
    }).map((x) => x.id),
    ["a"],
  );
  const result = fromSearchResponse({
    offers: [
      {
        id: "offer",
        title: "Lunch box",
        description: "Portable",
        dataOrigin: "sample",
        price: 20,
        currency: "USD",
        priceIsIllustrative: true,
      },
    ],
  });
  assert.equal(result[0].kind, "listing");
  assert.equal(result[0].creator, null);
  assert.equal(result[0].priceIsIllustrative, true);
});

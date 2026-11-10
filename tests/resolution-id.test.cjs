const test = require("node:test");
const assert = require("node:assert/strict");
const ids = require("../usneseni/resolution-id.js");

test("both official ID schemes supply metadata and retain their spelling in links", () => {
  assert.deepEqual(ids.parse("UZ-001-01/26"), {organ: "ZM", number: 1, meeting: 1, year: "2026"});
  assert.equal(ids.url("UZ-001-01/26"), "/usneseni/2026/UZ-001-01-26/");
  assert.equal(ids.url("UR-12-2/2026"), "/usneseni/2026/UR-12-2-2026/");
  assert.equal(ids.url("RM/12/2/2026"), "/usneseni/2026/RM-12-2-2026/");
  assert.notEqual(ids.url("UZ-1-1/26"), ids.url("ZM/1/1/2026"));
});

test("hash links retain native IDs and keep existing slash-ID links working", () => {
  for (const hash of ["#UZ-1-1/26", "#UZ-1-1%2F26", "#UZ-1-1-26"]) {
    assert.equal(ids.fromHash(hash), "UZ-1-1/26");
  }
  assert.equal(ids.fromHash("#RM-12-2-2026"), "RM/12/2/2026");
  assert.equal(ids.fromHash("#bod-1"), null);
  assert.equal(ids.fromHash("#%ZZ"), null);
});

test("detail paths accept native numbers and reject unrelated or malformed paths", () => {
  for (const path of ["/usneseni/2026/UZ-1-1-26/", "/usneseni/2026/UR-12-2-2026/", "/usneseni/2026/RM-12-2-2026/"]) {
    assert.equal(ids.isPath(path), true);
  }
  for (const id of [undefined, "UZ/1/1/2026", "UZ-1-1/260", "UZ-1-1/26/extra", "https://example.org/"]) {
    assert.equal(ids.parse(id), null);
    assert.equal(ids.url(id), null);
  }
  assert.equal(ids.isPath("/usneseni/2026/anything/"), false);
});

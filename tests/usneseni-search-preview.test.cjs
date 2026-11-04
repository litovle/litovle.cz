const test = require("node:test");
const assert = require("node:assert/strict");
const {ranges, highlight, snippet} = require("../usneseni/search-preview.js");

test("match offsets preserve composed and decomposed accents after emoji", () => {
  for (const word of ["LÉKAŘ", "LÉKAŘ".normalize("NFD")]) {
    const text = `🏡 ${word} a lékař`;
    assert.equal(highlight(text, ["lekar"]), `🏡 <mark>${word}</mark> a <mark>lékař</mark>`);
    assert.equal(text.slice(...ranges(text, ["lekar"])[0]), word);
  }
});

test("overlapping and repeated terms produce one safe highlight per match", () => {
  assert.equal(highlight('lékař <img> & "lékař"', ["leka", "lekar"]), '<mark>lékař</mark> &lt;img&gt; &amp; &quot;<mark>lékař</mark>&quot;');
  assert.equal(highlight("<script>", []), "&lt;script&gt;");
  assert.deepEqual(ranges("ab", ["ab"]), []);
});

test("a late match remains visible with context and omission indicators", () => {
  const text = "Úvodní text rozhodnutí. ".repeat(30) + "Pronájem ordinace pro lékaře v Litovli. " + "Další obsah. ".repeat(30);
  const preview = snippet(text, ["lekar"]);
  assert.match(preview, /^… /);
  assert.match(preview, /pro lékaře v Litovli/);
  assert.ok(preview.endsWith("…"));
  assert.ok(preview.length <= 183);
  assert.match(highlight(preview, ["lekar"]), /<mark>lékař<\/mark>e/);
});

test("context prefers the complete phrase over an earlier isolated word", () => {
  const text = "Oprava chodníku. " + "Další obsah rozhodnutí. ".repeat(25) + "oprava školy v Litovli.";
  const preview = snippet(text, ["oprava", "skoly"], 180, "oprava skoly");
  assert.match(preview, /oprava školy v Litovli/);
  assert.ok(preview.startsWith("… "));
});

test("short text and queries absent from the text keep the ordinary prefix preview", () => {
  assert.equal(snippet("  Krátký  text\nrozhodnutí. ", ["lekar"]), "Krátký text rozhodnutí.");
  const text = "Dlouhý text rozhodnutí ".repeat(30);
  assert.equal(snippet(text, ["lekar"]), snippet(text));
  assert.ok(snippet(text).endsWith("…"));
});

test("context window does not truncate a search term longer than its budget", () => {
  const term = "a".repeat(200);
  assert.ok(snippet("Úvod. ".repeat(40) + term + " Konec.", [term]).includes(term));
});

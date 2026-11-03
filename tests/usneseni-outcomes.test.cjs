const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const outcomes = require("../usneseni/outcomes.js");

const record = overrides => ({id: "RM/1/1/2026", actions: [], items: [], ...overrides});

test("only explicit outcome actions classify a resolution", () => {
  assert.equal(outcomes.definition("__proto__"), null);
  assert.equal(outcomes.definition("unknown"), null);
  for (const [key, actions] of Object.entries({rejected: ["neschvaluje", "nesouhlasí"], changed: ["revokuje"], deferred: ["odkládá", "stahuje bod"]})) {
    for (const action of actions) assert.equal(outcomes.parts(record({actions: [action], subject: "žádost"}), key).length, 1);
  }
  for (const action of ["schvaluje", "souhlasí", "bere na vědomí"]) {
    assert.equal(outcomes.parts(record({actions: [action], subject: "Zpráva zmiňuje, že město dříve neschvaluje žádost."}), "rejected").length, 0);
  }
  assert.equal(outcomes.parts(record({items: [{text: "schvaluje změnu smlouvy, kterou dříve revokuje"}]}), "changed").length, 0);
  assert.equal(outcomes.parts(record({items: [{text: "neschvalujeme"}]}), "rejected").length, 0);
});

test("mixed resolutions retain the exact matching item and its original label", () => {
  const mixed = record({actions: ["neschvaluje", "schvaluje"], items: [
    {label: "a", text: "schvaluje opravu chodníku"},
    {label: "b", text: "Neschvaluje žádost o pronájem zahrady"},
  ]});
  assert.deepEqual(outcomes.parts(mixed, "rejected"), [{...mixed.items[1], index: 1}]);
  assert.equal(outcomes.partText(mixed, outcomes.parts(mixed, "rejected")[0]).includes("chodniku"), false);
  assert.equal(outcomes.parts(record({actions: ["neschvaluje"], items: [{text: "schvaluje žádost"}]}), "rejected").length, 0);
});

test("records without explicit outcome data stay outside filtered results", () => {
  for (const r of [record({id: "RO/1/2026", actions: ["neschvaluje"]}), record({type: "archive_document", actions: ["neschvaluje"]}), record({type: "archive_resolution", actions: ["neschvaluje"]}), record({})]) {
    assert.deepEqual(outcomes.parts(r, "rejected"), []);
  }
});

test("references belong to the revocation point, with valid targets and no duplicates", () => {
  const changed = record({items: [
    {label: "a", text: "revokuje usnesení RM/12/4/2025."},
    {label: "b", text: "schvaluje smlouvu navazující na RM/13/4/2025."},
  ], references_out: [
    {raw: "RM/12/4/2025", resolved: "RM/12/4/2025"},
    {raw: "RM/12/4/2025", resolved: "RM/12/4/2025"},
    {raw: "RM/13/4/2025", resolved: "RM/13/4/2025"},
    {raw: "RM/12/4/2025", resolved: "https://example.com"},
    {raw: "RM/12/4/2025", resolved: null},
  ]});
  assert.deepEqual(outcomes.references(changed, "changed"), ["RM/12/4/2025"]);
  assert.deepEqual(outcomes.references(changed, "rejected"), []);
});

test("published outcome actions are attributable to actual decision points", () => {
  const rows = fs.readdirSync(path.join(__dirname, "../assets/usneseni/data")).filter(name => name.endsWith(".json"))
    .flatMap(name => JSON.parse(fs.readFileSync(path.join(__dirname, "../assets/usneseni/data", name), "utf8")));
  for (const key of ["rejected", "changed", "deferred"]) {
    const rule = outcomes.definition(key);
    const matching = rows.filter(r => (r.actions || []).some(action => rule.actions.includes(action)));
    assert.ok(matching.length > 0);
    for (const r of matching) assert.ok(outcomes.parts(r, key).length > 0, r.id);
  }
});

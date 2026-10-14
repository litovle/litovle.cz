const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// Exercise the existing browser functions with fixture data and URL state.
function app(category = "", query = "") {
  const nodes = new Map();
  function node(id) {
    if (!nodes.has(id)) nodes.set(id, {value: "", hidden: false, focus: () => {}, replaceChildren: function() {this.children = [];}, appendChild: function(child) {this.children.push(child);}, querySelectorAll: () => []});
    return nodes.get(id);
  }
  node("usn-topic").value = category;
  node("usn-sort").value = "desc";
  node("usn-q").value = query;
  const records = [
    {id: "RM/1/1/2026", organ: "RM", datum: "2026-01-01", subject: "oprava chodniku", classification: {category: "transport"}},
    {id: "RM/2/1/2026", organ: "RM", datum: "2026-02-01", subject: "kulturni akce", classification: {category: "culture"}},
    {id: "RO/1/2026", organ: "RM", approval_date: "2026-03-01", notes: []},
    {id: "archive-1", organ: "ZM", type: "archive_resolution", date: "2026-04-01", display_text: "historicky zapis"},
  ];
  const requests = [];
  const payloads = {
    "/assets/usneseni/meta.json": {2026: {count: 2}},
    "/assets/usneseni/ro/meta.json": {2026: {count: 1}},
    "/assets/usneseni/archive/meta.json": {2026: {count: 1}},
    "/assets/usneseni/data/2026.json": records.slice(0, 2),
    "/assets/usneseni/index/2026.json": {chodniku: [records[0].id], kulturni: [records[1].id]},
    "/assets/usneseni/ro/data/2026.json": [records[2]],
    "/assets/usneseni/archive/data/2026.json": [records[3]],
  };
  const context = vm.createContext({
    document: {getElementById: node, querySelector: () => null, createElement: () => ({dataset: {}, setAttribute: function(name, value) {this[name] = value;}})},
    location: {pathname: "/usneseni/", search: "", hash: ""},
    history: {replaceState: (_, __, url) => {context.location.search = url;}},
    URLSearchParams, URL, console, setTimeout, clearTimeout,
    fetch: async url => {requests.push(url); return {ok: true, json: async () => payloads[url] || {}};},
  });
  let source = fs.readFileSync(path.join(__dirname, "../usneseni/app.js"), "utf8");
  source = source.replace("  init();", `
    TOPICS = {transport: "Doprava", culture: "Kultura"};
    META = {2026: {count: 2}};
    RO_META = {2026: {count: 1}};
    ARCHIVE_META = {2026: {count: 1}};
    YEAR_INPUTS = [{value: "2026", checked: true}];
    TYPE_INPUTS = [{value: "usneseni", checked: true}, {value: "ro", checked: true}];
    ORG_INPUTS = [{value: "Rada města Litovel", checked: true}, {value: "Zastupitelstvo města Litovel", checked: true}];
    globalThis.api = {loadYear,
      sources: (resolutions, budgets, archive) => {META = resolutions; RO_META = budgets; ARCHIVE_META = archive;},
      findResults, parseQuery, updateUrl, loadFromUrl, filtersAreDefault,
      paginate, renderResultCard, selectedTopic, loadMeta, renderWelcomeOverview, filterSummary, updateSearchPresentation,
      shortcut: async (category, place = false) => {
        const original = search;
        search = async () => {
          updateUrl();
          return {topic: selectedTopic(), query: q.value, years: selectedYears(),
            types: selectedTypes(), organs: selectedOrgans(), sort: sortSel.value};
        };
        try {return await (place ? browsePlace(category) : browseTopic(category));} finally {search = original;}
      },
      clear: async key => {
        const original = search;
        search = async () => {updateUrl(); updateSearchPresentation();};
        try {return await clearFilter(key);} finally {search = original;}
      },
      empty: () => {for (const input of [...YEAR_INPUTS, ...TYPE_INPUTS, ...ORG_INPUTS]) input.checked = false;},
      all: () => {for (const input of [...YEAR_INPUTS, ...TYPE_INPUTS, ...ORG_INPUTS]) input.checked = true;},
      setPage: n => {PAGE = n;}, setOrg: () => {ORG_INPUTS[0].checked = false;}};
  `);
  vm.runInContext(source, context);
  return {api: context.api, context, node, requests};
}

function ids(rows) {return Array.from(rows, row => row.id);}

test("topic-only browsing, clearing topic, and unknown category", async () => {
  const {api, node, context} = app("transport");
  assert.deepEqual(ids(await api.findResults(null)), ["RM/1/1/2026"]);
  node("usn-topic").value = "culture";
  assert.deepEqual(ids(await api.findResults(null)), ["RM/2/1/2026"]);
  node("usn-topic").value = "";
  api.updateUrl();
  assert.equal(new URLSearchParams(context.location.search).has("category"), false);
  context.location.search = "?category=unknown";
  api.loadFromUrl();
  assert.equal(api.selectedTopic(), "");
});

test("unclassified includes budgets and archive; all topics includes everything", async () => {
  const {api, node} = app("unclassified");
  assert.deepEqual(ids(await api.findResults(null)), ["archive-1", "RO/1/2026"]);
  node("usn-topic").value = "";
  assert.equal((await api.findResults(null)).length, 4);
});

test("topic combines with text and organ filters", async () => {
  const {api, node} = app("transport");
  assert.equal((await api.findResults(api.parseQuery("chodniku"))).length, 1);
  assert.equal((await api.findResults(api.parseQuery("kulturni"))).length, 0);
  api.setOrg();
  assert.equal((await api.findResults(null)).length, 0);
});

test("URL round trip preserves topic, query and year", () => {
  const {api, node, context} = app("transport", "chodniku");
  api.updateUrl();
  const params = new URLSearchParams(context.location.search);
  assert.equal(params.get("category"), "transport");
  assert.equal(params.get("y"), "2026");
  node("usn-topic").value = "";
  node("usn-q").value = "";
  api.loadFromUrl();
  assert.equal(node("usn-topic").value, "transport");
  assert.equal(node("usn-q").value, "chodniku");
  assert.equal(api.filtersAreDefault(), false);
});

test("pagination and labels work without a query", () => {
  const {api} = app("transport");
  const rows = Array.from({length: 25}, (_, i) => ({id: i}));
  api.setPage(2);
  assert.equal(api.paginate(rows).length, 5);
  api.updateUrl();
  const card = api.renderResultCard({id: "RM/1/1/2026", organ: "RM", classification: {category: "transport"}}, null);
  assert.match(card.innerHTML, /Doprava/);
  assert.match(card.innerHTML, /category%3Dtransport/);
});

test("missing metadata leaves ordinary search usable", async () => {
  const {api, node} = app();
  node("usn-topic-group").hidden = true;
  await api.loadMeta();
  assert.equal(api.selectedTopic(), "");
  assert.equal((await api.findResults(api.parseQuery("chodniku"))).length, 1);
});


test("topic shortcuts clear text and preserve the other filters", async () => {
  const {api, node, context} = app("transport", "chodniku");
  node("usn-sort").value = "asc";
  api.setOrg();
  const result = await api.shortcut("culture");
  assert.equal(result.topic, "culture");
  assert.equal(result.query, "");
  assert.deepEqual(Array.from(result.years), ["2026"]);
  assert.deepEqual(Array.from(result.types), ["usneseni", "ro"]);
  assert.deepEqual(Array.from(result.organs), ["Zastupitelstvo města Litovel"]);
  assert.equal(result.sort, "asc");
  const params = new URLSearchParams(context.location.search);
  assert.equal(params.get("category"), "culture");
  assert.equal(params.has("q"), false);
});

test("unknown shortcuts do not modify search state", async () => {
  const {api, node} = app("transport", "chodniku");
  assert.equal(await api.shortcut("unknown"), undefined);
  assert.equal(node("usn-topic").value, "transport");
  assert.equal(node("usn-q").value, "chodniku");
});


test("place shortcuts clear category and preserve the other filters", async () => {
  const {api, node, context} = app("transport", "chodniku");
  node("usn-sort").value = "asc";
  api.setOrg();
  const result = await api.shortcut("Unčovice", true);
  assert.equal(result.topic, "");
  assert.equal(result.query, "Unčovice");
  assert.deepEqual(Array.from(result.years), ["2026"]);
  assert.deepEqual(Array.from(result.types), ["usneseni", "ro"]);
  assert.deepEqual(Array.from(result.organs), ["Zastupitelstvo města Litovel"]);
  assert.equal(result.sort, "asc");
  const params = new URLSearchParams(context.location.search);
  assert.equal(params.has("category"), false);
  assert.equal(params.get("q"), "Unčovice");
});

test("welcome overview uses resolution and budget metadata", () => {
  const {api, node} = app();
  api.renderWelcomeOverview();
  assert.equal(node("usn-total-resolutions").textContent, "2");
  assert.equal(node("usn-total-budget-docs").textContent, "1");
  assert.equal(node("usn-latest-year-link").href, "/usneseni/2026/");
  assert.equal(node("usn-data-overview").hidden, false);
});


test("welcome appears only when both query and category are empty", () => {
  const {api, node} = app("transport");
  api.updateSearchPresentation();
  assert.equal(node("usn-topics").hidden, true);
  assert.equal(node("usn-active-filters").hidden, false);
  node("usn-topic").value = "";
  node("usn-q").value = "chodniku";
  api.updateSearchPresentation();
  assert.equal(node("usn-topics").hidden, true);
  node("usn-q").value = "";
  api.updateSearchPresentation();
  assert.equal(node("usn-topics").hidden, false);
  assert.equal(node("usn-active-filters").hidden, true);
});

test("removing restrictions preserves query and removes only that restriction", async () => {
  const {api, node, context} = app("transport", "chodniku");
  api.empty();
  await api.clear("types");
  let params = new URLSearchParams(context.location.search);
  assert.deepEqual(params.getAll("type"), ["usneseni", "ro"]);
  assert.deepEqual(params.getAll("org"), [""]);
  assert.equal(params.get("category"), "transport");
  assert.equal(params.get("q"), "chodniku");
  await api.clear("years");
  params = new URLSearchParams(context.location.search);
  assert.deepEqual(params.getAll("y"), ["2026"]);
  await api.clear("organs");
  await api.clear("topic");
  assert.equal(node("usn-q").value, "chodniku");
  assert.equal(node("usn-topic").value, "");
  assert.equal(node("usn-topics").hidden, true);
});

test("empty filter selections survive URL reload", () => {
  const {api, context} = app("transport");
  api.empty();
  api.updateUrl();
  api.all();
  api.loadFromUrl();
  const filters = api.filterSummary();
  assert.equal(filters.find(f => f.key === "years").label, "Roky: žádné");
  assert.equal(filters.find(f => f.key === "types").label, "Typ: žádný");
  assert.equal(filters.find(f => f.key === "organs").label, "Orgán: žádný");
});


test("year loading requests only the datasets advertised in metadata", async () => {
  const cases = [
    [{2026: {count: 2}}, {2026: {count: 1}}, {}, ["", "ro/"]],
    [{}, {}, {2026: {count: 1}}, ["archive/"]],
    [{}, {2026: {count: 1}}, {}, ["ro/"]],
    [{2026: {count: 2}}, {2026: {count: 1}}, {2026: {count: 1}}, ["", "ro/", "archive/"]],
    [{}, {}, {}, []],
  ];
  for (const [resolutions, budgets, archive, prefixes] of cases) {
    const {api, requests} = app();
    api.sources(resolutions, budgets, archive);
    await Promise.all([api.loadYear("2026"), api.loadYear("2026")]);
    const expected = prefixes.flatMap(prefix => ["index", "data"].map(kind => `/assets/usneseni/${prefix}${kind}/2026.json`));
    assert.deepEqual(requests, expected);
    await api.loadYear("2026");
    assert.deepEqual(requests, expected);
  }
});

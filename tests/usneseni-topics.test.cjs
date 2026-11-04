const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// Exercise the existing browser functions with fixture data and URL state.
function app(category = "", query = "", fixtureRecords = null) {
  const nodes = new Map();
  const events = {};
  const classes = new Set();
  const panel = {classList: {
    toggle: (name, enabled) => enabled ? classes.add(name) : classes.delete(name),
    contains: name => classes.has(name),
  }};
  function node(id) {
    if (!nodes.has(id)) nodes.set(id, {value: "", hidden: false, children: [], setAttribute: function(k, v) {this[k] = v;}, addEventListener: function(k, fn) {this[k] = fn;}, focus: () => {}, replaceChildren: function() {this.children = [];}, appendChild: function(child) {this.children.push(child);}, querySelectorAll: () => []});
    return nodes.get(id);
  }
  node("usn-topic").value = category;
  node("usn-sort").value = "desc";
  node("usn-q").value = query;
  const records = fixtureRecords || [
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
    "/assets/usneseni/data/2026.json": records.filter(r => !r.id.startsWith("RO/") && !r.type?.startsWith("archive_")),
    "/assets/usneseni/index/2026.json": {chodniku: [records[0].id], kulturni: [records[1].id]},
    "/assets/usneseni/ro/data/2026.json": records.filter(r => r.id.startsWith("RO/")),
    "/assets/usneseni/archive/data/2026.json": records.filter(r => r.type?.startsWith("archive_")),
  };
  const context = vm.createContext({
    UsneseniOutcomes: require("../usneseni/outcomes.js"),
    UsneseniSearchPreview: require("../usneseni/search-preview.js"),
    document: {createDocumentFragment: () => ({appendChild: () => {}}), getElementById: node, querySelector: selector => selector === ".usn-search-panel" ? panel : null, createElement: () => ({dataset: {}, setAttribute: function(name, value) {this[name] = value;}})},
    location: {pathname: "/usneseni/", search: "", hash: ""},
    history: {replaceState: (_, __, url) => {context.location.search = url;}},
    window: {innerWidth: 390, addEventListener: (name, fn) => {events[name] = fn;}},
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
    globalThis.api = {loadYear, setFiltersOpen, bindUiEvents, truncatePreview, cleanRoSnippet, buildSearchText, renderResolutionPreview, search, searchWithOpenFilters,
      sources: (resolutions, budgets, archive) => {META = resolutions; RO_META = budgets; ARCHIVE_META = archive;},
      findResults, parseQuery, updateUrl, loadFromUrl, filtersAreDefault, selectedOutcome, browseOutcome,
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
  return {api: context.api, context, node, requests, panel, events};
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


test("filter disclosure labels and cached return preserve the search", () => {
  const {api, node, context, panel, events} = app("transport", "chodniku");
  api.updateUrl();
  const url = context.location.search;
  api.bindUiEvents();
  node("usn-refine-toggle").click();
  assert.equal(panel.classList.contains("is-open"), true);
  assert.equal(node("usn-refine-toggle")["aria-expanded"], "true");
  assert.equal(node("usn-refine-toggle").textContent, "Skrýt upřesnění");
  node("usn-refine-toggle").click();
  assert.equal(node("usn-refine-toggle").textContent, "Upřesnit hledání");
  api.setFiltersOpen(true);
  events.pageshow({persisted: true});
  assert.equal(panel.classList.contains("is-open"), false);
  assert.equal(node("usn-refine-toggle")["aria-expanded"], "false");
  assert.equal(context.location.search, url);
  assert.equal(node("usn-topic").value, "transport");
  assert.equal(node("usn-q").value, "chodniku");
});

test("mobile search preserves an explicitly opened filter panel", async () => {
  const {api, panel} = app("transport", "chodniku");
  api.setFiltersOpen(true);
  await api.search();
  assert.equal(panel.classList.contains("is-open"), true);
  api.setFiltersOpen(false);
  await api.search();
  assert.equal(panel.classList.contains("is-open"), false);
});

test("preview truncation marks shortened text and leaves short text intact", () => {
  const {api} = app();
  assert.equal(api.truncatePreview("Krátké usnesení."), "Krátké usnesení.");
  const preview = api.truncatePreview("Dlouhé usnesení o opravě chodníku. ".repeat(15));
  assert.ok(preview.endsWith("…"));
  assert.ok(preview.length <= 181);
  const card = api.renderResultCard({id: "RM/1/1/2026", subject: "<text> ".repeat(50)}, null);
  assert.ok(card.innerHTML.includes("&lt;text&gt;"));
  assert.ok(card.innerHTML.includes("…"));
});

test("RO/17/2026 preview removes the imported unclosed RZ suffix and keeps its link", () => {
  const {api} = app();
  const records = JSON.parse(fs.readFileSync(path.join(__dirname, "../assets/usneseni/ro/data/2026.json"), "utf8"));
  const record = records.find(record => record.id === "RO/17/2026");
  const html = api.renderResultCard(record, api.parseQuery("Unčovice")).innerHTML;
  assert.match(html, /<strong>176\/2026\/RM<\/strong>/);
  assert.match(html, /#rz-176-2026-rm/);
  assert.match(html, /<mark>Unčovice<\/mark> - renovace vnitřních prostor<\/span>/);
  assert.doesNotMatch(html, /\(RZ/);
});

test("RO preview cleanup preserves descriptive parentheses and embedded references", () => {
  const {api} = app();
  for (const suffix of [" (RZ 176/2026/RM", " (RZ 176/2026/RM)", " (RZ176 / 2026 / ZM )  "]) {
    assert.equal(api.cleanRoSnippet("Renovace (první etapa)" + suffix), "Renovace (první etapa)");
  }
  for (const text of ["Renovace (první etapa)", "Renovace (RZ 176/2026/RM) a oprava střechy", "Renovace (RZ 176/2026/"]) {
    assert.equal(api.cleanRoSnippet(text), text);
  }
});


test("opening filters reveals selected older years without changing the selection", () => {
  const {api, node} = app();
  api.sources(Object.fromEntries([2031, 2030, 2029, 2028, 2027, 2026].map(y => [y, {count: 1}])), {}, {});
  api.setFiltersOpen(false);
  assert.notEqual(node("usn-older-years").open, true);
  api.setFiltersOpen(true);
  assert.equal(node("usn-older-years").open, true);
  assert.equal(api.filterSummary().find(f => f.key === "years").label, "Roky: 2026");
});

test("recent-year selections do not force the older-years disclosure open", () => {
  const {api, node} = app();
  api.setFiltersOpen(true);
  assert.notEqual(node("usn-older-years").open, true);
});

test("RM/2589/82/2026 shows all three original labels and school reports", () => {
  const {api} = app();
  const records = JSON.parse(fs.readFileSync(path.join(__dirname, "../assets/usneseni/data/2026.json"), "utf8"));
  const resolution = records.find(record => record.id === "RM/2589/82/2026");
  const card = api.renderResultCard(resolution, null).innerHTML;
  assert.ok(card.includes("3 rozhodnutí"));
  for (const label of ["a", "b", "c"]) assert.ok(card.includes(`class="usn-action-label">${label})</strong>`));
  assert.equal((card.match(/<li>/g) || []).length, 3);
  assert.ok(card.indexOf("Jungmannova") < card.indexOf("Vítězná"));
  assert.ok(card.indexOf("Vítězná") < card.indexOf("Nasobůrky"));
});

test("previews include subjects and single points, and limit longer item lists", () => {
  const {api} = app();
  const single = api.renderResolutionPreview({actions: ["schvaluje"], subject: "Změny programu", items: [{label: "a", text: "doplnění programu"}]});
  assert.ok(single.includes("Změny programu"));
  assert.ok(single.includes('class="usn-action-label">a)</strong> doplnění programu'));
  const multiple = api.renderResolutionPreview({items: Array.from({length: 5}, (_, i) => ({label: String(i + 1), text: `Rozhodnutí číslo ${i + 1}`}))});
  assert.equal((multiple.match(/<li>/g) || []).length, 3);
  assert.ok(multiple.includes("5 rozhodnutí"));
  assert.ok(multiple.includes("Další 2 rozhodnutí"));
  assert.ok(!multiple.includes("Rozhodnutí číslo 4"));
  assert.ok(!multiple.includes("Rozhodnutí číslo 5"));
});

test("item previews escape once and highlight accented text without changing labels", () => {
  const {api} = app();
  const resolution = {items: [{label: "<a>", text: 'lékař <img src=x onerror=alert(1)> & "citace"'}]};
  for (const terms of [[], ["lekar"]]) {
    const preview = api.renderResolutionPreview(resolution, terms);
    assert.ok(!preview.includes("<img"));
    assert.ok(preview.includes("&lt;img"));
    assert.ok(preview.includes("&amp;"));
    assert.ok(!preview.includes("&amp;lt;"));
    assert.ok(preview.includes("&lt;a&gt;)"));
    if (terms.length) assert.ok(preview.includes("<mark>lékař</mark>"));
  }
  assert.equal(api.truncatePreview("  Krátký  text\nbez ořezu. "), "Krátký text bez ořezu.");
});

test("search previews select late matching points and keep their original indices", () => {
  const {api, context} = app("property", "lékař");
  context.location.search = "?q=l%C3%A9ka%C5%99&category=property&y=2026";
  const record = {id: "RM/1/1/2026", items: Array.from({length: 7}, (_, index) => ({
    label: "a", text: index === 6 ? "Úvodní text. ".repeat(30) + "Pronájem ordinace pro lékaře v Litovli." : "schvaluje program",
  }))};
  const html = api.renderResultCard(record, api.parseQuery("lékař")).innerHTML;
  assert.match(html, /<mark>lékař<\/mark>e/);
  assert.match(html, /… /);
  assert.match(html, /#bod-7/);
  assert.doesNotMatch(html, /#bod-1/);
  assert.doesNotMatch(html, /schvaluje program/);
  const href = html.match(/href="([^"]+)"/)[1].replaceAll("&amp;", "&");
  const url = new URL(href, "https://litovle.cz");
  assert.equal(url.hash, "#bod-7");
  assert.equal(url.searchParams.get("back"), "/usneseni/" + context.location.search);
});

test("each displayed match has its own point link and only matching points count as remaining", () => {
  const {api} = app();
  const record = {id: "RM/1/1/2026", items: Array.from({length: 9}, (_, index) => ({
    label: String(index + 1), text: index % 2 ? "oprava školy" : "program schůze",
  }))};
  const html = api.renderResultCard(record, api.parseQuery("školy")).innerHTML;
  for (const index of [2, 4, 6]) assert.match(html, new RegExp(`class="usn-point-link" href="[^"]+#bod-${index}"`));
  assert.doesNotMatch(html, /#bod-8/);
  assert.match(html, /Další 1 rozhodnutí se shodou/);
  assert.doesNotMatch(html, /program schůze/);
});

test("generic query words do not hide the point with the complete match", () => {
  const {api} = app();
  const record = {id: "RM/1/1/2026", subject: "schvaluje dotace", items: Array.from({length: 7}, (_, index) => ({
    label: String(index + 1), text: "schvaluje dotace pro " + (index === 6 ? "Senzakord" : "školy"),
  }))};
  const html = api.renderResultCard(record, api.parseQuery("schvaluje dotace Senzakord")).innerHTML;
  assert.match(html, /#bod-7/);
  assert.match(html, /<mark>Senzakord<\/mark>/);
  assert.doesNotMatch(html, /#bod-1/);
  assert.match(html.match(/href="([^"]+)"/)[1], /#bod-7$/);
});

test("an exact phrase takes precedence over a point containing the words separately", () => {
  const {api} = app();
  const record = {id: "RM/1/1/2026", items: [
    {label: "a", text: "Zahrada školy a oprava chodníku"},
    {label: "b", text: "oprava školy v Litovli"},
  ]};
  const html = api.renderResultCard(record, api.parseQuery("oprava školy")).innerHTML;
  assert.match(html, /#bod-2/);
  assert.doesNotMatch(html, /#bod-1/);
});

test("subject and tail matches have contextual previews and distinct anchors", () => {
  const {api} = app();
  for (const [field, anchor] of [["subject", "predmet"], ["tail", "dovetek"]]) {
    const record = {id: "RM/1/1/2026", [field]: "Dlouhý úvod. ".repeat(30) + "oprava školy v Nasobůrkách"};
    const html = api.renderResultCard(record, api.parseQuery("Nasobůrkách")).innerHTML;
    assert.match(html, /<mark>Nasobůrkách<\/mark>/);
    assert.match(html, new RegExp(`#${anchor}`));
  }
  const html = api.renderResultCard({id: "RM/1/1/2026", subject: "oprava chodníku", tail: "oprava školy v Nasobůrkách"}, api.parseQuery("oprava školy")).innerHTML;
  assert.match(html.match(/href="([^"]+)"/)[1], /#dovetek$/);
});

test("outcome-only result links directly to the original matching point", () => {
  const {api, node} = app();
  node("usn-outcome").value = "rejected";
  const html = api.renderResultCard({id: "RM/1/1/2026", items: [
    {label: "a", text: "schvaluje program"}, {label: "b", text: "neschvaluje pronájem zahrady"},
  ]}, null).innerHTML;
  assert.match(html, /#bod-2/);
  assert.doesNotMatch(html, /#bod-1/);
});

test("outcome URLs survive reload and reject unknown values", () => {
  const {api, node, context} = app("transport", "chodniku");
  node("usn-outcome").value = "rejected";
  api.updateUrl();
  assert.equal(new URLSearchParams(context.location.search).get("outcome"), "rejected");
  node("usn-outcome").value = "";
  api.loadFromUrl();
  assert.equal(api.selectedOutcome(), "rejected");
  assert.equal(api.filtersAreDefault(), false);
  context.location.search = "?outcome=__proto__";
  api.loadFromUrl();
  assert.equal(api.selectedOutcome(), "");
  api.updateUrl();
  assert.equal(new URLSearchParams(context.location.search).has("outcome"), false);
});

const outcomeRecords = [
  {id: "RM/1/1/2026", organ: "RM", datum: "2026-01-01", actions: ["neschvaluje", "schvaluje"], classification: {category: "transport"}, items: [
    {label: "a", text: "neschvaluje pronájem zahrady"},
    {label: "b", text: "schvaluje opravu chodníku"},
  ]},
  {id: "RM/2/1/2026", organ: "RM", datum: "2026-02-01", actions: ["revokuje"], subject: "usnesení RM/1/1/2026.", references_out: [{raw: "RM/1/1/2026", resolved: "RM/1/1/2026"}]},
  {id: "RM/3/1/2026", organ: "RM", datum: "2026-03-01", actions: ["odkládá"], subject: "opravu školy"},
  {id: "RO/1/2026", organ: "RM", approval_date: "2026-03-01", notes: []},
  {id: "archive-1", organ: "RM", type: "archive_resolution", date: "2026-04-01", display_text: "neschvaluje žádost"},
];

test("a parsed mění action remains searchable, highlighted and included in the existing changed filter", async () => {
  const previous = {id: "RM/2563/81/2026", organ: "RM", datum: "2026-10-01", actions: ["souhlasí"], subject: "s nákupem vybavení"};
  const changed = {id: "RM/2592/82/2026", organ: "RM", datum: "2026-10-22", actions: ["mění"],
    subject: "usnesení č. RM/2563/81/2026: částka 1.800.000 Kč se nahrazuje částkou 2.000.000 Kč.",
    references_out: [{raw: "RM/2563/81/2026", resolved: previous.id}]};
  const {api, node} = app("", "", [previous, changed]);
  assert.ok(api.buildSearchText(changed).startsWith("meni usneseni"));
  node("usn-outcome").value = "changed";
  assert.deepEqual(ids(await api.findResults(null)), [changed.id]);
  assert.deepEqual(ids(await api.findResults(api.parseQuery("mění"))), [changed.id]);
  node("usn-outcome").value = "";
  const card = api.renderResultCard(changed, api.parseQuery("mění")).innerHTML;
  assert.match(card, /class="usn-summary"><mark>mění<\/mark>/);
  assert.match(card, /#predmet/);
});

test("outcome-only browsing respects topic and document filters, and excludes missing data", async () => {
  const {api, node} = app("", "", outcomeRecords);
  for (const [outcome, expected] of [["rejected", "RM/1/1/2026"], ["changed", "RM/2/1/2026"], ["deferred", "RM/3/1/2026"]]) {
    node("usn-outcome").value = outcome;
    assert.deepEqual(ids(await api.findResults(null)), [expected]);
  }
  node("usn-topic").value = "transport";
  assert.deepEqual(ids(await api.findResults(null)), []);
  node("usn-outcome").value = "rejected";
  assert.deepEqual(ids(await api.findResults(null)), ["RM/1/1/2026"]);
  api.empty();
  assert.deepEqual(ids(await api.findResults(null)), []);
});

test("text search must match the selected decision point", async () => {
  const {api, node} = app("", "", outcomeRecords);
  node("usn-outcome").value = "rejected";
  assert.deepEqual(ids(await api.findResults(api.parseQuery("zahrady"))), ["RM/1/1/2026"]);
  assert.deepEqual(ids(await api.findResults(api.parseQuery("chodniku"))), []);
  const preview = api.renderResolutionPreview(outcomeRecords[0], ["zahrady"]);
  assert.ok(preview.includes("1 odpovídající bod z 2"));
  assert.ok(preview.includes("<mark>zahrady</mark>"));
  assert.ok(!preview.includes("opravu chodníku"));
  assert.ok(!preview.includes('class="usn-action-label">b)'));
});

test("search terms cannot be combined across separate decision points", async () => {
  const split = {...outcomeRecords[0], items: [
    {label: "a", text: "neschvaluje pronájem zahrady"},
    {label: "b", text: "neschvaluje opravu chodníku"},
  ]};
  const {api, node} = app("", "", [split, outcomeRecords[1]]);
  node("usn-outcome").value = "rejected";
  assert.deepEqual(ids(await api.findResults(api.parseQuery("zahrady chodniku"))), []);
});

test("revocations link available originals outside the main result link", async () => {
  const {api, node} = app("", "", outcomeRecords);
  node("usn-outcome").value = "changed";
  const [record] = await api.findResults(null);
  const html = api.renderResultCard(record, null).innerHTML;
  assert.ok(html.includes("Původní usnesení:"));
  assert.ok(html.includes('href="/usneseni/2026/RM-1-1-2026/?back='));
  assert.ok(html.indexOf("usn-related-decisions") > html.indexOf("</a>"));
  const missing = {...record, subject: "usnesení RM/9999/1/2026.", references_out: [{raw: "RM/9999/1/2026", resolved: "RM/9999/1/2026"}]};
  const unavailable = api.renderResultCard(missing, null).innerHTML;
  assert.ok(unavailable.includes("nepodařilo dohledat"));
  assert.ok(!unavailable.includes('href="/usneseni/2026/RM-9999-1-2026/'));
});

test("outcome shortcut starts results without a query and clearing restores welcome", async () => {
  const {api, node, context} = app("", "", outcomeRecords);
  await api.browseOutcome("rejected");
  assert.equal(new URLSearchParams(context.location.search).get("outcome"), "rejected");
  assert.equal(node("usn-topics").hidden, true);
  assert.equal(node("usn-outcome-note").hidden, false);
  assert.ok(api.filterSummary().some(filter => filter.key === "outcome"));
  await api.clear("outcome");
  assert.equal(node("usn-topics").hidden, false);
  assert.equal(node("usn-outcome-note").hidden, true);
  assert.equal(new URLSearchParams(context.location.search).has("outcome"), false);
});

test("clearing an outcome preserves the query and topic", async () => {
  const {api, node, context} = app("transport", "zahrady", outcomeRecords);
  node("usn-outcome").value = "rejected";
  await api.clear("outcome");
  assert.equal(node("usn-q").value, "zahrady");
  assert.equal(node("usn-topic").value, "transport");
  assert.equal(node("usn-topics").hidden, true);
  assert.equal(new URLSearchParams(context.location.search).has("outcome"), false);
});

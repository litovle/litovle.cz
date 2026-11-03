(function (root) {
  "use strict";
  const B = typeof module !== "undefined" && module.exports ? require("./model.js") : root.BudgetModel;
  const places = [...Object.keys(B.localParts), "unassigned"];
  const scope = "city_and_funds_capital_excluding_internal_transfers";
  // ODPA divisions, with citizen-facing labels. No description-based classification.
  const divisions = Object.freeze({
    "10": "Lesy a zemědělství", "21": "Energetika a hospodářství", "22": "Doprava",
    "23": "Voda a kanalizace", "31": "Školy a vzdělávání", "32": "Školy a vzdělávání",
    "33": "Kultura a památky", "34": "Sport a volný čas", "35": "Zdravotní a sociální péče",
    "36": "Bydlení a veřejný prostor", "37": "Životní prostředí", "43": "Zdravotní a sociální péče",
    "52": "Bezpečnost a hasiči", "53": "Bezpečnost a hasiči", "55": "Bezpečnost a hasiči",
    "61": "Správa města", "63": "Ostatní investice", "64": "Ostatní investice"
  });
  const code = value => String(value ?? "").replace(/\s/g, "");
  const category = row => divisions[code(row.codes?.ODPA).slice(0, 2)] || "Ostatní investice";
  const amount = value => Number.isSafeInteger(value);
  const date = value => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
  const safeHref = value => typeof value === "string" && (/^\/(?!\/)/.test(value) || /^https:\/\//.test(value))
    && !/[\s\\]/.test(value);
  const source = value => !!value && typeof value.title === "string" && !!value.title.trim() && safeHref(value.url)
    && typeof value.copy === "string" && /^\/assets\/rozpocet\/[\w.-]+$/.test(value.copy)
    && /^[a-f0-9]{64}$/.test(value.sha256 || "");
  const sum = rows => rows.reduce((n, r) => n + r.amount_minor, 0);
  const grouped = rows => Object.fromEntries(places.map(place => [place, sum(rows.filter(r => B.locality(r) === place))]));
  const validRow = row => row && row.verified === true && amount(row.amount_minor)
    && typeof row.id === "string" && !!row.id && typeof row.description === "string"
    && /^6\d{3}$/.test(code(row.codes?.POL)) && /^\d{4}$/.test(code(row.codes?.ODPA));
  function matchesControl(control, rows) {
    const totals = grouped(rows);
    return control && source(control.source) && amount(control.total_minor) && sum(rows) === control.total_minor
      && Object.keys(control.by_place || {}).length === places.length
      && places.every(place => amount(control.by_place[place]) && control.by_place[place] === totals[place]);
  }
  function allocationKey(row) {
    return JSON.stringify(Object.entries(row.codes).map(([key, value]) => [key, code(value)])
      .filter(([, value]) => value).sort(([a], [b]) => a.localeCompare(b)));
  }
  function allocations(rows) {
    const result = new Map();
    for (const row of rows) {
      const key = allocationKey(row);
      const item = result.get(key) || {...row, amount_minor: 0, sources: []};
      item.amount_minor += row.amount_minor;
      if (row.amount_minor > 0) item.description = row.description;
      if (row.source && !item.sources.some(s => s.url === row.source.url)) item.sources.push(row.source);
      result.set(key, item);
    }
    return [...result.values()].sort((a, b) => b.amount_minor - a.amount_minor);
  }
  function prepare(snapshot, amendments) {
    const fail = reason => ({ready: false, reason});
    if (!snapshot || snapshot.schema_version !== 1 || snapshot.year !== amendments?.year) return fail("invalid_snapshot");
    if (!snapshot.opening) return fail("missing_opening");
    if (!snapshot.population) return fail("missing_population");
    if (!snapshot.reconciliation) return fail("missing_reconciliation");
    const opening = snapshot.opening, population = snapshot.population, control = snapshot.reconciliation;
    if (snapshot.scope !== scope || !date(opening.approved_date) || opening.approved_date > `${snapshot.year}-01-01`
      || !source(opening.source) || opening.complete !== true
      || !Array.isArray(opening.rows) || !opening.rows.length || !opening.rows.every(r => validRow(r) && r.amount_minor >= 0)
      || new Set(opening.rows.map(r => r.id)).size !== opening.rows.length
      || !Array.isArray(opening.included_document_ids) || new Set(opening.included_document_ids).size !== opening.included_document_ids.length
      || !matchesControl(opening.control, opening.rows)) return fail("invalid_opening");
    if (!date(population.date) || population.date > `${snapshot.year}-01-01` || !source(population.source)
      || typeof population.definition !== "string" || !population.definition.trim()
      || Object.keys(population.by_place || {}).length !== places.length - 1
      || !places.filter(p => p !== "unassigned").every(p => Number.isSafeInteger(population.by_place[p]) && population.by_place[p] > 0)) return fail("invalid_population");
    const documents = amendments.documents;
    const entries = [...(amendments.earlier_entries || []), ...(amendments.entries || []), ...(amendments.later_entries || [])];
    if (!Array.isArray(documents) || !documents.length || documents.length !== amendments.coverage?.documents
      || new Set(documents.map(d => d.id)).size !== documents.length || amendments.coverage.unresolved_rows !== 0
      || !date(amendments.latest_approval_date) || !amendments.latest_approval_date.startsWith(`${snapshot.year}-`)
      || !documents.every(d => {
        const c = d.budget_changes;
        return date(d.approval_date) && safeHref(d.href) && c?.verified === true && c.balanced === true
          && Number.isSafeInteger(c.row_count) && c.row_count > 0
          && [c.income_minor, c.expenditure_minor, c.financing_minor].every(amount)
          && c.income_minor + c.financing_minor === c.expenditure_minor;
      }) || documents.reduce((n, d) => n + d.budget_changes.row_count, 0) !== amendments.coverage.source_rows) return fail("incomplete_amendments");
    const byDocument = new Map(documents.map(d => [d.id, d]));
    if (opening.included_document_ids.some(id => !byDocument.has(id) || byDocument.get(id).approval_date > `${snapshot.year}-01-01`)
      || documents.some(d => d.approval_date < opening.approved_date && !opening.included_document_ids.includes(d.id))
      || documents.some(d => d.approval_date > amendments.latest_approval_date)) return fail("ambiguous_opening_period");
    const changes = [];
    for (const entry of entries) {
      const document = byDocument.get(entry.document_id);
      if (!document || entry.approval_date !== document.approval_date || !safeHref(entry.href) || !Array.isArray(entry.rows)) return fail("invalid_amendment_rows");
      for (const row of entry.rows) {
        if (row.category !== "capital") {
          if (code(row.codes?.POL).startsWith("6")) return fail("invalid_amendment_rows");
          continue;
        }
        if (!validRow(row)) return fail("invalid_amendment_rows");
        changes.push({...row, approval_date: entry.approval_date, document_id: entry.document_id,
          source: {title: entry.rz_id || entry.document_id, url: entry.href}});
      }
    }
    if (changes.length !== amendments.coverage.dispositions?.capital || new Set(changes.map(r => r.id)).size !== changes.length) return fail("incomplete_amendment_rows");
    const initial = opening.rows.map(r => ({...r, source: {...opening.source, url: `${opening.source.url.split("#")[0]}${r.source_page ? `#page=${r.source_page}` : ""}`}}));
    const effective = changes.filter(r => !opening.included_document_ids.includes(r.document_id));
    const currentRows = [...initial, ...effective];
    if (!date(control.date) || control.date !== amendments.latest_approval_date || !matchesControl(control, currentRows)
      || !amount(sum(currentRows)) || allocations(currentRows).some(r => !amount(r.amount_minor) || r.amount_minor < 0)) return fail("unreconciled_totals");
    const prepared = {ready: true, year: snapshot.year, latest_date: control.date, initial, changes: effective, population,
      sources: [opening.source, population.source, opening.control.source, control.source]};
    for (let month = 1; month <= Number(control.date.slice(5, 7)); month++) {
      if (!overview(prepared, month)) return fail("unreconciled_period");
    }
    return prepared;
  }
  function overview(prepared, month, place = "all") {
    if (!prepared.ready) return null;
    const latestMonth = Number(prepared.latest_date.slice(5, 7));
    month = Number.isInteger(month) && month >= 1 && month <= latestMonth ? month : latestMonth;
    place = places.includes(place) ? place : "all";
    const monthEnd = new Date(Date.UTC(prepared.year, month, 0)).toISOString().slice(0, 10);
    const cutoff = monthEnd < prepared.latest_date ? monthEnd : prepared.latest_date;
    const changes = prepared.changes.filter(r => r.approval_date <= cutoff);
    const rows = [...prepared.initial, ...changes];
    const items = allocations(rows);
    if (items.some(r => r.amount_minor < 0 || !amount(r.amount_minor))) return null;
    const totals = grouped(rows);
    const scoped = rows.filter(r => place === "all" || B.locality(r) === place);
    const categories = new Map();
    for (const row of scoped) categories.set(category(row), (categories.get(category(row)) || 0) + row.amount_minor);
    const events = new Map();
    for (const row of changes.filter(r => place === "all" || B.locality(r) === place)) events.set(row.approval_date, (events.get(row.approval_date) || 0) + row.amount_minor);
    let running = sum(prepared.initial.filter(r => place === "all" || B.locality(r) === place));
    const timeline = [...events].sort(([a], [b]) => a.localeCompare(b)).map(([eventDate, change]) => ({date: eventDate, change, value: running += change,
      sources: changes.filter(r => r.approval_date === eventDate && (place === "all" || B.locality(r) === place)).map(r => r.source)}));
    return {date: cutoff, total: sum(rows), unassigned: totals.unassigned, scopedTotal: sum(scoped),
      places: Object.entries(B.localParts).map(([id, label]) => ({id, label, total: totals[id], population: prepared.population.by_place[id], per_person_minor: totals[id] / prepared.population.by_place[id]})),
      categories: [...categories].filter(([, value]) => value !== 0).map(([label, value]) => ({label, value})).sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, "cs")),
      allocations: items.filter(r => r.amount_minor > 0 && (place === "all" || B.locality(r) === place)),
      opening: sum(prepared.initial.filter(r => place === "all" || B.locality(r) === place)), timeline};
  }
  const api = {prepare, overview, category, safeHref, scope};
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.InvestmentModel = api;
})(typeof globalThis !== "undefined" ? globalThis : this);

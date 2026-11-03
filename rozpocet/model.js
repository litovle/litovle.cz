(function (root) {
  "use strict";
  const months = ["Leden", "Únor", "Březen", "Duben", "Květen", "Červen", "Červenec", "Srpen", "Září", "Říjen", "Listopad", "Prosinec"];
  const money = new Intl.NumberFormat("cs-CZ", {style: "currency", currency: "CZK", maximumFractionDigits: 2});
  // ORJ mapping in the city's final accounts, section 3.6, table 14.
  const localParts = Object.freeze({301: "Myslechovice", 302: "Chudobín", 303: "Nová Ves", 304: "Rozvadovice",
    305: "Březové", 306: "Víska", 307: "Chořelice", 308: "Tři Dvory", 309: "Nasobůrky", 310: "Unčovice", 311: "Savín"});
  const knownPlace = value => Object.prototype.hasOwnProperty.call(localParts, value);
  const locality = row => {
    const code = String(row.codes?.ORJ ?? "").replace(/\s/g, "");
    return knownPlace(code) ? code : "unassigned";
  };
  const matchesPlace = (row, place = "all") => place === "all" || locality(row) === place;
  const placeLabel = (place = "all") => knownPlace(place) ? localParts[place] : (place === "unassigned" ? "Bez přiřazení místní části" : "Celé město a místní části");
  const scopedRows = (entry, place = "all") => entry.rows.filter(row => matchesPlace(row, place));
  const normalize = value => String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const eligible = (row, mode) => row.category === "capital" || (mode === "all" && row.category === "operating");
  function totals(entry, mode, place = "all") {
    let increase = 0, reduction = 0;
    for (const row of entry.rows) {
      if (!eligible(row, mode) || !matchesPlace(row, place)) continue;
      if (row.amount_minor >= 0) increase += row.amount_minor;
      else reduction += row.amount_minor;
    }
    return {increase, reduction, net: increase + reduction};
  }
  function visibleEntries(data, state) {
    return data.entries.filter(entry => Number(entry.approval_date.slice(5, 7)) <= state.month)
      .map(entry => state.place && state.place !== "all" ? {...entry, rows: scopedRows(entry, state.place)} : entry)
      .filter(entry => entry.rows.some(row => eligible(row, state.mode) || row.category === "unresolved"))
      .filter(entry => !state.date || entry.approval_date === state.date)
      .filter(entry => !state.onlyMonth || Number(entry.approval_date.slice(5, 7)) === state.month)
      .filter(entry => normalize([entry.rz_id, entry.document_id, ...entry.notes, ...entry.rows.map(row => row.description)].join(" ")).includes(normalize(state.query || "")));
  }
  function series(data, mode, month, place = "all") {
    const events = new Map();
    const monthly = Array(12).fill(0);
    for (const entry of data.entries) {
      const m = Number(entry.approval_date.slice(5, 7));
      if (m > month) continue;
      monthly[m - 1] += totals(entry, mode, place).net;
      if (entry.rows.some(row => eligible(row, mode) && matchesPlace(row, place))) {
        events.set(entry.approval_date, (events.get(entry.approval_date) || 0) + totals(entry, mode, place).net);
      }
    }
    let cumulative = 0;
    const steps = [...events].sort(([a], [b]) => a.localeCompare(b)).map(([date, change]) => ({date, change, value: cumulative += change}));
    return {steps, monthly, net: cumulative};
  }
  function fromUrl(search, latestMonth) {
    const params = new URLSearchParams(search);
    const candidate = Number(params.get("month"));
    return {month: Number.isInteger(candidate) && candidate >= 1 && candidate <= latestMonth ? candidate : latestMonth,
      mode: params.get("mode") === "all" ? "all" : "capital",
      place: knownPlace(params.get("place")) || params.get("place") === "unassigned" ? params.get("place") : "all",
      query: params.get("q") || "", date: "", onlyMonth: false};
  }
  function toUrl(state) {
    const params = new URLSearchParams({month: String(state.month), mode: state.mode});
    if (state.query) params.set("q", state.query);
    if (state.place && state.place !== "all") params.set("place", state.place);
    return "?" + params.toString();
  }
  function budgetOverview(approved, data, month) {
    const keys = ["income_minor", "expenditure_minor", "financing_minor"];
    const initial = approved?.scopes?.combined;
    if (approved?.year !== data.year || !initial || !keys.every(key => Number.isSafeInteger(initial[key]))
      || initial.income_minor + initial.financing_minor !== initial.expenditure_minor) return null;
    const monthEnd = new Date(Date.UTC(data.year, month, 0)).toISOString().slice(0, 10);
    const date = data.latest_approval_date && data.latest_approval_date < monthEnd ? data.latest_approval_date : monthEnd;
    const documents = data.documents.filter(doc => doc.approval_date >= approved.approved_date && doc.approval_date <= date);
    const result = {initial, current: null, date, documentCount: documents.length};
    // A balanced total alone cannot establish that every source row is covered.
    const complete = data.documents.length === data.coverage.documents
      && data.documents.every(doc => Number.isSafeInteger(doc.budget_changes?.row_count))
      && data.documents.reduce((sum, doc) => sum + doc.budget_changes.row_count, 0) === data.coverage.source_rows;
    if (!complete || !documents.every(doc => {
      const c = doc.budget_changes;
      return c.verified && c.balanced && keys.every(key => Number.isSafeInteger(c[key]))
        && c.income_minor + c.financing_minor === c.expenditure_minor;
    })) return result;
    const current = Object.fromEntries(keys.map(key => [key, initial[key] + documents.reduce((sum, doc) => sum + doc.budget_changes[key], 0)]));
    if (keys.every(key => Number.isSafeInteger(current[key])) && current.income_minor + current.financing_minor === current.expenditure_minor) result.current = current;
    return result;
  }
  const csvCell = value => {
    let text = String(value ?? "");
    if (/^[=+\-@\t\r]/.test(text) && !/^-?\d+(\.\d+)?$/.test(text)) text = "'" + text;
    return '"' + text.replace(/"/g, '""') + '"';
  };
  function csv(entries, mode, place = "all") {
    const rows = [["Datum", "RZ", "Dokument", "Navýšení Kč", "Snížení Kč", "Čistá změna Kč", "Nezařazené řádky", "Popis", "Zdroj", "Výběr místní části"]];
    for (const entry of entries) {
      const t = totals(entry, mode, place);
      const selected = scopedRows(entry, place);
      rows.push([entry.approval_date, entry.rz_id, entry.document_id,
        (t.increase / 100).toFixed(2), (t.reduction / 100).toFixed(2), (t.net / 100).toFixed(2),
        selected.filter(row => row.category === "unresolved").length,
        selected.map(row => row.description).join(" | "), "https://litovle.cz" + entry.href, placeLabel(place)]);
    }
    return "\uFEFF" + rows.map(row => row.map(csvCell).join(";")).join("\r\n");
  }
  const api = {months, money, localParts, locality, matchesPlace, placeLabel, normalize, eligible, totals, visibleEntries, series, fromUrl, toUrl, budgetOverview, csv};
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.BudgetModel = api;
})(typeof globalThis !== "undefined" ? globalThis : this);

(() => {
  "use strict";
  const root = document.querySelector(".investment-app");
  if (!root) return;
  const params = new URLSearchParams(location.search);
  if (params.get("mode") === "all" || params.has("q")) {
    const target = new URL(root.dataset.detailsUrl, location.href);
    target.search = location.search;
    target.hash = location.hash;
    location.replace(target.href);
    return;
  }
  const M = window.InvestmentModel, B = window.BudgetModel;
  const get = id => document.getElementById("investment-" + id);
  const money = new Intl.NumberFormat("cs-CZ", {style: "currency", currency: "CZK", maximumFractionDigits: 0});
  const integer = new Intl.NumberFormat("cs-CZ");
  const format = minor => money.format(minor / 100);
  const dateText = value => new Intl.DateTimeFormat("cs-CZ").format(new Date(value + "T12:00:00Z"));
  const node = (tag, text, attrs = {}) => {
    const element = document.createElement(tag);
    if (text !== undefined) element.textContent = text;
    for (const [key, value] of Object.entries(attrs)) element.setAttribute(key, value);
    return element;
  };
  function link(source) {
    return M.safeHref(source.url) ? node("a", source.title, {href: source.url}) : node("span", source.title);
  }
  function sources(container, values) {
    const unique = [...new Map(values.map(s => [s.url, s])).values()];
    unique.forEach((s, index) => {if (index) container.append(document.createTextNode(" · ")); container.append(link(s));});
  }
  let prepared, state;
  function readState() {
    const search = new URLSearchParams(location.search);
    const base = B.fromUrl(location.search, Number(prepared.latest_date.slice(5, 7)));
    return {month: base.month, place: base.place, unit: search.get("unit") === "total" ? "total" : "person"};
  }
  function writeState() {
    const search = new URLSearchParams({month: String(state.month)});
    if (state.place !== "all") search.set("place", state.place);
    if (state.unit === "total") search.set("unit", "total");
    history.replaceState(null, "", "?" + search + location.hash);
  }
  function pending(message) {
    get("content").hidden = true;
    get("pending").hidden = false;
    get("status").hidden = !message;
    get("status").textContent = message || "";
  }
  function choosePlace(place, focus = false) {
    state.place = place;
    render();
    if (focus) {
      get("categories-title").setAttribute("tabindex", "-1");
      get("categories-title").focus();
    }
  }
  function bar(label, value, max, description, action, pressed) {
    const row = node(action ? "button" : "div", undefined, {class: "investment-bar-row"});
    if (action) {
      row.type = "button";
      row.setAttribute("aria-pressed", String(pressed));
      row.addEventListener("click", action);
    }
    const heading = node("span", undefined, {class: "investment-bar-heading"});
    heading.append(node("span", label), node("strong", format(value)));
    const track = node("span", undefined, {class: "investment-bar-track", "aria-hidden": "true"});
    const fill = node("span");
    fill.style.width = `${max > 0 ? Math.max(0, value) / max * 100 : 0}%`;
    track.append(fill);
    row.append(heading, track);
    if (description) row.append(node("span", description, {class: "investment-bar-description"}));
    return row;
  }
  function categoryBars(container, categories) {
    container.replaceChildren();
    const max = Math.max(0, ...categories.map(c => c.value));
    if (!categories.length) container.append(node("p", "V ověřeném plánu nejsou pro tento výběr přímo přiřazené investiční položky.", {class: "budget-help"}));
    for (const item of categories) container.append(bar(item.label, item.value, max));
  }
  function render() {
    const view = M.overview(prepared, state.month, state.place);
    if (!view) {
      pending("Pro zvolený měsíc nelze částky spolehlivě ověřit. Podklady a rozpočtové změny jsou dostupné samostatně.");
      return;
    }
    get("pending").hidden = true;
    get("status").hidden = true;
    get("content").hidden = false;
    get("month").value = String(state.month);
    get("place").value = state.place;
    get("date").textContent = `Schválený plán po změnách do ${dateText(view.date)}. Nejde o skutečné čerpání.`;
    get("per-person").setAttribute("aria-pressed", String(state.unit === "person"));
    get("total").setAttribute("aria-pressed", String(state.unit === "total"));
    const key = state.unit === "total" ? "total" : "per_person_minor";
    const sorted = [...view.places].sort((a, b) => b[key] - a[key] || a.label.localeCompare(b.label, "cs"));
    const max = Math.max(0, ...sorted.map(p => p[key]));
    get("places").replaceChildren(...sorted.map(p => bar(p.label, p[key], max,
      `${state.unit === "person" ? `Celkem ${format(p.total)}` : `${format(p.per_person_minor)} na obyvatele`} · ${integer.format(p.population)} obyvatel`,
      () => choosePlace(p.id, true), state.place === p.id)));
    get("population").replaceChildren(document.createTextNode(`Počty obyvatel k ${dateText(prepared.population.date)}. ${prepared.population.definition} Zdroj: `), link(prepared.population.source));
    get("city-total").textContent = format(view.total);
    get("unassigned").textContent = format(view.unassigned);
    get("category-scope").textContent = `${B.placeLabel(state.place)} · plánované investice ${format(view.scopedTotal)}${state.place === "all" ? ", včetně investic bez přiřazení místní části." : "."}`;
    const top = view.categories.slice(0, 5);
    const rest = view.categories.slice(5);
    if (rest.length) top.push({label: "Ostatní oblasti", value: rest.reduce((n, c) => n + c.value, 0)});
    categoryBars(get("categories"), top);
    get("more-categories").hidden = !rest.length;
    categoryBars(get("all-categories"), view.categories);
    get("detail").hidden = state.place === "all";
    if (state.place !== "all") {
      const selected = view.places.find(p => p.id === state.place);
      get("detail-title").textContent = B.placeLabel(state.place);
      get("detail-total").textContent = `${format(view.scopedTotal)} plánovaných investic${selected ? ` · ${format(selected.per_person_minor)} na obyvatele` : ""}`;
      const items = view.allocations.slice(0, 5).map(item => {
        const li = node("li");
        li.append(node("p", item.description), node("strong", format(item.amount_minor)));
        const refs = node("p", undefined, {class: "budget-help"}); sources(refs, item.sources); li.append(refs);
        return li;
      });
      get("allocations").replaceChildren(...items);
      if (!items.length) get("allocations").append(node("li", "V ověřeném plánu nejsou přímo přiřazené investiční položky. Sdílené investice nejsou zahrnuté."));
      get("opening").replaceChildren(document.createTextNode(`Výchozí investiční plán: ${format(view.opening)}. `), link(prepared.sources[0]));
      get("timeline").replaceChildren(...view.timeline.map(event => {
        const li = node("li");
        li.append(node("p", `${dateText(event.date)}: ${event.change > 0 ? "+" : ""}${format(event.change)} → plán ${format(event.value)}`));
        sources(li, event.sources);
        return li;
      }));
      if (!view.timeline.length) get("timeline").append(node("li", "Do zvoleného data nejsou zahrnuty žádné přímo přiřazené investiční změny."));
      get("result").textContent = `Plán po změnách do ${dateText(view.date)}: ${format(view.scopedTotal)}.`;
    }
    get("sources").replaceChildren();
    sources(get("sources"), prepared.sources);
    writeState();
  }
  async function init() {
    try {
      const [snapshot, amendments] = await Promise.all([root.dataset.investmentsUrl, root.dataset.amendmentsUrl].map(async url => {
        const response = await fetch(url);
        if (!response.ok) throw new Error("Data unavailable");
        return response.json();
      }));
      prepared = M.prepare(snapshot, amendments);
      if (!prepared.ready) {
        pending(["missing_opening", "missing_population", "missing_reconciliation"].includes(prepared.reason) ? "" : "Úplnost nebo součty podkladů zatím nelze ověřit. Srovnání proto nezobrazujeme.");
        return;
      }
      state = readState();
      for (let month = 1; month <= Number(prepared.latest_date.slice(5, 7)); month++) get("month").append(node("option", B.months[month - 1], {value: month}));
      get("place").append(node("option", "Celé město a místní části", {value: "all"}));
      for (const [id, label] of Object.entries(B.localParts)) get("place").append(node("option", label, {value: id}));
      get("place").append(node("option", "Bez přiřazení místní části", {value: "unassigned"}));
      get("month").addEventListener("change", () => {state.month = Number(get("month").value); render();});
      get("place").addEventListener("change", () => choosePlace(get("place").value));
      get("show-unassigned").addEventListener("click", () => choosePlace("unassigned", true));
      for (const [id, unit] of [["total", "total"], ["per-person", "person"]]) get(id).addEventListener("click", () => {state.unit = unit; render();});
      window.addEventListener("popstate", () => {state = readState(); render();});
      render();
    } catch {
      pending("Podklady se nepodařilo načíst. Zkuste stránku obnovit; dostupný rozpočet a jeho změny můžete otevřít v odkazu níže.");
    }
  }
  init();
})();

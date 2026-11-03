(() => {
  "use strict";
  const M = window.BudgetModel;
  const root = document.querySelector(".budget-app");
  if (!root || !M) return;
  const get = id => document.getElementById("budget-" + id);
  const format = amount => M.money.format(amount / 100);
  const short = amount => new Intl.NumberFormat("cs-CZ", {notation: "compact", maximumFractionDigits: 1}).format(amount / 100) + " Kč";
  const dateText = value => new Intl.DateTimeFormat("cs-CZ").format(new Date(value + "T12:00:00Z"));
  let data, approved, state, currentRows = [], sort = {key: "date", descending: true};
  const node = (tag, text, attrs = {}) => {
    const element = document.createElement(tag);
    if (text !== undefined) element.textContent = text;
    for (const [key, value] of Object.entries(attrs)) element.setAttribute(key, value);
    return element;
  };
  const svgNode = (tag, attrs, text) => {
    const element = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (const [key, value] of Object.entries(attrs)) element.setAttribute(key, value);
    if (text !== undefined) element.textContent = text;
    return element;
  };
  function activate(element, action) {
    element.addEventListener("click", action);
    element.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {event.preventDefault(); action();}
    });
  }
  function cutoff() {
    const end = new Date(Date.UTC(data.year, state.month, 0)).toISOString().slice(0, 10);
    return data.latest_approval_date && data.latest_approval_date < end ? data.latest_approval_date : end;
  }
  function chooseDate(value) {
    state.date = value;
    state.onlyMonth = false;
    renderTable();
    get("selection").focus();
    get("entries-title").scrollIntoView({behavior: "instant", block: "start"});
  }
  function chooseMonth(value) {
    state.month = value;
    state.date = "";
    state.onlyMonth = true;
    get("month").value = String(value);
    render();
    get("selection").focus();
    get("entries-title").scrollIntoView({behavior: "instant", block: "start"});
  }
  async function loadApprovedBudget() {
    try {
      const response = await fetch(root.dataset.approvedUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const snapshot = await response.json();
      if (snapshot.schema_version !== 1 || !Array.isArray(snapshot.expenditure_sectors) || !M.budgetOverview(snapshot, data, state.month)) throw new Error("Invalid approved budget");
      approved = snapshot;
      get("whole-source").replaceChildren(document.createTextNode(`Výchozí roční rozpočet schválilo zastupitelstvo ${dateText(approved.approved_date)}. `),
        node("a", `Usnesení ${approved.resolution_id} →`, {href: approved.resolution_href}));
      const sectors = document.createDocumentFragment();
      for (const sector of approved.expenditure_sectors) {
        const tr = node("tr");
        tr.append(node("th", `${sector.label} (${sector.code})`, {scope: "row"}), node("td", format(sector.amount_minor)));
        sectors.append(tr);
      }
      get("sectors").replaceChildren(sectors);
      const totals = document.createDocumentFragment();
      for (const [label, scope] of [["Hlavní rozpočtový okruh celkem", "main"], ["Městské fondy celkem", "funds"], ["Celé město a fondy celkem", "combined"]]) {
        const tr = node("tr"); tr.append(node("th", label, {scope: "row"}), node("td", format(approved.scopes[scope].expenditure_minor))); totals.append(tr);
      }
      get("sector-totals").replaceChildren(totals);
      get("whole-content").hidden = false;
    } catch {
      approved = null;
      get("whole-status").textContent = "Souhrnná data rozpočtu se nepodařilo načíst. Oficiální rozpočet a schvalující usnesení můžete otevřít v odkazech níže. Grafy změn jsou dostupné samostatně.";
    }
  }
  function renderWholeBudget() {
    if (!approved) return;
    const overview = M.budgetOverview(approved, data, state.month);
    if (!overview) return;
    for (const [label, key] of [["income", "income_minor"], ["expenditure", "expenditure_minor"], ["financing", "financing_minor"]]) {
      get("original-" + label).textContent = format(overview.initial[key]);
      get("current-" + label).textContent = overview.current ? format(overview.current[key]) : "Nelze ověřit";
    }
    get("whole-date").textContent = `Po zahrnutých změnách do ${dateText(overview.date)}`;
    get("whole-status").hidden = !!overview.current;
    if (!overview.current) get("whole-status").textContent = "Aktualizovaný celkový rozpočet nelze bezpečně dopočítat: účetní řádky nejsou kompletně ověřené nebo jejich součty nesouhlasí. Původně schválené částky jsou uvedené podle oficiálního dokumentu.";
    get("whole-calculation").textContent = overview.current
      ? `Částky po změnách jsou náš výpočet: schválený rozpočet + ${overview.documentCount} zahrnutých opatření do ${dateText(overview.date)}. Filtr místní části ani druhu výdajů tento celoměstský přehled neomezuje. Podklady jednotlivých změn najdete níže.`
      : "Zobrazujeme ověřený výchozí rozpočet; dopočtený sloupec zatím není k dispozici.";
  }
  function chart(container, values, label) {
    const width = 1000, height = 310, left = 105, right = 28, top = 28, bottom = 43;
    const low = Math.min(0, ...values);
    const high = Math.max(0, ...values) || (low === 0 ? 10000 : 0);
    const padding = (high - low || 10000) * .12;
    const min = low - padding, max = high + padding;
    const y = value => top + (max - value) / (max - min) * (height - top - bottom);
    const svg = svgNode("svg", {viewBox: `0 0 ${width} ${height}`, role: "group", "aria-label": label});
    svg.append(svgNode("title", {}, label));
    for (let i = 0; i <= 4; i++) {
      const value = low + (high - low || 10000) * i / 4;
      svg.append(svgNode("line", {x1: left, x2: width - right, y1: y(value), y2: y(value), class: "budget-grid"}));
      svg.append(svgNode("text", {x: left - 12, y: y(value) + 4, "text-anchor": "end"}, short(value)));
    }
    svg.append(svgNode("line", {x1: left, x2: width - right, y1: y(0), y2: y(0), class: "budget-axis"}));
    get(container).replaceChildren(svg);
    return {svg, y, left, right: width - right, bottom: height - bottom, height};
  }
  function renderCharts() {
    const summary = M.series(data, state.mode, state.month, state.place);
    const line = chart("line", summary.steps.map(step => step.value), `${M.placeLabel(state.place)}: kumulativní změna rozpočtu v Kč. Body otevřou schválené změny daného dne.`);
    const start = Date.UTC(data.year, 0, 1), end = new Date(cutoff() + "T23:59:59Z").getTime();
    const x = value => line.left + (new Date(value + "T12:00:00Z").getTime() - start) / Math.max(86400000, end - start) * (line.right - line.left);
    let path = `M ${line.left} ${line.y(0)}`;
    for (const step of summary.steps) path += ` H ${x(step.date)} V ${line.y(step.value)}`;
    path += ` H ${line.right}`;
    line.svg.append(svgNode("path", {d: path, class: "budget-path"}));
    for (let month = 1; month <= state.month; month++) {
      const value = `${data.year}-${String(month).padStart(2, "0")}-01`;
      if (value > cutoff()) break;
      line.svg.append(svgNode("text", {x: x(value), y: line.height - 12, "text-anchor": "middle"}, `${month}.`));
    }
    for (const step of summary.steps) {
      const group = svgNode("g", {class: "budget-point", tabindex: 0, role: "button", "aria-label": `${dateText(step.date)}: změna ${format(step.change)}, celkem ${format(step.value)}. Zobrazit podklady.`});
      group.append(svgNode("title", {}, `${dateText(step.date)} · ${format(step.change)} · kumulativně ${format(step.value)}`));
      group.append(svgNode("circle", {cx: x(step.date), cy: line.y(step.value), r: 5, class: "budget-dot"}));
      group.append(svgNode("circle", {cx: x(step.date), cy: line.y(step.value), r: 13, class: "budget-hit"}));
      activate(group, () => chooseDate(step.date));
      line.svg.append(group);
    }
    const monthly = summary.monthly.slice(0, state.month);
    const bars = chart("bars", monthly, `${M.placeLabel(state.place)}: čisté změny výdajů podle měsíců v Kč. Výběr měsíce otevře jeho podklady.`);
    const column = (bars.right - bars.left) / state.month;
    monthly.forEach((value, index) => {
      const group = svgNode("g", {tabindex: 0, role: "button", "aria-label": `${M.months[index]}: ${format(value)}. Zobrazit podklady.`});
      group.append(svgNode("title", {}, `${M.months[index]}: ${format(value)}`));
      const pos = bars.left + column * (index + .5);
      const top = Math.min(bars.y(0), bars.y(value));
      group.append(svgNode("rect", {x: pos - column * .29, y: top, width: column * .58, height: Math.max(2, Math.abs(bars.y(value) - bars.y(0))), rx: 3, class: value < 0 ? "budget-bar budget-bar-negative" : "budget-bar"}));
      group.append(svgNode("rect", {x: bars.left + column * index, y: 0, width: column, height: bars.height, class: "budget-hit"}));
      group.append(svgNode("text", {x: pos, y: bars.height - 12, "text-anchor": "middle"}, `${index + 1}.`));
      activate(group, () => chooseMonth(index + 1));
      bars.svg.append(group);
    });
    const all = data.entries.filter(entry => Number(entry.approval_date.slice(5, 7)) <= state.month);
    const increase = all.reduce((total, entry) => total + M.totals(entry, state.mode, state.place).increase, 0);
    const reduction = all.reduce((total, entry) => total + M.totals(entry, state.mode, state.place).reduction, 0);
    const subject = state.mode === "all" ? "Plánované výdaje" : "Plánované investiční výdaje";
    get("net-label").textContent = subject + (summary.net > 0 ? " se zvýšily o" : summary.net < 0 ? " se snížily o" : " se celkově nezměnily");
    get("net").textContent = format(Math.abs(summary.net));
    get("increase").textContent = format(increase);
    get("reduction").textContent = format(Math.abs(reduction));
    get("difference").textContent = format(summary.net);
  }
  function renderTable() {
    currentRows = M.visibleEntries(data, state).sort((a, b) => {
      let comparison;
      if (sort.key === "date") comparison = a.approval_date.localeCompare(b.approval_date);
      else if (sort.key === "id") comparison = (a.rz_id || a.id).localeCompare(b.rz_id || b.id, "cs", {numeric: true});
      else comparison = M.totals(a, state.mode)[sort.key] - M.totals(b, state.mode)[sort.key];
      return (sort.descending ? -comparison : comparison) || a.id.localeCompare(b.id, "cs", {numeric: true});
    });
    const body = get("rows");
    const fragment = document.createDocumentFragment();
    for (const entry of currentRows) {
      const tr = node("tr");
      const total = M.totals(entry, state.mode);
      tr.append(node("td", dateText(entry.approval_date), {class: "budget-date"}));
      const title = node("td");
      title.append(node("a", entry.rz_id || "Bez úplného čísla RZ", {href: entry.href}));
      const description = entry.rows.find(row => M.eligible(row, state.mode)) || entry.rows[0];
      title.append(node("span", description.description, {class: "budget-entry-name"}));
      const unresolved = entry.rows.filter(row => row.category === "unresolved").length;
      if (unresolved) title.append(node("span", `${unresolved} nezařazených řádků mimo součet`, {class: "budget-unresolved"}));
      tr.append(title, node("td", format(total.increase)), node("td", format(total.reduction)), node("td", format(total.net)));
      const detailTr = node("tr");
      const cell = node("td", undefined, {colspan: 5, class: "budget-detail-cell"});
      const details = node("details", undefined, {class: "budget-detail"});
      details.append(node("summary", `Podrobnosti ${entry.rz_id || entry.document_id} · ${entry.rows.length} účetních řádků`));
      const list = node("ul");
      for (const row of entry.rows) {
        const li = node("li");
        li.append(node("strong", format(row.amount_minor)), document.createTextNode(" · " + row.description));
        const labels = {capital: "Investiční výdaj", operating: "Běžný výdaj", internal_transfer: "Vnitřní převod — mimo součet", unresolved: "Neověřené zařazení — mimo součet"};
        li.append(node("small", [labels[row.category], ...Object.entries(row.codes).map(([k, v]) => `${k}: ${v}`), row.source_page ? `strana ${row.source_page}` : "textový přepis"].join(" · ")));
        list.append(li);
      }
      details.append(list);
      for (const note of entry.notes) details.append(node("p", note));
      details.append(node("a", `Otevřít původní změnu v ${entry.document_id} →`, {href: entry.href}));
      cell.append(details); detailTr.append(cell); fragment.append(tr, detailTr);
    }
    if (!currentRows.length) {
      const tr = node("tr");
      tr.append(node("td", "Pro zvolený filtr nejsou žádné rozpočtové změny.", {colspan: 5}));
      fragment.append(tr);
    }
    body.replaceChildren(fragment);
    get("results").textContent = `${currentRows.length} rozpočtových změn · ${M.placeLabel(state.place)} · ${state.mode === "capital" ? "investiční výdaje" : "všechny výdaje"}`;
    get("csv").disabled = !currentRows.length;
    get("clear-selection").hidden = !state.date && !state.onlyMonth;
    get("selection").hidden = !state.date && !state.onlyMonth;
    get("selection").textContent = state.date ? `Podklady ke dni ${dateText(state.date)}` : `Podklady za měsíc ${M.months[state.month - 1].toLowerCase()}`;
    for (const button of root.querySelectorAll("[data-sort]")) {
      button.parentElement.setAttribute("aria-sort", button.dataset.sort === sort.key ? (sort.descending ? "descending" : "ascending") : "none");
    }
  }
  function render() {
    history.replaceState(null, "", M.toUrl(state) + location.hash);
    const investment = state.mode !== "all";
    const kind = investment ? "Investiční výdaje" : "Všechny výdaje";
    get("mode-label").textContent = `${kind} · ${M.placeLabel(state.place)}`;
    get("place").querySelector('[value="unassigned"]').textContent = investment ? "Investice bez přiřazení místní části" : "Výdaje bez přiřazení místní části";
    get("scope").textContent = state.place === "all"
      ? "Zobrazeny jsou změny pro celé město i místní části. Filtr místní části umožňuje prohlédnout přímo přiřazené účetní řádky."
      : state.place === "unassigned"
        ? `${investment ? "Investice" : "Výdaje"} bez přiřazení místní části mohou zahrnovat centrální Litovel, společnou infrastrukturu i místní části. Nejde o samostatný součet pro centrální Litovel.`
        : `${M.placeLabel(state.place)}: zobrazeny jsou pouze změny ${investment ? "investičních výdajů" : "výdajů"} přímo přiřazené této místní části kódem ORJ. Sdílené investice a řádky bez přiřazení zde nejsou zahrnuté. Nulová změna neznamená nulové investice.`;
    get("cutoff").textContent = `Schválené změny do ${dateText(cutoff())}.`;
    renderWholeBudget(); renderCharts(); renderTable();
  }
  async function init() {
    try {
      const response = await fetch(root.dataset.budgetUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      data = await response.json();
      if (data.schema_version !== 1 || data.year !== 2026 || !Array.isArray(data.entries) || !Array.isArray(data.documents)) throw new Error("Invalid budget dataset");
      if (!data.entries.length || !data.latest_approval_date) {
        get("status").textContent = "Pro rok 2026 zatím nejsou dostupné rozpočtové změny schválené během roku. Původní dokumenty najdete v odkazu výše.";
        return;
      }
      const latestMonth = Number(data.latest_approval_date.slice(5, 7));
      state = M.fromUrl(location.search, latestMonth);
      await loadApprovedBudget();
      get("place").append(node("option", M.placeLabel("all"), {value: "all"}));
      const parts = node("optgroup", undefined, {label: "Přímo přiřazené místní části"});
      for (const [code, name] of Object.entries(M.localParts).sort((a, b) => a[1].localeCompare(b[1], "cs"))) parts.append(node("option", name, {value: code}));
      get("place").append(parts, node("option", "Investice bez přiřazení místní části", {value: "unassigned"}));
      for (let month = 1; month <= latestMonth; month++) {
        const suffix = month === latestMonth ? ` (do ${dateText(data.latest_approval_date)})` : "";
        get("month").append(node("option", M.months[month - 1] + suffix, {value: month}));
      }
      get("mode").value = state.mode; get("month").value = state.month; get("query").value = state.query; get("place").value = state.place;
      get("place").addEventListener("change", () => {state.place = get("place").value; state.date = ""; state.onlyMonth = false; render();});
      get("mode").addEventListener("change", () => {state.mode = get("mode").value; render();});
      get("month").addEventListener("change", () => {state.month = Number(get("month").value); state.date = ""; state.onlyMonth = false; render();});
      get("query").addEventListener("input", () => {state.query = get("query").value; history.replaceState(null, "", M.toUrl(state) + location.hash); renderTable();});
      get("clear-selection").addEventListener("click", () => {state.date = ""; state.onlyMonth = false; renderTable();});
      for (const button of root.querySelectorAll("[data-sort]")) button.addEventListener("click", () => {
        sort = {key: button.dataset.sort, descending: sort.key === button.dataset.sort ? !sort.descending : true}; renderTable();
      });
      get("csv").addEventListener("click", () => {
        const url = URL.createObjectURL(new Blob([M.csv(currentRows, state.mode, state.place)], {type: "text/csv;charset=utf-8"}));
        const a = node("a", undefined, {href: url, download: `litovel-zmeny-2026-${state.month}-${state.mode}-${state.place}.csv`});
        root.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      });
      const coverage = data.coverage;
      get("coverage").textContent = `Zpracováno ${coverage.documents} rozpočtových opatření, ${coverage.source_rows} účetních řádků. Poslední zahrnuté schválení: ${dateText(data.latest_approval_date)}. Data obnovena: ${new Intl.DateTimeFormat("cs-CZ", {dateStyle: "medium", timeStyle: "short"}).format(new Date(data.refreshed_at))}. Pokrytí se vztahuje ke zpracovaným dokumentům; nejde o průběžné účetní čerpání.`;
      get("exclusions").textContent = coverage.unresolved_rows ? `${coverage.unresolved_rows} účetních řádků s neověřeným zařazením se do grafů nezapočítává. Součet absolutních částek těchto řádků: ${format(coverage.unresolved_absolute_minor)}. Jejich podklady zůstávají dostupné v tabulce a kontrolním přehledu.` : "Všechny zpracované účetní řádky mají ověřené zařazení.";
      if (coverage.incomplete_identifier_rows) get("exclusions").append(document.createTextNode(` U ${coverage.incomplete_identifier_rows} řádků chybí úplné číslo RZ. Jejich ověřené výdajové částky se započítávají podle účetních kódů; odkaz vede na celé opatření.`));
      get("earlier").hidden = !data.earlier_entries.length;
      for (const entry of data.earlier_entries) {
        const li = node("li"); li.append(node("a", `${entry.rz_id || entry.document_id} · ${dateText(entry.approval_date)}`, {href: entry.href})); get("earlier-list").append(li);
      }
      get("status").hidden = true; get("content").hidden = false;
      render();
    } catch (error) {
      console.error("Budget dashboard:", error);
      get("content").hidden = true; get("status").hidden = false;
      get("status").textContent = "Data se nepodařilo načíst. Zkuste stránku obnovit nebo otevřete původní rozpočtová opatření v odkazu výše.";
    }
  }
  init();
})();

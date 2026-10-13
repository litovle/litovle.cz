(() => {
  // ============================================================
  // KONSTANTY & STAV
  // ============================================================

  const PAGE_SIZE = 20;
  const SNIPPET_LEN = 180;
  const SEARCH_DEBOUNCE_MS = 140;
  const DEFAULT_SEARCH_YEARS = 5;
  const FEATURED_TOPICS = [
    ["education", "Školy a školky"],
    ["transport", "Doprava a chodníky"],
    ["sport", "Sport a volný čas"],
    ["culture", "Kultura a akce"],
    ["environment", "Životní prostředí"],
    ["property", "Majetek města"],
  ];
  const LOCAL_PLACES = ["Litovel", "Unčovice", "Nasobůrky", "Myslechovice", "Chořelice", "Nová Ves"];

  let TOPICS = {};
  let META = {};
  let RO_META = {};
  let ARCHIVE_META = {};
  let INDEX = {};
  let DATA = {};
  let DATA_MAP = {};
  let RO_INDEX = {};
  let RO_DATA = {};
  let RO_DATA_MAP = {};
  let ARCHIVE_INDEX = {};
  let ARCHIVE_DATA = {};
  let ARCHIVE_DATA_MAP = {};
  let LOADED = {};
  let LOAD_PROMISES = {};
  let PAGE = 1;
  let SEARCH_SEQ = 0;
  let SEARCH_TIMER = null;
  let currentResults = [];
  let LAST_PARSED = null;
  let YEAR_INPUTS = [];
  let TYPE_INPUTS = [];
  let ORG_INPUTS = [];
  let SORT_CHIPS = [];

  const q = document.getElementById("usn-q");
  const clearButton = document.getElementById("usn-clear");
  const res = document.getElementById("usn-results");
  const resultsPanel = document.getElementById("usn-results-panel");
  const resultsCount = document.getElementById("usn-results-count");
  const resultsKicker = document.getElementById("usn-results-kicker");
  const searchPanel = document.querySelector(".usn-search-panel");
  const backToTopButton = document.getElementById("usn-back-to-top");
  const activeFiltersBox = document.getElementById("usn-active-filters");
  const refineToggle = document.getElementById("usn-refine-toggle");
  const yearsBox = document.getElementById("usn-years");
  const yearPresetsBox = document.getElementById("usn-year-presets");
  const sortSel = document.getElementById("usn-sort");
  const sortOptions = document.getElementById("usn-sort-options");
  const typeBox = document.getElementById("usn-type");
  const topicSel = document.getElementById("usn-topic");
  const topicShortcuts = document.getElementById("usn-topics");
  const extraTopicButtons = document.getElementById("usn-extra-topic-buttons");
  const welcomeTopicChoices = document.getElementById("usn-welcome-topic-choices");
  const moreTopics = document.getElementById("usn-more-topics");
  const topicButtons = document.getElementById("usn-topic-buttons");
  const topicGroup = document.getElementById("usn-topic-group");
  const orgBox = document.getElementById("usn-org");
  const appRoot = document.querySelector(".usn-app");
  const bootStatus = document.getElementById("usn-boot-status");

  // ============================================================
  // NORMALIZACE
  // ============================================================

  // Normalize both indexed text and user input to a comparable ASCII form.
  function normalize(s) {
    return s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  // ============================================================
  // UTIL
  // ============================================================

  // Convert exported IDs into slug-like fragments used in URLs and anchors.
  function anchorFromId(id) {
    return id.replace(/\//g, "-");
  }

  function rzAnchorFromId(id) {
    return `rz-${anchorFromId(id).toLowerCase()}`;
  }

  function staticUrlFromId(id) {
    if (id.startsWith("RO/")) {
      return `/rozpoctova-opatreni/${anchorFromId(id)}/`;
    }

    const year = id.split("/").pop();
    const slug = anchorFromId(id);
    return `/usneseni/${year}/${slug}/`;
  }

  function isArchiveRecord(u) {
    return u.type === "archive_document" || u.type === "archive_resolution";
  }

  function hrefFromRecord(u) {
    if (isArchiveRecord(u)) {
      return u.permalink || u.source_url || u.original_file_url || "#";
    }

    return `${staticUrlFromId(u.id)}?back=${encodeURIComponent(location.pathname + location.search)}`;
  }

  function idFromHash() {
    if (!location.hash) return null;
    return location.hash.substring(1).replace(/-/g, "/");
  }

  // Pick a short sentence that can stand in as a result snippet.
  function firstSentence(u) {
    if (isArchiveRecord(u)) {
      return (u.display_text || u.search_text || "").replace(/\s+/g, " ").trim();
    }

    if (u.id && u.id.startsWith("RO/")) {
      const note = u.notes && u.notes.length ? u.notes[0].text : "";
      if (note) return note;

      for (const section of u.sections || []) {
        const row = section.rows && section.rows.length ? section.rows[0] : null;
        if (row && row.description) return row.description;
      }

      return "";
    }

    if (u.subject) return u.subject;
    if (u.items && u.items.length) return u.items[0].text;
    return "";
  }

  // Build the normalized text blob once when data is loaded, then reuse it.
  // This keeps search cheap while preserving the same broad matching behavior.
  function buildSearchText(u) {
    if (isArchiveRecord(u)) {
      return normalize(
        [
          u.id || "",
          u.title || "",
          u.date || "",
          u.period || "",
          u.organ || "",
          u.search_text || "",
          u.display_text || ""
        ].join(" ")
      );
    }

    if (u.id && u.id.startsWith("RO/")) {
      return normalize(
        [
          u.id || "",
          u.approved_by || "",
          u.approval_date || "",
          ...(u.source_resolutions || []),
          ...(u.budget_change_ids || []),
          ...(u.notes || []).flatMap(note => [note.title || "", note.text || ""]),
          ...(u.sections || []).flatMap(section => [
            section.label || "",
            ...(section.rows || []).flatMap(row => [
              row.budget_change_id || "",
              ...(row.raw_codes || []),
              row.amount || "",
              row.description || ""
            ])
          ])
        ].join(" ")
      );
    }

    return normalize(
      [
        u.subject || "",
        ...(u.items || []).map(i => i.text),
        u.tail || ""
      ].join(" ")
    );
  }

  function searchText(u) {
    return u._searchText || "";
  }

  function escapeRegExp(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  // Expand compact organ codes to the reader-facing labels used by filters.
  function normalizedOrgan(u) {
    if (!u || !u.organ) return "";
    if (u.organ === "RM") return "Rada města Litovel";
    if (u.organ === "ZM") return "Zastupitelstvo města Litovel";
    return u.organ;
  }

  function highlight(text, terms) {
    let out = text;

    for (const t of terms) {
      if (!t) continue;
      const re = new RegExp(`(${escapeRegExp(t)})`, "gi");
      out = out.replace(re, "<mark>$1</mark>");
    }

    return out;
  }

  // Result cards are rendered from templates, so snippets must be escaped.
  function escapeHtml(text) {
    return String(text || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function cleanRoSnippet(text) {
    return (text || "").replace(/\s*\(RZ\s+\d+\/\d{4}\/(?:RM|ZM)\)\s*$/i, "").trim();
  }

  // Keep ARIA busy in sync while async searches are in flight.
  function setBusy(loading) {
    res.setAttribute("aria-busy", loading ? "true" : "false");
  }

  // Keep the static UI inert until the app has finished booting.
  function setBootReady(ready) {
    appRoot?.classList.toggle("is-booting", !ready);
    appRoot?.querySelectorAll("[data-usn-boot]").forEach(node => {
      node.disabled = !ready;
    });
    if (bootStatus) {
      bootStatus.textContent = ready ? "" : "Načítám vyhledávání…";
      bootStatus.hidden = ready;
    }
  }

  function setBootFailed() {
    if (bootStatus) {
      bootStatus.hidden = false;
      bootStatus.textContent = "Vyhledávání se nepodařilo načíst. Zkuste obnovit stránku.";
    }
  }

  // Show the explicit clear affordance when the query has any text.
  function syncClearButton() {
    if (!clearButton) return;
    clearButton.hidden = !q.value.trim();
  }

  // Typing on mobile can fire many rapid input events, so queue one search
  // slightly later instead of recomputing results on every keystroke.
  function queueSearch(delay = SEARCH_DEBOUNCE_MS) {
    if (SEARCH_TIMER) {
      clearTimeout(SEARCH_TIMER);
    }
    SEARCH_TIMER = window.setTimeout(() => {
      SEARCH_TIMER = null;
      search();
    }, delay);
  }

  function cancelQueuedSearch() {
    if (!SEARCH_TIMER) return;
    clearTimeout(SEARCH_TIMER);
    SEARCH_TIMER = null;
  }

  // Return to the top where the search panel and page intro live.
  function scrollSearchIntoView() {
    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  }

  // The mobile-only shortcut appears only after the user scrolls deeper down.
  function updateBackToTopVisibility() {
    if (!backToTopButton) return;
    backToTopButton.classList.toggle("is-visible", window.innerWidth <= 700 && window.scrollY > 700);
  }

  // Rank RO note/row snippets so the best contextual match appears first.
  function rankRoChunk(chunk, parsed) {
    const text = chunk.text;
    const hasPhrase = text.includes(parsed.raw);
    const hasAllTerms = parsed.longWords.length > 1
      && parsed.longWords.every(term => text.includes(term));
    const termHits = parsed.longWords.reduce((count, term) => count + (text.includes(term) ? 1 : 0), 0);
    const snippetLength = (chunk.snippet || "").length;

    if (hasPhrase && chunk.kind === "note") return 4000 + termHits * 100 + snippetLength;
    if (hasPhrase && chunk.kind === "row") return 3000 + termHits * 100 + snippetLength;
    if (hasAllTerms && chunk.kind === "note") return 2000 + termHits * 100 + snippetLength;
    if (hasAllTerms && chunk.kind === "row") return 1000 + termHits * 100 + snippetLength;
    return termHits * 100 + snippetLength;
  }

  function findRoMatchContext(u, parsed) {
    if (!u || !u.id || !u.id.startsWith("RO/") || !parsed) return null;

    const chunks = [];

    for (const note of u.notes || []) {
      const match = (note.title || "").match(/(\d+\/\d{4}\/(?:RM|ZM))/i);
      const text = normalize(`${note.title || ""} ${note.text || ""}`);
      if (!text) continue;
      chunks.push({
        kind: "note",
        anchor: match ? rzAnchorFromId(match[1]) : "",
        label: match ? match[1] : "Poznámka",
        snippet: note.text || note.title || "",
        text
      });
    }

    for (const section of u.sections || []) {
      const groups = new Map();

      for (const row of section.rows || []) {
        const budgetChangeId = row.budget_change_id || "";
        const key = budgetChangeId || `row-${groups.size}`;
        if (!groups.has(key)) {
          groups.set(key, []);
        }
        groups.get(key).push(row);
      }

      for (const [budgetChangeId, rows] of groups) {
        const rowChunks = rows.map((row, index) => ({
          index,
          text: normalize([
            row.budget_change_id || "",
            ...(row.raw_codes || []),
            row.amount || "",
            row.description || ""
          ].join(" ")),
          snippet: row.description || row.budget_change_id || ""
        }));

        const matchingRows = rowChunks
          .filter(row =>
            row.text.includes(parsed.raw)
            || (parsed.longWords.length > 1 && parsed.longWords.every(term => row.text.includes(term)))
          )
          .sort((a, b) => {
            const aScore = rankRoChunk({ kind: "row", text: a.text, snippet: a.snippet }, parsed);
            const bScore = rankRoChunk({ kind: "row", text: b.text, snippet: b.snippet }, parsed);
            return bScore - aScore || a.index - b.index;
          });

        const bestRow = matchingRows[0] || rowChunks[0];
        const groupText = normalize(rows.map(row => [
          row.budget_change_id || "",
          ...(row.raw_codes || []),
          row.amount || "",
          row.description || ""
        ].join(" ")).join(" "));

        if (!groupText) continue;
        chunks.push({
          kind: "row",
          anchor: budgetChangeId ? rzAnchorFromId(budgetChangeId) : "",
          label: budgetChangeId || "Řádek",
          snippet: bestRow ? bestRow.snippet : budgetChangeId || "",
          text: groupText
        });
      }
    }

    const matched = chunks
      .filter(chunk =>
        chunk.text.includes(parsed.raw)
        || (parsed.longWords.length > 1 && parsed.longWords.every(term => chunk.text.includes(term)))
      )
      .map((chunk, index) => ({ ...chunk, score: rankRoChunk(chunk, parsed), index }))
      .sort((a, b) => b.score - a.score || a.index - b.index);

    if (!matched.length) return null;

    const seen = new Set();
    const topMatches = [];
    let totalMatches = 0;
    for (const match of matched) {
      const dedupeKey = `${match.anchor}|${match.label}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      totalMatches += 1;
      if (topMatches.length < 3) {
        topMatches.push(match);
      }
    }

    return {
      anchor: topMatches[0].anchor,
      snippet: cleanRoSnippet(topMatches[0].snippet),
      matches: topMatches,
      totalMatches
    };
  }

  // ============================================================
  // URL STATE
  // ============================================================

  // Keep the current search state in the URL so reload/share works.
  function updateUrl() {
    const params = new URLSearchParams();

    if (q.value) params.set("q", q.value);
    if (selectedTopic()) params.set("category", selectedTopic());

    for (const y of selectedYears().length ? selectedYears() : [""]) params.append("y", y);
    for (const t of selectedTypes().length ? selectedTypes() : [""]) params.append("type", t);
    for (const o of selectedOrgans().length ? selectedOrgans() : [""]) params.append("org", o);

    params.set("sort", sortSel.value);

    history.replaceState(null, "", "?" + params.toString());
  }

  // Restore filters and the current query from the page URL.
  function loadFromUrl() {
    const params = new URLSearchParams(location.search);

    if (params.get("q")) q.value = params.get("q");

    const category = params.get("category");
    if (topicSel && category && (category === "unclassified" || Object.hasOwn(TOPICS, category))) {
      topicSel.value = category;
    }

    const years = params.getAll("y");
    if (years.length) {
      YEAR_INPUTS.forEach(i => {
        i.checked = years.includes(i.value);
      });
    }

    const types = params.getAll("type");
    if (types.length) {
      TYPE_INPUTS.forEach(i => {
        i.checked = types.includes(i.value);
      });
    }

    const orgs = params.getAll("org");
    if (orgs.length) {
      ORG_INPUTS.forEach(i => {
        i.checked = orgs.includes(i.value);
      });
    }

    if (params.get("sort")) {
      sortSel.value = params.get("sort");
    }

    syncClearButton();
  }

  // ============================================================
  // DATA LOAD
  // ============================================================

  // Load one year's index and detail payload lazily on demand.
  // Concurrent callers share the same promise so the same year is never fetched twice.
  async function loadYear(year) {
    if (LOADED[year]) return;
    if (LOAD_PROMISES[year]) return LOAD_PROMISES[year];

    const fetchDataset = (meta, prefix, kind) => Object.hasOwn(meta, year)
      ? fetch(`/assets/usneseni/${prefix}${kind}/${year}.json`)
      : Promise.resolve(null);
    LOAD_PROMISES[year] = (async () => {
      const [
        indexRes,
        dataRes,
        roIndexRes,
        roDataRes,
        archiveIndexRes,
        archiveDataRes
      ] = await Promise.allSettled([
        fetchDataset(META, "", "index"),
        fetchDataset(META, "", "data"),
        fetchDataset(RO_META, "ro/", "index"),
        fetchDataset(RO_META, "ro/", "data"),
        fetchDataset(ARCHIVE_META, "archive/", "index"),
        fetchDataset(ARCHIVE_META, "archive/", "data")
      ]);

      INDEX[year] = {};
      DATA[year] = [];
      DATA_MAP[year] = {};
      RO_INDEX[year] = {};
      RO_DATA[year] = [];
      RO_DATA_MAP[year] = {};
      ARCHIVE_INDEX[year] = {};
      ARCHIVE_DATA[year] = [];
      ARCHIVE_DATA_MAP[year] = {};

      if (indexRes.status === "fulfilled" && indexRes.value?.ok) {
        INDEX[year] = await indexRes.value.json();
      }
      if (dataRes.status === "fulfilled" && dataRes.value?.ok) {
        DATA[year] = await dataRes.value.json();
        DATA[year].forEach(u => {
          u._searchText = buildSearchText(u);
        });
        DATA_MAP[year] = Object.fromEntries(DATA[year].map(u => [u.id, u]));
      }
      if (roIndexRes.status === "fulfilled" && roIndexRes.value?.ok) {
        RO_INDEX[year] = await roIndexRes.value.json();
      }
      if (roDataRes.status === "fulfilled" && roDataRes.value?.ok) {
        RO_DATA[year] = await roDataRes.value.json();
        RO_DATA[year].forEach(u => {
          u._searchText = buildSearchText(u);
        });
        RO_DATA_MAP[year] = Object.fromEntries(RO_DATA[year].map(u => [u.id, u]));
      }
      if (archiveIndexRes.status === "fulfilled" && archiveIndexRes.value?.ok) {
        ARCHIVE_INDEX[year] = await archiveIndexRes.value.json();
      }
      if (archiveDataRes.status === "fulfilled" && archiveDataRes.value?.ok) {
        ARCHIVE_DATA[year] = await archiveDataRes.value.json();
        ARCHIVE_DATA[year].forEach(u => {
          u._searchText = buildSearchText(u);
        });
        ARCHIVE_DATA_MAP[year] = Object.fromEntries(ARCHIVE_DATA[year].map(u => [u.id, u]));
      }

      LOADED[year] = true;
      delete LOAD_PROMISES[year];
    })();

    return LOAD_PROMISES[year];
  }

  // Read the current filter UI state.
  function selectedYears() {
    return YEAR_INPUTS.filter(input => input.checked).map(i => i.value);
  }

  function setSelectedYears(years) {
    const selected = new Set(years);
    YEAR_INPUTS.forEach(input => {
      input.checked = selected.has(input.value);
    });
  }

  function defaultYears(years) {
    return years.slice(0, DEFAULT_SEARCH_YEARS);
  }

  function filtersAreDefault() {
    return (
      selectedYears().join("|") === defaultYears(sortedYearsFromMeta()).join("|")
      && TYPE_INPUTS.every(input => input.checked)
      && ORG_INPUTS.every(input => input.checked)
      && !selectedTopic()
      && sortSel.value === "desc"
    );
  }

  function syncSortChips() {
    if (!sortOptions) return;
    SORT_CHIPS.forEach(button => {
      const active = button.dataset.sortValue === sortSel.value;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });
  }

  function selectedTopic() {
    return topicGroup && !topicGroup.hidden ? topicSel.value : "";
  }

  function matchesTopic(u) {
    const selected = selectedTopic();
    const category = u.classification?.category;
    if (!selected) return true;
    return selected === "unclassified" ? !category : category === selected;
  }

  function selectedOrgans() {
    return ORG_INPUTS.filter(input => input.checked).map(i => i.value);
  }

  function selectedTypes() {
    return TYPE_INPUTS.filter(input => input.checked).map(i => i.value);
  }

  // ============================================================
  // SUMMARY
  // ============================================================

  // Produce the short line shown under each result header.
  function summaryLabel(u) {
    if (isArchiveRecord(u)) {
      return [
        u.organ || "Zastupitelstvo města Litovel",
        u.period ? `období ${u.period}` : "",
        u.meeting_no ? `${u.meeting_no}. zasedání` : "",
        u.type === "archive_resolution" && u.resolution_no ? `usnesení ${u.resolution_no}` : ""
      ].filter(Boolean).join(" · ");
    }

    if (u.id && u.id.startsWith("RO/")) {
      return normalizedOrgan(u) || u.approved_by || "";
    }

    if (!u.items || u.items.length === 0) {
      return (u.actions || []).join(", ");
    }
    if (u.items.length === 1) {
      return u.actions && u.actions[0] ? u.actions[0] : "";
    }
    return `${u.items.length} rozhodnutí`;
  }

  // Shared renderer for “too short”, “not found” and cleared-search states.
  function renderEmptyResultsState({ title, message, hints = [] }) {
    res.innerHTML = `
      <li class="usn-empty-state">
        <h3>${escapeHtml(title)}</h3>
        <p>${escapeHtml(message)}</p>
        ${hints.length
          ? `<ul class="usn-empty-list">${hints.map(hint => `<li>${escapeHtml(hint)}</li>`).join("")}</ul>`
          : ""}
      </li>
    `;
  }

  function renderLoadingState(query) {
    showResultsState({
      count: "Načítám výsledky",
      query,
    });
    res.innerHTML = `
      <li class="usn-loading-state" aria-hidden="true">
        <div class="usn-loading-card">
          <span class="usn-loading-line usn-loading-line-title"></span>
          <span class="usn-loading-line usn-loading-line-meta"></span>
          <span class="usn-loading-line usn-loading-line-body"></span>
          <span class="usn-loading-line usn-loading-line-body-short"></span>
        </div>
        <div class="usn-loading-card">
          <span class="usn-loading-line usn-loading-line-title"></span>
          <span class="usn-loading-line usn-loading-line-meta"></span>
          <span class="usn-loading-line usn-loading-line-body"></span>
          <span class="usn-loading-line usn-loading-line-body-short"></span>
        </div>
        <div class="usn-loading-card">
          <span class="usn-loading-line usn-loading-line-title"></span>
          <span class="usn-loading-line usn-loading-line-meta"></span>
          <span class="usn-loading-line usn-loading-line-body"></span>
          <span class="usn-loading-line usn-loading-line-body-short"></span>
        </div>
      </li>
    `;
  }

  // Mobile uses a collapsed filter tray; desktop keeps filters visible.
  function setMobileFiltersOpen(open) {
    if (!searchPanel) return;
    searchPanel.classList.toggle("is-open", open);
    if (refineToggle) {
      refineToggle.textContent = "Upřesnit hledání";
      refineToggle.setAttribute("aria-expanded", open ? "true" : "false");
    }
  }

  // ============================================================
  // SORT & PAGING
  // ============================================================

  function sortResults(list) {
    return list.sort((a, b) => {
      const aDate = a.datum || a.approval_date || a.date || "";
      const bDate = b.datum || b.approval_date || b.date || "";

      if (!aDate || !bDate) return 0;
      return sortSel.value === "asc"
        ? aDate.localeCompare(bDate)
        : bDate.localeCompare(aDate);
    });
  }

  function paginate(list) {
    const start = (PAGE - 1) * PAGE_SIZE;
    return list.slice(start, start + PAGE_SIZE);
  }

  function renderPager(total) {
    const pages = Math.ceil(total / PAGE_SIZE);
    if (pages <= 1) return;

    const nav = document.createElement("div");
    nav.className = "usn-pager";

    function pageLink(label, page, disabled = false, current = false) {
      const a = document.createElement("a");
      a.href = "#";
      a.textContent = label;

      if (current) {
        a.className = "usn-page-current";
        return a;
      }

      if (disabled) {
        a.className = "usn-page-disabled";
        return a;
      }

      a.onclick = e => {
        e.preventDefault();
        PAGE = page;
        renderResults(currentResults);
      };
      return a;
    }

    nav.appendChild(pageLink("‹ předchozí", PAGE - 1, PAGE === 1));

    const radius = 2;
    let start = Math.max(1, PAGE - radius);
    let end = Math.min(pages, PAGE + radius);

    if (start > 1) {
      nav.appendChild(pageLink("1", 1));
      if (start > 2) nav.appendChild(pageLink("…", null, true));
    }

    for (let i = start; i <= end; i++) {
      nav.appendChild(pageLink(i, i, false, i === PAGE));
    }

    if (end < pages) {
      if (end < pages - 1) nav.appendChild(pageLink("…", null, true));
      nav.appendChild(pageLink(pages, pages));
    }

    nav.appendChild(pageLink("další ›", PAGE + 1, PAGE === pages));
    res.appendChild(nav);
  }

  // ============================================================
  // SEARCH
  // ============================================================

  function parseQuery(input) {
    const raw = normalize(input);
    if (!raw) return null;

    const words = raw.split(" ");
    const longWords = words.filter(w => w.length >= 3);

    const anchor = longWords.length
      ? longWords.slice().sort((a, b) => b.length - a.length)[0]
      : null;

    return { raw, words, longWords, anchor };
  }

  // Pull likely candidates only from selected years and the strongest anchor term.
  async function collectCandidates(anchor, years) {
    const out = new Map();

    // Load all selected years in parallel, then resolve indexed hits from memory.
    await Promise.all(years.map(year => loadYear(year)));

    for (const y of years) {
      if (!anchor) {
        for (const u of [...DATA[y], ...RO_DATA[y], ...ARCHIVE_DATA[y]]) out.set(u.id, u);
        continue;
      }
      const resolutionHit = INDEX[y][anchor] || [];
      const roHit = RO_INDEX[y][anchor] || [];
      const archiveHit = ARCHIVE_INDEX[y][anchor] || [];

      for (const id of resolutionHit) {
        const u = DATA_MAP[y][id];
        if (u) out.set(id, u);
      }

      for (const id of roHit) {
        const u = RO_DATA_MAP[y][id];
        if (u) out.set(id, u);
      }

      for (const id of archiveHit) {
        const u = ARCHIVE_DATA_MAP[y][id];
        if (u) out.set(id, u);
      }
    }

    return [...out.values()];
  }

  function matchesPhrase(u, phrase) {
    return searchText(u).includes(phrase);
  }

  function matchesAllTerms(u, terms) {
    const text = searchText(u);
    return terms.every(t => text.includes(t));
  }

  // Keep all header/result-state toggles in one place.
  function showResultsState({ count = "", query = "" } = {}) {
    resultsPanel.hidden = false;
    resultsCount.textContent = count;
    const topic = selectedTopic();
    const topicText = topic === "unclassified" ? "Bez zařazení" : TOPICS[topic];
    resultsKicker.textContent = [query ? `pro „${query}”` : "", topicText ? `téma: ${topicText}` : ""].filter(Boolean).join(" · ");
  }

  function clearResultsState() {
    resultsPanel.hidden = true;
    resultsCount.textContent = "";
    resultsKicker.textContent = "";
    res.innerHTML = "";
  }

  function renderShortQueryState(query) {
    showResultsState({
      query,
    });
    renderEmptyResultsState({
      title: "Zkuste přidat přesnější výraz",
      message: "Vyhledávání funguje nejlépe od tří písmen nebo z více slov.",
      hints: [
        "místo „šk“ zkuste „škola“, „školka“ nebo konkrétní školu",
        "místo „no“ zkuste „Nová Ves“ nebo „chodník“",
        "můžete přidat i místo: „Unčovice“, „Nasobůrky“, „Litovel“"
      ]
    });
  }

  function documentMatchesCurrentFilters(u, types, organs) {
    const isRo = u.id && u.id.startsWith("RO/");
    const matchesType = (isRo && types.includes("ro"))
      || (!isRo && types.includes("usneseni"));
    return matchesType && organs.includes(normalizedOrgan(u)) && matchesTopic(u);
  }

  function filterByCurrentFilters(list, types, organs) {
    return list.filter(u => documentMatchesCurrentFilters(u, types, organs));
  }

  // Search in two passes: exact normalized phrase first, all terms second.
  async function findResults(parsed) {
    const candidates = await collectCandidates(parsed?.anchor, selectedYears());
    const types = selectedTypes();
    const organs = selectedOrgans();

    if (!parsed) return sortResults(filterByCurrentFilters(candidates, types, organs));

    let results = filterByCurrentFilters(
      candidates.filter(u => matchesPhrase(u, parsed.raw)),
      types,
      organs
    );

    if (!results.length && parsed.longWords.length > 1) {
      results = filterByCurrentFilters(
        candidates.filter(u => matchesAllTerms(u, parsed.longWords)),
        types,
        organs
      );
    }

    return sortResults(results);
  }

  function renderResultCard(u, parsed) {
    const isArchive = isArchiveRecord(u);
    const roMatch = u.id.startsWith("RO/")
      ? findRoMatchContext(u, parsed)
      : null;
    const href = hrefFromRecord(u);
    const linkAttrs = "";

    const snippetRaw = ((roMatch && roMatch.snippet) || firstSentence(u) || "").slice(0, SNIPPET_LEN);
    const snippetSafe = escapeHtml(snippetRaw);
    const snippet = parsed
      ? highlight(snippetSafe, parsed.longWords)
      : snippetSafe;

    const isRo = u.id.startsWith("RO/");
    const typeLabel = u.type === "archive_document" ? "Archivní dokument" : (isArchive ? "Archivní usnesení" : (isRo ? "Rozpočtové opatření" : "Usnesení"));
    const category = u.classification?.category;
    const topicLabel = category ? (TOPICS[category] || category) : "";
    const typeClass = isArchive ? "usn-doc-type-archive" : (isRo ? "usn-doc-type-ro" : "usn-doc-type-usn");
    const title = isArchive ? (u.title || u.id) : u.id;
    const date = u.datum || u.approval_date || u.date || "";
    const li = document.createElement("li");

    li.className = "usn-result";

    li.innerHTML = `
      <a href="${escapeHtml(href)}" class="usn-card"${linkAttrs}>
        <div class="usn-head">
          <strong>${escapeHtml(title)}</strong>
          <span class="usn-date">${escapeHtml(date)}</span>
          <span class="usn-badges">
            <span class="usn-doc-type ${typeClass}">${typeLabel}</span>
            ${topicLabel ? `<span class="usn-topic-label" title="Automaticky přiřazené téma">${escapeHtml(topicLabel)}</span>` : ""}
          </span>
        </div>

        <div class="usn-summary">${escapeHtml(summaryLabel(u))}</div>

        ${isRo ? "" : `<div class="usn-snippet">${snippet}</div>`}

        ${roMatch && roMatch.matches && roMatch.matches.length
          ? `<div class="usn-ro-matches">${
            roMatch.matches.map((match, index) => `
              <a href="${href}${match.anchor ? `#${match.anchor}` : ""}" class="usn-ro-match-item">
                <span class="usn-ro-match-badge">${index === 0 ? "Shoda" : "Další"}</span>
                <strong>${match.label}</strong>
                <span>${highlight((cleanRoSnippet(match.snippet) || match.label).slice(0, SNIPPET_LEN), parsed.longWords)}</span>
              </a>
            `).join("")
          }${
            roMatch.totalMatches > roMatch.matches.length
              ? `<div class="usn-ro-match-more">+${roMatch.totalMatches - roMatch.matches.length} další shody v tomto rozpočtovém opatření</div>`
              : ""
          }</div>`
          : ""}
      </a>
    `;

    return li;
  }

  // Main search orchestration: parse input, load candidates, then render state/results.
  async function search() {
    PAGE = 1;
    const seq = ++SEARCH_SEQ;
    syncClearButton();

    const parsed = parseQuery(q.value);
    LAST_PARSED = parsed;
    updateUrl();
    syncTopicShortcuts();
    updateSearchPresentation();

    if ((!parsed && !selectedTopic()) || (parsed && !parsed.anchor)) {
      setBusy(false);
      if (!parsed) {
        clearResultsState();
        return;
      }

      renderShortQueryState(q.value.trim());
      return;
    }

    if (window.innerWidth <= 700) {
      setMobileFiltersOpen(false);
    }
    setBusy(true);
    renderLoadingState(q.value.trim());
    const results = await findResults(parsed);

    if (seq !== SEARCH_SEQ) return;
    updateUrl();
    renderResults(results);
    setBusy(false);
  }

  // ============================================================
  // RENDER RESULTS
  // ============================================================

  function renderResults(list) {
    showResultsState({
      count: `${list.length} výsledků`,
      query: q.value.trim(),
    });

    currentResults = list;
    if (!list.length) {
      renderEmptyResultsState({
        title: "Pro vybrané hledání nejsou žádné výsledky",
        message: "Zkuste změnit téma, rozšířit roky nebo upravit hledaný výraz.",
        hints: [
          "zkuste obecnější pojem, například „škola“, „dotace“ nebo „chodník“",
          "zkuste konkrétní místo, například „Nová Ves“ nebo „Unčovice“",
          "pokud nic nenacházíte, zkontrolujte vybrané téma, rok, typ dokumentu a schvalující orgán"
        ]
      });
      return;
    }

    const pageItems = paginate(list);
    const parsed = LAST_PARSED;
    // Batch card insertion to avoid repeated layout work while filling one page.
    const fragment = document.createDocumentFragment();
    res.innerHTML = "";
    for (const u of pageItems) {
      fragment.appendChild(renderResultCard(u, parsed));
    }
    res.appendChild(fragment);

    renderPager(list.length);
  }

  // ============================================================
  // DEEP LINK
  // ============================================================

  function redirectFromHash() {
    const id = idFromHash();
    if (!id) return false;

    if (!/^(RM|ZM)\/\d+\/\d+\/\d+$/.test(id)) return false;

    window.location.replace(staticUrlFromId(id));
    return true;
  }

  async function loadMeta() {
    const [metaRes, roMetaRes, archiveMetaRes, topicsRes] = await Promise.allSettled([
      fetch("/assets/usneseni/meta.json"),
      fetch("/assets/usneseni/ro/meta.json"),
      fetch("/assets/usneseni/archive/meta.json"),
      fetch("/assets/usneseni/topics.json")
    ]);

    if (topicsRes.status === "fulfilled" && topicsRes.value.ok) {
      try {
        const topics = await topicsRes.value.json();
        if (topics && typeof topics === "object" && !Array.isArray(topics)
            && Object.values(topics).every(label => typeof label === "string")) TOPICS = topics;
      } catch (error) {
        console.warn("Názvy témat se nepodařilo načíst.", error);
      }
    }

    META = metaRes.status === "fulfilled" && metaRes.value.ok
      ? await metaRes.value.json()
      : {};
    RO_META = roMetaRes.status === "fulfilled" && roMetaRes.value.ok
      ? await roMetaRes.value.json()
      : {};
    ARCHIVE_META = archiveMetaRes.status === "fulfilled" && archiveMetaRes.value.ok
      ? await archiveMetaRes.value.json()
      : {};
  }

  function sortedYearsFromMeta() {
    return [...new Set([...Object.keys(META), ...Object.keys(RO_META), ...Object.keys(ARCHIVE_META)])]
      .sort()
      .reverse();
  }

  function filterSummary() {
    const filters = [];
    const topic = selectedTopic();
    if (topic) filters.push({key: "topic", label: `Téma: ${topic === "unclassified" ? "Bez zařazení" : TOPICS[topic] || topic}`, removable: true});
    const years = selectedYears();
    filters.push({key: "years", label: `Roky: ${years.join(", ") || "žádné"}`,
      removable: years.join("|") !== defaultYears(sortedYearsFromMeta()).join("|")});
    if (!TYPE_INPUTS.every(input => input.checked)) {
      const names = {usneseni: "Usnesení", ro: "Rozpočtová opatření"};
      filters.push({key: "types", label: `Typ: ${selectedTypes().map(type => names[type]).join(", ") || "žádný"}`, removable: true});
    }
    if (!ORG_INPUTS.every(input => input.checked)) {
      const names = {"Rada města Litovel": "Rada města", "Zastupitelstvo města Litovel": "Zastupitelstvo"};
      filters.push({key: "organs", label: `Orgán: ${selectedOrgans().map(organ => names[organ] || organ).join(", ") || "žádný"}`, removable: true});
    }
    if (sortSel.value !== "desc") filters.push({key: "sort", label: "Řazení: Nejstarší", removable: true});
    return filters;
  }

  function updateSearchPresentation() {
    const searching = Boolean(q.value.trim() || selectedTopic());
    if (topicShortcuts) topicShortcuts.hidden = searching;
    if (!activeFiltersBox) return;
    activeFiltersBox.hidden = !searching && filtersAreDefault();
    activeFiltersBox.replaceChildren();
    for (const filter of filterSummary()) {
      const node = document.createElement(filter.removable ? "button" : "span");
      node.textContent = filter.label + (filter.removable ? " ×" : "");
      node.className = filter.removable ? "usn-active-filter" : "usn-filter-scope";
      if (filter.removable) {
        node.type = "button";
        node.dataset.clearFilter = filter.key;
        node.setAttribute("aria-label", `Zrušit filtr: ${filter.label}`);
      }
      activeFiltersBox.appendChild(node);
    }
  }

  async function clearFilter(key) {
    if (key === "topic") topicSel.value = "";
    else if (key === "years") setSelectedYears(defaultYears(sortedYearsFromMeta()));
    else if (key === "types") TYPE_INPUTS.forEach(input => {input.checked = true;});
    else if (key === "organs") ORG_INPUTS.forEach(input => {input.checked = true;});
    else if (key === "sort") {sortSel.value = "desc"; syncSortChips();}
    else return;
    cancelQueuedSearch();
    q.focus();
    return search();
  }

  function syncTopicShortcuts() {
    if (!topicShortcuts) return;
    const selected = selectedTopic();
    topicShortcuts.querySelectorAll("[data-topic]").forEach(button => {
      button.setAttribute("aria-pressed", String(button.dataset.topic === selected));
    });
  }

  async function browseTopic(category) {
    if (!topicSel || !Object.hasOwn(TOPICS, category)) return;
    cancelQueuedSearch();
    q.value = "";
    topicSel.value = category;
    syncClearButton();
    q.focus();
    return search();
  }

  function renderTopicFilter() {
    if (!topicGroup || !topicSel || !Object.keys(TOPICS).length) return;
    topicSel.replaceChildren(new Option("Všechna témata", ""));
    const entries = Object.entries(TOPICS).sort((a, b) => a[1].localeCompare(b[1], "cs"));
    for (const [category, label] of entries) topicSel.add(new Option(label, category));
    topicSel.add(new Option("Bez zařazení", "unclassified"));
    topicGroup.hidden = false;
    if (topicButtons && extraTopicButtons && welcomeTopicChoices) {
      topicButtons.replaceChildren();
      extraTopicButtons.replaceChildren();
      const featured = new Set();
      for (const [category, label] of FEATURED_TOPICS) {
        if (!Object.hasOwn(TOPICS, category)) continue;
        featured.add(category);
        topicButtons.appendChild(topicButton(category, label));
      }
      for (const [category, label] of entries) {
        if (!featured.has(category)) extraTopicButtons.appendChild(topicButton(category, label));
      }
      if (moreTopics) moreTopics.hidden = featured.size === entries.length;
      welcomeTopicChoices.hidden = false;
    }
  }

  function topicButton(category, label) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "usn-topic-button";
    button.dataset.topic = category;
    button.textContent = label;
    button.setAttribute("aria-pressed", "false");
    button.setAttribute("data-usn-boot", "");
    button.disabled = true;
    return button;
  }

  async function browsePlace(place) {
    if (!LOCAL_PLACES.includes(place)) return;
    cancelQueuedSearch();
    topicSel.value = "";
    q.value = place;
    syncClearButton();
    q.focus();
    return search();
  }

  function renderWelcomeOverview() {
    if (topicShortcuts) topicShortcuts.hidden = false;
    const overview = document.getElementById("usn-data-overview");
    if (!overview || !Object.keys(META).length || !Object.keys(RO_META).length) return;
    document.getElementById("usn-total-resolutions").textContent = String(
      Object.values(META).reduce((total, item) => total + (item?.count || 0), 0));
    document.getElementById("usn-total-budget-docs").textContent = String(
      Object.values(RO_META).reduce((total, item) => total + (item?.count || 0), 0));
    const year = Object.keys(META).sort().reverse()[0];
    document.getElementById("usn-latest-year-link").href = `/usneseni/${year}/`;
    overview.hidden = false;
  }

  function renderYearFilters(years) {
    for (const year of years) {
      const count = (META[year]?.count || 0) + (RO_META[year]?.count || 0) + (ARCHIVE_META[year]?.count || 0);
      const label = document.createElement("label");
      label.className = "usn-year";
      label.innerHTML = `
        <input type="checkbox" value="${year}">
        ${year} (${count})
      `;
      yearsBox.appendChild(label);
    }
    YEAR_INPUTS = [...yearsBox.querySelectorAll("input")];
  }

  function renderYearPresets() {
    yearPresetsBox.innerHTML = `
      <button type="button" class="usn-year-preset" data-year-preset="default">Posledních 5 let</button>
      <button type="button" class="usn-year-preset" data-year-preset="all">Vše</button>
      <button type="button" class="usn-year-preset" data-year-preset="recent">Poslední 2 roky</button>
    `;
    TYPE_INPUTS = [...typeBox.querySelectorAll("input")];
    ORG_INPUTS = [...orgBox.querySelectorAll("input")];
    SORT_CHIPS = sortOptions ? [...sortOptions.querySelectorAll("[data-sort-value]")] : [];
  }

  function searchWithOpenFilters() {
    setMobileFiltersOpen(true);
    cancelQueuedSearch();
    search();
  }

  // Split event binding by concern so init stays readable.
  function bindFilterEvents(years) {
    yearPresetsBox?.addEventListener("click", event => {
      const button = event.target.closest("[data-year-preset]");
      if (!button) return;
      const preset = button.dataset.yearPreset;
      if (preset === "default") {
        setSelectedYears(defaultYears(years));
      } else if (preset === "all") {
        setSelectedYears(years);
      } else if (preset === "recent") {
        setSelectedYears(years.slice(0, 2));
      }
      searchWithOpenFilters();
    });

    yearsBox.addEventListener("change", searchWithOpenFilters);
    typeBox.addEventListener("change", searchWithOpenFilters);
    orgBox.addEventListener("change", searchWithOpenFilters);
    topicSel?.addEventListener("change", searchWithOpenFilters);

    sortSel.addEventListener("change", () => {
      setMobileFiltersOpen(true);
      syncSortChips();
      search();
    });

    sortOptions?.addEventListener("click", event => {
      const button = event.target.closest("[data-sort-value]");
      if (!button) return;
      sortSel.value = button.dataset.sortValue || "desc";
      setMobileFiltersOpen(true);
      syncSortChips();
      search();
    });
  }

  function bindUiEvents() {
    activeFiltersBox?.addEventListener("click", event => {
      const button = event.target.closest("[data-clear-filter]");
      if (button) clearFilter(button.dataset.clearFilter);
    });
    topicShortcuts?.addEventListener("click", event => {
      const topic = event.target.closest("[data-topic]");
      const place = event.target.closest("[data-place]");
      if (topic) browseTopic(topic.dataset.topic);
      else if (place) browsePlace(place.dataset.place);
    });

    q.addEventListener("input", () => {
      queueSearch();
    });
    q.addEventListener("search", () => {
      cancelQueuedSearch();
      search();
    });

    clearButton?.addEventListener("click", () => {
      cancelQueuedSearch();
      q.value = "";
      syncClearButton();
      search();
      q.focus();
    });

    refineToggle?.addEventListener("click", () => {
      setMobileFiltersOpen(!searchPanel.classList.contains("is-open"));
    });

    backToTopButton?.addEventListener("click", scrollSearchIntoView);
    window.addEventListener("scroll", updateBackToTopVisibility, { passive: true });
  }

  // ============================================================
  // INIT
  // ============================================================

  async function init() {
    try {
      if (redirectFromHash()) return;

      await loadMeta();
      const years = sortedYearsFromMeta();
      renderYearFilters(years);
      setSelectedYears(defaultYears(years));
      renderYearPresets();
      renderTopicFilter();
      renderWelcomeOverview();

      loadFromUrl();
      syncClearButton();
      syncSortChips();
      bindFilterEvents(years);
      bindUiEvents();
      setMobileFiltersOpen(!filtersAreDefault());
      updateBackToTopVisibility();
      setBootReady(true);

      search();
    } catch (error) {
      console.error("Nepodařilo se načíst vyhledávání usnesení.", error);
      setBootFailed();
    }
  }

  init();
})();

---
layout: default
title: Usnesení rady a zastupitelstva města – vyhledávání
seo_title: Usnesení rady a zastupitelstva Litovel – vyhledávání
description: "Vyhledávejte v usneseních rady a zastupitelstva města Litovel podle tématu, místa, roku nebo čísla. Prohlédněte si jednotlivé schůze a navazující rozhodnutí."
permalink: /usneseni/
indexnow_dependencies:
  - /assets/usneseni/
  - /usneseni/*.js
---

# Vyhledávání v usneseních

<p class=subtitle>
Zjistěte, co město schválilo pro vaše téma, ulici nebo místní část.
</p>

<style>
.usn-app {
  --space-section: 32px;
  --space-panel: 16px;
  --radius-panel: 12px;
  --radius-control: 8px;
  --control-height: 34px;
  --surface-panel: #fff;
  --usn-accent: #294b35;
  --usn-link: var(--brand-blue, #0f46ab);
  --usn-border: #d4d6cc;
  --usn-muted: #52606b;
  display: grid;
  gap: var(--space-panel);
}
.usn-app *, .usn-app *::before, .usn-app *::after { box-sizing: border-box; }
.usn-app [hidden] { display: none !important; }
.usn-app :is(button, input, select) { font: inherit; }
.usn-app :is(button, a, input, select, summary):focus-visible {
  outline: 2px solid var(--usn-accent);
  outline-offset: 3px;
}
.usn-app :is(button, summary) { cursor: pointer; }
.usn-app :is(button, input, select):disabled { cursor: wait; opacity: .65; }
.usn-app a { color: var(--usn-link); }
.usn-search-panel { display: grid; gap: .85rem; }
.usn-search-row { position: relative; }
.usn-search-panel input[type="search"] {
  width: 100%; min-height: 48px; padding: .8rem 3.4rem .8rem .85rem;
  border: 1px solid #929b90; border-radius: 8px; background: #fff;
  color: var(--primary-text-color); font-size: var(--text-body); appearance: none;
}
.usn-search-panel input[type="search"]::-webkit-search-cancel-button { -webkit-appearance: none; }
.usn-search-clear {
  position: absolute; top: 50%; right: .2rem; transform: translateY(-50%);
  width: 44px; height: 44px; border: 0; background: transparent;
  color: var(--usn-muted); font-size: var(--text-section) !important; border-radius: var(--radius-control);
}
.usn-boot-status { display: none; color: var(--usn-muted); }
.usn-app.is-booting .usn-boot-status { display: block; }
.usn-refine-toggle {
  display: inline-flex; align-items: center; gap: .65rem; justify-self: start;
  min-height: var(--control-height); padding: .3rem .65rem; border: 1px solid var(--usn-border);
  border-radius: 8px; background: #f0f1eb; color: #364238;
}
.usn-refine-toggle::after {
  content: ""; width: .45rem; height: .45rem; border-right: 2px solid currentColor;
  border-bottom: 2px solid currentColor; transform: translateY(-2px) rotate(45deg);
}
.usn-refine-toggle[aria-expanded="true"]::after { transform: translateY(2px) rotate(225deg); }
.usn-app .usn-controls {
  display: none; margin: 0; padding: 1rem; border: 1px solid var(--usn-border);
  border-radius: var(--radius-control); background: #fff; gap: 1.25rem;
}
.usn-search-panel.is-open .usn-controls { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); align-items: start; }
.usn-years-group { grid-column: 1 / -1; }
.usn-older-years summary { width: fit-content; padding: .4rem 0; cursor: pointer; color: var(--usn-accent); }
.usn-older-years .usn-years { margin-top: .4rem; }
.usn-app .usn-filter-group { min-width: 0; justify-content: start; font-size: var(--text-body); }
.usn-app .usn-filter-label { color: var(--primary-text-color); font-size: var(--text-body); font-weight: 600; margin-bottom: .4rem; }
.usn-years-wrap { display: grid; gap: .5rem; }
.usn-app :is(.usn-years, .usn-filter-options, .usn-year-presets, .usn-sort-options) { display: flex; flex-wrap: wrap; gap: .35rem .65rem; }
.usn-app :is(.usn-year, .usn-filter-options label) {
  display: inline-flex; align-items: center; gap: .45rem; min-height: var(--control-height);
  margin: 0; padding: .25rem 0; cursor: pointer; white-space: normal;
}
.usn-app input[type="checkbox"] { width: 18px; height: 18px; accent-color: var(--usn-accent); flex: none; }
.usn-app :is(.usn-year-preset, .usn-sort-chip, .usn-topic-button, .usn-place-button) {
  min-height: var(--control-height); padding: .3rem .65rem; border: 1px solid var(--usn-border);
  border-radius: var(--radius-control); background: #fff; color: var(--usn-accent); text-align: left;
}
.usn-app :is(.usn-year-preset, .usn-sort-chip, .usn-topic-button, .usn-place-button, .usn-refine-toggle, .usn-search-clear):hover { background: #e8efe5; }
.usn-app :is(.usn-sort-chip.is-active, .usn-topic-button[aria-pressed="true"]) { background: var(--usn-accent); color: #fff; border-color: var(--usn-accent); }
.usn-app .usn-sort-chip.is-active { background: var(--usn-link); border-color: var(--usn-link); }
.usn-sort-select { display: none; }
.usn-app select:not(.usn-sort-select) { width: 100%; max-width: 100%; min-height: var(--control-height); padding: .5rem; border: 1px solid #929b90; border-radius: 8px; background: #fff; color: var(--primary-text-color); }
#usn-topic-note { margin-top: .4rem; color: var(--usn-muted); }
.usn-active-filters { display: flex; flex-wrap: wrap; align-items: center; gap: .5rem; }
.usn-active-filter { min-height: var(--control-height); padding: .4rem .65rem; border: 1px solid var(--usn-border); border-radius: var(--radius-control); background: #e8efe5; color: var(--usn-accent); }
.usn-filter-scope { color: var(--usn-muted); font-size: var(--text-small); }
.usn-welcome-content { display: grid; gap: 1rem; }
.usn-welcome-intro {
  padding: var(--space-panel); border-radius: var(--radius-panel); background: #f0f4ec;
}
.usn-welcome-intro h2 { margin: 0 0 .6rem; font-size: var(--text-section); line-height: 1.3; color: #294b35; }
.usn-welcome-intro p { margin: 0; max-width: 58ch; line-height: 1.55; }
.usn-welcome h3 { margin: 0 0 .5rem; font-size: var(--text-body); }
.usn-welcome-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; }
.usn-welcome-places, .usn-outcome-shortcuts { padding: var(--space-panel); border-radius: var(--radius-panel); background: var(--surface-panel); }
.usn-welcome-places p, .usn-outcome-shortcuts p, .usn-welcome-footer p { margin: 0; line-height: 1.5; }
.usn-topic-buttons { display: flex; flex-wrap: wrap; gap: .5rem; margin-top: .75rem; }
.usn-app #usn-topic-buttons .usn-topic-button { background: #2f5a41; border-color: #2f5a41; color: #fff; }
.usn-app #usn-topic-buttons .usn-topic-button:hover { background: #254b35; }
.usn-more-topics { margin-top: .5rem; }
.usn-more-topics summary { color: var(--usn-accent); padding: .4rem 0; width: fit-content; }
.usn-welcome-footer { color: var(--usn-muted); font-size: var(--text-small); }
.usn-outcome-note { color: var(--usn-muted); font-size: var(--text-small); margin: 0; line-height: 1.5; }
.usn-related-decisions { margin: 8px 0 0; color: var(--text-muted); font-size: var(--text-small); }
.usn-related-decisions a { display: inline-block; padding-block: 4px; }
.usn-welcome-links { display: flex; flex-wrap: wrap; gap: .3rem 1rem; margin-top: .5rem; }
.usn-welcome-links a { padding: .35rem 0; }
.usn-results-panel { display: grid; gap: .5rem; }
.usn-results-head, .usn-results-meta { display: flex; flex-wrap: wrap; align-items: baseline; gap: .4rem 1rem; }
.usn-results-head { justify-content: space-between; }
.usn-results-head h2 { margin: 0; font-size: var(--text-section); }
.usn-results-count { font-weight: 600; }
.usn-results-kicker { color: var(--usn-muted); }
.usn-result-kind, .usn-result-topic { color: var(--usn-muted); font-size: var(--text-small); }
.usn-result-kind { padding-right: .65rem; border-right: 1px solid var(--usn-border); }
.usn-app mark { background: #dce9f7; color: inherit; border-radius: 2px; }
.usn-badges { display: inline-flex; flex-wrap: wrap; gap: .5rem; }
.usn-app :is(.usn-doc-type, .usn-topic-label) { padding: 0; border: 0; border-radius: 0; background: none; color: var(--usn-muted); font-size: var(--text-small); white-space: normal; }
.usn-empty-state { padding: 1rem 0; }
.usn-empty-state h3 { margin: 0 0 .5rem; font-size: var(--text-body); }
.usn-empty-state p { margin: 0; }
.usn-empty-list { padding-left: 1.25rem; line-height: 1.6; }
.usn-source-note { color: var(--usn-muted); font-size: var(--text-small); margin: 0; }
.usn-back-to-top { display: none; position: fixed; right: 1rem; bottom: max(1rem, env(safe-area-inset-bottom)); z-index: 30; }
.usn-back-to-top.is-visible { display: block; justify-self: end; min-height: var(--control-height); padding: .3rem .65rem; border: 1px solid var(--usn-border); border-radius: var(--radius-control); background: #fff; color: var(--usn-accent); }
@media (max-width: 700px) {
  .usn-search-panel.is-open .usn-controls, .usn-welcome-grid { grid-template-columns: 1fr; }
  .usn-welcome-intro h2 { font-size: var(--text-section); }
}
@media (pointer: coarse) {
  .usn-app { --control-height: 44px; }
  .usn-app summary, .usn-welcome-links a { min-height: 44px; padding-block: .65rem; }
}
</style>

<div class="usn-app is-booting">
  <div class="usn-search-panel">
    <div class="usn-search-row">
      <input id="usn-q" type="search" aria-label="Hledat v usneseních" placeholder="Např. škola, chodník, Unčovice, dotace" data-usn-boot disabled>
      <button type="button" id="usn-clear" class="usn-search-clear" aria-label="Vymazat hledání" data-usn-boot disabled hidden>&times;</button>
    </div>
    <div id="usn-boot-status" class="usn-boot-status" aria-live="polite">Načítám vyhledávání…</div>
    <button type="button" id="usn-refine-toggle" class="usn-refine-toggle" aria-controls="usn-filter-controls" aria-expanded="false" data-usn-boot disabled>Upřesnit hledání</button>

    <div id="usn-active-filters" class="usn-active-filters" aria-label="Aktivní filtry" hidden></div>
    <div class="usn-controls" id="usn-filter-controls">
      <div id="usn-topic-group" class="usn-filter-group" hidden>
        <label class="usn-filter-label" for="usn-topic">Téma</label>
        <select id="usn-topic" aria-describedby="usn-topic-note" data-usn-boot disabled></select>
        <small id="usn-topic-note">Téma je přiřazené automaticky.</small>
      </div>
      <div class="usn-filter-group">
        <label class="usn-filter-label" for="usn-outcome">Výsledek rozhodnutí</label>
        <select id="usn-outcome" aria-describedby="usn-outcome-note" data-usn-boot disabled>
          <option value="">Všechny výsledky</option>
          <option value="rejected">Zamítnuto</option>
          <option value="changed">Změněno</option>
          <option value="deferred">Odloženo</option>
        </select>
      </div>
      <div class="usn-filter-group">
        <div class="usn-filter-label">Typ dokumentu</div>
        <div id="usn-type" class="usn-filter-options">
          <label>
            <input type="checkbox" value="usneseni" checked data-usn-boot disabled>
            Usnesení
          </label>
          <label>
            <input type="checkbox" value="ro" checked data-usn-boot disabled>
            Rozpočtová opatření
          </label>
        </div>
      </div>

      <div class="usn-filter-group">
        <div class="usn-filter-label">Schvalující orgán</div>
        <div id="usn-org" class="usn-filter-options">
          <label>
            <input type="checkbox" value="Rada města Litovel" checked data-usn-boot disabled>
            Rada města
          </label>
          <label>
            <input type="checkbox" value="Zastupitelstvo města Litovel" checked data-usn-boot disabled>
            Zastupitelstvo
          </label>
        </div>
      </div>

      <div class="usn-filter-group">
        <label class="usn-filter-label" for="usn-sort">Řazení</label>
        <div id="usn-sort-options" class="usn-sort-options">
          <button type="button" class="usn-sort-chip" data-sort-value="desc" aria-pressed="true" data-usn-boot disabled>Nejnovější</button>
          <button type="button" class="usn-sort-chip" data-sort-value="asc" aria-pressed="false" data-usn-boot disabled>Nejstarší</button>
        </div>
        <select id="usn-sort" class="usn-sort-select" data-usn-boot disabled>
          <option value="desc">Nejnovější</option>
          <option value="asc">Nejstarší</option>
        </select>
      </div>
      <div class="usn-filter-group">
        <label class="usn-filter-label" for="usn-meeting">Schůze</label>
        <select id="usn-meeting" aria-label="Filtrovat podle schůze" data-usn-boot disabled><option value="">Všechny schůze</option></select>
      </div>
      <div class="usn-filter-group usn-years-group">
        <div class="usn-filter-label">Roky</div>
        <div class="usn-years-wrap">
          <div id="usn-year-presets" class="usn-year-presets"></div>
          <div id="usn-years">
            <div id="usn-recent-years" class="usn-years"></div>
            <details id="usn-older-years" class="usn-older-years" hidden>
              <summary>Starší roky</summary>
              <div id="usn-older-year-options" class="usn-years"></div>
            </details>
          </div>
        </div>
      </div>
    </div>
    <p id="usn-outcome-note" class="usn-outcome-note" hidden></p>
  </div>

  <section id="usn-topics" class="usn-welcome" aria-labelledby="usn-welcome-title" hidden>
    <div class="usn-welcome-content">
      <section class="usn-welcome-intro" aria-labelledby="usn-welcome-title">
        <h2 id="usn-welcome-title">Podívejte se, co město řeší ve vašem okolí.</h2>
        <p>Školy, chodníky, sport i vaše místní část. Vyberte si téma nebo místo a najděte usnesení, která vás zajímají.</p>
        <div id="usn-welcome-topic-choices" hidden>
          <div id="usn-topic-buttons" class="usn-topic-buttons" role="group" aria-label="Oblíbená témata"></div>
          <details id="usn-more-topics" class="usn-more-topics">
            <summary>Další témata</summary>
            <div id="usn-extra-topic-buttons" class="usn-topic-buttons" role="group" aria-label="Další témata"></div>
          </details>
        </div>
      </section>
      <div class="usn-welcome-grid">
        <section class="usn-welcome-places">
          <h3>Hledejte podle místa</h3>
          <p>Podívejte se, co se týká vaší části města.</p>
          <div class="usn-topic-buttons" role="group" aria-label="Hledat podle místa">
            <button type="button" class="usn-place-button" data-place="Litovel" data-usn-boot disabled>Litovel</button>
            <button type="button" class="usn-place-button" data-place="Unčovice" data-usn-boot disabled>Unčovice</button>
            <button type="button" class="usn-place-button" data-place="Nasobůrky" data-usn-boot disabled>Nasobůrky</button>
            <button type="button" class="usn-place-button" data-place="Myslechovice" data-usn-boot disabled>Myslechovice</button>
            <button type="button" class="usn-place-button" data-place="Chořelice" data-usn-boot disabled>Chořelice</button>
            <button type="button" class="usn-place-button" data-place="Nová Ves" data-usn-boot disabled>Nová Ves</button>
          </div>
        </section>
        <section class="usn-outcome-shortcuts" aria-labelledby="usn-outcomes-title">
          <h3 id="usn-outcomes-title">Za rozhodnutími města</h3>
          <p>Co město odmítlo, změnilo nebo odložilo?</p>
          <div class="usn-topic-buttons" role="group" aria-label="Procházet podle výsledku rozhodnutí">
            <button type="button" class="usn-topic-button" data-outcome="rejected" data-usn-boot disabled>Zamítnuto</button>
            <button type="button" class="usn-topic-button" data-outcome="changed" data-usn-boot disabled>Změněno</button>
            <button type="button" class="usn-topic-button" data-outcome="deferred" data-usn-boot disabled>Odloženo</button>
          </div>
        </section>
      </div>
        <section id="usn-data-overview" class="usn-welcome-footer" hidden>
          <p><strong id="usn-total-resolutions"></strong> usnesení a <strong id="usn-total-budget-docs"></strong> rozpočtových opatření v aktuální datové sadě.</p>
          <div class="usn-welcome-links">
            <a id="usn-latest-year-link" href="/usneseni/">Nejnovější rok</a>
            <a href="/rozpoctova-opatreni/">Rozpočtová opatření</a>
            <a href="/usneseni/archiv/">Archiv usnesení</a>
          </div>
        </section>
    </div>
  </section>

  <section id="usn-results-panel" class="usn-results-panel" hidden>
    <div class="usn-results-head">
      <h2>Výsledky</h2>
      <div class="usn-results-meta">
        <div id="usn-results-count" class="usn-results-count" aria-live="polite" aria-atomic="true"></div>
        <div id="usn-results-kicker" class="usn-results-kicker"></div>
      </div>
    </div>
    <ul id="usn-results" class="usn-results"></ul>
  </section>
  <button type="button" id="usn-back-to-top" class="usn-back-to-top" aria-label="Zpět nahoru">Nahoru</button>

  <p class="usn-source-note">Data vycházejí z oficiálně zveřejněných dokumentů města Litovel.</p>

  <div class="archiv-label">Procházet podle roku</div>
  <ul class="archiv-years">
  {% assign years = site.pages
      | where_exp: "p", "p.url contains '/usneseni/'"
      | where_exp: "p", "p.url != '/usneseni/'"
      | map: "url"
  %}

  {% assign year_list = "" | split: "" %}

  {% for url in years %}
    {% assign parts = url | split: "/" %}
    {% assign y = parts[2] %}
    {% unless year_list contains y %}
      {% assign year_list = year_list | push: y %}
    {% endunless %}
  {% endfor %}

  {% assign sorted_years = year_list | sort | reverse %}

  {% for year in sorted_years %}
    <li><a href="/usneseni/{{ year }}/">{{ year }}</a></li>
  {% endfor %}
  </ul>
</div>

<script src="/usneseni/outcomes.js"></script>
<script src="/usneseni/search-preview.js"></script>
<script src="/usneseni/app.js?v=2"></script>

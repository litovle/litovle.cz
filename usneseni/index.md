---
layout: default
title: Usnesení rady a zastupitelstva města – vyhledávání
permalink: /usneseni/
---

# Vyhledávání v usneseních

<p class=subtitle>
Zjistěte, co město schválilo pro vaše téma, ulici nebo místní část.
</p>

<style>

.usn-app {
  display: grid;
  gap: 1.25rem;
}

.usn-app.is-booting .usn-search-panel {
  opacity: .72;
}

.usn-boot-status {
  display: none;
  align-items: center;
  gap: .55rem;
  color: #4a5d4b;
  font-size: .94rem;
}

.usn-app.is-booting .usn-boot-status {
  display: inline-flex;
}

.usn-boot-status::before {
  content: "";
  width: .85rem;
  height: .85rem;
  border: 2px solid rgba(47, 90, 65, 0.18);
  border-top-color: #2f5a41;
  border-radius: 999px;
  animation: usn-boot-spin .8s linear infinite;
}

@keyframes usn-boot-spin {
  to {
    transform: rotate(360deg);
  }
}

.usn-search-panel {
  position: sticky;
  top: 0;
  z-index: 20;
  display: grid;
  gap: .9rem;
  padding: .95rem 1rem 1rem;
  border: 1px solid rgba(57, 79, 61, 0.10);
  border-radius: 18px;
  background: linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(250,252,250,0.96) 100%);
  box-shadow: 0 16px 36px rgba(44, 55, 47, 0.08);
  backdrop-filter: blur(8px);
}

.usn-search-row {
  position: relative;
}

.usn-search-panel input[type="search"] {
  width: 100%;
  border: 1px solid rgba(57, 79, 61, 0.16);
  border-radius: 12px;
  padding: 1rem 3.7rem 1rem 1.15rem;
  background: linear-gradient(180deg, #fffdf9 0%, #ffffff 100%);
  color: #1f2b22;
  font-size: 1.05rem;
  line-height: 1.2;
  box-shadow: 0 10px 24px rgba(44, 55, 47, 0.08);
  transition: border-color .16s ease, box-shadow .16s ease, transform .16s ease;
  appearance: none;
  -webkit-appearance: none;
}

.usn-search-panel input[type="search"]::placeholder {
  color: #7b847d;
}

.usn-search-panel input[type="search"]:hover {
  border-color: rgba(57, 79, 61, 0.28);
}

.usn-search-panel input[type="search"]:focus {
  outline: none;
  border-color: #36513b;
  box-shadow: 0 0 0 4px rgba(54, 81, 59, 0.12), 0 14px 30px rgba(44, 55, 47, 0.12);
  transform: translateY(-1px);
}

.usn-search-panel input[type="search"]::-webkit-search-decoration,
.usn-search-panel input[type="search"]::-webkit-search-cancel-button,
.usn-search-panel input[type="search"]::-webkit-search-results-button,
.usn-search-panel input[type="search"]::-webkit-search-results-decoration {
  -webkit-appearance: none;
}

.usn-search-panel input[type="search"] {
  box-shadow: 0 10px 24px rgba(44, 55, 47, 0.08);
}

.usn-search-clear {
  position: absolute;
  top: 50%;
  right: .7rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  border: 0;
  border-radius: 999px;
  padding: 0;
  background: rgba(57, 79, 61, 0.10);
  color: #294132;
  font: inherit;
  font-size: 1.2rem;
  line-height: 1;
  cursor: pointer;
  transform: translateY(-50%);
  transition: background .16s ease;
}

.usn-search-clear:hover,
.usn-search-clear:focus-visible {
  background: rgba(57, 79, 61, 0.18);
}

.usn-search-clear[hidden] {
  display: none;
}

.usn-refine-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: fit-content;
  border: 1px solid rgba(57, 79, 61, 0.14);
  border-radius: 999px;
  padding: .38rem .8rem;
  background: #f3f6f3;
  color: #294132;
  font: inherit;
  cursor: pointer;
}

.usn-refine-toggle:hover,
.usn-refine-toggle:focus-visible {
  background: #e7efe8;
}

.usn-search-panel input[type="search"]:disabled,
.usn-search-clear:disabled,
.usn-refine-toggle:disabled,
.usn-sort-chip:disabled,
.usn-filter-options input:disabled + span {
  cursor: not-allowed;
}

.usn-search-panel input[type="search"]:disabled {
  opacity: .82;
  transform: none;
}

.usn-search-clear:disabled,
.usn-refine-toggle:disabled,
.usn-sort-chip:disabled {
  opacity: .6;
  box-shadow: none;
}

.usn-refine-toggle {
  white-space: nowrap;
}

.usn-years-wrap {
  display: grid;
  gap: .45rem;
}

.usn-year-presets {
  display: flex;
  flex-wrap: wrap;
  gap: .45rem;
}

.usn-year-preset,
.usn-year,
.usn-filter-options label,
.usn-sort-chip {
  display: inline-flex;
  align-items: center;
  gap: .35rem;
  border-radius: 999px;
  font: inherit;
}

.usn-year-preset {
  border: 1px solid rgba(57, 79, 61, 0.14);
  padding: .28rem .65rem;
  background: #f3f6f3;
  color: #294132;
  cursor: pointer;
}

.usn-year-preset:hover,
.usn-year-preset:focus-visible {
  background: #e7efe8;
}

.usn-years {
  gap: .45rem;
}

.usn-year,
.usn-filter-options label,
.usn-sort-chip {
  margin-right: 0;
  padding: .24rem .62rem;
  border: 1px solid rgba(57, 79, 61, 0.12);
  background: #fff;
  cursor: pointer;
}

.usn-year:has(input:checked),
.usn-filter-options label:has(input:checked),
.usn-sort-chip.is-active {
  background: #2f5a41;
  border-color: #2f5a41;
  color: #fff;
}

.usn-year input,
.usn-filter-options input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
  pointer-events: none;
}

.usn-sort-options {
  display: flex;
  flex-wrap: wrap;
  gap: .45rem;
}

.usn-sort-chip {
  font: inherit;
}

.usn-sort-select {
  position: absolute;
  opacity: 0;
  pointer-events: none;
  width: 0;
  height: 0;
  overflow: hidden;
}

.usn-controls {
  display: none;
}

#usn-topic-group[hidden] { display: none; }

#usn-topic {
  max-width: 100%;
  padding: .5rem .65rem;
  border: 1px solid rgba(57, 79, 61, 0.2);
  border-radius: 8px;
  background: #fff;
  color: #1f2b22;
  font: inherit;
}

#usn-topic:focus-visible { outline: 2px solid #2f5a41; outline-offset: 2px; }

#usn-topic-note { margin-top: .35rem; color: #667168; }

.usn-head { flex-wrap: wrap; }
.usn-badges {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: .4em;
  max-width: 100%;
}
.usn-topic-label {
  display: inline-block;
  padding: .08em .45em;
  border: 1px solid #dce7dc;
  border-radius: 999px;
  background: #f3f6f3;
  color: #526154;
  font-size: .78em;
  overflow-wrap: anywhere;
}

.usn-search-panel.is-open .usn-controls {
  display: flex;
}

.usn-results-jump {
  display: none;
  border: 0;
  border-radius: 999px;
  padding: .35rem .7rem;
  background: #eef3ef;
  color: #24412e;
  font: inherit;
  cursor: pointer;
}

.usn-back-to-top {
  position: fixed;
  right: 1rem;
  bottom: 1rem;
  z-index: 30;
  border: 0;
  border-radius: 999px;
  padding: .7rem .95rem;
  background: #2f5a41;
  color: #fff;
  font: inherit;
  box-shadow: 0 12px 28px rgba(32, 54, 39, 0.22);
  cursor: pointer;
  opacity: 0;
  transform: translateY(10px);
  pointer-events: none;
  transition: opacity .18s ease, transform .18s ease, background .18s ease;
  display: none;
}

.usn-back-to-top.is-visible {
  display: inline-flex;
  opacity: 1;
  transform: translateY(0);
  pointer-events: auto;
}

.usn-back-to-top:hover,
.usn-back-to-top:focus-visible {
  background: #254b35;
}

.usn-results-panel {
  display: grid;
  gap: .75rem;
}

.usn-results-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
  padding-top: .25rem;
  flex-wrap: wrap;
}

.usn-results-head h2 {
  margin: 0;
  font-size: 1.1rem;
}

.usn-results-meta {
  display: inline-flex;
  align-items: baseline;
  gap: .55rem;
  flex-wrap: wrap;
}

.usn-results-count {
  color: #2f5a41;
  font-size: .95rem;
  font-weight: 700;
}

.usn-results-kicker {
  color: #5a645d;
  font-size: .92rem;
}

.usn-empty-state {
  padding: 1rem 1.1rem;
  border: 1px dashed rgba(74, 93, 75, 0.28);
  border-radius: 16px;
  background: #faf8f2;
}

.usn-loading-state {
  display: grid;
  gap: .75rem;
}

.usn-loading-card {
  display: grid;
  gap: .65rem;
  padding: 1rem 1.05rem;
  border: 1px solid rgba(74, 93, 75, 0.10);
  border-radius: 18px;
  background: #fff;
}

.usn-loading-line {
  display: block;
  height: .88rem;
  border-radius: 999px;
  background: linear-gradient(90deg, rgba(230, 236, 231, 0.92) 0%, rgba(244, 247, 244, 1) 45%, rgba(230, 236, 231, 0.92) 100%);
  background-size: 220% 100%;
  animation: usn-loading-shimmer 1.15s linear infinite;
}

.usn-loading-line-title {
  width: 38%;
  height: 1rem;
}

.usn-loading-line-meta {
  width: 26%;
}

.usn-loading-line-body {
  width: 100%;
}

.usn-loading-line-body-short {
  width: 72%;
}

@keyframes usn-loading-shimmer {
  from {
    background-position: 100% 0;
  }
  to {
    background-position: -100% 0;
  }
}

.usn-empty-state h3 {
  margin: 0 0 .45rem;
  font-size: 1rem;
}

.usn-empty-state p {
  margin: 0;
}

.usn-empty-list {
  margin: .8rem 0 0;
  padding-left: 1.1rem;
}

.usn-empty-list li + li {
  margin-top: .25rem;
}

.usn-results-panel[hidden] {
  display: none !important;
}

.usn-source-note {
  margin: .2rem 0 0;
  color: #667168;
  font-size: .92rem;
}

@media (max-width: 700px) {

.usn-back-to-top {
    right: 50%;
    bottom: .85rem;
    transform: translateX(50%) translateY(10px);
  }

.usn-back-to-top.is-visible {
    transform: translateX(50%) translateY(0);
  }

  h1 {
    font-size: 1.7rem;
    line-height: 1.1;
    margin-bottom: .5rem;
  }

  .subtitle {
    margin-bottom: .75rem;
    font-size: .98rem;
  }

.usn-results-jump {
    display: inline-flex;
    align-items: center;
  }

.usn-search-panel {
    position: static;
    padding: 0;
    border: 0;
    border-radius: 0;
    box-shadow: none;
    background: none;
    backdrop-filter: none;
  }

.usn-search-panel input[type="search"] {
    position: static;
    padding-right: 3.5rem;
  }

.usn-controls {
    display: none;
  }

.usn-search-panel.is-open .usn-controls {
    display: grid;
  }
}
.usn-welcome[hidden],
.usn-welcome [hidden] { display: none; }
.usn-welcome-content { display: grid; gap: 1rem; margin-top: .6rem; }
.usn-welcome-hero {
  padding: 1.5rem;
  border: 1px solid rgba(74, 93, 75, .18);
  border-radius: 22px;
  background: linear-gradient(135deg, #f7f2e8 0%, #eef5ef 100%);
  box-shadow: 0 16px 40px rgba(53, 61, 54, .08);
}
.usn-welcome-kicker {
  display: inline-block;
  margin-bottom: .65rem;
  padding: .3rem .6rem;
  border-radius: 999px;
  background: rgba(67, 90, 71, .1);
  color: #36513b;
  font-size: .85rem;
  font-weight: 600;
}
.usn-welcome-hero h2 { margin: 0 0 .7rem; font-size: 1.6rem; line-height: 1.25; }
.usn-welcome-hero p { margin: 0; max-width: 58ch; line-height: 1.55; }
.usn-welcome-grid { display: grid; gap: 1rem; grid-template-columns: repeat(2, minmax(0, 1fr)); }
.usn-welcome-card {
  padding: 1.1rem;
  border: 1px solid rgba(74, 93, 75, .12);
  border-radius: 18px;
  background: #fff;
}
.usn-welcome-card h3 { margin: 0 0 .5rem; }
.usn-welcome-card p { margin: 0; line-height: 1.5; }
.usn-welcome-links { display: flex; flex-wrap: wrap; gap: .6rem; margin-top: .9rem; }
.usn-welcome-links a { color: #36513b; }
.usn-more-topics { margin-top: 1rem; }
.usn-more-topics summary { color: #36513b; cursor: pointer; width: fit-content; }
.usn-place-button {
  padding: .4rem .7rem;
  border: 1px solid rgba(57, 79, 61, .16);
  border-radius: 999px;
  background: #eef3ef;
  color: #294132;
  font: inherit;
  cursor: pointer;
}
.usn-place-button:hover { background: #dde9df; }
.usn-place-button:focus-visible,
.usn-welcome summary:focus-visible { outline: 2px solid #2f5a41; outline-offset: 3px; }
@media (max-width: 700px) {
  .usn-welcome-hero { padding: 1.1rem; }
  .usn-welcome-hero h2 { font-size: 1.35rem; }
  .usn-welcome-grid { grid-template-columns: 1fr; }
}
.usn-topic-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: .5rem;
  margin-top: .75rem;
}
.usn-topic-button {
  padding: .4rem .7rem;
  border: 1px solid rgba(57, 79, 61, .16);
  border-radius: 999px;
  background: #eef3ef;
  color: #294132;
  font: inherit;
  cursor: pointer;
}
#usn-topic-buttons .usn-topic-button { background: #2f5a41; border-color: #2f5a41; color: #fff; }
#usn-topic-buttons .usn-topic-button:hover { background: #254b35; }
.usn-topic-button:hover { background: #dde9df; }
.usn-topic-button[aria-pressed="true"] {
  background: #2f5a41;
  border-color: #2f5a41;
  color: #fff;
}
.usn-topic-button:focus-visible,
.usn-welcome summary:focus-visible {
  outline: 2px solid #2f5a41;
  outline-offset: 3px;
}
.usn-active-filters { display: flex; flex-wrap: wrap; align-items: center; gap: .45rem; }
.usn-active-filters[hidden] { display: none; }
.usn-active-filter {
  display: inline-flex;
  padding: .3rem .65rem;
  border: 1px solid #cbd9cd;
  border-radius: 999px;
  background: #eef3ef;
  color: #294132;
  font: inherit;
  font-size: .88rem;
  cursor: pointer;
}
.usn-active-filter:hover { background: #dde9df; }
.usn-active-filter:focus-visible { outline: 2px solid #2f5a41; outline-offset: 2px; }
.usn-filter-scope { color: #667168; font-size: .88rem; }
</style>

<div class="usn-app is-booting">
  <div class="usn-search-panel">
    <div class="usn-search-row">
      <input id="usn-q" type="search" placeholder="Např. škola, chodník, Unčovice, dotace" data-usn-boot disabled>
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
        <div class="usn-filter-label">Roky</div>
        <div class="usn-years-wrap">
          <div id="usn-year-presets" class="usn-year-presets"></div>
          <div id="usn-years" class="usn-years"></div>
        </div>
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
    </div>
  </div>

  <section id="usn-topics" class="usn-welcome" aria-labelledby="usn-welcome-title" hidden>
    <div class="usn-welcome-content">
      <section class="usn-welcome-hero" aria-labelledby="usn-welcome-title">
        <span class="usn-welcome-kicker">Nevíte, kde začít?</span>
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
        <section class="usn-welcome-card">
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
        <section id="usn-data-overview" class="usn-welcome-card" hidden>
          <h3>V datech najdete</h3>
          <p><strong id="usn-total-resolutions"></strong> usnesení a <strong id="usn-total-budget-docs"></strong> rozpočtových opatření v aktuální datové sadě.</p>
          <div class="usn-welcome-links">
            <a id="usn-latest-year-link" href="/usneseni/">Nejnovější rok</a>
            <a href="/rozpoctova-opatreni/">Rozpočtová opatření</a>
            <a href="/usneseni/archiv/">Archiv usnesení</a>
          </div>
        </section>
      </div>
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

<script src="/usneseni/app.js"></script>

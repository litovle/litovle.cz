const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const backLinkScript = fs.readFileSync(path.join(__dirname, "../usneseni/back-link.js"), "utf8");
const siteScript = fs.readFileSync(path.join(__dirname, "../assets/js/site.js"), "utf8");

function runBackLink(back, prefixes) {
  const link = {href: "/usneseni/", textContent: "Výchozí odkaz"};
  vm.runInNewContext(backLinkScript, {
    URL, URLSearchParams,
    location: {
      origin: "https://litovle.cz",
      search: back === undefined ? "" : "?" + new URLSearchParams({back})
    },
    document: {
      getElementById: () => link,
      currentScript: {dataset: {backPrefixes: prefixes}}
    }
  });
  return link;
}

test("return links preserve the search filters and omit fragments", () => {
  for (const [back, expected] of [
    ["/usneseni?q=skola&y=2026#results", "/usneseni?q=skola&y=2026"],
    ["https://litovle.cz/usneseni/?q=skola&y=2026#results", "/usneseni/?q=skola&y=2026"]
  ]) {
    const link = runBackLink(back);
    assert.equal(link.href, expected);
    assert.equal(link.textContent, "← Zpět na vyhledávání");
  }
});

test("return links accept a page in the allowed section", () => {
  assert.equal(runBackLink("/usneseni/2026/RM-82/").href, "/usneseni/2026/RM-82/");
});

test("invalid or unrelated return URLs keep the generated fallback", () => {
  for (const back of [undefined, "", "http://[", "https://example.org/usneseni/", "//example.org/usneseni/",
    "javascript:alert(1)", "/usneseni-evil/", "/o-projektu/", "/usneseni/%2e%2e/o-projektu/"]) {
    assert.deepEqual(runBackLink(back), {href: "/usneseni/", textContent: "Výchozí odkaz"}, String(back));
  }
});

test("budget return destinations require the additional allowed section", () => {
  assert.equal(runBackLink("/rozpoctova-opatreni/?rok=2026").href, "/usneseni/");
  const prefixes = "/usneseni /rozpoctova-opatreni";
  assert.equal(runBackLink("/rozpoctova-opatreni/?rok=2026", prefixes).href, "/rozpoctova-opatreni/?rok=2026");
  assert.equal(runBackLink("/usneseni/?q=rozpocet", prefixes).href, "/usneseni/?q=rozpocet");
  assert.equal(runBackLink("/rozpoctova-opatreni-evil/", prefixes).href, "/usneseni/");
});

test("pages without a return link need no page-specific configuration", () => {
  assert.doesNotThrow(() => vm.runInNewContext(backLinkScript, {document: {getElementById: () => null}}));
});

test("the shared top button responds to scrolling, viewport changes and reduced motion", () => {
  const events = {};
  const classes = new Set();
  let click;
  let reducedMotion = false;
  let lastScroll;
  const button = {
    classList: {toggle: (name, visible) => visible ? classes.add(name) : classes.delete(name)},
    addEventListener: (name, callback) => { if (name === "click") click = callback; }
  };
  const window = {
    innerWidth: 500, scrollY: 0,
    addEventListener: (name, callback) => { events[name] = callback; },
    matchMedia: () => ({matches: reducedMotion}),
    scrollTo: ({top, behavior}) => { lastScroll = {top, behavior}; }
  };
  vm.runInNewContext(siteScript, {window, document: {getElementById: id => id === "site-back-to-top" ? button : null}});
  assert.equal(classes.has("is-visible"), false);
  window.scrollY = 800;
  events.scroll();
  assert.equal(classes.has("is-visible"), true);
  window.innerWidth = 1000;
  events.resize();
  assert.equal(classes.has("is-visible"), false);
  click();
  assert.deepEqual(lastScroll, {top: 0, behavior: "smooth"});
  reducedMotion = true;
  click();
  assert.deepEqual(lastScroll, {top: 0, behavior: "auto"});
});

test("the search page keeps ownership of its existing top button", () => {
  assert.doesNotThrow(() => vm.runInNewContext(siteScript, {document: {getElementById: () => ({})}}));
});

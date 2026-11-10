(() => {
  const root = document.querySelector(".usn-resolution, .usn-budget");
  if (!root) return;
  const body = root.querySelector(".usneseni-body");
  const back = root.querySelector(".usn-resolution-back");
  const meeting = root.querySelector(".usn-resolution-meeting");

  // Move only standalone generated navigation paragraphs. Keep document text intact.
  for (const paragraph of [...body.children]) {
    if (paragraph.tagName !== "P" || paragraph.children.length !== 1) continue;
    const link = paragraph.firstElementChild;
    if (link.tagName !== "A" || paragraph.textContent.trim() !== link.textContent.trim()) continue;
    if (link.id === "back-link") {
      back.appendChild(paragraph);
      back.hidden = false;
      continue;
    }
    let url;
    try { url = new URL(link.getAttribute("href"), location.href); }
    catch { continue; }
    if (meeting && url.origin === location.origin && /^\/usneseni\/\d{4}\/(?:RM|ZM)-\d+\/$/.test(url.pathname)) {
      meeting.appendChild(paragraph);
      meeting.hidden = false;
    }
  }

  if (!root.classList.contains("usn-resolution")) return;
  const previews = globalThis.UsneseniSearchPreview;

  function searchContext() {
    const backUrl = new URLSearchParams(location.search).get("back");
    if (!backUrl) return null;
    try {
      const url = new URL(backUrl, location.origin);
      return url.origin === location.origin && /^\/usneseni\/?$/.test(url.pathname) ? url : null;
    } catch { return null; }
  }

  const context = searchContext();
  if (context) {
    for (const link of root.querySelectorAll("a.usn-context-link")) {
      const url = new URL(link.getAttribute("href"), location.href);
      if (url.origin !== location.origin || !globalThis.UsneseniResolutionId.isPath(url.pathname)) continue;
      url.searchParams.set("back", context.pathname + context.search);
      link.href = url.pathname + url.search + url.hash;
    }
  }

  function searchQuery() {
    const phrase = context?.searchParams.get("q") || "";
    return {phrase, terms: phrase.split(/\s+/).filter(word => word.length >= 3)};
  }

  // Work with text nodes to preserve the original wording, labels and markup.
  function markMatches(target, {terms, phrase}) {
    const ranges = previews.ranges(target.textContent, terms);
    if (!ranges.length) return;
    const preferred = previews.ranges(target.textContent, [phrase])[0] || ranges[0];
    const walker = document.createTreeWalker(target, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    let offset = 0, focusMark;
    for (const node of nodes) {
      const text = node.textContent;
      const matches = ranges.map(([start, end]) => [Math.max(0, start - offset), Math.min(text.length, end - offset)])
        .filter(([start, end]) => start < end);
      const nodeStart = offset;
      offset += text.length;
      if (!matches.length) continue;
      const fragment = document.createDocumentFragment();
      let cursor = 0;
      for (const [start, end] of matches) {
        fragment.appendChild(document.createTextNode(text.slice(cursor, start)));
        const mark = document.createElement("mark");
        mark.dataset.usnMatch = "";
        mark.textContent = text.slice(start, end);
        if (!focusMark && nodeStart + end > preferred[0]) focusMark = mark;
        fragment.appendChild(mark);
        cursor = end;
      }
      fragment.appendChild(document.createTextNode(text.slice(cursor)));
      node.replaceWith(fragment);
    }
    return focusMark;
  }

  function revealMatch() {
    body.querySelectorAll("mark[data-usn-match]").forEach(mark => mark.replaceWith(...mark.childNodes));
    body.querySelectorAll(".is-search-target").forEach(node => node.classList.remove("is-search-target"));
    const anchor = location.hash.slice(1);
    if (!/^(predmet|bod-[1-9]\d*|dovetek)$/.test(anchor)) return;
    const target = document.getElementById(anchor);
    if (!target || !body.contains(target)) return;
    const match = markMatches(target, searchQuery());
    target.setAttribute("tabindex", "-1");
    target.focus({preventScroll: true});
    (match || target).scrollIntoView({block: "center", behavior: "instant"});
    target.classList.add("is-search-target");
    setTimeout(() => target.classList.remove("is-search-target"), 4000);
  }

  window.addEventListener("hashchange", revealMatch);
  if (document.readyState === "complete") revealMatch();
  else window.addEventListener("load", () => requestAnimationFrame(revealMatch), {once: true});
})();

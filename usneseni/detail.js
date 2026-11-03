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
})();

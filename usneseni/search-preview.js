/* Shared match offsets for result snippets and links into the original text. */
((root) => {
  function foldedText(text) {
    let value = "", offset = 0;
    const starts = [], ends = [];
    for (const character of String(text || "")) {
      const end = offset + character.length;
      const folded = character.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (!folded && ends.length) ends[ends.length - 1] = end;
      for (const letter of folded) {
        const normalized = /\s/.test(letter) ? " " : letter;
        if (normalized === " " && value.endsWith(" ")) {
          ends[ends.length - 1] = end;
          continue;
        }
        value += normalized;
        for (let i = 0; i < normalized.length; i++) {
          starts.push(offset);
          ends.push(end);
        }
      }
      offset = end;
    }
    return {value, starts, ends};
  }

  function ranges(text, terms = []) {
    const folded = foldedText(text);
    const matches = [];
    for (const term of terms) {
      const needle = foldedText(term).value.trim();
      if (needle.length < 3) continue;
      let from = 0;
      while ((from = folded.value.indexOf(needle, from)) !== -1) {
        matches.push([folded.starts[from], folded.ends[from + needle.length - 1]]);
        from += needle.length;
      }
    }
    matches.sort((a, b) => a[0] - b[0] || b[1] - a[1]);
    const merged = [];
    for (const match of matches) {
      const previous = merged[merged.length - 1];
      if (previous && match[0] <= previous[1]) previous[1] = Math.max(previous[1], match[1]);
      else merged.push([...match]);
    }
    return merged;
  }

  const escapeHtml = text => String(text || "").replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

  function highlight(text, terms) {
    text = String(text || "");
    let html = "", cursor = 0;
    for (const [start, end] of ranges(text, terms)) {
      html += escapeHtml(text.slice(cursor, start)) + `<mark>${escapeHtml(text.slice(start, end))}</mark>`;
      cursor = end;
    }
    return html + escapeHtml(text.slice(cursor));
  }

  function snippet(text, terms = [], length = 180, phrase = "") {
    text = String(text || "").replace(/\s+/g, " ").trim();
    if (text.length <= length) return text;
    const match = (phrase && ranges(text, [phrase])[0]) || ranges(text, terms)[0];
    let start = match ? Math.max(0, match[0] - Math.min(60, Math.floor(length / 3))) : 0;
    if (start > 0) {
      const boundary = text.indexOf(" ", start - 1);
      if (boundary >= 0 && boundary < match[0]) start = boundary + 1;
    }
    let end = Math.min(text.length, Math.max(start + length, match?.[1] || 0));
    if (end < text.length) {
      const boundary = text.lastIndexOf(" ", end);
      if (boundary > start + length / 2 && boundary >= (match?.[1] || 0)) end = boundary;
    }
    return (start ? "… " : "") + text.slice(start, end).trimEnd() + (end < text.length ? "…" : "");
  }

  const api = {ranges, highlight, snippet};
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.UsneseniSearchPreview = api;
})(globalThis);

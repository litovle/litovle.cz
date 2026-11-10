/* Read metadata and construct links while retaining the official resolution number. */
((root) => {
  function parse(id) {
    if (typeof id !== "string") return null;
    let match = id.match(/^(RM|ZM)\/(\d+)\/(\d+)\/(\d{4})$/i);
    if (match) return {organ: match[1].toUpperCase(), number: Number(match[2]), meeting: Number(match[3]), year: match[4]};
    match = id.match(/^U([RZ])-(\d+)-(\d+)\/(\d{4}|\d{2})$/i);
    if (!match) return null;
    return {organ: match[1].toUpperCase() === "R" ? "RM" : "ZM", number: Number(match[2]),
      meeting: Number(match[3]), year: match[4].length === 2 ? String(2000 + Number(match[4])) : match[4]};
  }

  function url(id) {
    const parts = parse(id);
    return parts ? `/usneseni/${parts.year}/${id.replace(/\//g, "-")}/` : null;
  }

  function fromHash(hash) {
    let id;
    try { id = decodeURIComponent(hash.replace(/^#/, "")); }
    catch { return null; }
    if (parse(id)) return id;
    const legacy = id.match(/^(RM|ZM)-(\d+)-(\d+)-(\d{4})$/i);
    if (legacy) return legacy.slice(1).join("/");
    const native = id.match(/^(U[RZ])-(\d+)-(\d+)-(\d{4}|\d{2})$/i);
    return native ? `${native[1]}-${native[2]}-${native[3]}/${native[4]}` : null;
  }

  function isPath(path) {
    return /^\/usneseni\/\d{4}\/(?:(?:RM|ZM)-\d+-\d+-\d{4}|U[RZ]-\d+-\d+-(?:\d{4}|\d{2}))\/$/i.test(path);
  }

  const api = {parse, url, fromHash, isPath};
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.UsneseniResolutionId = api;
})(globalThis);

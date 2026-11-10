/* Explicit decision actions only; no inferred disputes or project status. */
((root) => {
  const ids = typeof module !== "undefined" && module.exports ? require("./resolution-id.js") : root.UsneseniResolutionId;
  const rules = {
    rejected: {label: "Zamítnuto", actions: ["neschvaluje", "nesouhlasí"], note: "Body s akcí „neschvaluje“ nebo „nesouhlasí“."},
    changed: {label: "Změněno", actions: ["revokuje", "mění"], note: "Body s akcí „revokuje“ nebo „mění“. Rozsah změny je uveden v textu usnesení."},
    deferred: {label: "Odloženo", actions: ["odkládá", "stahuje bod"], note: "Body s akcí „odkládá“ nebo „stahuje bod“."},
  };
  const normalize = text => String(text || "").toLowerCase().normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
  const definition = key => Object.hasOwn(rules, key) ? rules[key] : null;

  function parts(record, key) {
    const rule = definition(key);
    if (!rule || !ids.parse(record.id)
      || record.type === "archive_document" || record.type === "archive_resolution") return [];
    const actions = rule.actions.map(normalize);
    if (record.items?.length) {
      return record.items.map((item, index) => ({...item, index})).filter(item => {
        const text = normalize(item.text).replace(/^(?:rada|zastupitelstvo) mesta litovel[ ,]+/, "");
        return actions.some(action => text === action || text.startsWith(action + " ") || text.startsWith(action + ".") || text.startsWith(action + ":"));
      });
    }
    if (!(record.actions || []).some(action => actions.includes(normalize(action)))) return [];
    return [{index: null, label: "", text: [...(record.actions || []), record.subject || "", record.tail || ""].join(" ")}];
  }

  function partText(record, part) {
    return normalize([record.id || "", part.index === null ? "" : record.subject || "", part.text || ""].join(" "));
  }

  function references(record, key) {
    if (key !== "changed") return [];
    const texts = parts(record, key).map(part => normalize(part.text));
    const seen = new Set();
    return (record.references_out || []).filter(ref => {
      if (!ids.parse(ref.resolved) || !ref.raw || seen.has(ref.resolved)) return false;
      if (!texts.some(text => text.includes(normalize(ref.raw)))) return false;
      seen.add(ref.resolved);
      return true;
    }).map(ref => ref.resolved);
  }

  const api = {definition, parts, partText, references};
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.UsneseniOutcomes = api;
})(globalThis);

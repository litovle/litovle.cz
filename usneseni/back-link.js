(() => {
  const link = document.getElementById("back-link");
  if (!link) return;

  const back = new URLSearchParams(location.search).get("back");
  if (!back) return;
  const prefixes = (document.currentScript.dataset.backPrefixes || "/usneseni").split(" ");

  try {
    const url = new URL(back, location.origin);
    if (url.origin !== location.origin || !prefixes.some(prefix =>
      url.pathname === prefix || url.pathname.startsWith(prefix + "/")
    )) return;

    link.href = url.pathname + url.search;
    link.textContent = "← Zpět na vyhledávání";
  } catch {
    // Keep the generated fallback link when the return URL is malformed.
  }
})();

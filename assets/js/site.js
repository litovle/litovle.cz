(() => {
    const button = document.getElementById("site-back-to-top");
    if (!button || document.getElementById("usn-back-to-top")) return;

    const syncVisibility = () => {
        button.classList.toggle("is-visible", window.innerWidth <= 700 && window.scrollY > 700);
    };

    button.addEventListener("click", () => {
        const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        window.scrollTo({ top: 0, behavior: reducedMotion ? "auto" : "smooth" });
    });

    window.addEventListener("scroll", syncVisibility, { passive: true });
    window.addEventListener("resize", syncVisibility);
    syncVisibility();
})();

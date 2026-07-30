// Shared behavior across every page: service worker registration + nav highlighting.

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}

(function highlightActiveNav() {
  // Normalize away ".html" so this works whether the host serves clean URLs
  // (e.g. "/standings") or keeps the extension (e.g. GitHub Pages "/standings.html").
  const seg = location.pathname.split("/").pop() || "index.html";
  const here = seg.replace(/\.html$/, "") || "index";
  document.querySelectorAll(".nav-item").forEach((el) => {
    const target = el.getAttribute("data-page").replace(/\.html$/, "");
    if (target === here) el.classList.add("active");
  });
})();

function titleCase(s) {
  return s.charAt(0) + s.slice(1).toLowerCase();
}

/**
 * Players in the league, paired by couple where applicable.
 * This mirrors the workbook's Standings/Picks tabs. Update here once the
 * Google Sheet is wired up as the live source (see ROADMAP.md).
 */
const LEAGUE_PLAYERS = [
  { name: "ALEX", couple: "Alex & Calli" },
  { name: "CALLI", couple: "Alex & Calli" },
  { name: "DREW", couple: "Drew & Michaela" },
  { name: "MICHAELA", couple: "Drew & Michaela" },
  { name: "SEAN", couple: "Sean & Carlie" },
  { name: "CARLIE", couple: "Sean & Carlie" },
  { name: "JACOB", couple: "Jacob & Emma" },
  { name: "EMMA", couple: "Jacob & Emma" },
  { name: "NICK", couple: "Nick & Emily" },
  { name: "EMILY", couple: "Nick & Emily" },
  { name: "LOUIE", couple: "Louie & Josie" },
  { name: "JOSIE", couple: "Louie & Josie" },
  { name: "CONNOR", couple: "Connor & Jack" },
  { name: "JACK", couple: "Connor & Jack" },
  { name: "PHIL", couple: null },
];

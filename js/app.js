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
 * real backend replaces this static list (see BACKLOG.md).
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

/**
 * Generated avatars — initials on a deterministic color, no photo dependency.
 * Real photos can replace these later without touching any callers, since
 * everything renders through avatarHtml().
 */
const AVATAR_COLORS = [
  "#4A90D9", "#E0736B", "#5FB88A", "#D9A544", "#9B7FD4",
  "#4AB8C4", "#D96BA0", "#7FA847", "#C97B4A", "#6C7FD4",
];

function avatarColor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function avatarInitials(name) {
  return name.slice(0, 2).toUpperCase();
}

/** size in px. wrapInLink: if given a href, wraps the avatar in an <a> (for
 * contexts where the name text isn't already a link). */
function avatarHtml(name, size = 32) {
  const fontSize = Math.round(size * 0.4);
  return `<span class="avatar" style="width:${size}px;height:${size}px;font-size:${fontSize}px;background:${avatarColor(name)}">${avatarInitials(name)}</span>`;
}

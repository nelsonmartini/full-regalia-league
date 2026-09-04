// Shared behavior across every page: service worker registration + nav highlighting.

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}

/** "Add to Home Screen" banner — most people never think to do this on
 * their own, and the offline/no-browser-chrome benefits only kick in once
 * it's actually installed. Runs on every page (app.js is shared), inserted
 * right after the topbar so it reads as part of the normal page flow, not
 * a floating overlay — it also sits behind the passphrase gate's full-
 * screen overlay (higher z-index) until unlocked, so it never shows before
 * that.
 *
 * Two things this has to get right or it'd be a nagging annoyance:
 *  1. Never show it to someone already running the installed app —
 *     `display-mode: standalone` (Android/Chrome) / `navigator.standalone`
 *     (iOS) both mean "this IS the home-screen app right now." Can't detect
 *     "installed but currently viewing in a regular tab" (no such API,
 *     intentionally, for privacy) — the dismissal flag below covers that
 *     gap once they've seen the banner once.
 *  2. Remember "Got it" / "Install" per device via localStorage so it only
 *     ever shows once, not on every visit.
 * iOS Safari can't trigger a real install prompt via code at all (no
 * `beforeinstallprompt` event there) — the only way onto an iPhone home
 * screen is Share → Add to Home Screen, so iOS gets instructions instead
 * of a button. */
(function initInstallPrompt() {
  const DISMISS_KEY = "fr_install_dismissed";
  if (localStorage.getItem(DISMISS_KEY)) return;

  const isStandalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  if (isStandalone) {
    localStorage.setItem(DISMISS_KEY, "1");
    return;
  }

  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  let deferredPrompt = null;

  function showBanner() {
    const topbar = document.querySelector(".topbar");
    if (!topbar || document.querySelector(".install-banner")) return;
    const banner = document.createElement("div");
    banner.className = "install-banner";
    banner.innerHTML = isIOS
      ? `<span class="install-banner-text">📲 Add Full Regalia to your Home Screen — tap <strong>Share</strong>, then <strong>Add to Home Screen</strong>.</span>
         <button class="install-banner-dismiss">Got it</button>`
      : `<span class="install-banner-text">📲 Install Full Regalia for quicker, full-screen access</span>
         <button class="install-banner-install">Install</button>
         <button class="install-banner-dismiss">✕</button>`;
    topbar.insertAdjacentElement("afterend", banner);

    banner.querySelector(".install-banner-dismiss").addEventListener("click", () => {
      localStorage.setItem(DISMISS_KEY, "1");
      banner.remove();
    });

    const installBtn = banner.querySelector(".install-banner-install");
    if (installBtn) {
      installBtn.addEventListener("click", async () => {
        banner.remove();
        localStorage.setItem(DISMISS_KEY, "1");
        if (deferredPrompt) {
          deferredPrompt.prompt();
          await deferredPrompt.userChoice;
          deferredPrompt = null;
        }
      });
    }
  }

  if (isIOS) {
    // No beforeinstallprompt on iOS — just show the instructions banner.
    // Small delay so it doesn't visually compete with the passphrase gate
    // unlocking on first load.
    setTimeout(showBanner, 1200);
  } else {
    // Chrome/Android fire this only when the browser's own install
    // criteria are met — capture it instead of the browser's default mini-
    // infobar so our banner (and its dismissal memory) is the one source
    // of truth.
    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      deferredPrompt = e;
      showBanner();
    });
  }
})();

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
 * Players in the league, paired by couple where applicable. Loaded from the
 * Supabase `players` table by loadPlayers() (js/players.js) — empty until
 * that resolves, so any page that needs the roster must await it first. Kept
 * as a top-level `let` (not const) because loadPlayers() reassigns it.
 */
let LEAGUE_PLAYERS = [];

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

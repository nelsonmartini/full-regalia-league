/**
 * Admin gate + roster management. Reuses sha256Hex() from js/gate.js (loaded
 * first on admin.html) — same courtesy-speed-bump model, NOT real security:
 * anyone reading this file's source can find the hash. The real trust
 * boundary is Supabase RLS on the `players` table, which (like `picks`) is
 * open to the anon key — see BACKLOG.md.
 *
 * To change the admin passphrase: pick a new phrase, then in a browser
 * console run
 *   crypto.subtle.digest("SHA-256", new TextEncoder().encode("yourphrase"))
 *     .then(b => console.log(Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2,"0")).join("")))
 * and paste the result below.
 */
const ADMIN_PASSPHRASE_HASH = "f84f4b915417aa67b8272d6418d386fcf945ef84ca2819aa04803c5fd77f16b5"; // "commish"

function waitForSiteGate() {
  return new Promise((resolve) => {
    const overlay = document.getElementById("fr-gate-overlay");
    if (!overlay || getComputedStyle(overlay).display === "none") {
      resolve();
      return;
    }
    const observer = new MutationObserver(() => {
      if (getComputedStyle(overlay).display === "none") {
        observer.disconnect();
        resolve();
      }
    });
    observer.observe(overlay, { attributes: true, attributeFilter: ["style"] });
  });
}

async function unlockAdmin() {
  const adminOverlay = document.getElementById("admin-gate-overlay");
  const input = document.getElementById("admin-gate-input");
  const submit = document.getElementById("admin-gate-submit");
  const errorEl = document.getElementById("admin-gate-error");

  adminOverlay.style.display = "flex";
  input.focus();

  return new Promise((resolve) => {
    async function tryUnlock() {
      const value = input.value.trim().toLowerCase();
      if (!value) return;
      const hash = await sha256Hex(value);
      if (hash === ADMIN_PASSPHRASE_HASH) {
        adminOverlay.style.display = "none";
        resolve();
      } else {
        errorEl.textContent = "Wrong admin passphrase — try again.";
        input.value = "";
        input.focus();
      }
    }
    submit.addEventListener("click", tryUnlock);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") tryUnlock();
    });
  });
}

function renderRoster() {
  const list = document.getElementById("roster-list");
  const count = document.getElementById("roster-count");
  count.textContent = `${LEAGUE_PLAYERS.length} player${LEAGUE_PLAYERS.length === 1 ? "" : "s"}`;
  list.innerHTML = LEAGUE_PLAYERS.length
    ? LEAGUE_PLAYERS.map(
        (p) => `
      <div class="standings-row" style="grid-template-columns:32px 1fr auto;cursor:default">
        ${avatarHtml(p.name, 28)}
        <div class="standings-name">${titleCase(p.name)}${p.couple ? `<span class="couple">${p.couple}</span>` : ""}</div>
        <button class="btn btn-ghost" data-delete="${p.name}" style="padding:6px 12px;font-size:12.5px">Remove</button>
      </div>`
      ).join("")
    : '<div class="empty-state">No players on the roster yet.</div>';

  list.querySelectorAll("[data-delete]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const name = btn.getAttribute("data-delete");
      if (!confirm(`Remove ${titleCase(name)} from the roster? Their past picks stay in the database, but they'll drop off Standings/History and the Picks page.`)) return;
      btn.disabled = true;
      btn.textContent = "Removing…";
      const { error } = await deletePlayer(name);
      if (error) {
        alert(error);
        btn.disabled = false;
        btn.textContent = "Remove";
        return;
      }
      await loadPlayers();
      renderRoster();
    });
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  await waitForSiteGate();
  await unlockAdmin();

  document.getElementById("admin-content").style.display = "block";
  await loadPlayers();
  renderRoster();

  const nameInput = document.getElementById("add-name");
  const coupleInput = document.getElementById("add-couple");
  const addBtn = document.getElementById("add-btn");
  const addStatus = document.getElementById("add-status");

  addBtn.addEventListener("click", async () => {
    addBtn.disabled = true;
    addStatus.textContent = "Adding…";
    const { error } = await addPlayer(nameInput.value, coupleInput.value);
    addBtn.disabled = false;
    if (error) {
      addStatus.textContent = error;
      return;
    }
    nameInput.value = "";
    coupleInput.value = "";
    addStatus.textContent = "Added.";
    await loadPlayers();
    renderRoster();
  });

  const scoreHit = document.getElementById("score-hit");
  const scorePush = document.getElementById("score-push");
  const scoreMiss = document.getElementById("score-miss");
  const scoreSaveBtn = document.getElementById("score-save-btn");
  const scoreStatus = document.getElementById("score-status");

  await loadScoringConfig();
  scoreHit.value = SCORING.hit;
  scorePush.value = SCORING.push;
  scoreMiss.value = SCORING.miss;

  scoreSaveBtn.addEventListener("click", async () => {
    const hit = Number(scoreHit.value);
    const push = Number(scorePush.value);
    const miss = Number(scoreMiss.value);
    if ([hit, push, miss].some((n) => Number.isNaN(n) || n < 0)) {
      scoreStatus.textContent = "Points must be numbers, 0 or greater.";
      return;
    }
    scoreSaveBtn.disabled = true;
    scoreStatus.textContent = "Saving…";
    const { error } = await saveScoringConfig(hit, push, miss);
    scoreSaveBtn.disabled = false;
    scoreStatus.textContent = error || "Saved — applies to every page immediately.";
  });
});

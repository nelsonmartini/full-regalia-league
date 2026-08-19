/**
 * Passphrase gate — a courtesy speed bump for sharing a beta preview link,
 * NOT real security. It's client-side JS with no server: anyone who opens
 * dev tools can read this file, find the hash, and either brute-force a
 * short/common phrase or just read the page's HTML directly without ever
 * unlocking it. It only stops casual link-forwarding and accidental
 * stumbling-upon, which is all it's meant to do. Don't put anything here
 * (or on this whole site) that actually needs to stay private.
 *
 * To change the passphrase: pick a new phrase, then in a browser console run
 *   crypto.subtle.digest("SHA-256", new TextEncoder().encode("yourphrase"))
 *     .then(b => console.log(Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2,"0")).join("")))
 * and paste the result below.
 */
const GATE_PASSPHRASE_HASH = "748d8735530048af931c59b9a6566dfc6d39276fa049c6050f1e75d324aad8da"; // "reg"
const GATE_KEY = "fr_gate_unlocked";

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

document.addEventListener("DOMContentLoaded", () => {
  const overlay = document.getElementById("fr-gate-overlay");
  if (!overlay) return;

  if (localStorage.getItem(GATE_KEY) === "1") {
    overlay.style.display = "none";
    return;
  }

  const input = document.getElementById("fr-gate-input");
  const submit = document.getElementById("fr-gate-submit");
  const errorEl = document.getElementById("fr-gate-error");

  async function tryUnlock() {
    const value = input.value.trim().toLowerCase();
    if (!value) return;
    const hash = await sha256Hex(value);
    if (hash === GATE_PASSPHRASE_HASH) {
      localStorage.setItem(GATE_KEY, "1");
      overlay.style.display = "none";
    } else {
      errorEl.textContent = "Wrong passphrase — try again.";
      input.value = "";
      input.focus();
    }
  }

  submit.addEventListener("click", tryUnlock);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") tryUnlock();
  });
  input.focus();
});

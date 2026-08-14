/**
 * League roster — now a real Supabase table (`players`) instead of the
 * hardcoded LEAGUE_PLAYERS array in js/app.js, so adding/removing someone
 * doesn't need a code change + redeploy. Same honor-system trust model as
 * `picks`: the anon key can read/insert/delete, and the real guardrail is the
 * admin passphrase gate on admin.html (see js/admin.js) — a UI speed bump,
 * not real auth (matching js/gate.js's own documented limitation).
 *
 * Schema (run once in Supabase SQL Editor — see BACKLOG.md for the exact SQL):
 *   players (name text primary key, couple text, sort_order integer, created_at)
 *
 * LEAGUE_PLAYERS itself (declared in js/app.js as `let`) is populated by
 * loadPlayers() and every page that needs the roster must await it first —
 * it's empty until then.
 */

async function loadPlayers() {
  const { data, error } = await sb.from("players").select("name, couple, sort_order").order("sort_order").order("name");
  if (error) {
    console.error("loadPlayers failed:", error);
    return LEAGUE_PLAYERS; // keep whatever was already loaded (e.g. a prior successful call) rather than wiping the roster on a transient error
  }
  LEAGUE_PLAYERS = data.map((p) => ({ name: p.name, couple: p.couple }));
  return LEAGUE_PLAYERS;
}

async function addPlayer(name, couple) {
  const cleanName = name.trim().toUpperCase();
  if (!cleanName) return { error: "Name can't be empty." };
  const { data: existing } = await sb.from("players").select("name").eq("name", cleanName).maybeSingle();
  if (existing) return { error: `${cleanName} is already on the roster.` };
  const { data: maxRow } = await sb.from("players").select("sort_order").order("sort_order", { ascending: false }).limit(1).maybeSingle();
  const nextOrder = (maxRow?.sort_order ?? 0) + 1;
  const { error } = await sb.from("players").insert({ name: cleanName, couple: couple?.trim() || null, sort_order: nextOrder });
  if (error) return { error: "Couldn't add player — try again." };
  return { error: null };
}

async function deletePlayer(name) {
  const { error } = await sb.from("players").delete().eq("name", name);
  if (error) return { error: "Couldn't delete player — try again." };
  return { error: null };
}

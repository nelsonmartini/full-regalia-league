/**
 * Shared Supabase client. Loaded after the Supabase CDN script and before any
 * page script that touches picks data (picks.js, and later standings.js).
 *
 * The anon key below is meant to be public — it's not a secret, it's what
 * every browser uses to talk to the API. The actual security boundary is the
 * Row Level Security policies on the `picks` table (see BACKLOG.md): anyone
 * can read, anyone can insert/update picks for games that haven't kicked off
 * yet, and nobody (not even this key) can touch a pick once kickoff passes.
 */
const SUPABASE_URL = "https://wiubzguvdiudlijrgozo.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndpdWJ6Z3V2ZGl1ZGxpanJnb3pvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYzMjYyNjcsImV4cCI6MjEwMTkwMjI2N30.tjY0BP6-PqNgkvoQOHuKnCvMPWy56lYq3eCAA36Yctw";

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

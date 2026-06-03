import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

let supabase = null;
let currentSession = null;

function getConfig() {
  return window.RETENTIOOO_CONFIG || null;
}

export function normalizeSupabaseUrl(url) {
  if (!url || typeof url !== "string") return url;
  return url.replace(/\/rest\/v1\/?$/i, "").replace(/\/+$/, "");
}

export function isAuthConfigured() {
  const c = getConfig();
  if (!c || !c.supabaseUrl || !c.supabaseAnonKey || c.supabaseUrl.includes("YOUR_PROJECT")) {
    return false;
  }
  if (/\/rest\/v1/i.test(c.supabaseUrl)) {
    console.error(
      "[retentiOoo] config.js supabaseUrl must be the project URL (https://xxx.supabase.co), not /rest/v1/"
    );
    return false;
  }
  return true;
}

export function getSupabase() {
  return supabase;
}

export function getSession() {
  return currentSession;
}

export function getUserId() {
  return currentSession?.user?.id ?? null;
}

export function isAuthenticated() {
  return !!currentSession?.user;
}

function redirectUrl() {
  return window.location.origin + window.location.pathname;
}

export async function initAuth() {
  if (!isAuthConfigured()) {
    console.warn("[retentiOoo] Missing config.js — copy config.example.js and add Supabase keys.");
    return { configured: false, session: null };
  }

  const { supabaseAnonKey } = getConfig();
  const supabaseUrl = normalizeSupabaseUrl(getConfig().supabaseUrl);
  supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

  const { data, error } = await supabase.auth.getSession();
  if (error) console.error("[retentiOoo] getSession:", error.message);
  currentSession = data.session;

  supabase.auth.onAuthStateChange((_event, session) => {
    currentSession = session;
  });

  return { configured: true, session: currentSession };
}

export async function signInWithGoogle() {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: redirectUrl() },
  });
  if (error) throw error;
}

export async function signOut() {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
  currentSession = null;
}

/** Fields stored in profiles.progress (game state) */
export function profileToProgressBlob(profile) {
  return {
    currentQuest: profile.currentQuest,
    currentLevel: profile.currentLevel,
    unlockedLevels: profile.unlockedLevels,
    unlockedQuests: profile.unlockedQuests,
    stars: profile.stars,
    bestStats: profile.bestStats,
    totalFlips: profile.totalFlips,
    totalSeconds: profile.totalSeconds,
    gateCompleted: profile.gateCompleted,
    matchboxTutorialDone: profile.matchboxTutorialDone,
    lastGame: profile.lastGame,
    chatStreak: profile.chatStreak,
    lastChatDate: profile.lastChatDate,
    bestScores: profile.bestScores,
  };
}

export function applyProgressBlob(profile, blob) {
  if (!blob || typeof blob !== "object") return;
  const keys = [
    "currentQuest", "currentLevel", "unlockedLevels", "unlockedQuests",
    "stars", "bestStats", "totalFlips", "totalSeconds", "gateCompleted",
    "matchboxTutorialDone", "lastGame", "chatStreak", "lastChatDate", "bestScores",
  ];
  keys.forEach((k) => {
    if (blob[k] !== undefined) profile[k] = blob[k];
  });
}

export async function fetchServerProfile() {
  if (!supabase || !isAuthenticated()) return null;
  const id = getUserId();
  const { data, error } = await supabase
    .from("profiles")
    .select("display_name, avatar, progress, platform_streak, last_streak_date")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[retentiOoo] fetch profile:", error.message);
    return null;
  }
  return data;
}

export async function upsertServerProfile(profile) {
  if (!supabase || !isAuthenticated()) return { ok: false, skipped: true };
  const id = getUserId();
  const row = {
    id,
    display_name: profile.nickname || null,
    avatar: profile.avatar || "unicorn",
    progress: profileToProgressBlob(profile),
    platform_streak: profile.platformStreak ?? 1,
    last_streak_date: profile.lastStreakDate || null,
  };

  const { error } = await supabase.from("profiles").upsert(row, { onConflict: "id" });
  if (error) {
    console.error("[retentiOoo] save profile:", error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/** Step 1 check: profiles table exists and is reachable */
export async function checkProfilesReady() {
  if (!supabase || !isAuthenticated()) {
    return { ok: false, reason: "auth" };
  }
  const { error } = await supabase.from("profiles").select("id").limit(1);
  if (error) {
    if (error.code === "42P01" || error.message?.includes("does not exist")) {
      return { ok: false, reason: "schema" };
    }
    return { ok: false, reason: "error", message: error.message };
  }
  return { ok: true };
}

export async function ensureProfileRow() {
  if (!supabase || !isAuthenticated()) return;
  const existing = await fetchServerProfile();
  if (existing) return;

  const user = currentSession.user;
  const meta = user.user_metadata || {};
  const name =
    meta.full_name || meta.name || user.email?.split("@")[0] || "Player";

  await supabase.from("profiles").upsert({
    id: user.id,
    display_name: name,
    avatar: "unicorn",
    progress: {},
  });
}

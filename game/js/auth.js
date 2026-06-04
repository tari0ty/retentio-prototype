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

export function getUserEmail() {
  return currentSession?.user?.email ?? "";
}

export function isAuthenticated() {
  return !!currentSession?.user;
}

function redirectUrl() {
  return window.location.href;
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

export async function signInWithGoogle(redirectTo = redirectUrl()) {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo },
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
    bio: profile.bio || "",
  };
}

export function applyProgressBlob(profile, blob) {
  if (!blob || typeof blob !== "object") return;
  const keys = [
    "currentQuest", "currentLevel", "unlockedLevels", "unlockedQuests",
    "stars", "bestStats", "totalFlips", "totalSeconds", "gateCompleted",
    "matchboxTutorialDone", "lastGame", "chatStreak", "lastChatDate", "bestScores",
    "bio",
  ];
  keys.forEach((k) => {
    if (blob[k] !== undefined) profile[k] = blob[k];
  });
}

export async function fetchServerProfile() {
  if (!supabase || !isAuthenticated()) return null;
  const id = getUserId();
  let result = await supabase
    .from("profiles")
    .select("display_name, avatar, profile_pic_url, email, email_visible, profile_public, progress, platform_streak, last_streak_date")
    .eq("id", id)
    .maybeSingle();
  if (result.error?.code === "42703") {
    result = await supabase
      .from("profiles")
      .select("display_name, avatar, progress, platform_streak, last_streak_date")
      .eq("id", id)
      .maybeSingle();
  }
  const { data, error } = result;

  if (error) {
    console.error("[retentiOoo] fetch profile:", error.message);
    return null;
  }
  return data;
}

export async function upsertServerProfile(profile) {
  if (!supabase || !isAuthenticated()) return { ok: false, skipped: true };
  const id = getUserId();
  const user = currentSession.user;
  const row = {
    id,
    display_name: profile.nickname || null,
    avatar: profile.avatar || "unicorn",
    profile_pic_url: profile.profilePicUrl || null,
    email: user.email || null,
    email_visible: !!profile.emailVisible,
    profile_public: profile.profilePublic !== false,
    progress: profileToProgressBlob(profile),
    platform_streak: profile.platformStreak ?? 1,
    last_streak_date: profile.lastStreakDate || null,
  };

  let { error } = await supabase.from("profiles").upsert(row, { onConflict: "id" });
  if (error?.code === "42703") {
    const fallback = {
      id,
      display_name: row.display_name,
      avatar: row.avatar,
      progress: row.progress,
      platform_streak: row.platform_streak,
      last_streak_date: row.last_streak_date,
    };
    ({ error } = await supabase.from("profiles").upsert(fallback, { onConflict: "id" }));
  }
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

  const row = {
    id: user.id,
    display_name: name,
    avatar: "unicorn",
    profile_pic_url: null,
    email: user.email || null,
    email_visible: false,
    profile_public: true,
    progress: {},
  };
  const { error } = await supabase.from("profiles").upsert(row);
  if (error?.code === "42703") {
    await supabase.from("profiles").upsert({
      id: user.id,
      display_name: name,
      avatar: "unicorn",
      progress: {},
    });
  }
}

import { getSupabase, getUserId, isAuthenticated } from "./auth.js";

export async function ensureFriendCode() {
  const sb = getSupabase();
  const uid = getUserId();
  if (!sb || !uid) return null;

  const { data, error } = await sb
    .from("profiles")
    .select("friend_code")
    .eq("id", uid)
    .maybeSingle();
  if (error) throw error;
  if (data?.friend_code) return data.friend_code;

  const code = randomFriendCode();
  const { error: upErr } = await sb
    .from("profiles")
    .update({ friend_code: code })
    .eq("id", uid);
  if (upErr) throw upErr;
  return code;
}

function randomFriendCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 8; i++) {
    s += chars[Math.floor(Math.random() * chars.length)];
  }
  return s;
}

export async function fetchFriendsList() {
  const sb = getSupabase();
  const uid = getUserId();
  if (!sb || !uid) return [];

  const { data: links, error } = await sb
    .from("friendships")
    .select("user_id, friend_id, created_at")
    .or(`user_id.eq.${uid},friend_id.eq.${uid}`);
  if (error) throw error;
  if (!links?.length) return [];

  const friendIds = links.map((l) =>
    l.user_id === uid ? l.friend_id : l.user_id
  );

  const { data: profiles, error: pErr } = await sb
    .from("profiles")
    .select("id, display_name, avatar, friend_code")
    .in("id", friendIds);
  if (pErr) throw pErr;
  return profiles || [];
}

export async function addFriendByCode(code) {
  const sb = getSupabase();
  const uid = getUserId();
  if (!sb || !uid) throw new Error("Sign in to add friends.");

  const normalized = code.trim().toUpperCase();
  if (normalized.length < 4) throw new Error("Enter a valid friend code.");

  const { data: target, error: findErr } = await sb
    .from("profiles")
    .select("id, display_name, friend_code")
    .eq("friend_code", normalized)
    .maybeSingle();
  if (findErr) throw findErr;
  if (!target) throw new Error("No player found with that code.");
  if (target.id === uid) throw new Error("That is your own code.");

  const { data: existingA } = await sb
    .from("friendships")
    .select("id")
    .eq("user_id", uid)
    .eq("friend_id", target.id)
    .maybeSingle();
  const { data: existingB } = await sb
    .from("friendships")
    .select("id")
    .eq("user_id", target.id)
    .eq("friend_id", uid)
    .maybeSingle();
  if (existingA || existingB) {
    throw new Error("Already friends with " + (target.display_name || "this player") + ".");
  }

  const { error: insErr } = await sb.from("friendships").insert({
    user_id: uid,
    friend_id: target.id,
  });
  if (insErr) throw insErr;
  return target;
}

export async function removeFriend(friendUserId) {
  const sb = getSupabase();
  const uid = getUserId();
  if (!sb || !uid) return;

  await sb.from("friendships").delete().eq("user_id", uid).eq("friend_id", friendUserId);
  await sb.from("friendships").delete().eq("user_id", friendUserId).eq("friend_id", uid);
}

export async function checkFriendsReady() {
  if (!isAuthenticated()) return { ok: false, reason: "auth" };
  const sb = getSupabase();
  if (!sb) return { ok: false, reason: "config" };
  const { error } = await sb.from("friendships").select("id").limit(1);
  if (error) {
    if (error.code === "42P01" || error.message?.includes("does not exist")) {
      return { ok: false, reason: "schema" };
    }
    return { ok: false, reason: "error", message: error.message };
  }
  return { ok: true };
}

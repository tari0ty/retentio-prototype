import { getSupabase, getUserId, isAuthenticated } from "./auth.js";

let friendMessagesChannel = null;

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
    .select("user_id, friend_id, created_at, status")
    .or(`user_id.eq.${uid},friend_id.eq.${uid}`)
    .eq("status", "accepted");
  if (error) throw error;
  if (!links?.length) return [];

  const friendIds = links.map((l) =>
    l.user_id === uid ? l.friend_id : l.user_id
  );

  const { data: profiles, error: pErr } = await sb
    .from("profiles")
    .select("id, display_name, avatar, friend_code, profile_pic_url, email, email_visible, profile_public, progress")
    .in("id", friendIds);
  if (pErr) throw pErr;
  return profiles || [];
}

export async function fetchIncomingFriendRequests() {
  const sb = getSupabase();
  const uid = getUserId();
  if (!sb || !uid) return [];

  const { data: requests, error } = await sb
    .from("friendships")
    .select("id, user_id, created_at, status")
    .eq("friend_id", uid)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error) throw error;
  if (!requests?.length) return [];

  const requesterIds = requests.map((r) => r.user_id);
  const { data: profiles, error: pErr } = await sb
    .from("profiles")
    .select("id, display_name, avatar, profile_pic_url")
    .in("id", requesterIds);
  if (pErr) throw pErr;
  const byId = new Map((profiles || []).map((p) => [p.id, p]));
  return requests.map((r) => ({ ...r, profile: byId.get(r.user_id) || {} }));
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
    .select("id, status")
    .eq("user_id", uid)
    .eq("friend_id", target.id)
    .maybeSingle();
  const { data: existingB } = await sb
    .from("friendships")
    .select("id, status")
    .eq("user_id", target.id)
    .eq("friend_id", uid)
    .maybeSingle();
  if (existingA || existingB) {
    const existing = existingA || existingB;
    throw new Error(
      existing.status === "pending"
        ? "Friend request is already pending."
        : "Already friends with " + (target.display_name || "this player") + "."
    );
  }

  const { error: insErr } = await sb.from("friendships").insert({
    user_id: uid,
    friend_id: target.id,
    status: "pending",
  });
  if (insErr) throw insErr;
  return target;
}

export async function acceptFriendRequest(requestId) {
  const sb = getSupabase();
  const uid = getUserId();
  if (!sb || !uid || !requestId) return;
  const { error } = await sb
    .from("friendships")
    .update({ status: "accepted", accepted_at: new Date().toISOString() })
    .eq("id", requestId)
    .eq("friend_id", uid);
  if (error) throw error;
}

export async function rejectFriendRequest(requestId) {
  const sb = getSupabase();
  const uid = getUserId();
  if (!sb || !uid || !requestId) return;
  const { error } = await sb
    .from("friendships")
    .delete()
    .eq("id", requestId)
    .eq("friend_id", uid);
  if (error) throw error;
}

export async function removeFriend(friendUserId) {
  const sb = getSupabase();
  const uid = getUserId();
  if (!sb || !uid) return;

  await sb.from("friendships").delete().eq("user_id", uid).eq("friend_id", friendUserId);
  await sb.from("friendships").delete().eq("user_id", friendUserId).eq("friend_id", uid);
}

export async function fetchFriendMessages(friendUserId, limit = 80) {
  const sb = getSupabase();
  const uid = getUserId();
  if (!sb || !uid || !friendUserId) return [];

  const { data, error } = await sb
    .from("friend_messages")
    .select("*")
    .or(
      `and(sender_id.eq.${uid},recipient_id.eq.${friendUserId}),and(sender_id.eq.${friendUserId},recipient_id.eq.${uid})`
    )
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

export async function sendFriendMessage(friendUserId, displayName, body) {
  const sb = getSupabase();
  const uid = getUserId();
  if (!sb || !uid || !friendUserId) return;

  const text = body.trim().slice(0, 280);
  if (!text) return;

  const { data, error } = await sb
    .from("friend_messages")
    .insert({
      sender_id: uid,
      recipient_id: friendUserId,
      display_name: displayName || "Player",
      body: text,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export function subscribeToFriendMessages(friendUserId, handler) {
  const sb = getSupabase();
  const uid = getUserId();
  if (!sb || !uid || !friendUserId) return;

  unsubscribeFromFriendMessages();
  friendMessagesChannel = sb
    .channel(`friend_messages:${uid}:${friendUserId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "friend_messages" },
      (payload) => {
        const msg = payload.new;
        const isCurrentThread =
          (msg.sender_id === uid && msg.recipient_id === friendUserId) ||
          (msg.sender_id === friendUserId && msg.recipient_id === uid);
        if (isCurrentThread) handler?.(msg);
      }
    )
    .subscribe();
}

export function unsubscribeFromFriendMessages() {
  const sb = getSupabase();
  if (sb && friendMessagesChannel) sb.removeChannel(friendMessagesChannel);
  friendMessagesChannel = null;
}

export async function addFriendById(friendUserId) {
  const sb = getSupabase();
  const uid = getUserId();
  if (!sb || !uid) throw new Error("Sign in to add friends.");

  const { data: existingA } = await sb
    .from("friendships")
    .select("id, status")
    .eq("user_id", uid)
    .eq("friend_id", friendUserId)
    .maybeSingle();
  const { data: existingB } = await sb
    .from("friendships")
    .select("id, status")
    .eq("user_id", friendUserId)
    .eq("friend_id", uid)
    .maybeSingle();
  if (existingA || existingB) {
    const existing = existingA || existingB;
    throw new Error(
      existing.status === "pending"
        ? "Friend request is already pending."
        : "Already friends."
    );
  }

  const { error: insErr } = await sb.from("friendships").insert({
    user_id: uid,
    friend_id: friendUserId,
    status: "pending",
  });
  if (insErr) throw insErr;
}

export async function checkFriendsReady() {
  if (!isAuthenticated()) return { ok: false, reason: "auth" };
  const sb = getSupabase();
  if (!sb) return { ok: false, reason: "config" };
  const { error } = await sb.from("friendships").select("id").limit(1);
  const { error: msgError } = error
    ? { error: null }
    : await sb.from("friend_messages").select("id").limit(1);
  const readyError = error || msgError;
  if (readyError) {
    if (readyError.code === "42P01" || readyError.message?.includes("does not exist")) {
      return { ok: false, reason: "schema" };
    }
    return { ok: false, reason: "error", message: readyError.message };
  }
  return { ok: true };
}

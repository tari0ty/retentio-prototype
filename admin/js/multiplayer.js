import { getSupabase, getUserId, isAuthenticated } from "./auth.js";

const MAX_ROOM_PLAYERS = 2;
const MIN_PLAYERS_TO_START = 2;

let currentRoomId = null;
let roomChannel = null;
let membersChannel = null;
let chatChannel = null;

export function getCurrentRoomId() {
  return currentRoomId;
}

export async function checkMultiplayerReady() {
  if (!isAuthenticated()) return { ok: false, reason: "auth" };
  const sb = getSupabase();
  if (!sb) return { ok: false, reason: "config" };

  const { error } = await sb.from("rooms").select("id").limit(1);
  if (error) {
    if (error.code === "42P01" || error.message?.includes("does not exist")) {
      return { ok: false, reason: "schema" };
    }
    return { ok: false, reason: "error", message: error.message };
  }
  return { ok: true };
}

export async function leaveCurrentRoom() {
  const sb = getSupabase();
  const uid = getUserId();
  if (!sb || !uid || !currentRoomId) {
    teardownChannels();
    currentRoomId = null;
    return;
  }

  await sb.from("room_members").delete().eq("room_id", currentRoomId).eq("user_id", uid);
  teardownChannels();
  currentRoomId = null;
}

function teardownChannels() {
  const sb = getSupabase();
  if (!sb) return;
  if (roomChannel) sb.removeChannel(roomChannel);
  if (membersChannel) sb.removeChannel(membersChannel);
  if (chatChannel) sb.removeChannel(chatChannel);
  roomChannel = membersChannel = chatChannel = null;
}

export async function joinOrCreateLobby(displayName, avatar, profilePicUrl = "") {
  const sb = getSupabase();
  const uid = getUserId();
  if (!sb || !uid) throw new Error("Sign in required for live Ranked.");

  await leaveCurrentRoom();

  const { data: openRooms, error: findErr } = await sb
    .from("rooms")
    .select("id")
    .eq("status", "lobby")
    .order("created_at", { ascending: true })
    .limit(10);

  if (findErr) throw findErr;

  let roomId = null;
  for (const room of openRooms || []) {
    const { count, error: countErr } = await sb
      .from("room_members")
      .select("*", { count: "exact", head: true })
      .eq("room_id", room.id);
    if (countErr) throw countErr;
    if ((count ?? 0) < MAX_ROOM_PLAYERS) {
      roomId = room.id;
      break;
    }
  }

  if (!roomId) {
    const { data: created, error: createErr } = await sb
      .from("rooms")
      .insert({ status: "lobby" })
      .select("id")
      .single();
    if (createErr) throw createErr;
    roomId = created.id;
  }

  const { error: joinErr } = await sb.from("room_members").upsert(
    {
      room_id: roomId,
      user_id: uid,
      display_name: displayName,
      avatar: avatar || "unicorn",
      profile_pic_url: profilePicUrl || null,
      pairs_matched: 0,
      flips: 0,
      finished: false,
    },
    { onConflict: "room_id,user_id" }
  );
  if (joinErr) throw joinErr;

  currentRoomId = roomId;
  return roomId;
}

export async function fetchRoom() {
  const sb = getSupabase();
  if (!sb || !currentRoomId) return null;
  const { data, error } = await sb.from("rooms").select("*").eq("id", currentRoomId).single();
  if (error) throw error;
  return data;
}

export async function fetchRoomMembers() {
  const sb = getSupabase();
  if (!sb || !currentRoomId) return [];
  const { data, error } = await sb
    .from("room_members")
    .select("*")
    .eq("room_id", currentRoomId)
    .order("joined_at", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function fetchChatMessages(limit = 80) {
  const sb = getSupabase();
  if (!sb || !currentRoomId) return [];
  const { data, error } = await sb
    .from("chat_messages")
    .select("*")
    .eq("room_id", currentRoomId)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

export async function castVote(vote) {
  const sb = getSupabase();
  const uid = getUserId();
  if (!sb || !currentRoomId || !uid) return;

  const room = await fetchRoom();
  const votes = { ...(room?.votes || {}) };

  if (!votes.user_votes) {
    votes.user_votes = {};
  }

  votes.user_votes[uid] = {
    subject: typeof vote === "string" ? vote : vote.subject,
    tiles: typeof vote === "object" ? Number(vote.tiles) : 16,
    timeLimit: typeof vote === "object" ? Number(vote.timeLimit) : 120,
    maxFlips: typeof vote === "object" ? Number(vote.maxFlips) : 40,
  };

  votes.topics = {};
  votes.settings = [];

  for (const userId in votes.user_votes) {
    const userVote = votes.user_votes[userId];
    if (userVote.subject) {
      votes.topics[userVote.subject] = (votes.topics[userVote.subject] || 0) + 1;
    }
    votes.settings.push({
      tiles: userVote.tiles,
      timeLimit: userVote.timeLimit,
      maxFlips: userVote.maxFlips,
    });
  }

  const { error } = await sb.from("rooms").update({ votes }).eq("id", currentRoomId);
  if (error) throw error;
}

export async function sendChatMessage(displayName, body) {
  const sb = getSupabase();
  const uid = getUserId();
  if (!sb || !currentRoomId || !uid) return;

  const text = body.trim().slice(0, 280);
  if (!text) return;

  const { error } = await sb.from("chat_messages").insert({
    room_id: currentRoomId,
    user_id: uid,
    display_name: displayName,
    body: text,
  });
  if (error) throw error;
}

export async function updateMyRoomProgress(pairsMatched, flips) {
  const sb = getSupabase();
  const uid = getUserId();
  if (!sb || !currentRoomId || !uid) return;

  await sb
    .from("room_members")
    .update({ pairs_matched: pairsMatched, flips })
    .eq("room_id", currentRoomId)
    .eq("user_id", uid);
}

export async function finishMyRoomResult(flips, timeSeconds, score, pairsMatched = 8) {
  const sb = getSupabase();
  const uid = getUserId();
  if (!sb || !currentRoomId || !uid) return;

  await sb
    .from("room_members")
    .update({
      flips,
      time_seconds: timeSeconds,
      score,
      finished: true,
      pairs_matched: pairsMatched,
    })
    .eq("room_id", currentRoomId)
    .eq("user_id", uid);

  const members = await fetchRoomMembers();
  const allDone = members.length > 0 && members.every((m) => m.finished);
  if (allDone) {
    await sb.from("rooms").update({ status: "finished" }).eq("id", currentRoomId);
  }
}

export async function tryBeginMatch() {
  const sb = getSupabase();
  if (!sb || !currentRoomId) return null;

  const members = await fetchRoomMembers();
  if (members.length < MIN_PLAYERS_TO_START) return null;

  const { data, error } = await sb.rpc("try_begin_match", { p_room_id: currentRoomId });
  if (error) throw error;
  return data;
}

export function subscribeToRoom(handlers) {
  const sb = getSupabase();
  if (!sb || !currentRoomId) return;

  teardownChannels();

  roomChannel = sb
    .channel(`room:${currentRoomId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "rooms", filter: `id=eq.${currentRoomId}` },
      async () => {
        const room = await fetchRoom();
        if (room) handlers.onRoom?.(room);
      }
    )
    .subscribe();

  membersChannel = sb
    .channel(`members:${currentRoomId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "room_members", filter: `room_id=eq.${currentRoomId}` },
      async () => {
        const members = await fetchRoomMembers();
        handlers.onMembers?.(members);
      }
    )
    .subscribe();

  chatChannel = sb
    .channel(`chat:${currentRoomId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "chat_messages", filter: `room_id=eq.${currentRoomId}` },
      (payload) => {
        handlers.onChat?.(payload.new);
      }
    )
    .subscribe();
}

export { MIN_PLAYERS_TO_START, MAX_ROOM_PLAYERS };

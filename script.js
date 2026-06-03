// ============================================================
//  retentiOoo — script.js
// ============================================================
import {
  initAuth,
  isAuthConfigured,
  isAuthenticated,
  signInWithGoogle,
  signOut,
  ensureProfileRow,
  fetchServerProfile,
  upsertServerProfile,
  applyProgressBlob,
  checkProfilesReady,
  getUserId,
} from "./js/auth.js";
import {
  checkMultiplayerReady,
  joinOrCreateLobby,
  leaveCurrentRoom,
  fetchRoom,
  fetchRoomMembers,
  fetchChatMessages,
  castVote,
  sendChatMessage,
  subscribeToRoom,
  tryBeginMatch,
  updateMyRoomProgress,
  finishMyRoomResult,
  MIN_PLAYERS_TO_START,
} from "./js/multiplayer.js";
import {
  ensureFriendCode,
  fetchFriendsList,
  addFriendByCode,
  removeFriend,
  fetchFriendMessages,
  sendFriendMessage,
  subscribeToFriendMessages,
  unsubscribeFromFriendMessages,
  checkFriendsReady,
} from "./js/friends.js";

document.addEventListener("DOMContentLoaded", function () {

  // ----------------------------------------------------------
  //  DATA
  // ----------------------------------------------------------
  const STORAGE_KEY = "retentiOoo_profile";
  const LEGACY_STORAGE_KEY = "retentiOo_profile";

  const GAMES = [
    { id: "matchbox",       title: "Matchbox",       emoji: "🃏", category: "Memory",    status: "live", featured: true },
    { id: "fraction-pizza", title: "Fraction Pizza", emoji: "🍕", category: "Math",      status: "soon", featured: true },
    { id: "word-hive",      title: "Word Hive",      emoji: "🐝", category: "Reading",   status: "soon", featured: true },
    { id: "logic-locks",    title: "Logic Locks",    emoji: "🔐", category: "Logic",     status: "soon", featured: false },
    { id: "lab-snap",       title: "Lab Snap",       emoji: "🔬", category: "Science",   status: "soon", featured: true },
    { id: "globe-hopper",   title: "Globe Hopper",   emoji: "🌍", category: "Geography", status: "soon", featured: false },
    { id: "rhythm-roots",   title: "Rhythm Roots",   emoji: "🎵", category: "Music",     status: "soon", featured: false },
    { id: "code-critters",  title: "Code Critters",  emoji: "🐛", category: "Coding",    status: "soon", featured: false },
    { id: "paint-guess",    title: "Paint & Guess",  emoji: "🎨", category: "Art",       status: "soon", featured: false },
    { id: "time-trek",      title: "Time Trek",      emoji: "⏳", category: "History",   status: "soon", featured: false },
  ];

  const HUB_CATEGORIES = ["All", "Memory", "Math", "Reading", "Logic", "Science", "Geography", "Music", "Coding", "Art", "History"];

  const QUESTS = [
    { id:1, name:"Quest 1", subject:"Animals",   emoji:"🦁",
      levels:["Mammals","Birds","Reptiles","Insects","Fish","Amphibians","Dinosaurs","Farm Animals","Wild Animals","Sea Creatures"] },
    { id:2, name:"Quest 2", subject:"Space",     emoji:"🚀",
      levels:["Planets","Stars","Galaxies","Black Holes","Moons","Asteroids","Comets","The Sun","Space Exploration","Constellations"] },
    { id:3, name:"Quest 3", subject:"Ocean",     emoji:"🐬",
      levels:["Fish","Coral Reefs","Deep Sea","Sharks","Whales","Turtles","Crabs","Jellyfish","Seahorses","Ocean Plants"] },
    { id:4, name:"Quest 4", subject:"Science",   emoji:"🔬",
      levels:["Plants","Human Body","Weather","Electricity","Magnets","Forces","Light","Sound","Chemistry","Animals"] },
    { id:5, name:"Quest 5", subject:"Geography", emoji:"🌍",
      levels:["Continents","Countries","Oceans","Mountains","Rivers","Deserts","Rainforests","Cities","Flags","Climates"] }
  ];

  const LEVEL_CONFIG = {
    1:{pairs:3,cols:2},2:{pairs:4,cols:2},3:{pairs:5,cols:3},
    4:{pairs:6,cols:3},5:{pairs:7,cols:3},6:{pairs:8,cols:4},
    7:{pairs:9,cols:4},8:{pairs:10,cols:4},9:{pairs:11,cols:4},10:{pairs:12,cols:4}
  };

  const TOPIC_IMAGES = {
    Animals:   [1,2,3,4,5,6,7,8].map(n=>`images/img-${n}.png`),
    Space:     [1,2,3,4,5,6,7,8].map(n=>`images/img-${n}.png`),
    Ocean:     [1,2,3,4,5,6,7,8].map(n=>`images/img-${n}.png`),
    Science:   [1,2,3,4,5,6,7,8].map(n=>`images/img-${n}.png`),
    Geography: [1,2,3,4,5,6,7,8].map(n=>`images/img-${n}.png`),
  };

  const AVATAR_EMOJI = { unicorn:"🦄", dragon:"🐲", robot:"🤖", alien:"👽" };
  const GAME_URL = "retentioo.com";
  let hubFilter = "All";
  let hubSearchQuery = "";
  let quizReturnTo = "hub";

  let rankedLiveMembers = [];
  let rankedBoardSeed = null;
  let rankedCountdownTimer = null;
  let rankedVoteConfirmed = false;
  let liveRankedActive = false;

  // ----------------------------------------------------------
  //  PROFILE
  // ----------------------------------------------------------
  let activeProfile = {
    nickname:"", avatar:"",
    currentQuest:1, currentLevel:1,
    unlockedLevels:{1:1,2:1,3:1,4:1,5:1},
    unlockedQuests:[1],
    stars:{1:{},2:{},3:{},4:{},5:{}},
    bestStats:{},
    totalFlips:0, totalSeconds:0,
    gateCompleted:false,
    isGuest:true,
    matchboxTutorialDone:false,
    lastGame:null,
    platformStreak:1,
    lastStreakDate:null,
    chatStreak:0,
    lastChatDate:null,
    bestScores:{}
  };
  let isLoggedIn = false;
  let cachedFriends = [];
  let activeFriendChat = null;
  let friendChatMessageIds = new Set();

  // ----------------------------------------------------------
  //  ADVENTURE GAME STATE
  // ----------------------------------------------------------
  let cardOne=null,cardTwo=null,disableDeck=false;
  let matchedCount=0,totalPairs=0,flips=0,seconds=0;
  let timerInterval=null;

  // ----------------------------------------------------------
  //  RANKED GAME STATE
  // ----------------------------------------------------------
  let rankedFlips=0, rankedSeconds=120;
  let rankedInterval=null, rankedMatchedCount=0;
  let rankedCardOne=null, rankedCardTwo=null, rankedDisable=false;
  let rankedTopic="Animals", rankedVote="";

  // ----------------------------------------------------------
  //  ELEMENTS
  // ----------------------------------------------------------
  const preloader            = document.getElementById("preloader");
  const loadingBar           = document.querySelector(".loading-bar");
  const accountGateScreen    = document.getElementById("account-gate-screen");
  const gamesHubScreen       = document.getElementById("games-hub-screen");
  const parentDashboardScreen= document.getElementById("parent-dashboard-screen");
  const friendsScreen          = document.getElementById("friends-screen");
  const comingSoonModal      = document.getElementById("coming-soon-modal");
  const rankedLockModal      = document.getElementById("ranked-lock-modal");
  const tutorialScreen       = document.getElementById("tutorial-screen");
  const quizScreen           = document.getElementById("quiz-screen");
  const gameModeScreen       = document.getElementById("game-mode-screen");
  const questSelectScreen    = document.getElementById("quest-select-screen");
  const mapScreen            = document.getElementById("map-screen");
  const gameScreen           = document.getElementById("game-screen");
  const rankedVoteScreen     = document.getElementById("ranked-vote-screen");
  const rankedWaitingScreen  = document.getElementById("ranked-waiting-screen");
  const rankedGameScreen     = document.getElementById("ranked-game-screen");
  const rankedResultsScreen  = document.getElementById("ranked-results-screen");
  const profileScreen        = document.getElementById("profile-screen");
  const leaderboardScreen    = document.getElementById("leaderboard-screen");
  const winModal             = document.getElementById("win-modal");

  function hideAll() {
    [accountGateScreen,gamesHubScreen,parentDashboardScreen,friendsScreen,
     gameModeScreen,questSelectScreen,mapScreen,gameScreen,
     rankedVoteScreen,rankedWaitingScreen,rankedGameScreen,
     rankedResultsScreen,profileScreen,leaderboardScreen].forEach(s=>{
      if(s) s.classList.add("hidden-layer");
    });
    tutorialScreen.classList.add("hidden-layer");
    quizScreen.classList.add("hidden-layer");
    closeFriendChat();
  }

  let cloudSaveToastTimer = null;

  function showCloudSaveToast(state, message) {
    const el = document.getElementById("cloud-save-toast");
    if (!el) return;
    el.classList.remove("hidden-layer", "toast-saving", "toast-saved", "toast-error");
    if (state === "hide") {
      el.classList.add("hidden-layer");
      return;
    }
    el.classList.add(`toast-${state}`);
    el.textContent = message;
    clearTimeout(cloudSaveToastTimer);
    if (state !== "saving") {
      cloudSaveToastTimer = setTimeout(() => showCloudSaveToast("hide"), 2800);
    }
  }

  function saveProfile() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(activeProfile));
    if (!isAuthenticated()) return;

    showCloudSaveToast("saving", "☁️ Saving to cloud…");
    upsertServerProfile(activeProfile).then((result) => {
      if (result?.ok) {
        showCloudSaveToast("saved", "☁️ Progress saved");
      } else if (!result?.skipped) {
        showCloudSaveToast("error", "☁️ Cloud save failed — check Supabase");
      } else {
        showCloudSaveToast("hide");
      }
    });
  }

  async function refreshSchemaBanner() {
    const banner = document.getElementById("hub-schema-banner");
    if (!banner) return;
    if (!isAuthenticated()) {
      banner.classList.add("hidden-layer");
      return;
    }
    const [profiles, multiplayer, friends] = await Promise.all([
      checkProfilesReady(),
      checkMultiplayerReady(),
      checkFriendsReady(),
    ]);
    const missing = [];
    if (!profiles.ok && profiles.reason === "schema") missing.push("profiles (schema.sql)");
    if (!multiplayer.ok && multiplayer.reason === "schema") {
      missing.push("live Ranked (schema-multiplayer.sql)");
    }
    if (!friends.ok && friends.reason === "schema") {
      missing.push("friends (schema-friends.sql)");
    }
    if (missing.length) {
      banner.classList.remove("hidden-layer");
      banner.innerHTML = `⚠️ Run in Supabase SQL: <strong>${missing.join("</strong> and <strong>")}</strong>`;
    } else {
      banner.classList.add("hidden-layer");
    }
  }

  function syncAuthFlags() {
    const authed = isAuthenticated();
    isLoggedIn = authed;
    if (authed) {
      activeProfile.isLoggedIn = true;
      activeProfile.isGuest = false;
    }
  }

  async function mergeServerProfileIntoLocal() {
    await ensureProfileRow();
    const row = await fetchServerProfile();
    if (!row) return;

    if (row.display_name && !activeProfile.nickname) {
      activeProfile.nickname = row.display_name;
    }
    if (row.avatar) activeProfile.avatar = row.avatar;
    if (row.platform_streak != null) {
      activeProfile.platformStreak = row.platform_streak;
    }
    if (row.last_streak_date) {
      activeProfile.lastStreakDate = row.last_streak_date;
    }
    applyProgressBlob(activeProfile, row.progress);

    if (!activeProfile.stars) activeProfile.stars = {1:{},2:{},3:{},4:{},5:{}};
    if (!activeProfile.unlockedQuests) activeProfile.unlockedQuests = [1];
    if (!activeProfile.unlockedLevels) activeProfile.unlockedLevels = {1:1,2:1,3:1,4:1,5:1};
    if (!activeProfile.bestStats) activeProfile.bestStats = {};
    if (!activeProfile.bestScores) activeProfile.bestScores = {};

    saveProfile();
  }

  async function mergeGuestProgressToCloud() {
    const guestRaw = localStorage.getItem(STORAGE_KEY);
    if (!guestRaw || !isAuthenticated()) return;
    try {
      const guest = JSON.parse(guestRaw);
      const guestHasPlay = Object.values(guest.stars || {}).some(
        (q) => Object.keys(q).length > 0
      );
      const localHasPlay = Object.values(activeProfile.stars || {}).some(
        (q) => Object.keys(q).length > 0
      );
      if (guestHasPlay && !localHasPlay) {
        applyProgressBlob(activeProfile, profileToProgressFromGuest(guest));
        saveProfile();
      }
    } catch (_) { /* ignore */ }
  }

  function profileToProgressFromGuest(guest) {
    return {
      currentQuest: guest.currentQuest,
      currentLevel: guest.currentLevel,
      unlockedLevels: guest.unlockedLevels,
      unlockedQuests: guest.unlockedQuests,
      stars: guest.stars,
      bestStats: guest.bestStats,
      totalFlips: guest.totalFlips,
      totalSeconds: guest.totalSeconds,
      matchboxTutorialDone: guest.matchboxTutorialDone,
      lastGame: guest.lastGame,
      chatStreak: guest.chatStreak,
      lastChatDate: guest.lastChatDate,
      bestScores: guest.bestScores,
    };
  }

  function updateHubAuthUI() {
    const googleBtn = document.getElementById("gate-google-btn");
    const warn = document.getElementById("gate-config-warning");

    if (googleBtn) {
      googleBtn.disabled = !isAuthConfigured();
    }
    if (warn) {
      warn.classList.toggle("hidden-layer", isAuthConfigured());
    }
  }

  function updateAppNavbar(show = true) {
    const nav = document.getElementById("app-navbar");
    if (!nav) return;
    nav.classList.toggle("hidden-layer", !show);
  }

  function needsOnboardingQuiz() {
    return !activeProfile.nickname || !activeProfile.avatar;
  }

  function showOnboardingQuiz(returnTo) {
    quizReturnTo = returnTo || "hub";
    hideAll();
    quizScreen.classList.remove("hidden-layer");
  }

  async function routeAfterBoot() {
    syncAuthFlags();
    updateHubAuthUI();
    loadProfile();

    if (isAuthenticated()) {
      activeProfile.gateCompleted = true;
      activeProfile.isGuest = false;
      await mergeServerProfileIntoLocal();
      await mergeGuestProgressToCloud();
      syncAuthFlags();

      if (needsOnboardingQuiz()) {
        showOnboardingQuiz("hub");
        return;
      }
      launchHub();
      refreshSchemaBanner();
      return;
    }

    if (loadProfile() && activeProfile.gateCompleted) {
      if (needsOnboardingQuiz() && !activeProfile.isGuest) {
        showOnboardingQuiz("hub");
        return;
      }
      launchHub();
      return;
    }

    launchAccountGate();
  }

  function loadProfile() {
    let raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) raw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return false;
    const p = JSON.parse(raw);
    activeProfile = Object.assign({}, activeProfile, p);
    if (!activeProfile.stars) activeProfile.stars = {1:{},2:{},3:{},4:{},5:{}};
    if (!activeProfile.unlockedQuests) activeProfile.unlockedQuests = [1];
    if (!activeProfile.unlockedLevels) activeProfile.unlockedLevels = {1:1,2:1,3:1,4:1,5:1};
    if (!activeProfile.bestStats) activeProfile.bestStats = {};
    if (!activeProfile.bestScores) activeProfile.bestScores = {};
    if (!isAuthenticated()) {
      isLoggedIn = !!activeProfile.isLoggedIn && !activeProfile.isGuest;
    }
    if (activeProfile.nickname) {
      activeProfile.gateCompleted = true;
      if (!activeProfile.matchboxTutorialDone) {
        const hasProgress = Object.values(activeProfile.stars || {}).some(
          q => Object.keys(q).length > 0
        );
        if (hasProgress) activeProfile.matchboxTutorialDone = true;
      }
    }
    return true;
  }

  function getMatchboxProgressLabel() {
    let totalStars = 0;
    let levelsPlayed = 0;
    Object.keys(activeProfile.stars || {}).forEach(qid => {
      const questStars = activeProfile.stars[qid] || {};
      Object.keys(questStars).forEach(() => { levelsPlayed++; });
      totalStars += Object.values(questStars).reduce((a, b) => a + b, 0);
    });
    if (levelsPlayed === 0) return "New";
    return `⭐ ${totalStars}`;
  }

  function updatePlatformStreak() {
    const today = new Date().toDateString();
    if (activeProfile.lastStreakDate === today) return;
    if (!activeProfile.lastStreakDate) {
      activeProfile.platformStreak = 1;
    } else {
      const last = new Date(activeProfile.lastStreakDate);
      const now = new Date(today);
      const diffDays = Math.round((now - last) / 86400000);
      activeProfile.platformStreak = diffDays === 1
        ? (activeProfile.platformStreak || 1) + 1
        : 1;
    }
    activeProfile.lastStreakDate = today;
    saveProfile();
  }

  function updateChatStreakUI() {
    const el = document.getElementById("chat-streak-count");
    if (el) el.textContent = activeProfile.chatStreak || 0;
  }

  function recordChatActivity() {
    const today = new Date().toDateString();
    if (activeProfile.lastChatDate === today) return;
    if (!activeProfile.lastChatDate) {
      activeProfile.chatStreak = 1;
    } else {
      const last = new Date(activeProfile.lastChatDate);
      const now = new Date(today);
      const diffDays = Math.round((now - last) / 86400000);
      activeProfile.chatStreak = diffDays === 1
        ? (activeProfile.chatStreak || 0) + 1
        : 1;
    }
    activeProfile.lastChatDate = today;
    saveProfile();
    updateChatStreakUI();
  }

  function updateRankedModeUI() {
    const rankedBtn = document.getElementById("ranked-mode-btn");
    const lockBadge = document.getElementById("ranked-lock-badge");
    if (!rankedBtn) return;
    if (isLoggedIn) {
      rankedBtn.classList.remove("ranked-locked");
      if (lockBadge) lockBadge.classList.add("hidden-layer");
    } else {
      rankedBtn.classList.add("ranked-locked");
      if (lockBadge) lockBadge.classList.remove("hidden-layer");
    }
  }

  function renderHub() {
    refreshHubFriendCounts();

    const featuredEl = document.getElementById("hub-featured-row");
    if (featuredEl) {
      featuredEl.innerHTML = "";
      const lastGame = GAMES.find(g => g.id === activeProfile.lastGame) || GAMES.find(g => g.id === "matchbox");
      if (lastGame) featuredEl.appendChild(buildHubTile(lastGame, true));
    }

    const gridEl = document.getElementById("hub-games-grid");
    if (gridEl) {
      gridEl.innerHTML = "";
      GAMES.forEach(g => gridEl.appendChild(buildHubTile(g, false)));
    }
  }

  async function refreshHubFriendCounts() {
    const el = document.getElementById("hub-online-friends-count");
    if (!el) return;
    if (!isAuthenticated()) {
      el.textContent = "0";
      return;
    }
    try {
      cachedFriends = await fetchFriendsList();
      const friendIds = new Set(cachedFriends.map(f => f.id));
      const online = rankedLiveMembers.filter(m => friendIds.has(m.user_id)).length;
      el.textContent = online;
    } catch (_) {
      el.textContent = "0";
    }
  }

  function buildHubTile(game, isFeatured) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `hub-game-tile ${game.status === "soon" ? "soon-tile" : ""} ${isFeatured ? "featured-tile" : ""}`;
    const progress = game.id === "matchbox" ? getMatchboxProgressLabel() : "Soon";
    btn.innerHTML = `
      <span class="hub-tile-badge ${game.status === "soon" ? "soon-badge" : ""}">${game.status === "live" ? "PLAY" : "SOON"}</span>
      <span class="hub-tile-emoji">${game.emoji}</span>
      <span class="hub-tile-title">${game.title}</span>
      <span class="hub-tile-progress">${progress}</span>
    `;
    btn.addEventListener("click", () => {
      if (game.status === "live") openGame(game.id);
      else showComingSoonModal(game);
    });
    return btn;
  }

  function showComingSoonModal(game) {
    document.getElementById("soon-emoji").textContent = game.emoji;
    document.getElementById("soon-title").textContent = game.title;
    document.getElementById("soon-category").textContent = game.category;
    comingSoonModal.classList.add("active");
  }

  function launchHub() {
    hideAll();
    updateAppNavbar(true);
    activeProfile.gateCompleted = true;
    saveProfile();
    syncAuthFlags();
    updateHubAuthUI();
    renderHub();
    refreshSchemaBanner();
    gamesHubScreen.classList.remove("hidden-layer");
  }

  function launchAccountGate() {
    hideAll();
    updateAppNavbar(false);
    accountGateScreen.classList.remove("hidden-layer");
  }

  function exitToHub() {
    stopTimer();
    saveProfile();
    launchHub();
  }

  function openGame(gameId) {
    if (gameId !== "matchbox") return;
    activeProfile.lastGame = "matchbox";
    saveProfile();
    launchMatchbox();
  }

  function launchMatchbox() {
    hideAll();
    if (!activeProfile.matchboxTutorialDone) {
      showTutorial();
      return;
    }
    if (!activeProfile.nickname) {
      quizReturnTo = "matchbox";
      quizScreen.classList.remove("hidden-layer");
      return;
    }
    launchGameMode();
  }

  async function startGoogleSignIn() {
    if (!isAuthConfigured()) {
      alert("Supabase is not configured yet. Copy config.example.js to config.js and add your keys.");
      return;
    }
    try {
      await signInWithGoogle();
    } catch (err) {
      console.error(err);
      alert("Could not start Google sign-in. Check the browser console and Supabase setup.");
    }
  }

  function completeGateSkip() {
    activeProfile.isGuest = true;
    activeProfile.isLoggedIn = false;
    activeProfile.gateCompleted = true;
    saveProfile();
    launchHub();
  }

  // ----------------------------------------------------------
  //  STAR LOGIC
  // ----------------------------------------------------------
  function calcStars(pairs,flipCount) {
    const p=pairs*2;
    if(flipCount<=p*1.5) return 3;
    if(flipCount<=p*2.5) return 2;
    return 1;
  }
  function renderStarString(count) { return "⭐".repeat(count)+"☆".repeat(3-count); }

  // ----------------------------------------------------------
  //  RANKED SCORE (lower = better: flips*10 + seconds)
  // ----------------------------------------------------------
  function calcRankedScore(f,s) { return f*10+s; }

  // ----------------------------------------------------------
  //  GLOBAL RANK
  // ----------------------------------------------------------
  function getGlobalRank(myProfile, allPlayers) {
    const sorted=[...allPlayers].sort((a,b)=>{
      if((a.totalFlips||0)!==(b.totalFlips||0)) return (a.totalFlips||0)-(b.totalFlips||0);
      return (a.totalSeconds||0)-(b.totalSeconds||0);
    });
    return sorted.findIndex(p=>p.nickname===myProfile.nickname)+1;
  }

  // ----------------------------------------------------------
  //  PHASE 1 — PRELOADER
  // ----------------------------------------------------------
  const LOAD_DURATION=5000;
  let bootPreloaderDone=false;
  let bootAuthDone=false;

  async function tryFinishBoot(){
    if(!bootPreloaderDone||!bootAuthDone) return;
    await routeAfterBoot();
  }

  initAuth().then(()=>{
    bootAuthDone=true;
    tryFinishBoot();
  }).catch((err)=>{
    console.error("[retentiOoo] auth init:",err);
    bootAuthDone=true;
    tryFinishBoot();
  });

  if(preloader&&loadingBar){
    loadingBar.style.transitionDuration=`${LOAD_DURATION}ms`;
    setTimeout(()=>{loadingBar.style.width="100%";},50);
    setTimeout(()=>{
      preloader.classList.add("preloader-fade-out");
      setTimeout(()=>{
        preloader.remove();
        bootPreloaderDone=true;
        tryFinishBoot();
      },500);
    },LOAD_DURATION+50);
  } else {
    bootPreloaderDone=true;
  }

  document.getElementById("gate-google-btn").addEventListener("click", startGoogleSignIn);
  document.getElementById("gate-skip-btn").addEventListener("click", completeGateSkip);

  async function handleSignOut() {
    try{
      await signOut();
      isLoggedIn=false;
      activeProfile.isLoggedIn=false;
      activeProfile.isGuest=true;
      saveProfile();
      updateHubAuthUI();
      launchAccountGate();
    }catch(err){
      console.error(err);
      alert("Could not sign out.");
    }
  }

  document.getElementById("profile-signout-btn")?.addEventListener("click", handleSignOut);

  document.getElementById("hub-profile-btn").addEventListener("click", () => {
    if (activeProfile.nickname) launchProfileScreen();
    else if (isAuthenticated()) showOnboardingQuiz("hub");
    else startGoogleSignIn();
  });

  document.getElementById("hub-parent-btn").addEventListener("click", () => {
    hideAll();
    updateAppNavbar(true);
    parentDashboardScreen.classList.remove("hidden-layer");
  });

  document.getElementById("app-nav-home")?.addEventListener("click", (e) => {
    e.preventDefault();
    launchHub();
  });

  document.getElementById("app-nav-friends")?.addEventListener("click", () => {
    if (isAuthenticated()) launchFriendsScreen();
    else document.getElementById("auth-modal").classList.add("active");
  });

  document.getElementById("app-nav-profile")?.addEventListener("click", () => {
    if (activeProfile.nickname) launchProfileScreen();
    else if (isAuthenticated()) showOnboardingQuiz("hub");
    else document.getElementById("auth-modal").classList.add("active");
  });

  async function launchFriendsScreen() {
    hideAll();
    const guestNote = document.getElementById("friends-guest-note");
    const codeEl = document.getElementById("my-friend-code");
    const listEl = document.getElementById("friends-list");
    const addMsg = document.getElementById("add-friend-msg");
    closeFriendChat();

    if (!isAuthenticated()) {
      guestNote.classList.remove("hidden-layer");
      codeEl.textContent = "——";
      listEl.innerHTML = "";
      friendsScreen.classList.remove("hidden-layer");
      return;
    }

    guestNote.classList.add("hidden-layer");
    addMsg.textContent = "";
    addMsg.className = "friends-msg";

    try {
      const code = await ensureFriendCode();
      codeEl.textContent = code || "——";
      await renderFriendsList();
    } catch (err) {
      console.error(err);
      codeEl.textContent = "Error";
      listEl.innerHTML = `<p class="friends-empty">Run schema-friends.sql in Supabase.</p>`;
    }

    friendsScreen.classList.remove("hidden-layer");
  }

  async function renderFriendsList() {
    const listEl = document.getElementById("friends-list");
    const friends = await fetchFriendsList();
    cachedFriends = friends;
    if (!friends.length) {
      listEl.innerHTML = `<p class="friends-empty">No friends yet. Share your code with other test accounts!</p>`;
      closeFriendChat();
      return;
    }
    listEl.innerHTML = "";
    friends.forEach((f) => {
      const row = document.createElement("div");
      row.className = "friend-row";
      row.innerHTML = `
        <span class="friend-row-emoji">${AVATAR_EMOJI[f.avatar] || "🦄"}</span>
        <div class="friend-row-info">
          <div class="friend-row-name">${f.display_name || "Player"}</div>
          <div class="friend-row-code">Code: ${f.friend_code || "—"}</div>
        </div>
        <button type="button" class="chat-send-btn friend-chat-open-btn" data-id="${f.id}">Chat</button>
        <button type="button" class="back-btn friend-remove-btn" data-id="${f.id}">Remove</button>
      `;
      row.querySelector(".friend-chat-open-btn").addEventListener("click", () => {
        openFriendChat(f);
      });
      row.querySelector(".friend-remove-btn").addEventListener("click", async () => {
        await removeFriend(f.id);
        if (activeFriendChat?.id === f.id) closeFriendChat();
        await renderFriendsList();
      });
      listEl.appendChild(row);
    });
  }

  function closeFriendChat() {
    activeFriendChat = null;
    friendChatMessageIds = new Set();
    unsubscribeFromFriendMessages();
    document.getElementById("friend-chat-panel")?.classList.add("hidden-layer");
    const box = document.getElementById("friend-chat-messages");
    if (box) box.innerHTML = "";
    const input = document.getElementById("friend-chat-input");
    if (input) input.value = "";
  }

  function appendFriendMessage(msg, scroll = true) {
    const box = document.getElementById("friend-chat-messages");
    if (!box || !msg) return;
    if (msg.id && friendChatMessageIds.has(msg.id)) return;
    if (msg.id) friendChatMessageIds.add(msg.id);
    const line = document.createElement("div");
    const mine = msg.sender_id === getUserId();
    line.className = `chat-line friend-chat-line ${mine ? "mine" : ""}`;
    const time = new Date(msg.created_at || Date.now()).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    const name = mine
      ? (activeProfile.nickname || "You")
      : (activeFriendChat?.display_name || msg.display_name || "Friend");
    line.innerHTML = `<span class="chat-time">${time}</span> <strong>${escapeChat(name)}</strong>: ${escapeChat(msg.body)}`;
    box.appendChild(line);
    if (scroll) box.scrollTop = box.scrollHeight;
  }

  async function openFriendChat(friend) {
    activeFriendChat = friend;
    const panel = document.getElementById("friend-chat-panel");
    const avatar = document.getElementById("friend-chat-avatar");
    const name = document.getElementById("friend-chat-name");
    const box = document.getElementById("friend-chat-messages");
    if (!panel || !box) return;

    if (avatar) avatar.textContent = AVATAR_EMOJI[friend.avatar] || "👤";
    if (name) name.textContent = friend.display_name || "Friend";
    friendChatMessageIds = new Set();
    box.innerHTML = `<p class="friends-empty friend-chat-loading">Loading chat...</p>`;
    panel.classList.remove("hidden-layer");

    try {
      const serverProfile = await fetchServerProfile();
      if (serverProfile?.display_name) activeProfile.nickname = serverProfile.display_name;
      const messages = await fetchFriendMessages(friend.id);
      box.innerHTML = "";
      messages.forEach((m) => appendFriendMessage(m, false));
      box.scrollTop = box.scrollHeight;
      subscribeToFriendMessages(friend.id, appendFriendMessage);
      document.getElementById("friend-chat-input")?.focus();
    } catch (err) {
      console.error(err);
      box.innerHTML = `<p class="friends-empty friend-chat-loading">Run schema-friends.sql in Supabase to enable friend chat.</p>`;
    }
  }

  document.getElementById("hub-friends-btn").addEventListener("click", () => {
    if (!isAuthenticated()) {
      document.getElementById("auth-modal").classList.add("active");
      return;
    }
    launchFriendsScreen();
  });

  document.getElementById("back-from-friends").addEventListener("click", launchHub);

  document.getElementById("copy-friend-code-btn").addEventListener("click", async () => {
    const code = document.getElementById("my-friend-code").textContent;
    if (!code || code === "——") return;
    try {
      await navigator.clipboard.writeText(code);
      document.getElementById("add-friend-msg").textContent = "Code copied!";
      document.getElementById("add-friend-msg").className = "friends-msg ok";
    } catch (_) {
      alert("Copy: " + code);
    }
  });

  document.getElementById("add-friend-btn").addEventListener("click", async () => {
    const input = document.getElementById("add-friend-code-input");
    const msg = document.getElementById("add-friend-msg");
    try {
      const added = await addFriendByCode(input.value);
      msg.textContent = `Added ${added.display_name || "friend"}!`;
      msg.className = "friends-msg ok";
      input.value = "";
      await renderFriendsList();
    } catch (err) {
      msg.textContent = err.message || "Could not add friend.";
      msg.className = "friends-msg err";
    }
  });

  document.getElementById("friend-chat-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = document.getElementById("friend-chat-input");
    if (!input || !activeFriendChat) return;
    try {
      const serverProfile = await fetchServerProfile();
      const displayName = serverProfile?.display_name || activeProfile.nickname || "Player";
      const sent = await sendFriendMessage(activeFriendChat.id, displayName, input.value);
      appendFriendMessage(sent);
      recordChatActivity();
      input.value = "";
    } catch (err) {
      console.error(err);
      const errText = err.message || String(err);
      const setupHint = errText.includes("friend_messages") || errText.includes("does not exist")
        ? "\n\nRun supabase/schema-friends.sql in Supabase SQL Editor, then refresh this page."
        : "";
      alert("Could not send message: " + errText + setupHint);
    }
  });

  document.getElementById("back-from-parent").addEventListener("click", launchHub);

  document.getElementById("close-soon-btn").addEventListener("click", () => {
    comingSoonModal.classList.remove("active");
  });
  document.getElementById("soon-ok-btn").addEventListener("click", () => {
    comingSoonModal.classList.remove("active");
  });
  if (comingSoonModal) {
    comingSoonModal.addEventListener("click", (e) => {
      if (e.target === comingSoonModal) comingSoonModal.classList.remove("active");
    });
  }

  document.getElementById("close-ranked-lock-btn").addEventListener("click", () => {
    rankedLockModal.classList.remove("active");
  });
  document.getElementById("ranked-lock-cancel-btn").addEventListener("click", () => {
    rankedLockModal.classList.remove("active");
  });

  document.getElementById("ranked-lock-skip-btn").addEventListener("click", () => {
    rankedLockModal.classList.remove("active");
  });
  document.getElementById("ranked-lock-signup-btn").addEventListener("click", () => {
    rankedLockModal.classList.remove("active");
    startGoogleSignIn();
  });

  document.getElementById("back-to-hub-from-matchbox").addEventListener("click", exitToHub);

  // ----------------------------------------------------------
  //  PHASE 2 — TUTORIAL
  // ----------------------------------------------------------
  let step2MatchDone=false;
  let step3Timer=null;

  function showTutorial(){ tutorialScreen.classList.remove("hidden-layer"); showTutorialStep(1); }

  function showTutorialStep(step){
    [1,2,3].forEach(i=>{
      document.getElementById(`t-step-${i}`).classList.add("hidden-layer");
      document.getElementById(`t-dot-${i}`).classList.remove("active");
    });
    document.getElementById(`t-step-${step}`).classList.remove("hidden-layer");
    document.getElementById(`t-dot-${step}`).classList.add("active");
    if(step===3) startStep3HUD();
  }

  const tCardFlip=document.getElementById("t-card-flip");
  if(tCardFlip){
    tCardFlip.addEventListener("click",()=>{
      if(tCardFlip.classList.contains("t-card-flipped")) return;
      tCardFlip.classList.add("t-card-flipped");
      document.getElementById("t-finger").style.display="none";
      document.getElementById("t-next-1").disabled=false;
    });
  }
  document.getElementById("t-next-1").addEventListener("click",()=>showTutorialStep(2));

  const tCardWrong=document.getElementById("t-card-wrong");
  const tCardCorrect=document.getElementById("t-card-correct");
  const tHint2=document.getElementById("t-hint-2");
  const tNext2=document.getElementById("t-next-2");

  if(tCardWrong){
    tCardWrong.addEventListener("click",()=>{
      if(step2MatchDone||tCardWrong.classList.contains("t-card-flipped")) return;
      tCardWrong.classList.add("t-card-flipped");
      tHint2.textContent="Not a match! Watch them flip back...";
      setTimeout(()=>{
        tCardWrong.classList.add("t-card-shake");
        setTimeout(()=>{
          tCardWrong.classList.remove("t-card-flipped","t-card-shake");
          tHint2.textContent="Try the other card!";
        },900);
      },400);
    });
  }

  if(tCardCorrect){
    tCardCorrect.addEventListener("click",()=>{
      if(step2MatchDone) return;
      tCardCorrect.classList.add("t-card-flipped");
      setTimeout(()=>{
        tCardCorrect.classList.add("t-card-match");
        document.querySelector(".t-card-flipped:not(#t-card-correct)").classList.add("t-card-match");
        tHint2.textContent="🎉 Perfect match!";
        step2MatchDone=true;
        tNext2.disabled=false;
      },400);
    });
  }

  document.getElementById("t-next-2").addEventListener("click",()=>showTutorialStep(3));

  function startStep3HUD(){
    clearInterval(step3Timer);
    let s=0,f=0;
    const timerEl=document.getElementById("t-timer");
    const flipsEl=document.getElementById("t-flips");
    const badge=document.getElementById("t-perfect-badge");
    if(!timerEl) return;
    badge.classList.add("hidden-layer");
    step3Timer=setInterval(()=>{
      s++;
      timerEl.textContent=formatTime(s);
      if(s%2===0&&f<6){ f++; flipsEl.textContent=`${f} Flips`; }
      if(s===5){ clearInterval(step3Timer); badge.classList.remove("hidden-layer"); }
    },1000);
  }

  function finishMatchboxTutorial() {
    activeProfile.matchboxTutorialDone = true;
    saveProfile();
    tutorialScreen.classList.add("hidden-layer");
    if (!activeProfile.nickname) {
      quizScreen.classList.remove("hidden-layer");
    } else {
      launchGameMode();
    }
  }

  document.getElementById("t-next-3").addEventListener("click", () => {
    clearInterval(step3Timer);
    finishMatchboxTutorial();
  });

  document.getElementById("tutorial-skip").addEventListener("click", () => {
    clearInterval(step3Timer);
    activeProfile.matchboxTutorialDone = true;
    saveProfile();
    tutorialScreen.classList.add("hidden-layer");
    if (!activeProfile.nickname) {
      quizScreen.classList.remove("hidden-layer");
    } else {
      launchGameMode();
    }
  });

  // ----------------------------------------------------------
  //  PHASE 3 — QUIZ
  // ----------------------------------------------------------
  document.querySelectorAll(".avatar-card").forEach(btn=>{
    btn.addEventListener("click",function(){
      const nickname=document.getElementById("quiz-nickname").value.trim();
      const errorEl=document.getElementById("nickname-error");
      if(!nickname){ errorEl.classList.remove("hidden-layer"); document.getElementById("quiz-nickname").focus(); return; }
      errorEl.classList.add("hidden-layer");
      activeProfile.nickname=nickname;
      activeProfile.avatar=this.dataset.avatar;
      if (isAuthenticated()) {
        activeProfile.isLoggedIn = true;
        activeProfile.isGuest = false;
      }
      saveProfile();
      quizScreen.classList.add("hidden-layer");
      if (quizReturnTo === "matchbox") launchGameMode();
      else launchHub();
    });
  });

  // ----------------------------------------------------------
  //  GAME MODE SCREEN
  // ----------------------------------------------------------
  function launchGameMode(){
    hideAll();
    updateAppNavbar(true);
    const avatar=AVATAR_EMOJI[activeProfile.avatar]||"🦄";
    const nickname=activeProfile.nickname||"Player";
    document.getElementById("gm-avatar").textContent=avatar;
    document.getElementById("gm-playername").textContent=nickname;
    const authBtn=document.getElementById("auth-btn");
    if(authBtn) authBtn.textContent=isLoggedIn?nickname:"Sign Up";
    updateRankedModeUI();
    gameModeScreen.classList.remove("hidden-layer");
  }

  document.getElementById("adventure-mode-btn").addEventListener("click",()=>{
    gameModeScreen.classList.add("hidden-layer");
    launchCoreGameBoard(1, activeProfile.currentLevel || 1);
  });

  document.getElementById("ranked-mode-btn").addEventListener("click",()=>{
    if (!isLoggedIn) {
      rankedLockModal.classList.add("active");
      return;
    }
    gameModeScreen.classList.add("hidden-layer");
    launchRankedLive();
  });

  // ----------------------------------------------------------
  //  QUEST SELECT
  // ----------------------------------------------------------
  function launchQuestSelect(){
    hideAll();
    document.getElementById("qs-avatar").textContent=AVATAR_EMOJI[activeProfile.avatar]||"🦄";
    document.getElementById("qs-playername").textContent=activeProfile.nickname||"Player";

    const questList=document.getElementById("quest-list");
    questList.innerHTML="";
    QUESTS.forEach(quest=>{
      const unlocked=activeProfile.unlockedQuests.includes(quest.id);
      const questStars=activeProfile.stars[quest.id]||{};
      const totalStars=Object.values(questStars).reduce((a,b)=>a+b,0);
      const btn=document.createElement("button");
      btn.className=`quest-card ${unlocked?"quest-unlocked":"quest-locked"}`;
      btn.disabled=!unlocked;
      btn.innerHTML=`
        <span class="quest-emoji">${quest.emoji}</span>
        <div class="quest-info">
          <span class="quest-name">${quest.name} — ${quest.subject}</span>
          <span class="quest-stars">${unlocked?`⭐ ${totalStars}/30 stars`:"🔒 Locked"}</span>
        </div>
        <span class="quest-status">${unlocked?"▶️":""}</span>
      `;
      if(unlocked){
        btn.addEventListener("click",()=>{
          activeProfile.currentQuest=quest.id;
          questSelectScreen.classList.add("hidden-layer");
          launchAdventureMap(quest.id);
        });
      }
      questList.appendChild(btn);
    });
    questSelectScreen.classList.remove("hidden-layer");
  }

  document.getElementById("back-to-game-mode").addEventListener("click",()=>{
    questSelectScreen.classList.add("hidden-layer");
    launchGameMode();
  });

  document.getElementById("nav-hub-link").addEventListener("click", (e) => {
    e.preventDefault();
    gameScreen.classList.add("hidden-layer");
    exitToHub();
  });

  // ----------------------------------------------------------
  //  ADVENTURE MAP
  // ----------------------------------------------------------
  function launchAdventureMap(questId){
    const quest=QUESTS.find(q=>q.id===questId);
    const unlockedLevel=activeProfile.unlockedLevels[questId]||1;
    const questStars=activeProfile.stars[questId]||{};
    document.getElementById("map-avatar").textContent=AVATAR_EMOJI[activeProfile.avatar]||"🦄";
    document.getElementById("quest-title").textContent=quest.name;
    document.getElementById("quest-subtitle").textContent=`${quest.subject} ${quest.emoji}`;
    const path=document.getElementById("adventure-path");
    path.innerHTML="";
    for(let i=1;i<=10;i++){
      const unlocked=i<=unlockedLevel;
      const subTopic=quest.levels[i-1];
      const starCount=questStars[i]||0;
      const isLast=i===10;
      const block=document.createElement("button");
      block.className=`level-block ${unlocked?"level-unlocked":"level-locked"}`;
      block.disabled=!unlocked;
      block.dataset.level=i;
      block.innerHTML=`
        <div class="level-block-left">
          <span class="level-block-num">${isLast&&!unlocked?"🏁":unlocked?i:"🔒"}</span>
        </div>
        <div class="level-block-info">
          <span class="level-block-title">Level ${i} — ${subTopic}</span>
          <span class="level-block-stars">${unlocked&&starCount>0?renderStarString(starCount):unlocked?"Not played yet":""}</span>
        </div>
        <span class="level-block-arrow">${unlocked?"▶️":""}</span>
      `;
      if(unlocked){
        block.addEventListener("click",()=>{
          activeProfile.currentLevel=i;
          mapScreen.classList.add("hidden-layer");
          launchCoreGameBoard(questId,i);
        });
      }
      path.appendChild(block);
    }
    mapScreen.classList.remove("hidden-layer");
  }

  document.getElementById("back-to-quests").addEventListener("click",()=>{
    mapScreen.classList.add("hidden-layer");
    launchQuestSelect();
  });

  // ----------------------------------------------------------
  //  ADVENTURE GAME BOARD
  // ----------------------------------------------------------
  function launchCoreGameBoard(questId,level){
    updateAppNavbar(false);
    document.getElementById("current-subject-label").textContent="Matchbox";
    document.getElementById("current-level-label").textContent=level;
    animateNavLogo("nav-logo-link");
    initNavToggle();
    gameScreen.classList.remove("hidden-layer");
    activeProfile.currentQuest = 1;
    activeProfile.currentLevel = level;
    activeProfile.lastGame = "matchbox";
    saveProfile();
    buildAndShuffleCards("Animals",level,"game-cards",false);
  }

  function buildAndShuffleCards(subject,level,gridId,isRanked){
    const cardGrid=document.getElementById(gridId);
    const allImages=TOPIC_IMAGES[subject]||TOPIC_IMAGES["Animals"];
    const pairCount=isRanked?8:(LEVEL_CONFIG[level]||LEVEL_CONFIG[1]).pairs;
    const cols=isRanked?4:(LEVEL_CONFIG[level]||LEVEL_CONFIG[1]).cols;

    if(!isRanked){
      cardOne=cardTwo=null; disableDeck=false;
      matchedCount=0; totalPairs=pairCount;
      flips=0; seconds=0;
      stopTimer(); updateFlipDisplay(); updateTimerDisplay();
    } else {
      rankedCardOne=rankedCardTwo=null; rankedDisable=false;
      rankedMatchedCount=0; rankedFlips=0;
      updateRankedFlipDisplay();
    }

    const imagePool=[];
    for(let i=0;i<pairCount;i++) imagePool.push(allImages[i%allImages.length]);
    const pairs=[...imagePool,...imagePool];
    if (isRanked && rankedBoardSeed != null) {
      seededShuffleArray(pairs, rankedBoardSeed);
    } else {
      shuffleArray(pairs);
    }

    cardGrid.style.display="grid";
    cardGrid.style.gridTemplateColumns=`repeat(${cols},1fr)`;
    cardGrid.style.height="auto";
    cardGrid.innerHTML="";

    pairs.forEach(imgSrc=>{
      const li=document.createElement("li");
      li.className="card";
      li.innerHTML=`
        <div class="view front-view"><span class="material-icons">question_mark</span></div>
        <div class="view back-view"><img src="${imgSrc}" alt="card image"></div>
      `;
      li.addEventListener("click",isRanked?flipRankedCard:flipCard);
      cardGrid.appendChild(li);
    });
  }

  // ----------------------------------------------------------
  //  ADVENTURE FLIP LOGIC
  // ----------------------------------------------------------
  function flipCard(e){
    const clicked=e.currentTarget;
    if(clicked===cardOne||disableDeck) return;
    startTimer(); flips++; updateFlipDisplay();
    clicked.classList.add("flip");
    if(!cardOne){ cardOne=clicked; return; }
    cardTwo=clicked; disableDeck=true;
    checkMatch(cardOne.querySelector("img").src,cardTwo.querySelector("img").src,false);
  }

  function checkMatch(img1,img2,isRanked){
    const c1=isRanked?rankedCardOne:cardOne;
    const c2=isRanked?rankedCardTwo:cardTwo;
    if(img1===img2){
      if(isRanked){ rankedMatchedCount++; }
      else{ matchedCount++; }
      c1.removeEventListener("click",isRanked?flipRankedCard:flipCard);
      c2.removeEventListener("click",isRanked?flipRankedCard:flipCard);
      if(isRanked){
        rankedCardOne=rankedCardTwo=null; rankedDisable=false;
        updateMyLiveProgress();
        if (liveRankedActive) {
          updateMyRoomProgress(rankedMatchedCount, rankedFlips);
        }
        if(rankedMatchedCount===8) endRankedGame(true);
      } else {
        cardOne=cardTwo=null; disableDeck=false;
        if(matchedCount===totalPairs){ stopTimer(); setTimeout(()=>showWinModal(),600); }
      }
    } else {
      setTimeout(()=>{ c1.classList.add("shake"); c2.classList.add("shake"); },300);
      setTimeout(()=>{
        c1.classList.remove("shake","flip"); c2.classList.remove("shake","flip");
        if(isRanked){ rankedCardOne=rankedCardTwo=null; rankedDisable=false; }
        else{ cardOne=cardTwo=null; disableDeck=false; }
      },1200);
    }
  }

  // ----------------------------------------------------------
  //  LIVE RANKED FLOW
  // ----------------------------------------------------------
  function memberKey(m) {
    return (m.user_id || m.nickname || "").toString();
  }

  function renderVoteResultsFromVotes(votes) {
    const voteResults = document.getElementById("vote-results");
    if (!voteResults) return;
    voteResults.innerHTML = "";
    const sorted = QUESTS.slice().sort(
      (a, b) => (votes[b.subject] || 0) - (votes[a.subject] || 0)
    );
    const total = Object.values(votes || {}).reduce((a, b) => a + b, 0) || 1;
    sorted.forEach((q) => {
      const pct = Math.round(((votes[q.subject] || 0) / total) * 100);
      const bar = document.createElement("div");
      bar.className = "vote-bar-row";
      bar.innerHTML = `
        <span class="vote-bar-label">${q.emoji} ${q.subject}</span>
        <div class="vote-bar-track"><div class="vote-bar-fill" style="width:${pct}%"></div></div>
        <span class="vote-bar-pct">${pct}%</span>
      `;
      voteResults.appendChild(bar);
    });
  }

  function renderWaitingRoomMembers(members) {
    const waitingRoom = document.getElementById("waiting-room");
    const countEl = document.getElementById("ranked-lobby-player-count");
    if (!waitingRoom) return;
    waitingRoom.innerHTML = "";
    members.forEach((m) => {
      const div = document.createElement("div");
      div.className = "waiting-player";
      div.innerHTML = `<span class="waiting-avatar">${AVATAR_EMOJI[m.avatar] || "🦄"}</span><span class="waiting-name">${m.display_name}</span><span class="waiting-ready">✓</span>`;
      waitingRoom.appendChild(div);
    });
    if (countEl) {
      countEl.textContent = `Players: ${members.length} (need ${MIN_PLAYERS_TO_START} to start)`;
    }
  }

  function appendChatTo(containerId, msg, scroll = true) {
    const box = document.getElementById(containerId);
    if (!box || !msg) return;
    const line = document.createElement("div");
    line.className = "chat-line";
    const time = new Date(msg.created_at || Date.now()).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    line.innerHTML = `<span class="chat-time">${time}</span> <strong>${msg.display_name}</strong>: ${escapeChat(msg.body)}`;
    box.appendChild(line);
    if (scroll) box.scrollTop = box.scrollHeight;
  }

  function escapeChat(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  async function loadChatHistory(containerId) {
    const messages = await fetchChatMessages();
    const box = document.getElementById(containerId);
    if (box) box.innerHTML = "";
    messages.forEach((m) => appendChatTo(containerId, m, false));
    if (box) box.scrollTop = box.scrollHeight;
  }

  function setupRankedRealtimeHandlers() {
    subscribeToRoom({
      onRoom: async (room) => {
        if (!room) return;
        renderVoteResultsFromVotes(room.votes || {});
        const statusEl = document.getElementById("ranked-live-status");
        if (statusEl) statusEl.textContent = `Lobby · ${rankedLiveMembers.length} online`;

        if (room.status === "playing") {
          clearInterval(rankedCountdownTimer);
          rankedTopic = room.topic || "Animals";
          rankedBoardSeed = room.board_seed;
          if (rankedGameScreen.classList.contains("hidden-layer")) {
            rankedWaitingScreen.classList.add("hidden-layer");
            rankedVoteScreen.classList.add("hidden-layer");
            launchRankedGame();
          }
        }
      },
      onMembers: (members) => {
        rankedLiveMembers = members;
        renderWaitingRoomMembers(members);
        buildLivePlayersPanel(members);
        maybeStartLobbyCountdown(members.length);
      },
      onChat: (msg) => {
        if (!rankedWaitingScreen.classList.contains("hidden-layer")) {
          appendChatTo("chat-messages", msg);
        }
        if (!document.getElementById("ranked-game-chat")?.classList.contains("hidden-layer")) {
          appendChatTo("game-chat-messages", msg);
        }
      },
    });
  }

  function maybeStartLobbyCountdown(playerCount) {
    if (!rankedVoteConfirmed || playerCount < MIN_PLAYERS_TO_START) return;
    const countEl = document.getElementById("waiting-timer");
    const labelEl = document.getElementById("waiting-countdown-label");
    if (!countEl || countEl.dataset.running === "1") return;

    countEl.dataset.running = "1";
    if (labelEl) labelEl.textContent = "Match starts in";
    let count = 8;
    countEl.textContent = count;

    clearInterval(rankedCountdownTimer);
    rankedCountdownTimer = setInterval(async () => {
      count--;
      countEl.textContent = count;
      if (count <= 0) {
        clearInterval(rankedCountdownTimer);
        countEl.dataset.running = "0";
        try {
          await tryBeginMatch();
          const room = await fetchRoom();
          if (room?.status !== "playing") {
            countEl.textContent = "…";
            if (labelEl) labelEl.textContent = "Starting match…";
          }
        } catch (err) {
          console.error(err);
          alert("Could not start match. Try again.");
        }
      }
    }, 1000);
  }

  async function launchRankedLive() {
    const mp = await checkMultiplayerReady();
    if (!mp.ok) {
      const msg =
        mp.reason === "schema"
          ? "Run schema-multiplayer.sql and schema-fix-rls.sql in Supabase SQL Editor."
          : "Sign in and configure Supabase to play live Ranked.";
      alert(msg);
      launchGameMode();
      return;
    }

    try {
      liveRankedActive = true;
      rankedVoteConfirmed = false;
      clearInterval(rankedCountdownTimer);
      await joinOrCreateLobby(
        activeProfile.nickname || "Player",
        activeProfile.avatar || "unicorn"
      );
      setupRankedRealtimeHandlers();
      const room = await fetchRoom();
      rankedLiveMembers = await fetchRoomMembers();
      if (room?.votes) renderVoteResultsFromVotes(room.votes);
      launchRankedVote();
    } catch (err) {
      console.error(err);
      liveRankedActive = false;
      const errText = String(err.message || err);
      const hint = errText.includes("recursion")
        ? "\n\nFix: run supabase/schema-fix-rls.sql in Supabase SQL Editor."
        : "";
      alert("Could not join live lobby: " + errText + hint);
      launchGameMode();
    }
  }

  function launchRankedVote() {
    hideAll();
    updateAppNavbar(true);
    document.getElementById("rv-avatar").textContent = AVATAR_EMOJI[activeProfile.avatar] || "🦄";
    document.getElementById("rv-name").textContent = activeProfile.nickname || "Player";

    const voteGrid = document.getElementById("vote-grid");
    const voteResults = document.getElementById("vote-results");
    const confirmBtn = document.getElementById("vote-confirm-btn");
    const statusEl = document.getElementById("ranked-live-status");
    voteGrid.innerHTML = "";
    voteResults.innerHTML = "";
    rankedVote = "";

    if (statusEl) {
      statusEl.textContent = `Live · ${rankedLiveMembers.length} player(s) in lobby`;
    }

    QUESTS.forEach((quest) => {
      const btn = document.createElement("button");
      btn.className = "vote-card";
      btn.dataset.subject = quest.subject;
      btn.innerHTML = `<span class="vote-emoji">${quest.emoji}</span><span class="vote-label">${quest.subject}</span>`;
      btn.addEventListener("click", async () => {
        document.querySelectorAll(".vote-card").forEach((b) => b.classList.remove("vote-selected"));
        btn.classList.add("vote-selected");
        rankedVote = quest.subject;
        confirmBtn.classList.remove("hidden-layer");
        try {
          await castVote(quest.subject);
          const room = await fetchRoom();
          renderVoteResultsFromVotes(room?.votes || {});
        } catch (err) {
          console.error(err);
        }
      });
      voteGrid.appendChild(btn);
    });

    const onConfirm = () => {
      rankedVoteConfirmed = true;
      rankedTopic = rankedVote || "Animals";
      launchRankedWaiting();
    };
    const newConfirm = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirm, confirmBtn);
    newConfirm.addEventListener("click", onConfirm, { once: true });

    rankedVoteScreen.classList.remove("hidden-layer");
  }

  document.getElementById("back-from-vote").addEventListener("click", async () => {
    await leaveCurrentRoom();
    liveRankedActive = false;
    rankedVoteScreen.classList.add("hidden-layer");
    launchGameMode();
  });

  document.getElementById("back-from-waiting").addEventListener("click", async () => {
    clearInterval(rankedCountdownTimer);
    await leaveCurrentRoom();
    liveRankedActive = false;
    rankedWaitingScreen.classList.add("hidden-layer");
    launchGameMode();
  });

  function launchRankedWaiting() {
    rankedVoteScreen.classList.add("hidden-layer");
    document.getElementById("rw-avatar").textContent = AVATAR_EMOJI[activeProfile.avatar] || "🦄";
    document.getElementById("rw-name").textContent = activeProfile.nickname || "Player";
    document.getElementById("ranked-topic-label").textContent = rankedVote
      ? `Your vote: ${rankedVote}`
      : "Pick a topic on the previous screen";

    renderWaitingRoomMembers(rankedLiveMembers);
    loadChatHistory("chat-messages");
    updateChatStreakUI();

    const countEl = document.getElementById("waiting-timer");
    if (countEl) {
      countEl.textContent = "—";
      countEl.dataset.running = "0";
    }
    maybeStartLobbyCountdown(rankedLiveMembers.length);

    rankedWaitingScreen.classList.remove("hidden-layer");
  }

  document.getElementById("chat-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = document.getElementById("chat-input");
    if (!input) return;
    await sendChatMessage(activeProfile.nickname || "Player", input.value);
    recordChatActivity();
    input.value = "";
  });

  document.getElementById("game-chat-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = document.getElementById("game-chat-input");
    if (!input) return;
    await sendChatMessage(activeProfile.nickname || "Player", input.value);
    recordChatActivity();
    input.value = "";
  });

  function launchRankedGame() {
    updateAppNavbar(false);
    const quest = QUESTS.find((q) => q.subject === rankedTopic) || QUESTS[0];
    rankedSeconds = 120;
    rankedFlips = 0;
    rankedMatchedCount = 0;
    rankedCardOne = rankedCardTwo = null;
    rankedDisable = false;

    document.getElementById("ranked-topic-hud").textContent = `${quest.emoji} ${quest.subject}`;
    document.getElementById("ranked-flips").textContent = 0;
    updateRankedTimerDisplay();

    rankedGameScreen.classList.remove("hidden-layer");
    document.getElementById("ranked-game-chat").classList.remove("hidden-layer");
    loadChatHistory("game-chat-messages");
    updateChatStreakUI();
    animateNavLogo("ranked-logo");

    buildAndShuffleCards(rankedTopic, 6, "ranked-cards", true);
    buildLivePlayersPanel(rankedLiveMembers);
    startRankedTimer();
  }

  // ----------------------------------------------------------
  //  RANKED FLIP LOGIC
  // ----------------------------------------------------------
  function flipRankedCard(e){
    const clicked=e.currentTarget;
    if(clicked===rankedCardOne||rankedDisable) return;
    rankedFlips++;
    updateRankedFlipDisplay();
    if(liveRankedActive) updateMyRoomProgress(rankedMatchedCount,rankedFlips);
    clicked.classList.add("flip");
    if(!rankedCardOne){ rankedCardOne=clicked; return; }
    rankedCardTwo=clicked; rankedDisable=true;
    checkMatch(rankedCardOne.querySelector("img").src,rankedCardTwo.querySelector("img").src,true);
  }

  function updateRankedFlipDisplay(){
    const el=document.getElementById("ranked-flips");
    if(el) el.textContent=rankedFlips;
  }

  // ----------------------------------------------------------
  //  RANKED TIMER (countdown)
  // ----------------------------------------------------------
  function startRankedTimer(){
    clearInterval(rankedInterval);
    rankedInterval=setInterval(()=>{
      rankedSeconds--;
      updateRankedTimerDisplay();
      if(rankedSeconds<=0){ endRankedGame(false); }
    },1000);
  }

  function updateRankedTimerDisplay(){
    const el=document.getElementById("ranked-timer");
    if(el){
      const m=Math.floor(rankedSeconds/60);
      const s=rankedSeconds%60;
      el.textContent=`${m}:${s<10?"0":""}${s}`;
      if(rankedSeconds<=30) el.classList.add("timer-danger");
      else el.classList.remove("timer-danger");
    }
  }

  async function endRankedGame(completed){
    clearInterval(rankedInterval);
    const timeTaken=120-rankedSeconds;
    const myScore=calcRankedScore(rankedFlips,timeTaken);
    if (!activeProfile.bestScores) activeProfile.bestScores = {};
    const rankedBest = activeProfile.bestScores.ranked;
    if (!rankedBest || myScore < rankedBest.score) {
      activeProfile.bestScores.ranked = {
        flips: rankedFlips,
        time: timeTaken,
        score: myScore,
        completed: !!completed
      };
      saveProfile();
    }
    if (liveRankedActive) {
      await finishMyRoomResult(rankedFlips, timeTaken, myScore);
      rankedLiveMembers = await fetchRoomMembers();
    }
    showRankedResults(completed,timeTaken,myScore);
  }

  function buildLivePlayersPanel(members){
    const panel=document.getElementById("live-players-panel");
    panel.innerHTML="<div class='live-panel-title'>⚔️ Live Players</div>";
    const list=members&&members.length?members:rankedLiveMembers;
    const uid=getUserId?.()||null;

    list.forEach(m=>{
      const key=memberKey(m);
      const isMe=m.user_id===uid;
      const pairs=m.pairs_matched||0;
      const pct=(pairs/8)*100;
      const div=document.createElement("div");
      div.className=`live-player ${isMe?"live-player-me":""}`;
      div.id=`lp-${key.replace(/[^a-zA-Z0-9]/g,"")}`;
      div.innerHTML=`
        <span class="lp-avatar">${AVATAR_EMOJI[m.avatar]||"🦄"}</span>
        <div class="lp-info">
          <span class="lp-name">${m.display_name}${isMe?" (You)":""}</span>
          <div class="lp-bar-track"><div class="lp-bar-fill" id="lpbar-${key.replace(/[^a-zA-Z0-9]/g,"")}" style="width:${pct}%"></div></div>
        </div>
        <span class="lp-pairs" id="lppairs-${key.replace(/[^a-zA-Z0-9]/g,"")}">${pairs}/8</span>
      `;
      panel.appendChild(div);
    });
  }

  function updateMyLiveProgress(){
    const uid=getUserId?.();
    const me=rankedLiveMembers.find(m=>m.user_id===uid);
    const key=me?memberKey(me):(activeProfile.nickname||"You");
    const safe=key.replace(/[^a-zA-Z0-9]/g,"");
    const pct=(rankedMatchedCount/8)*100;
    const barEl=document.getElementById(`lpbar-${safe}`);
    const pairsEl=document.getElementById(`lppairs-${safe}`);
    if(barEl) barEl.style.width=`${pct}%`;
    if(pairsEl) pairsEl.textContent=`${rankedMatchedCount}/8`;
  }

  // ----------------------------------------------------------
  //  RANKED RESULTS
  // ----------------------------------------------------------
  function showRankedResults(completed,timeTaken,myScore){
    rankedGameScreen.classList.add("hidden-layer");
    document.getElementById("ranked-game-chat")?.classList.add("hidden-layer");
    const quest=QUESTS.find(q=>q.subject===rankedTopic);

    const uid=getUserId?.();
    const allResults=rankedLiveMembers.map(m=>({
      nickname:m.display_name,
      avatar:m.avatar,
      flips:m.flips||0,
      time:m.time_seconds??999,
      score:m.score??calcRankedScore(m.flips||0,m.time_seconds||999),
      isMe:m.user_id===uid
    }));

    if(!allResults.some(r=>r.isMe)){
      allResults.push({
        nickname:activeProfile.nickname||"You",
        avatar:activeProfile.avatar,
        flips:rankedFlips,
        time:timeTaken,
        score:myScore,
        isMe:true
      });
    }

    allResults.sort((a,b)=>a.score-b.score);
    const myRank=allResults.findIndex(r=>r.isMe)+1;

    // Update share card
    document.getElementById("rs-topic").textContent=`${quest.subject} ${quest.emoji}`;
    document.getElementById("rs-rank").textContent=`#${myRank}`;
    document.getElementById("rs-flips").textContent=rankedFlips;
    document.getElementById("rs-time").textContent=formatTime(timeTaken);
    document.getElementById("rs-score").textContent=myScore;

    // Build results list
    const list=document.getElementById("ranked-results-list");
    list.innerHTML="";
    allResults.forEach((r,i)=>{
      const row=document.createElement("div");
      row.className=`ranked-result-row ${r.isMe?"ranked-result-me":""}`;
      const medal=i===0?"🥇":i===1?"🥈":i===2?"🥉":`#${i+1}`;
      row.innerHTML=`
        <span class="rr-rank">${medal}</span>
        <span class="rr-avatar">${AVATAR_EMOJI[r.avatar]||"🦄"}</span>
        <span class="rr-name">${r.nickname}${r.isMe?" (You)":""}</span>
        <span class="rr-flips">${r.flips} flips</span>
        <span class="rr-time">${formatTime(r.time)}</span>
        <span class="rr-score">${r.score}</span>
      `;
      list.appendChild(row);
    });

    rankedResultsScreen.classList.remove("hidden-layer");
  }

  document.getElementById("play-again-ranked-btn").addEventListener("click",async ()=>{
    rankedResultsScreen.classList.add("hidden-layer");
    await leaveCurrentRoom();
    launchRankedLive();
  });

  document.getElementById("back-to-mode-btn").addEventListener("click",async ()=>{
    rankedResultsScreen.classList.add("hidden-layer");
    await leaveCurrentRoom();
    liveRankedActive=false;
    exitToHub();
  });

  // ----------------------------------------------------------
  //  SHARING
  // ----------------------------------------------------------
  async function shareCard(cardId, text){
    const card=document.getElementById(cardId);
    if(!card) return;
    try {
      // Make card visible for capture
      card.style.display="flex";
      const canvas=await html2canvas(card,{scale:2,backgroundColor:null,useCORS:true});
      card.style.display="none";
      canvas.toBlob(async(blob)=>{
        const file=new File([blob],"retentioo-result.png",{type:"image/png"});
        if(navigator.share&&navigator.canShare&&navigator.canShare({files:[file]})){
          await navigator.share({ files:[file], title:"retentiOoo", text });
        } else {
          // Desktop fallback — download image + copy text
          const url=URL.createObjectURL(blob);
          const a=document.createElement("a");
          a.href=url; a.download="retentioo-result.png"; a.click();
          URL.revokeObjectURL(url);
          await navigator.clipboard.writeText(text).catch(()=>{});
          alert("Image downloaded! Link copied to clipboard.");
        }
      },"image/png");
    } catch(err){
      console.error("Share failed:",err);
      alert("Could not share. Try downloading the image manually.");
    }
  }

  document.getElementById("share-arcade-btn").addEventListener("click",()=>{
    const topic=document.getElementById("win-quest-label").textContent;
    const stars=["win-star-1","win-star-2","win-star-3"].filter(id=>document.getElementById(id).textContent==="⭐").length;
    const text=`I just completed "${topic}" on Matchbox (retentiOoo) with ${document.getElementById("win-flips").textContent} flips in ${document.getElementById("win-time").textContent}! ${renderStarString(stars)}\nPlay at ${GAME_URL}`;
    // Sync share card content
    document.getElementById("ac-topic").textContent=topic;
    document.getElementById("ac-stars").textContent=renderStarString(stars);
    document.getElementById("ac-flips").textContent=document.getElementById("win-flips").textContent;
    document.getElementById("ac-time").textContent=document.getElementById("win-time").textContent;
    shareCard("arcade-share-card",text);
  });

  document.getElementById("share-ranked-btn").addEventListener("click",()=>{
    const rank=document.getElementById("rs-rank").textContent;
    const flips=document.getElementById("rs-flips").textContent;
    const time=document.getElementById("rs-time").textContent;
    const topic=document.getElementById("rs-topic").textContent;
    const text=`I ranked ${rank} of 10 in a Ranked Matchbox match on retentiOoo!\nTopic: ${topic} | ${flips} flips | ${time}\nPlay at ${GAME_URL}`;
    shareCard("ranked-share-card",text);
  });

  // ----------------------------------------------------------
  //  WIN MODAL (Adventure)
  // ----------------------------------------------------------
  function showWinModal(){
    const level=activeProfile.currentLevel;
    const config=LEVEL_CONFIG[level];
    const earned=calcStars(config.pairs,flips);
    const timeStr=document.getElementById("timer").textContent;

    if(!activeProfile.stars.matchbox) activeProfile.stars.matchbox={};
    activeProfile.stars.matchbox[level]=Math.max(activeProfile.stars.matchbox[level]||0,earned);

    if(!activeProfile.bestScores) activeProfile.bestScores={};
    if(!activeProfile.bestScores.matchbox){
      activeProfile.bestScores.matchbox={flips,time:seconds,level};
    } else {
      const best=activeProfile.bestScores.matchbox;
      if(level>(best.level||1)||flips<best.flips||seconds<best.time){
        activeProfile.bestScores.matchbox={flips,time:seconds,level};
      }
    }

    activeProfile.totalFlips=(activeProfile.totalFlips||0)+flips;
    activeProfile.totalSeconds=(activeProfile.totalSeconds||0)+seconds;

    const nextLevel=level+1;
    if(nextLevel<=10){
      activeProfile.unlockedLevels.matchbox=Math.max(activeProfile.unlockedLevels.matchbox||1,nextLevel);
    }

    saveProfile();

    document.getElementById("win-title").textContent=`Level ${level} Complete!`;
    document.getElementById("win-quest-label").textContent=`Matchbox - Level ${level}`;
    document.getElementById("win-time").textContent=timeStr;
    document.getElementById("win-flips").textContent=flips;
    const best=activeProfile.bestScores?.matchbox;
    document.getElementById("win-best").textContent=best?`${best.flips} flips`:"-";

    ["win-star-1","win-star-2","win-star-3"].forEach((id,i)=>{
      const el=document.getElementById(id);
      el.textContent=i<earned?"⭐":"☆";
      el.classList.remove("star-pop");
      if(i<earned) setTimeout(()=>el.classList.add("star-pop"),i*200);
    });

    winModal.classList.add("active");
  }

  document.getElementById("win-continue-btn").addEventListener("click",()=>{
    winModal.classList.remove("active");
    const nextLevel=activeProfile.currentLevel+1;
    if(nextLevel<=10){
      activeProfile.currentLevel=nextLevel;
      document.getElementById("current-level-label").textContent=nextLevel;
      document.getElementById("current-subject-label").textContent="Matchbox";
      buildAndShuffleCards("Animals",nextLevel,"game-cards",false);
    } else {
      gameScreen.classList.add("hidden-layer");
      launchGameMode();
    }
  });

  document.getElementById("win-claim-btn").addEventListener("click",()=>{
    winModal.classList.remove("active");
    document.getElementById("auth-modal").classList.add("active");
  });

  // ----------------------------------------------------------
  //  PROFILE SCREEN
  // ----------------------------------------------------------
  async function launchProfileScreen(){
    hideAll();
    updateAppNavbar(true);
    const avatar=AVATAR_EMOJI[activeProfile.avatar]||"🦄";
    const nickname=activeProfile.nickname||"Player";
    document.getElementById("profile-avatar").textContent=avatar;
    document.getElementById("profile-name").textContent=nickname;
    document.getElementById("profile-badge").textContent=`Matchbox · Level ${activeProfile.currentLevel || 1}`;

    const allPlayers=getPlaceholderPlayers();
    allPlayers.push(activeProfile);
    const rank=getGlobalRank(activeProfile,allPlayers);
    document.getElementById("profile-rank-badge").textContent=`🏆 Global Rank #${rank}`;
    document.getElementById("profile-signout-btn")?.classList.toggle("hidden-layer", !isAuthenticated());

    let friendCount = cachedFriends.length;
    if (isAuthenticated()) {
      try {
        cachedFriends = await fetchFriendsList();
        friendCount = cachedFriends.length;
      } catch (_) {
        friendCount = cachedFriends.length;
      }
    }
    const friendsBadge = document.getElementById("profile-friends-badge");
    if (friendsBadge) friendsBadge.textContent = `👥 ${friendCount} friend${friendCount === 1 ? "" : "s"}`;

    const progressCards=document.getElementById("progress-cards");
    progressCards.innerHTML="";
    const matchboxBest=activeProfile.bestScores?.matchbox;
    const matchboxStars=activeProfile.stars?.matchbox||{};
    const levelsPlayed=Object.keys(matchboxStars).length;
    const totalStars=Object.values(matchboxStars).reduce((a,b)=>a+b,0);
    [
      {
        emoji:"🎮",
        name:"Matchbox Arcade",
        detail:matchboxBest
          ? `Best: ${matchboxBest.flips} flips · ${formatTime(matchboxBest.time)} · Level ${matchboxBest.level}`
          : `No score yet · ${levelsPlayed}/10 levels · ${totalStars}/30 stars`
      },
      {
        emoji:"🏆",
        name:"Matchbox Ranked",
        detail:activeProfile.bestScores?.ranked
          ? `Best: ${activeProfile.bestScores.ranked.flips} flips · ${formatTime(activeProfile.bestScores.ranked.time)}`
          : "No ranked score yet"
      }
    ].forEach(game=>{
      const card=document.createElement("div");
      card.className="progress-card";
      card.innerHTML=`
        <span class="progress-card-emoji">${game.emoji}</span>
        <div class="progress-card-info">
          <span class="progress-card-name">${game.name}</span>
          <span class="progress-card-detail">${game.detail}</span>
        </div>
      `;
      progressCards.appendChild(card);
    });
    profileScreen.classList.remove("hidden-layer");
    return;
    QUESTS.forEach(q=>{
      const unlocked=activeProfile.unlockedQuests.includes(q.id);
      const questStars=activeProfile.stars[q.id]||{};
      const totalStars=Object.values(questStars).reduce((a,b)=>a+b,0);
      const levelsPlayed=Object.keys(questStars).length;
      const card=document.createElement("div");
      card.className=`progress-card ${unlocked?"":"progress-card-locked"}`;
      card.innerHTML=`
        <span class="progress-card-emoji">${q.emoji}</span>
        <div class="progress-card-info">
          <span class="progress-card-name">${q.subject}</span>
          <span class="progress-card-detail">${unlocked?`${levelsPlayed}/10 levels · ⭐ ${totalStars}/30`:"🔒 Locked"}</span>
        </div>
      `;
      progressCards.appendChild(card);
    });

    const statsTable=document.getElementById("stats-table");
    statsTable.innerHTML="";
    QUESTS.forEach(q=>{
      const best=activeProfile.bestStats[q.subject];
      const row=document.createElement("div");
      row.className="stats-row";
      row.innerHTML=`
        <span class="stats-row-subject">${q.emoji} ${q.subject}</span>
        <span class="stats-row-val">${best?best.flips:"—"}</span>
        <span class="stats-row-val">${best?formatTime(best.time):"—"}</span>
      `;
      statsTable.appendChild(row);
    });

    profileScreen.classList.remove("hidden-layer");
  }

  document.getElementById("back-from-profile").addEventListener("click",()=>{
    profileScreen.classList.add("hidden-layer");
    launchHub();
  });

  // ----------------------------------------------------------
  //  LEADERBOARD
  // ----------------------------------------------------------
  function launchLeaderboard(){
    hideAll();
    updateAppNavbar(true);
    const list=document.getElementById("leaderboard-list");
    list.innerHTML="";
    const allPlayers=[...getPlaceholderPlayers(),activeProfile];
    allPlayers.sort((a,b)=>{
      if((a.totalFlips||0)!==(b.totalFlips||0)) return (a.totalFlips||0)-(b.totalFlips||0);
      return (a.totalSeconds||0)-(b.totalSeconds||0);
    });
    allPlayers.forEach((player,i)=>{
      const isMe=player.nickname===activeProfile.nickname;
      const row=document.createElement("div");
      row.className=`lb-row ${isMe?"lb-row-me":""}`;
      const medal=i===0?"🥇":i===1?"🥈":i===2?"🥉":`#${i+1}`;
      row.innerHTML=`
        <span class="lb-rank">${medal}</span>
        <span class="lb-avatar">${AVATAR_EMOJI[player.avatar]||"🦄"}</span>
        <span class="lb-name">${player.nickname}${isMe?" (You)":""}</span>
        <span class="lb-flips">${player.totalFlips||0}</span>
        <span class="lb-time">${formatTime(player.totalSeconds||0)}</span>
      `;
      list.appendChild(row);
    });
    leaderboardScreen.classList.remove("hidden-layer");
  }

  function getPlaceholderPlayers(){
    return [
      {nickname:"SuperBrain",avatar:"unicorn",totalFlips:142,totalSeconds:734,stars:{1:{1:3,2:3},2:{},3:{},4:{},5:{}}},
      {nickname:"DragonKid",avatar:"dragon",totalFlips:167,totalSeconds:812,stars:{1:{1:3},2:{},3:{},4:{},5:{}}},
      {nickname:"RoboMaster",avatar:"robot",totalFlips:98,totalSeconds:520,stars:{1:{1:2},2:{},3:{},4:{},5:{}}},
      {nickname:"AlienGenius",avatar:"alien",totalFlips:210,totalSeconds:950,stars:{1:{1:1},2:{},3:{},4:{},5:{}}},
    ];
  }

  document.getElementById("back-from-leaderboard").addEventListener("click",()=>{
    leaderboardScreen.classList.add("hidden-layer");
    if (gameScreen.classList.contains("hidden-layer")) launchHub();
    else launchGameMode();
  });

  document.getElementById("leaderboard-link").addEventListener("click",e=>{
    e.preventDefault();
    gameScreen.classList.add("hidden-layer");
    launchLeaderboard();
  });

  // ----------------------------------------------------------
  //  NAVBAR NAV LINKS
  // ----------------------------------------------------------
  document.getElementById("nav-adventure-link").addEventListener("click",e=>{
    e.preventDefault();
    gameScreen.classList.add("hidden-layer");
    launchCoreGameBoard(1, activeProfile.currentLevel || 1);
  });

  document.getElementById("nav-ranked-link").addEventListener("click",e=>{
    e.preventDefault();
    gameScreen.classList.add("hidden-layer");
    if (!isLoggedIn) {
      rankedLockModal.classList.add("active");
      return;
    }
    launchRankedLive();
  });

  // ----------------------------------------------------------
  //  TIMER (Adventure)
  // ----------------------------------------------------------
  function startTimer(){
    if(!timerInterval) timerInterval=setInterval(()=>{ seconds++; updateTimerDisplay(); },1000);
  }
  function stopTimer(){ clearInterval(timerInterval); timerInterval=null; }
  function updateTimerDisplay(){
    const el=document.getElementById("timer");
    if(el) el.textContent=formatTime(seconds);
  }
  function updateFlipDisplay(){
    const el=document.getElementById("flips");
    if(el) el.textContent=flips;
  }

  // ----------------------------------------------------------
  //  HELPERS
  // ----------------------------------------------------------
  function formatTime(s){
    return `${Math.floor(s/60)}:${(s%60)<10?"0":""}${s%60}`;
  }
  function shuffleArray(arr){
    for(let i=arr.length-1;i>0;i--){
      const j=Math.floor(Math.random()*(i+1));
      [arr[i],arr[j]]=[arr[j],arr[i]];
    }
    return arr;
  }

  function seededShuffleArray(arr,seed){
    let s=Number(seed)||1;
    const rand=()=>{ s=(s*1103515245+12345)&0x7fffffff; return s/0x7fffffff; };
    for(let i=arr.length-1;i>0;i--){
      const j=Math.floor(rand()*(i+1));
      [arr[i],arr[j]]=[arr[j],arr[i]];
    }
    return arr;
  }
  function animateNavLogo(id){
    const link=document.getElementById(id);
    if(!link||link.dataset.animated) return;
    const t=link.textContent;
    link.innerHTML=`${t.slice(0,-2)}<span>${t.slice(-2,-1)}</span><span>${t.slice(-1)}</span>`;
    link.dataset.animated="true";
  }
  function initNavToggle(){
    const toggle=document.getElementById("nav-toggle");
    const links=document.getElementById("nav-links");
    if(!toggle||!links) return;
    const newToggle=toggle.cloneNode(true);
    toggle.parentNode.replaceChild(newToggle,toggle);
    newToggle.addEventListener("click",()=>links.classList.toggle("open"));
    links.querySelectorAll("a").forEach(a=>a.addEventListener("click",()=>links.classList.remove("open")));
  }

  // ----------------------------------------------------------
  //  AUTH MODAL
  // ----------------------------------------------------------
  const authBtn=document.getElementById("auth-btn");
  const authModal=document.getElementById("auth-modal");
  const closeModalBtn=document.getElementById("close-modal-btn");
  const authGoogleBtn=document.getElementById("auth-google-btn");
  const authSkipBtn=document.getElementById("auth-skip-btn");

  if(authBtn) authBtn.addEventListener("click",()=>{ if(isLoggedIn){ launchProfileScreen(); } else { authModal.classList.add("active"); } });
  if(closeModalBtn) closeModalBtn.addEventListener("click",()=>authModal.classList.remove("active"));
  if(authModal) authModal.addEventListener("click",e=>{ if(e.target===authModal) authModal.classList.remove("active"); });

  if (authGoogleBtn) {
    authGoogleBtn.addEventListener("click", () => {
      authModal.classList.remove("active");
      startGoogleSignIn();
    });
  }

  if (authSkipBtn) {
    authSkipBtn.addEventListener("click", () => {
      authModal.classList.remove("active");
      completeGateSkip();
    });
  }

}); // end DOMContentLoaded

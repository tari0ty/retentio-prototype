// ============================================================
//  retentiOo — script.js
// ============================================================

document.addEventListener("DOMContentLoaded", function () {

  // ----------------------------------------------------------
  //  QUEST & LEVEL DATA
  // ----------------------------------------------------------
  const QUESTS = [
    { id: 1, name: "Quest 1", subject: "Animals",   emoji: "🦁",
      levels: ["Mammals","Birds","Reptiles","Insects","Fish","Amphibians","Dinosaurs","Farm Animals","Wild Animals","Sea Creatures"] },
    { id: 2, name: "Quest 2", subject: "Space",     emoji: "🚀",
      levels: ["Planets","Stars","Galaxies","Black Holes","Moons","Asteroids","Comets","The Sun","Space Exploration","Constellations"] },
    { id: 3, name: "Quest 3", subject: "Ocean",     emoji: "🐬",
      levels: ["Fish","Coral Reefs","Deep Sea","Sharks","Whales","Turtles","Crabs","Jellyfish","Seahorses","Ocean Plants"] },
    { id: 4, name: "Quest 4", subject: "Science",   emoji: "🔬",
      levels: ["Plants","Human Body","Weather","Electricity","Magnets","Forces","Light","Sound","Chemistry","Animals"] },
    { id: 5, name: "Quest 5", subject: "Geography", emoji: "🌍",
      levels: ["Continents","Countries","Oceans","Mountains","Rivers","Deserts","Rainforests","Cities","Flags","Climates"] }
  ];

  const LEVEL_CONFIG = {
    1:{pairs:3,cols:2}, 2:{pairs:4,cols:2}, 3:{pairs:5,cols:3},
    4:{pairs:6,cols:3}, 5:{pairs:7,cols:3}, 6:{pairs:8,cols:4},
    7:{pairs:9,cols:4}, 8:{pairs:10,cols:4}, 9:{pairs:11,cols:4}, 10:{pairs:12,cols:4}
  };

  const TOPIC_IMAGES = {
    Animals:   [1,2,3,4,5,6,7,8].map(n=>`images/img-${n}.png`),
    Space:     [1,2,3,4,5,6,7,8].map(n=>`images/img-${n}.png`),
    Ocean:     [1,2,3,4,5,6,7,8].map(n=>`images/img-${n}.png`),
    Science:   [1,2,3,4,5,6,7,8].map(n=>`images/img-${n}.png`),
    Geography: [1,2,3,4,5,6,7,8].map(n=>`images/img-${n}.png`),
  };

  const AVATAR_EMOJI = { unicorn:"🦄", dragon:"🐲", robot:"🤖", alien:"👽" };

  // ----------------------------------------------------------
  //  DEFAULT PROFILE
  // ----------------------------------------------------------
  let activeProfile = {
    nickname: "", avatar: "",
    currentQuest: 1, currentLevel: 1,
    unlockedLevels: {1:1,2:1,3:1,4:1,5:1},
    unlockedQuests: [1],
    stars: {1:{},2:{},3:{},4:{},5:{}},
    bestStats: {},
    totalFlips: 0,
    totalSeconds: 0
  };

  let isLoggedIn = false;

  // ----------------------------------------------------------
  //  GAME STATE
  // ----------------------------------------------------------
  let cardOne=null, cardTwo=null, disableDeck=false;
  let matchedCount=0, totalPairs=0, flips=0, seconds=0;
  let timerInterval=null;

  // ----------------------------------------------------------
  //  ELEMENTS
  // ----------------------------------------------------------
  const preloader         = document.getElementById("preloader");
  const loadingBar        = document.querySelector(".loading-bar");
  const tutorialScreen    = document.getElementById("tutorial-screen");
  const quizScreen        = document.getElementById("quiz-screen");
  const questSelectScreen = document.getElementById("quest-select-screen");
  const mapScreen         = document.getElementById("map-screen");
  const gameScreen        = document.getElementById("game-screen");
  const winModal          = document.getElementById("win-modal");
  const profileScreen     = document.getElementById("profile-screen");
  const leaderboardScreen = document.getElementById("leaderboard-screen");

  // ----------------------------------------------------------
  //  STAR LOGIC (flips only)
  // ----------------------------------------------------------
  function calcStars(pairs, flipCount) {
    const perfect = pairs * 2;
    if (flipCount <= perfect * 1.5) return 3;
    if (flipCount <= perfect * 2.5) return 2;
    return 1;
  }

  function renderStarString(count) {
    return "⭐".repeat(count) + "☆".repeat(3 - count);
  }

  // ----------------------------------------------------------
  //  GLOBAL RANK CALCULATOR
  //  Sort by: 1) total stars DESC, 2) total flips ASC, 3) total time ASC
  // ----------------------------------------------------------
  function calcTotalStars(profile) {
    let total = 0;
    Object.values(profile.stars || {}).forEach(quest => {
      Object.values(quest).forEach(s => { total += s; });
    });
    return total;
  }

  function getGlobalRank(myProfile, allPlayers) {
    // allPlayers is array of profile objects including myProfile
    const sorted = [...allPlayers].sort((a, b) => {
      const starsA = calcTotalStars(a), starsB = calcTotalStars(b);
      if (starsB !== starsA) return starsB - starsA;         // more stars = higher
      if ((a.totalFlips||0) !== (b.totalFlips||0))
        return (a.totalFlips||0) - (b.totalFlips||0);        // fewer flips = higher
      return (a.totalSeconds||0) - (b.totalSeconds||0);      // less time = higher
    });
    return sorted.findIndex(p => p.nickname === myProfile.nickname) + 1;
  }

  // ----------------------------------------------------------
  //  PHASE 1 — PRELOADER
  // ----------------------------------------------------------
  const LOAD_DURATION = 5000;
  if (preloader && loadingBar) {
    loadingBar.style.transitionDuration = `${LOAD_DURATION}ms`;
    setTimeout(() => { loadingBar.style.width = "100%"; }, 50);
    setTimeout(() => {
      preloader.classList.add("preloader-fade-out");
      setTimeout(() => {
        preloader.remove();
        const saved = localStorage.getItem("retentiOo_profile");
        if (saved) {
          const parsed = JSON.parse(saved);
          activeProfile = Object.assign({}, activeProfile, parsed);
          // Ensure new fields exist on old profiles
          if (!activeProfile.stars) activeProfile.stars = {1:{},2:{},3:{},4:{},5:{}};
          if (!activeProfile.unlockedQuests) activeProfile.unlockedQuests = [1];
          if (!activeProfile.unlockedLevels) activeProfile.unlockedLevels = {1:1,2:1,3:1,4:1,5:1};
          if (!activeProfile.bestStats) activeProfile.bestStats = {};
          if (!activeProfile.totalFlips) activeProfile.totalFlips = 0;
          if (!activeProfile.totalSeconds) activeProfile.totalSeconds = 0;
          // Returning player — skip tutorial and quiz
          launchQuestSelect();
        } else {
          // New player — show tutorial
          showTutorial();
        }
      }, 500);
    }, LOAD_DURATION + 50);
  }

  // ----------------------------------------------------------
  //  PHASE 2 — TUTORIAL
  // ----------------------------------------------------------
  let currentTutorialStep = 1;
  let step2MatchDone = false;
  let step2WrongShown = false;

  function showTutorial() {
    tutorialScreen.classList.remove("hidden-layer");
    showTutorialStep(1);
    startStep3HUD(); // pre-init but hidden
  }

  function showTutorialStep(step) {
    currentTutorialStep = step;
    [1,2,3].forEach(i => {
      document.getElementById(`t-step-${i}`).classList.add("hidden-layer");
      document.getElementById(`t-dot-${i}`).classList.remove("active");
    });
    document.getElementById(`t-step-${step}`).classList.remove("hidden-layer");
    document.getElementById(`t-dot-${step}`).classList.add("active");
    if (step === 3) startStep3HUD();
  }

  // Step 1 — flip card
  const tCardFlip = document.getElementById("t-card-flip");
  if (tCardFlip) {
    tCardFlip.addEventListener("click", () => {
      if (tCardFlip.classList.contains("t-card-flipped")) return;
      tCardFlip.classList.add("t-card-flipped");
      document.getElementById("t-finger").style.display = "none";
      document.getElementById("t-next-1").disabled = false;
    });
  }

  document.getElementById("t-next-1").addEventListener("click", () => showTutorialStep(2));

  // Step 2 — match cards
  const tCardWrong   = document.getElementById("t-card-wrong");
  const tCardCorrect = document.getElementById("t-card-correct");
  const tHint2       = document.getElementById("t-hint-2");
  const tNext2       = document.getElementById("t-next-2");

  if (tCardWrong) {
    tCardWrong.addEventListener("click", () => {
      if (step2MatchDone) return;
      // Flip wrong card
      tCardWrong.classList.add("t-card-flipped");
      tHint2.textContent = "Not a match! Watch them flip back...";
      setTimeout(() => {
        tCardWrong.classList.add("t-card-shake");
        setTimeout(() => {
          tCardWrong.classList.remove("t-card-flipped", "t-card-shake");
          tHint2.textContent = "Try the other card!";
          step2WrongShown = true;
        }, 900);
      }, 400);
    });
  }

  if (tCardCorrect) {
    tCardCorrect.addEventListener("click", () => {
      if (step2MatchDone) return;
      tCardCorrect.classList.add("t-card-flipped");
      setTimeout(() => {
        tCardCorrect.classList.add("t-card-match");
        // Also mark the pre-flipped card
        document.querySelector(".t-card-flipped:not(#t-card-correct)").classList.add("t-card-match");
        tHint2.textContent = "🎉 Perfect match!";
        step2MatchDone = true;
        tNext2.disabled = false;
      }, 400);
    });
  }

  document.getElementById("t-next-2").addEventListener("click", () => showTutorialStep(3));

  // Step 3 — mock HUD
  let step3Timer = null;
  let step3Secs  = 0;
  let step3Flips = 0;

  function startStep3HUD() {
    clearInterval(step3Timer);
    step3Secs = 0; step3Flips = 0;
    const timerEl = document.getElementById("t-timer");
    const flipsEl = document.getElementById("t-flips");
    const badge   = document.getElementById("t-perfect-badge");
    if (!timerEl) return;

    badge.classList.add("hidden-layer");

    step3Timer = setInterval(() => {
      step3Secs++;
      const m = Math.floor(step3Secs / 60);
      const s = step3Secs % 60;
      timerEl.textContent = `${m}:${s < 10 ? "0" : ""}${s}`;

      // Simulate flips increasing
      if (step3Secs % 2 === 0 && step3Flips < 6) {
        step3Flips++;
        flipsEl.textContent = `${step3Flips} Flips`;
      }

      // Show perfect badge at 5 seconds
      if (step3Secs === 5) {
        clearInterval(step3Timer);
        badge.classList.remove("hidden-layer");
      }
    }, 1000);
  }

  document.getElementById("t-next-3").addEventListener("click", () => {
    clearInterval(step3Timer);
    tutorialScreen.classList.add("hidden-layer");
    quizScreen.classList.remove("hidden-layer");
  });

  // Skip tutorial
  document.getElementById("tutorial-skip").addEventListener("click", () => {
    clearInterval(step3Timer);
    tutorialScreen.classList.add("hidden-layer");
    quizScreen.classList.remove("hidden-layer");
  });

  // ----------------------------------------------------------
  //  PHASE 3 — QUIZ (Nickname + Avatar)
  // ----------------------------------------------------------
  document.querySelectorAll(".avatar-card").forEach(btn => {
    btn.addEventListener("click", function () {
      const nickname = document.getElementById("quiz-nickname").value.trim();
      const errorEl  = document.getElementById("nickname-error");
      if (!nickname) {
        errorEl.classList.remove("hidden-layer");
        document.getElementById("quiz-nickname").focus();
        return;
      }
      errorEl.classList.add("hidden-layer");
      activeProfile.nickname = nickname;
      activeProfile.avatar   = this.dataset.avatar;
      localStorage.setItem("retentiOo_profile", JSON.stringify(activeProfile));
      quizScreen.classList.add("hidden-layer");
      launchQuestSelect();
    });
  });

  // ----------------------------------------------------------
  //  PHASE 4 — QUEST SELECT
  // ----------------------------------------------------------
  function launchQuestSelect() {
    [gameScreen, mapScreen, profileScreen, leaderboardScreen].forEach(s => {
      if (s) s.classList.add("hidden-layer");
    });

    const avatar   = AVATAR_EMOJI[activeProfile.avatar] || "🦄";
    const nickname = activeProfile.nickname || "Player";
    document.getElementById("qs-avatar").textContent     = avatar;
    document.getElementById("qs-playername").textContent = nickname;

    const authBtn = document.getElementById("auth-btn");
    if (authBtn && isLoggedIn) authBtn.textContent = nickname;

    const questList = document.getElementById("quest-list");
    questList.innerHTML = "";

    QUESTS.forEach(quest => {
      const unlocked   = activeProfile.unlockedQuests.includes(quest.id);
      const questStars = activeProfile.stars[quest.id] || {};
      const totalStars = Object.values(questStars).reduce((a,b)=>a+b,0);

      const btn = document.createElement("button");
      btn.className = `quest-card ${unlocked ? "quest-unlocked" : "quest-locked"}`;
      btn.disabled  = !unlocked;
      btn.innerHTML = `
        <span class="quest-emoji">${quest.emoji}</span>
        <div class="quest-info">
          <span class="quest-name">${quest.name} — ${quest.subject}</span>
          <span class="quest-stars">${unlocked ? `⭐ ${totalStars}/30 stars` : "🔒 Locked"}</span>
        </div>
        <span class="quest-status">${unlocked ? "▶️" : ""}</span>
      `;
      if (unlocked) {
        btn.addEventListener("click", () => {
          activeProfile.currentQuest = quest.id;
          questSelectScreen.classList.add("hidden-layer");
          launchAdventureMap(quest.id);
        });
      }
      questList.appendChild(btn);
    });

    questSelectScreen.classList.remove("hidden-layer");
  }

  // ----------------------------------------------------------
  //  PHASE 5 — ADVENTURE MAP
  // ----------------------------------------------------------
  function launchAdventureMap(questId) {
    const quest         = QUESTS.find(q=>q.id===questId);
    const unlockedLevel = activeProfile.unlockedLevels[questId] || 1;
    const questStars    = activeProfile.stars[questId] || {};

    document.getElementById("map-avatar").textContent     = AVATAR_EMOJI[activeProfile.avatar] || "🦄";
    document.getElementById("quest-title").textContent    = quest.name;
    document.getElementById("quest-subtitle").textContent = `${quest.subject} ${quest.emoji}`;

    const path = document.getElementById("adventure-path");
    path.innerHTML = "";

    for (let i=1; i<=10; i++) {
      const unlocked  = i <= unlockedLevel;
      const subTopic  = quest.levels[i-1];
      const starCount = questStars[i] || 0;
      const isLast    = i === 10;

      const block = document.createElement("button");
      block.className     = `level-block ${unlocked ? "level-unlocked" : "level-locked"}`;
      block.disabled      = !unlocked;
      block.dataset.level = i;
      block.innerHTML = `
        <div class="level-block-left">
          <span class="level-block-num">${isLast && !unlocked ? "🏁" : unlocked ? i : "🔒"}</span>
        </div>
        <div class="level-block-info">
          <span class="level-block-title">Level ${i} — ${subTopic}</span>
          <span class="level-block-stars">${unlocked && starCount>0 ? renderStarString(starCount) : unlocked ? "Not played yet" : ""}</span>
        </div>
        <span class="level-block-arrow">${unlocked ? "▶️" : ""}</span>
      `;
      if (unlocked) {
        block.addEventListener("click", () => {
          activeProfile.currentLevel = i;
          mapScreen.classList.add("hidden-layer");
          launchCoreGameBoard(questId, i);
        });
      }
      path.appendChild(block);
    }
    mapScreen.classList.remove("hidden-layer");
  }

  document.getElementById("back-to-quests").addEventListener("click", () => {
    mapScreen.classList.add("hidden-layer");
    launchQuestSelect();
  });

  // ----------------------------------------------------------
  //  PHASE 6 — GAME BOARD
  // ----------------------------------------------------------
  function launchCoreGameBoard(questId, level) {
    const quest    = QUESTS.find(q=>q.id===questId);
    const subTopic = quest.levels[level-1];
    document.getElementById("current-subject-label").textContent = `${quest.emoji} ${subTopic}`;
    document.getElementById("current-level-label").textContent   = level;
    animateNavLogo();
    initNavToggle();
    gameScreen.classList.remove("hidden-layer");
    buildAndShuffleCards(quest.subject, level);
  }

  function buildAndShuffleCards(subject, level) {
    const cardGrid  = document.getElementById("game-cards");
    const allImages = TOPIC_IMAGES[subject] || TOPIC_IMAGES["Animals"];
    const config    = LEVEL_CONFIG[level] || LEVEL_CONFIG[1];
    const pairCount = config.pairs;
    const cols      = config.cols;

    cardOne=cardTwo=null; disableDeck=false;
    matchedCount=0; totalPairs=pairCount;
    flips=0; seconds=0;
    stopTimer(); updateFlipDisplay(); updateTimerDisplay();

    const imagePool = [];
    for (let i=0; i<pairCount; i++) imagePool.push(allImages[i % allImages.length]);
    const pairs = [...imagePool, ...imagePool];
    shuffleArray(pairs);

    cardGrid.style.display             = "grid";
    cardGrid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    cardGrid.style.height              = "auto";
    cardGrid.innerHTML                 = "";

    pairs.forEach(imgSrc => {
      const li = document.createElement("li");
      li.className = "card";
      li.innerHTML = `
        <div class="view front-view"><span class="material-icons">question_mark</span></div>
        <div class="view back-view"><img src="${imgSrc}" alt="card image"></div>
      `;
      li.addEventListener("click", flipCard);
      cardGrid.appendChild(li);
    });
  }

  // ----------------------------------------------------------
  //  FLIP LOGIC
  // ----------------------------------------------------------
  function flipCard(e) {
    const clicked = e.currentTarget;
    if (clicked===cardOne || disableDeck) return;
    startTimer();
    flips++; updateFlipDisplay();
    clicked.classList.add("flip");
    if (!cardOne) { cardOne=clicked; return; }
    cardTwo=clicked; disableDeck=true;
    checkMatch(cardOne.querySelector("img").src, cardTwo.querySelector("img").src);
  }

  function checkMatch(img1, img2) {
    if (img1===img2) {
      matchedCount++;
      cardOne.removeEventListener("click", flipCard);
      cardTwo.removeEventListener("click", flipCard);
      cardOne=cardTwo=null; disableDeck=false;
      if (matchedCount===totalPairs) { stopTimer(); setTimeout(()=>showWinModal(), 600); }
    } else {
      setTimeout(()=>{ cardOne.classList.add("shake"); cardTwo.classList.add("shake"); }, 300);
      setTimeout(()=>{
        cardOne.classList.remove("shake","flip");
        cardTwo.classList.remove("shake","flip");
        cardOne=cardTwo=null; disableDeck=false;
      }, 1200);
    }
  }

  // ----------------------------------------------------------
  //  WIN MODAL
  // ----------------------------------------------------------
  function showWinModal() {
    const questId  = activeProfile.currentQuest;
    const level    = activeProfile.currentLevel;
    const quest    = QUESTS.find(q=>q.id===questId);
    const subTopic = quest.levels[level-1];
    const config   = LEVEL_CONFIG[level];
    const earned   = calcStars(config.pairs, flips);
    const timeStr  = document.getElementById("timer").textContent;

    // Save stars — only upgrade
    if (!activeProfile.stars[questId]) activeProfile.stars[questId] = {};
    activeProfile.stars[questId][level] = Math.max(activeProfile.stars[questId][level]||0, earned);

    // Save best stats per subject
    const subject = quest.subject;
    if (!activeProfile.bestStats[subject]) {
      activeProfile.bestStats[subject] = { flips, time: seconds };
    } else {
      if (flips < activeProfile.bestStats[subject].flips)
        activeProfile.bestStats[subject].flips = flips;
      if (seconds < activeProfile.bestStats[subject].time)
        activeProfile.bestStats[subject].time = seconds;
    }

    // Accumulate totals for global ranking
    activeProfile.totalFlips   = (activeProfile.totalFlips   || 0) + flips;
    activeProfile.totalSeconds = (activeProfile.totalSeconds || 0) + seconds;

    // Unlock next level / quest
    const nextLevel = level + 1;
    if (nextLevel <= 10) {
      activeProfile.unlockedLevels[questId] = Math.max(activeProfile.unlockedLevels[questId]||1, nextLevel);
    } else {
      const nextQuest = questId + 1;
      if (nextQuest<=5 && !activeProfile.unlockedQuests.includes(nextQuest)) {
        activeProfile.unlockedQuests.push(nextQuest);
        activeProfile.unlockedLevels[nextQuest] = 1;
      }
    }

    localStorage.setItem("retentiOo_profile", JSON.stringify(activeProfile));

    // Update UI
    document.getElementById("win-title").textContent       = `Level ${level} Complete!`;
    document.getElementById("win-quest-label").textContent = `${quest.subject} ${quest.emoji} — ${subTopic}`;
    document.getElementById("win-time").textContent        = timeStr;
    document.getElementById("win-flips").textContent       = flips;
    const best = activeProfile.bestStats[subject];
    document.getElementById("win-best").textContent = best ? `${best.flips} flips` : "-";

    // Animate stars
    ["win-star-1","win-star-2","win-star-3"].forEach((id,i) => {
      const el = document.getElementById(id);
      el.textContent = i < earned ? "⭐" : "☆";
      el.classList.remove("star-pop");
      if (i < earned) setTimeout(()=>el.classList.add("star-pop"), i*200);
    });

    winModal.classList.add("active");
  }

  document.getElementById("win-continue-btn").addEventListener("click", () => {
    winModal.classList.remove("active");
    const questId   = activeProfile.currentQuest;
    const nextLevel = activeProfile.currentLevel + 1;
    if (nextLevel <= 10) {
      activeProfile.currentLevel = nextLevel;
      const quest    = QUESTS.find(q=>q.id===questId);
      const subTopic = quest.levels[nextLevel-1];
      document.getElementById("current-level-label").textContent   = nextLevel;
      document.getElementById("current-subject-label").textContent = `${quest.emoji} ${subTopic}`;
      buildAndShuffleCards(quest.subject, nextLevel);
    } else {
      gameScreen.classList.add("hidden-layer");
      launchQuestSelect();
    }
  });

  document.getElementById("win-claim-btn").addEventListener("click", () => {
    winModal.classList.remove("active");
    document.getElementById("auth-modal").classList.add("active");
  });

  // ----------------------------------------------------------
  //  PROFILE SCREEN
  // ----------------------------------------------------------
  function launchProfileScreen() {
    const avatar   = AVATAR_EMOJI[activeProfile.avatar] || "🦄";
    const nickname = activeProfile.nickname || "Player";
    const questId  = activeProfile.currentQuest;
    const level    = activeProfile.currentLevel;
    const quest    = QUESTS.find(q=>q.id===questId);

    document.getElementById("profile-avatar").textContent = avatar;
    document.getElementById("profile-name").textContent   = nickname;
    document.getElementById("profile-badge").textContent  = `${quest ? quest.name : "Quest 1"} · Level ${level}`;

    // Global rank — using only local player for now (placeholder others)
    const placeholderPlayers = getPlaceholderPlayers();
    const allPlayers = [...placeholderPlayers, activeProfile];
    const rank = getGlobalRank(activeProfile, allPlayers);
    document.getElementById("profile-rank-badge").textContent = `🏆 Global Rank #${rank}`;

    // Progress cards
    const progressCards = document.getElementById("progress-cards");
    progressCards.innerHTML = "";
    QUESTS.forEach(q => {
      const unlocked    = activeProfile.unlockedQuests.includes(q.id);
      const questStars  = activeProfile.stars[q.id] || {};
      const totalStars  = Object.values(questStars).reduce((a,b)=>a+b,0);
      const levelsPlayed = Object.keys(questStars).length;
      const card = document.createElement("div");
      card.className = `progress-card ${unlocked ? "" : "progress-card-locked"}`;
      card.innerHTML = `
        <span class="progress-card-emoji">${q.emoji}</span>
        <div class="progress-card-info">
          <span class="progress-card-name">${q.subject}</span>
          <span class="progress-card-detail">${unlocked ? `${levelsPlayed}/10 levels · ⭐ ${totalStars}/30` : "🔒 Locked"}</span>
        </div>
      `;
      progressCards.appendChild(card);
    });

    // Stats table
    const statsTable = document.getElementById("stats-table");
    statsTable.innerHTML = "";
    QUESTS.forEach(q => {
      const best = activeProfile.bestStats[q.subject];
      const row  = document.createElement("div");
      row.className = "stats-row";
      row.innerHTML = `
        <span class="stats-row-subject">${q.emoji} ${q.subject}</span>
        <span class="stats-row-val">${best ? `${best.flips}` : "—"}</span>
        <span class="stats-row-val">${best ? formatTime(best.time) : "—"}</span>
      `;
      statsTable.appendChild(row);
    });

    profileScreen.classList.remove("hidden-layer");
  }

  document.getElementById("back-from-profile").addEventListener("click", () => {
    profileScreen.classList.add("hidden-layer");
    launchQuestSelect();
  });

  // ----------------------------------------------------------
  //  LEADERBOARD (global, no tabs)
  // ----------------------------------------------------------
  function launchLeaderboard() {
    const list = document.getElementById("leaderboard-list");
    list.innerHTML = "";

    const placeholderPlayers = getPlaceholderPlayers();
    const allPlayers = [...placeholderPlayers, activeProfile];

    // Sort: stars DESC, flips ASC, time ASC
    allPlayers.sort((a,b) => {
      const starsA = calcTotalStars(a), starsB = calcTotalStars(b);
      if (starsB !== starsA) return starsB - starsA;
      if ((a.totalFlips||0) !== (b.totalFlips||0)) return (a.totalFlips||0)-(b.totalFlips||0);
      return (a.totalSeconds||0)-(b.totalSeconds||0);
    });

    allPlayers.forEach((player, i) => {
      const isMe  = player.nickname === activeProfile.nickname;
      const stars = calcTotalStars(player);
      const row   = document.createElement("div");
      row.className = `lb-row ${isMe ? "lb-row-me" : ""}`;

      const rankEmoji = i===0?"🥇": i===1?"🥈": i===2?"🥉": `#${i+1}`;
      row.innerHTML = `
        <span class="lb-rank">${rankEmoji}</span>
        <span class="lb-avatar">${AVATAR_EMOJI[player.avatar]||"🦄"}</span>
        <span class="lb-name">${player.nickname}${isMe?" (You)":""}</span>
        <span class="lb-stars">${stars}⭐</span>
        <span class="lb-flips">${player.totalFlips||0}</span>
        <span class="lb-time">${formatTime(player.totalSeconds||0)}</span>
      `;
      list.appendChild(row);
    });

    leaderboardScreen.classList.remove("hidden-layer");
  }

  // Placeholder players for leaderboard (replaced by real API later)
  function getPlaceholderPlayers() {
    return [
      { nickname:"SuperBrain",  avatar:"unicorn", totalFlips:142, totalSeconds:734,
        stars:{1:{1:3,2:3,3:2},2:{1:3},3:{},4:{},5:{}} },
      { nickname:"DragonKid",   avatar:"dragon",  totalFlips:167, totalSeconds:812,
        stars:{1:{1:3,2:2},2:{},3:{},4:{},5:{}} },
      { nickname:"RoboMaster",  avatar:"robot",   totalFlips:98,  totalSeconds:520,
        stars:{1:{1:2},2:{},3:{},4:{},5:{}} },
      { nickname:"AlienGenius", avatar:"alien",   totalFlips:210, totalSeconds:950,
        stars:{1:{1:1},2:{},3:{},4:{},5:{}} },
    ];
  }

  document.getElementById("back-from-leaderboard").addEventListener("click", () => {
    leaderboardScreen.classList.add("hidden-layer");
    launchQuestSelect();
  });

  document.getElementById("leaderboard-link").addEventListener("click", e => {
    e.preventDefault();
    gameScreen.classList.add("hidden-layer");
    launchLeaderboard();
  });

  // ----------------------------------------------------------
  //  TIMER
  // ----------------------------------------------------------
  function startTimer() {
    if (!timerInterval)
      timerInterval = setInterval(()=>{ seconds++; updateTimerDisplay(); }, 1000);
  }
  function stopTimer() { clearInterval(timerInterval); timerInterval=null; }
  function updateTimerDisplay() {
    const el=document.getElementById("timer");
    if (el) el.textContent=formatTime(seconds);
  }
  function updateFlipDisplay() {
    const el=document.getElementById("flips");
    if (el) el.textContent=flips;
  }
  function formatTime(s) {
    return `${Math.floor(s/60)}:${(s%60)<10?"0":""}${s%60}`;
  }

  // ----------------------------------------------------------
  //  HELPERS
  // ----------------------------------------------------------
  function shuffleArray(arr) {
    for (let i=arr.length-1;i>0;i--) {
      const j=Math.floor(Math.random()*(i+1));
      [arr[i],arr[j]]=[arr[j],arr[i]];
    }
    return arr;
  }

  function animateNavLogo() {
    const link=document.getElementById("nav-logo-link");
    if (!link||link.dataset.animated) return;
    const t=link.textContent;
    link.innerHTML=`${t.slice(0,-2)}<span>${t.slice(-2,-1)}</span><span>${t.slice(-1)}</span>`;
    link.dataset.animated="true";
  }

  function initNavToggle() {
    const toggle=document.getElementById("nav-toggle");
    const links=document.getElementById("nav-links");
    if (!toggle||!links) return;
    const newToggle=toggle.cloneNode(true);
    toggle.parentNode.replaceChild(newToggle,toggle);
    newToggle.addEventListener("click",()=>links.classList.toggle("open"));
    links.querySelectorAll("a").forEach(a=>a.addEventListener("click",()=>links.classList.remove("open")));
  }

  // ----------------------------------------------------------
  //  AUTH MODAL
  // ----------------------------------------------------------
  const authBtn         = document.getElementById("auth-btn");
  const authModal       = document.getElementById("auth-modal");
  const closeModalBtn   = document.getElementById("close-modal-btn");
  const authForm        = document.getElementById("auth-form");
  const switchMode      = document.getElementById("switch-auth-mode");
  const modalTitle      = document.getElementById("modal-title");
  const modalSubtitle   = document.getElementById("modal-subtitle");
  const submitAuthBtn   = document.getElementById("submit-auth-btn");
  const usernameWrapper = document.getElementById("username-wrapper");
  let isSignUpMode = true;

  if (authBtn) {
    authBtn.addEventListener("click", () => {
      if (isLoggedIn) { launchProfileScreen(); }
      else { authModal.classList.add("active"); }
    });
  }
  if (closeModalBtn) closeModalBtn.addEventListener("click",()=>authModal.classList.remove("active"));
  if (authModal) authModal.addEventListener("click",e=>{if(e.target===authModal)authModal.classList.remove("active");});

  if (switchMode) {
    switchMode.addEventListener("click", e => {
      e.preventDefault();
      isSignUpMode = !isSignUpMode;
      const usernameInput = document.getElementById("auth-username");
      if (isSignUpMode) {
        modalTitle.textContent="Create Account";
        modalSubtitle.textContent="Join retentiOo to save your high scores!";
        submitAuthBtn.textContent="Sign Up";
        switchMode.textContent="Log In";
        usernameWrapper.style.display="flex";
        if (usernameInput) usernameInput.required=true;
      } else {
        modalTitle.textContent="Welcome Back";
        modalSubtitle.textContent="Log in to check your personal stats.";
        submitAuthBtn.textContent="Log In";
        switchMode.textContent="Sign Up";
        usernameWrapper.style.display="none";
        if (usernameInput) usernameInput.required=false;
      }
    });
  }

  if (authForm) {
    authForm.addEventListener("submit", e => {
      e.preventDefault();
      const username=document.getElementById("auth-username").value;
      isLoggedIn=true;
      if (authBtn) authBtn.textContent=username||activeProfile.nickname||"Account";
      authModal.classList.remove("active");
      authForm.reset();
    });
  }

}); // end DOMContentLoaded

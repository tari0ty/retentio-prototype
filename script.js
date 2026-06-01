// ============================================================
//  retentiOo — script.js
// ============================================================

document.addEventListener("DOMContentLoaded", function () {

  // ----------------------------------------------------------
  //  QUEST & LEVEL DATA
  // ----------------------------------------------------------
  const QUESTS = [
    {
      id: 1,
      name: "Quest 1",
      subject: "Animals",
      emoji: "🦁",
      levels: ["Mammals","Birds","Reptiles","Insects","Fish",
               "Amphibians","Dinosaurs","Farm Animals","Wild Animals","Sea Creatures"]
    },
    {
      id: 2,
      name: "Quest 2",
      subject: "Space",
      emoji: "🚀",
      levels: ["Planets","Stars","Galaxies","Black Holes","Moons",
               "Asteroids","Comets","The Sun","Space Exploration","Constellations"]
    },
    {
      id: 3,
      name: "Quest 3",
      subject: "Ocean",
      emoji: "🐬",
      levels: ["Fish","Coral Reefs","Deep Sea","Sharks","Whales",
               "Turtles","Crabs","Jellyfish","Seahorses","Ocean Plants"]
    },
    {
      id: 4,
      name: "Quest 4",
      subject: "Science",
      emoji: "🔬",
      levels: ["Plants","Human Body","Weather","Electricity","Magnets",
               "Forces","Light","Sound","Chemistry","Animals"]
    },
    {
      id: 5,
      name: "Quest 5",
      subject: "Geography",
      emoji: "🌍",
      levels: ["Continents","Countries","Oceans","Mountains","Rivers",
               "Deserts","Rainforests","Cities","Flags","Climates"]
    }
  ];

  // Level config — pairs and grid columns per level
  const LEVEL_CONFIG = {
    1:  { pairs: 3,  cols: 2 },
    2:  { pairs: 4,  cols: 2 },
    3:  { pairs: 5,  cols: 3 },
    4:  { pairs: 6,  cols: 3 },
    5:  { pairs: 7,  cols: 3 },
    6:  { pairs: 8,  cols: 4 },
    7:  { pairs: 9,  cols: 4 },
    8:  { pairs: 10, cols: 4 },
    9:  { pairs: 11, cols: 4 },
    10: { pairs: 12, cols: 4 },
  };

  // All topics use the same 8 placeholder images for now.
  // Later: swap per-quest image folders here.
  const TOPIC_IMAGES = {
    Animals:   [1,2,3,4,5,6,7,8].map(n => `images/img-${n}.png`),
    Space:     [1,2,3,4,5,6,7,8].map(n => `images/img-${n}.png`),
    Ocean:     [1,2,3,4,5,6,7,8].map(n => `images/img-${n}.png`),
    Science:   [1,2,3,4,5,6,7,8].map(n => `images/img-${n}.png`),
    Geography: [1,2,3,4,5,6,7,8].map(n => `images/img-${n}.png`),
  };

  const REWARD_EMOJI = { trophy: "🏆", gem: "💎", sticker: "🎨", star: "👑" };
  const AVATAR_EMOJI = { unicorn: "🦄", dragon: "🐲", robot: "🤖", alien: "👽" };

  // ----------------------------------------------------------
  //  PLAYER PROFILE
  // ----------------------------------------------------------
  let activeProfile = {
    reward: "",
    avatar: "",
    currentQuest: 1,
    currentLevel: 1,
    // tracks unlocked levels per quest: { 1: 1, 2: 1, ... }
    unlockedLevels: { 1:1, 2:1, 3:1, 4:1, 5:1 },
    // tracks unlocked quests
    unlockedQuests: [1]
  };

  // ----------------------------------------------------------
  //  GAME STATE
  // ----------------------------------------------------------
  let cardOne      = null;
  let cardTwo      = null;
  let disableDeck  = false;
  let matchedCount = 0;
  let totalPairs   = 0;
  let flips        = 0;
  let seconds      = 0;
  let timerInterval = null;

  // ----------------------------------------------------------
  //  ELEMENT REFERENCES
  // ----------------------------------------------------------
  const preloader         = document.getElementById("preloader");
  const loadingBar        = document.querySelector(".loading-bar");
  const quizScreen        = document.getElementById("quiz-screen");
  const questSelectScreen = document.getElementById("quest-select-screen");
  const mapScreen         = document.getElementById("map-screen");
  const gameScreen        = document.getElementById("game-screen");
  const winModal          = document.getElementById("win-modal");

  // ----------------------------------------------------------
  //  PHASE 1 — PRELOADER (5 seconds)
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
          activeProfile = JSON.parse(saved);
          launchQuestSelect();
        } else {
          quizScreen.classList.remove("hidden-layer");
        }
      }, 500);
    }, LOAD_DURATION + 50);
  }

  // ----------------------------------------------------------
  //  PHASE 2 — QUIZ (Reward → Avatar)
  // ----------------------------------------------------------
  document.querySelectorAll("#step-1 .kid-card").forEach(btn => {
    btn.addEventListener("click", function () {
      activeProfile.reward = this.dataset.reward;
      document.getElementById("step-1").classList.add("hidden-layer");
      document.getElementById("step-2").classList.remove("hidden-layer");
    });
  });

  document.querySelectorAll("#step-2 .kid-card").forEach(btn => {
    btn.addEventListener("click", function () {
      activeProfile.avatar = this.dataset.avatar;
      localStorage.setItem("retentiOo_profile", JSON.stringify(activeProfile));
      quizScreen.classList.add("hidden-layer");
      launchQuestSelect();
    });
  });

  // ----------------------------------------------------------
  //  PHASE 3 — QUEST SELECT
  // ----------------------------------------------------------
  function launchQuestSelect() {
    const avatar = AVATAR_EMOJI[activeProfile.avatar] || "🦄";
    document.getElementById("qs-avatar").textContent = avatar;

    const questList = document.getElementById("quest-list");
    questList.innerHTML = "";

    QUESTS.forEach(quest => {
      const unlocked = activeProfile.unlockedQuests.includes(quest.id);
      const btn = document.createElement("button");
      btn.className = `quest-card ${unlocked ? "quest-unlocked" : "quest-locked"}`;
      btn.disabled = !unlocked;
      btn.innerHTML = `
        <span class="quest-emoji">${quest.emoji}</span>
        <div class="quest-info">
          <span class="quest-name">${quest.name}</span>
          <span class="quest-subject">${quest.subject}</span>
        </div>
        <span class="quest-status">${unlocked ? "▶️" : "🔒"}</span>
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
  //  PHASE 4 — ADVENTURE MAP (Quest level blocks)
  // ----------------------------------------------------------
  function launchAdventureMap(questId) {
    const quest = QUESTS.find(q => q.id === questId);
    const unlockedLevel = activeProfile.unlockedLevels[questId] || 1;

    document.getElementById("map-avatar").textContent = AVATAR_EMOJI[activeProfile.avatar] || "🦄";
    document.getElementById("quest-title").textContent = quest.name;
    document.getElementById("quest-subtitle").textContent = `${quest.subject} ${quest.emoji}`;

    const path = document.getElementById("adventure-path");
    path.innerHTML = "";

    for (let i = 1; i <= 10; i++) {
      const unlocked = i <= unlockedLevel;
      const subTopic = quest.levels[i - 1];
      const isLast   = i === 10;

      const block = document.createElement("button");
      block.className = `level-block ${unlocked ? "level-unlocked" : "level-locked"}`;
      block.disabled  = !unlocked;
      block.dataset.level = i;

      block.innerHTML = `
        <div class="level-block-left">
          <span class="level-block-num">${unlocked && !isLast ? i : isLast ? "🏁" : "🔒"}</span>
        </div>
        <div class="level-block-info">
          <span class="level-block-title">Level ${i}</span>
          <span class="level-block-sub">${subTopic}</span>
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

  // Back button: quest map → quest select
  const backToQuests = document.getElementById("back-to-quests");
  if (backToQuests) {
    backToQuests.addEventListener("click", () => {
      mapScreen.classList.add("hidden-layer");
      launchQuestSelect();
    });
  }

  // ----------------------------------------------------------
  //  PHASE 5 — GAME BOARD
  // ----------------------------------------------------------
  function launchCoreGameBoard(questId, level) {
    const quest    = QUESTS.find(q => q.id === questId);
    const subTopic = quest.levels[level - 1];

    document.getElementById("current-subject-label").textContent = `${quest.emoji} ${subTopic}`;
    document.getElementById("current-level-label").textContent   = level;

    animateNavLogo();
    initNavToggle();
    gameScreen.classList.remove("hidden-layer");
    buildAndShuffleCards(quest.subject, level);
  }

  // ----------------------------------------------------------
  //  CARD BUILDER
  // ----------------------------------------------------------
  function buildAndShuffleCards(subject, level) {
    const cardGrid  = document.getElementById("game-cards");
    const allImages = TOPIC_IMAGES[subject] || TOPIC_IMAGES["Animals"];
    const config    = LEVEL_CONFIG[level] || LEVEL_CONFIG[1];
    const pairCount = config.pairs;
    const cols      = config.cols;

    // Reset game state
    cardOne = cardTwo = null;
    disableDeck  = false;
    matchedCount = 0;
    totalPairs   = pairCount;
    flips        = 0;
    seconds      = 0;
    stopTimer();
    updateFlipDisplay();
    updateTimerDisplay();

    // Build image pool — cycle if more pairs than images
    const imagePool = [];
    for (let i = 0; i < pairCount; i++) {
      imagePool.push(allImages[i % allImages.length]);
    }

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
        <div class="view front-view">
          <span class="material-icons">question_mark</span>
        </div>
        <div class="view back-view">
          <img src="${imgSrc}" alt="card image">
        </div>
      `;
      li.addEventListener("click", flipCard);
      cardGrid.appendChild(li);
    });
  }

  // ----------------------------------------------------------
  //  CARD FLIP LOGIC
  // ----------------------------------------------------------
  function flipCard(e) {
    const clicked = e.currentTarget;
    if (clicked === cardOne || disableDeck) return;

    startTimer();
    flips++;
    updateFlipDisplay();
    clicked.classList.add("flip");

    if (!cardOne) { cardOne = clicked; return; }

    cardTwo = clicked;
    disableDeck = true;

    const imgOne = cardOne.querySelector("img").src;
    const imgTwo = cardTwo.querySelector("img").src;
    checkMatch(imgOne, imgTwo);
  }

  function checkMatch(img1, img2) {
    if (img1 === img2) {
      matchedCount++;
      cardOne.removeEventListener("click", flipCard);
      cardTwo.removeEventListener("click", flipCard);
      cardOne = cardTwo = null;
      disableDeck = false;

      if (matchedCount === totalPairs) {
        stopTimer();
        setTimeout(() => showWinModal(), 600);
      }
    } else {
      setTimeout(() => {
        cardOne.classList.add("shake");
        cardTwo.classList.add("shake");
      }, 300);
      setTimeout(() => {
        cardOne.classList.remove("shake", "flip");
        cardTwo.classList.remove("shake", "flip");
        cardOne = cardTwo = null;
        disableDeck = false;
      }, 1200);
    }
  }

  // ----------------------------------------------------------
  //  WIN MODAL
  // ----------------------------------------------------------
  function showWinModal() {
    const questId  = activeProfile.currentQuest;
    const level    = activeProfile.currentLevel;
    const quest    = QUESTS.find(q => q.id === questId);
    const subTopic = quest.levels[level - 1];
    const reward   = REWARD_EMOJI[activeProfile.reward] || "🏆";

    document.getElementById("win-emoji").textContent      = reward;
    document.getElementById("win-title").textContent      = `Level ${level} Complete!`;
    document.getElementById("win-quest-label").textContent = `${quest.subject} ${quest.emoji} — ${subTopic}`;
    document.getElementById("win-time").textContent       = document.getElementById("timer").textContent;
    document.getElementById("win-flips").textContent      = flips;
    document.getElementById("win-reward").textContent     = reward;

    // Unlock next level / next quest
    const nextLevel = level + 1;
    if (nextLevel <= 10) {
      activeProfile.unlockedLevels[questId] = Math.max(
        activeProfile.unlockedLevels[questId] || 1,
        nextLevel
      );
    } else {
      // Completed all 10 levels — unlock next quest
      const nextQuest = questId + 1;
      if (nextQuest <= 5 && !activeProfile.unlockedQuests.includes(nextQuest)) {
        activeProfile.unlockedQuests.push(nextQuest);
        activeProfile.unlockedLevels[nextQuest] = 1;
      }
    }

    localStorage.setItem("retentiOo_profile", JSON.stringify(activeProfile));
    winModal.classList.add("active");
  }

  // Continue button — go directly to next level
  document.getElementById("win-continue-btn").addEventListener("click", () => {
    winModal.classList.remove("active");
    const questId   = activeProfile.currentQuest;
    const nextLevel = activeProfile.currentLevel + 1;

    if (nextLevel <= 10) {
      activeProfile.currentLevel = nextLevel;
      buildAndShuffleCards(QUESTS.find(q => q.id === questId).subject, nextLevel);
      document.getElementById("current-level-label").textContent = nextLevel;
      const quest    = QUESTS.find(q => q.id === questId);
      const subTopic = quest.levels[nextLevel - 1];
      document.getElementById("current-subject-label").textContent = `${quest.emoji} ${subTopic}`;
    } else {
      // Quest complete — go back to quest select
      gameScreen.classList.add("hidden-layer");
      launchQuestSelect();
    }
  });

  // Login to Claim Rewards button — open auth modal
  document.getElementById("win-claim-btn").addEventListener("click", () => {
    winModal.classList.remove("active");
    document.getElementById("auth-modal").classList.add("active");
  });

  // ----------------------------------------------------------
  //  TIMER
  // ----------------------------------------------------------
  function startTimer() {
    if (!timerInterval) {
      timerInterval = setInterval(() => {
        seconds++;
        updateTimerDisplay();
      }, 1000);
    }
  }

  function stopTimer() {
    clearInterval(timerInterval);
    timerInterval = null;
  }

  function updateTimerDisplay() {
    const el = document.getElementById("timer");
    if (!el) return;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    el.textContent = `${m}:${s < 10 ? "0" : ""}${s}`;
  }

  function updateFlipDisplay() {
    const el = document.getElementById("flips");
    if (el) el.textContent = flips;
  }

  // ----------------------------------------------------------
  //  HELPERS
  // ----------------------------------------------------------
  function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function animateNavLogo() {
    const link = document.getElementById("nav-logo-link");
    if (!link || link.dataset.animated) return;
    const text   = link.textContent;
    const base   = text.slice(0, -2);
    const bigO   = text.slice(-2, -1);
    const smallO = text.slice(-1);
    link.innerHTML       = `${base}<span>${bigO}</span><span>${smallO}</span>`;
    link.dataset.animated = "true";
  }

  function initNavToggle() {
    const toggle = document.getElementById("nav-toggle");
    const links  = document.querySelector(".nav-links");
    if (!toggle || !links) return;
    toggle.addEventListener("click", () => links.classList.toggle("open"));
    links.querySelectorAll("a").forEach(a =>
      a.addEventListener("click", () => links.classList.remove("open"))
    );
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

  if (authBtn)       authBtn.addEventListener("click", () => authModal.classList.add("active"));
  if (closeModalBtn) closeModalBtn.addEventListener("click", () => authModal.classList.remove("active"));
  if (authModal) {
    authModal.addEventListener("click", e => {
      if (e.target === authModal) authModal.classList.remove("active");
    });
  }

  if (switchMode) {
    switchMode.addEventListener("click", e => {
      e.preventDefault();
      isSignUpMode = !isSignUpMode;
      const usernameInput = document.getElementById("auth-username");
      if (isSignUpMode) {
        modalTitle.textContent    = "Create Account";
        modalSubtitle.textContent = "Join retentiOo to save your high scores!";
        submitAuthBtn.textContent = "Sign Up";
        switchMode.textContent    = "Log In";
        usernameWrapper.style.display = "flex";
        if (usernameInput) usernameInput.required = true;
      } else {
        modalTitle.textContent    = "Welcome Back";
        modalSubtitle.textContent = "Log in to check your personal stats.";
        submitAuthBtn.textContent = "Log In";
        switchMode.textContent    = "Sign Up";
        usernameWrapper.style.display = "none";
        if (usernameInput) usernameInput.required = false;
      }
    });
  }

  if (authForm) {
    authForm.addEventListener("submit", e => {
      e.preventDefault();
      const username = document.getElementById("auth-username").value;
      if (authBtn) authBtn.textContent = isSignUpMode && username ? username : "Account";
      authModal.classList.remove("active");
      authForm.reset();
    });
  }

}); // end DOMContentLoaded

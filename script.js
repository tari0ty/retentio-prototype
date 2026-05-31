// ============================================================
//  retentiOo — script.js
//  Single DOMContentLoaded block. Clean merge of all systems.
// ============================================================

document.addEventListener("DOMContentLoaded", function () {

  // ----------------------------------------------------------
  //  ELEMENT REFERENCES
  // ----------------------------------------------------------
  const preloader    = document.getElementById("preloader");
  const loadingBar   = document.querySelector(".loading-bar");
  const quizScreen   = document.getElementById("quiz-screen");
  const mapScreen    = document.getElementById("map-screen");
  const gameScreen   = document.getElementById("game-screen");

  // ----------------------------------------------------------
  //  TOPIC IMAGE MAP
  //  All topics use the same 8 images for now.
  //  Later: swap in topic-specific folders, e.g. "images/animals/img-1.png"
  // ----------------------------------------------------------
  const TOPIC_IMAGES = {
    animals: [1,2,3,4,5,6,7,8].map(n => `images/img-${n}.png`),
    space:   [1,2,3,4,5,6,7,8].map(n => `images/img-${n}.png`),
    dinos:   [1,2,3,4,5,6,7,8].map(n => `images/img-${n}.png`),
    ocean:   [1,2,3,4,5,6,7,8].map(n => `images/img-${n}.png`),
  };

  // ----------------------------------------------------------
  //  LEVEL CONFIG
  //  Level 1 = 3 pairs (6 cards), +1 pair every level, up to 12 pairs at level 10.
  //  Grid columns: 2 cols for levels 1-2, 3 cols for levels 3-5, 4 cols for levels 6-10.
  // ----------------------------------------------------------
  const LEVEL_CONFIG = {
    1:  { pairs: 3,  cols: 2 },
    2:  { pairs: 4,  cols: 2 },
    3:  { pairs: 5,  cols: 3 },
    4:  { pairs: 6,  cols: 3 },
    5:  { pairs: 7,  cols: 3 },  // 14 cards — 3 cols gives 5 rows (last row has 2)
    6:  { pairs: 8,  cols: 4 },
    7:  { pairs: 9,  cols: 4 },  // 18 cards — uses img-1 to img-8, img-1 repeated once
    8:  { pairs: 10, cols: 4 },
    9:  { pairs: 11, cols: 4 },
    10: { pairs: 12, cols: 4 },
  };

  const AVATAR_EMOJI = { unicorn: "🦄", dragon: "🐲", robot: "🤖", alien: "👽" };

  // Player profile — filled by quiz or loaded from storage
  let activeProfile = { topic: "", reward: "", avatar: "", currentLevel: 1 };

  // ----------------------------------------------------------
  //  GAME STATE VARIABLES
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
  //  PHASE 1 — PRELOADER
  // ----------------------------------------------------------
  const LOAD_DURATION = 2500; // ms

  if (preloader && loadingBar) {
    loadingBar.style.transitionDuration = `${LOAD_DURATION}ms`;

    // Small delay so browser registers 0% before animating to 100%
    setTimeout(() => { loadingBar.style.width = "100%"; }, 50);

    setTimeout(() => {
      preloader.classList.add("preloader-fade-out");

      setTimeout(() => {
        preloader.remove();

        // Check for a saved profile (returning player)
        const saved = localStorage.getItem("retentiOo_profile");
        if (saved) {
          activeProfile = JSON.parse(saved);
          launchAdventureMap();
        } else {
          // New player — show quiz
          quizScreen.classList.remove("hidden-layer");
        }
      }, 500); // matches CSS fade duration

    }, LOAD_DURATION + 50);
  }


  // ----------------------------------------------------------
  //  PHASE 2 — ONBOARDING QUIZ
  // ----------------------------------------------------------

  // Step 1: Topic selection
  document.querySelectorAll("#step-1 .kid-card").forEach(btn => {
    btn.addEventListener("click", function () {
      activeProfile.topic = this.dataset.topic;
      showStep("step-1", "step-2", "star-2");
    });
  });

  // Step 2: Reward selection
  document.querySelectorAll("#step-2 .kid-card").forEach(btn => {
    btn.addEventListener("click", function () {
      activeProfile.reward = this.dataset.reward;
      showStep("step-2", "step-3", "star-3");
    });
  });

  // Step 3: Avatar selection — save profile and go to map
  document.querySelectorAll("#step-3 .kid-card").forEach(btn => {
    btn.addEventListener("click", function () {
      activeProfile.avatar = this.dataset.avatar;
      localStorage.setItem("retentiOo_profile", JSON.stringify(activeProfile));
      quizScreen.classList.add("hidden-layer");
      launchAdventureMap();
    });
  });

  // Helper: hide one step, show the next, activate the progress star
  function showStep(hideId, showId, starId) {
    document.getElementById(hideId).classList.add("hidden-layer");
    document.getElementById(showId).classList.remove("hidden-layer");
    document.getElementById(starId).classList.add("active");
  }


  // ----------------------------------------------------------
  //  PHASE 3 — ADVENTURE MAP
  // ----------------------------------------------------------
  function launchAdventureMap() {
    // Show avatar in header
    document.getElementById("map-avatar").textContent =
      AVATAR_EMOJI[activeProfile.avatar] || "🦄";

    mapScreen.classList.remove("hidden-layer");
  }

  // Level node clicks
  document.querySelectorAll(".level-node").forEach(node => {
    node.addEventListener("click", function () {
      if (!this.disabled) {
        activeProfile.currentLevel = parseInt(this.dataset.level);
        mapScreen.classList.add("hidden-layer");
        launchCoreGameBoard(activeProfile.topic, activeProfile.currentLevel);
      }
    });
  });


  // ----------------------------------------------------------
  //  PHASE 4 — GAME BOARD
  // ----------------------------------------------------------
  function launchCoreGameBoard(topic, level) {
    // Update stat labels
    document.getElementById("current-subject-label").textContent = topic.toUpperCase();
    document.getElementById("current-level-label").textContent   = level;

    // Animate logo letters in navbar
    animateNavLogo();

    // Show the game screen
    gameScreen.classList.remove("hidden-layer");

    // Build and shuffle the cards for this level
    buildAndShuffleCards(topic, level);

    // Wire up mobile nav toggle
    initNavToggle();
  }


  // ----------------------------------------------------------
  //  CARD BUILDER
  //  Builds the correct number of pairs for the current level,
  //  sets the grid column count, shuffles, and injects into DOM.
  // ----------------------------------------------------------
  function buildAndShuffleCards(topic, level) {
    const cardGrid  = document.getElementById("game-cards");
    const allImages = TOPIC_IMAGES[topic] || TOPIC_IMAGES["animals"];
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

    // Build image pool for this level.
    // If we need more pairs than unique images, cycle back through.
    const imagePool = [];
    for (let i = 0; i < pairCount; i++) {
      imagePool.push(allImages[i % allImages.length]);
    }

    // Make pairs array and shuffle
    const pairs = [...imagePool, ...imagePool];
    shuffleArray(pairs);

    // Switch to grid layout and set column count
    cardGrid.style.display             = "grid";
    cardGrid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    cardGrid.style.height              = "auto";

    // Clear old cards
    cardGrid.innerHTML = "";

    // Build card elements
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

    // Ignore if same card clicked twice or deck is locked
    if (clicked === cardOne || disableDeck) return;

    // Start timer on first flip
    startTimer();

    flips++;
    updateFlipDisplay();
    clicked.classList.add("flip");

    if (!cardOne) {
      cardOne = clicked;
      return;
    }

    // Second card picked — check match
    cardTwo = clicked;
    disableDeck = true;

    const imgOne = cardOne.querySelector("img").src;
    const imgTwo = cardTwo.querySelector("img").src;
    checkMatch(imgOne, imgTwo);
  }

  function checkMatch(img1, img2) {
    if (img1 === img2) {
      // Match — lock these cards
      matchedCount++;
      cardOne.removeEventListener("click", flipCard);
      cardTwo.removeEventListener("click", flipCard);
      cardOne = cardTwo = null;
      disableDeck = false;

      // All pairs matched — win condition
      if (matchedCount === totalPairs) {
        stopTimer();
        setTimeout(() => {
          alert(`Level ${activeProfile.currentLevel} complete! Flips: ${flips} | Time: ${document.getElementById("timer").textContent}`);

          // Unlock the next level on the map
          const nextLevel = activeProfile.currentLevel + 1;
          if (nextLevel <= 10) {
            const nextNode = document.querySelector(`.level-node[data-level="${nextLevel}"]`);
            if (nextNode) {
              nextNode.disabled = false;
              nextNode.classList.remove("locked-level");
              nextNode.classList.add("active-level");
              nextNode.innerHTML = `<span class="level-number">${nextLevel}</span><span class="level-status">▶️</span>`;
            }
            activeProfile.currentLevel = nextLevel;
            localStorage.setItem("retentiOo_profile", JSON.stringify(activeProfile));
          }

          // Return to map
          gameScreen.classList.add("hidden-layer");
          launchAdventureMap();
        }, 600);
      }

    } else {
      // No match — shake and flip back
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

  // Fisher-Yates shuffle
  function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  // Animate the two Os in the nav logo
  function animateNavLogo() {
    const link = document.getElementById("nav-logo-link");
    if (!link || link.dataset.animated) return;
    const text    = link.textContent;
    const base    = text.slice(0, -2);
    const bigO    = text.slice(-2, -1);
    const smallO  = text.slice(-1);
    link.innerHTML = `${base}<span>${bigO}</span><span>${smallO}</span>`;
    link.dataset.animated = "true";
  }

  // Mobile nav toggle
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
  const authBtn       = document.getElementById("auth-btn");
  const authModal     = document.getElementById("auth-modal");
  const closeModalBtn = document.getElementById("close-modal-btn");
  const authForm      = document.getElementById("auth-form");
  const switchMode    = document.getElementById("switch-auth-mode");

  const modalTitle    = document.getElementById("modal-title");
  const modalSubtitle = document.getElementById("modal-subtitle");
  const submitAuthBtn = document.getElementById("submit-auth-btn");
  const usernameWrapper = document.getElementById("username-wrapper");

  let isSignUpMode = true;

  if (authBtn) {
    authBtn.addEventListener("click", () => authModal.classList.add("active"));
  }

  if (closeModalBtn) {
    closeModalBtn.addEventListener("click", () => authModal.classList.remove("active"));
  }

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

      // Update navbar button to show username (placeholder until backend)
      if (authBtn) {
        authBtn.textContent = isSignUpMode && username ? username : "Account";
      }

      authModal.classList.remove("active");
      authForm.reset();
    });
  }

}); // end DOMContentLoaded

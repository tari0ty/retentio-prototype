// ============================================================
//  retentiOo — script.js
// ============================================================
document.addEventListener("DOMContentLoaded", function () {

  // ----------------------------------------------------------
  //  DATA
  // ----------------------------------------------------------
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

  // Mock players for ranked
  const MOCK_PLAYERS = [
    { nickname:"SuperBrain",  avatar:"unicorn" },
    { nickname:"DragonKid",   avatar:"dragon"  },
    { nickname:"RoboMaster",  avatar:"robot"   },
    { nickname:"AlienGenius", avatar:"alien"   },
    { nickname:"StarChaser",  avatar:"unicorn" },
    { nickname:"FlipKing",    avatar:"dragon"  },
    { nickname:"MemoryAce",   avatar:"robot"   },
    { nickname:"QuickMatch",  avatar:"alien"   },
    { nickname:"CardShark",   avatar:"unicorn" },
  ];

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
    totalFlips:0, totalSeconds:0
  };
  let isLoggedIn = false;

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
  let livePlayerIntervals=[];

  // ----------------------------------------------------------
  //  ELEMENTS
  // ----------------------------------------------------------
  const preloader            = document.getElementById("preloader");
  const loadingBar           = document.querySelector(".loading-bar");
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
    [gameModeScreen,questSelectScreen,mapScreen,gameScreen,
     rankedVoteScreen,rankedWaitingScreen,rankedGameScreen,
     rankedResultsScreen,profileScreen,leaderboardScreen].forEach(s=>{
      if(s) s.classList.add("hidden-layer");
    });
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
  if(preloader&&loadingBar){
    loadingBar.style.transitionDuration=`${LOAD_DURATION}ms`;
    setTimeout(()=>{loadingBar.style.width="100%";},50);
    setTimeout(()=>{
      preloader.classList.add("preloader-fade-out");
      setTimeout(()=>{
        preloader.remove();
        const saved=localStorage.getItem("retentiOo_profile");
        if(saved){
          const p=JSON.parse(saved);
          activeProfile=Object.assign({},activeProfile,p);
          if(!activeProfile.stars) activeProfile.stars={1:{},2:{},3:{},4:{},5:{}};
          if(!activeProfile.unlockedQuests) activeProfile.unlockedQuests=[1];
          if(!activeProfile.unlockedLevels) activeProfile.unlockedLevels={1:1,2:1,3:1,4:1,5:1};
          if(!activeProfile.bestStats) activeProfile.bestStats={};
          launchGameMode();
        } else { showTutorial(); }
      },500);
    },LOAD_DURATION+50);
  }

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

  document.getElementById("t-next-3").addEventListener("click",()=>{
    clearInterval(step3Timer);
    tutorialScreen.classList.add("hidden-layer");
    quizScreen.classList.remove("hidden-layer");
  });

  document.getElementById("tutorial-skip").addEventListener("click",()=>{
    clearInterval(step3Timer);
    tutorialScreen.classList.add("hidden-layer");
    quizScreen.classList.remove("hidden-layer");
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
      localStorage.setItem("retentiOo_profile",JSON.stringify(activeProfile));
      quizScreen.classList.add("hidden-layer");
      launchGameMode();
    });
  });

  // ----------------------------------------------------------
  //  GAME MODE SCREEN
  // ----------------------------------------------------------
  function launchGameMode(){
    hideAll();
    const avatar=AVATAR_EMOJI[activeProfile.avatar]||"🦄";
    const nickname=activeProfile.nickname||"Player";
    document.getElementById("gm-avatar").textContent=avatar;
    document.getElementById("gm-playername").textContent=nickname;
    const authBtn=document.getElementById("auth-btn");
    if(authBtn&&isLoggedIn) authBtn.textContent=nickname;
    gameModeScreen.classList.remove("hidden-layer");
  }

  document.getElementById("adventure-mode-btn").addEventListener("click",()=>{
    gameModeScreen.classList.add("hidden-layer");
    launchQuestSelect();
  });

  document.getElementById("ranked-mode-btn").addEventListener("click",()=>{
    gameModeScreen.classList.add("hidden-layer");
    launchRankedVote();
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
    const quest=QUESTS.find(q=>q.id===questId);
    const subTopic=quest.levels[level-1];
    document.getElementById("current-subject-label").textContent=`${quest.emoji} ${subTopic}`;
    document.getElementById("current-level-label").textContent=level;
    animateNavLogo("nav-logo-link");
    initNavToggle();
    gameScreen.classList.remove("hidden-layer");
    buildAndShuffleCards(quest.subject,level,"game-cards",false);
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
    shuffleArray(pairs);

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
      if(isRanked){ rankedCardOne=rankedCardTwo=null; rankedDisable=false;
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
  //  RANKED FLOW
  // ----------------------------------------------------------
  function launchRankedVote(){
    hideAll();
    document.getElementById("rv-avatar").textContent=AVATAR_EMOJI[activeProfile.avatar]||"🦄";
    document.getElementById("rv-name").textContent=activeProfile.nickname||"Player";

    // Mock votes — randomised
    const mockVotes={};
    QUESTS.forEach(q=>{ mockVotes[q.subject]=Math.floor(Math.random()*5)+1; });

    const voteGrid=document.getElementById("vote-grid");
    const voteResults=document.getElementById("vote-results");
    const confirmBtn=document.getElementById("vote-confirm-btn");
    voteGrid.innerHTML=""; voteResults.innerHTML="";
    rankedVote="";

    QUESTS.forEach(quest=>{
      const btn=document.createElement("button");
      btn.className="vote-card";
      btn.dataset.subject=quest.subject;
      btn.innerHTML=`<span class="vote-emoji">${quest.emoji}</span><span class="vote-label">${quest.subject}</span>`;
      btn.addEventListener("click",()=>{
        document.querySelectorAll(".vote-card").forEach(b=>b.classList.remove("vote-selected"));
        btn.classList.add("vote-selected");
        rankedVote=quest.subject;
        mockVotes[quest.subject]=(mockVotes[quest.subject]||0)+1;
        confirmBtn.classList.remove("hidden-layer");

        // Show vote results
        voteResults.innerHTML="";
        const sorted=QUESTS.slice().sort((a,b)=>(mockVotes[b.subject]||0)-(mockVotes[a.subject]||0));
        sorted.forEach(q=>{
          const total=Object.values(mockVotes).reduce((a,b)=>a+b,0);
          const pct=Math.round(((mockVotes[q.subject]||0)/total)*100);
          const bar=document.createElement("div");
          bar.className="vote-bar-row";
          bar.innerHTML=`
            <span class="vote-bar-label">${q.emoji} ${q.subject}</span>
            <div class="vote-bar-track"><div class="vote-bar-fill" style="width:${pct}%"></div></div>
            <span class="vote-bar-pct">${pct}%</span>
          `;
          voteResults.appendChild(bar);
        });
      });
      voteGrid.appendChild(btn);
    });

    confirmBtn.addEventListener("click",()=>{
      // Winner = highest voted
      const winner=QUESTS.reduce((a,b)=>
        (mockVotes[a.subject]||0)>=(mockVotes[b.subject]||0)?a:b
      );
      rankedTopic=winner.subject;
      launchRankedWaiting();
    },{once:true});

    rankedVoteScreen.classList.remove("hidden-layer");
  }

  document.getElementById("back-from-vote").addEventListener("click",()=>{
    rankedVoteScreen.classList.add("hidden-layer");
    launchGameMode();
  });

  function launchRankedWaiting(){
    rankedVoteScreen.classList.add("hidden-layer");
    const quest=QUESTS.find(q=>q.subject===rankedTopic);
    document.getElementById("ranked-topic-label").textContent=`Topic: ${quest.subject} ${quest.emoji}`;

    // Build waiting room with mock players + current player
    const waitingRoom=document.getElementById("waiting-room");
    waitingRoom.innerHTML="";
    const allPlayers=[...MOCK_PLAYERS,{nickname:activeProfile.nickname||"You",avatar:activeProfile.avatar}];
    allPlayers.forEach(p=>{
      const div=document.createElement("div");
      div.className="waiting-player";
      div.innerHTML=`<span class="waiting-avatar">${AVATAR_EMOJI[p.avatar]||"🦄"}</span><span class="waiting-name">${p.nickname}</span><span class="waiting-ready">✓</span>`;
      waitingRoom.appendChild(div);
    });

    // Countdown 5→0 then start
    let count=5;
    const countEl=document.getElementById("waiting-timer");
    countEl.textContent=count;
    rankedWaitingScreen.classList.remove("hidden-layer");

    const countInterval=setInterval(()=>{
      count--;
      countEl.textContent=count;
      if(count===0){
        clearInterval(countInterval);
        rankedWaitingScreen.classList.add("hidden-layer");
        launchRankedGame();
      }
    },1000);
  }

  function launchRankedGame(){
    const quest=QUESTS.find(q=>q.subject===rankedTopic);
    rankedSeconds=120; rankedFlips=0; rankedMatchedCount=0;
    rankedCardOne=rankedCardTwo=null; rankedDisable=false;

    document.getElementById("ranked-topic-hud").textContent=`${quest.emoji} ${quest.subject}`;
    document.getElementById("ranked-flips").textContent=0;
    updateRankedTimerDisplay();

    rankedGameScreen.classList.remove("hidden-layer");
    animateNavLogo("ranked-logo");

    buildAndShuffleCards(rankedTopic,6,"ranked-cards",true);
    buildLivePlayersPanel();
    startRankedTimer();
  }

  // ----------------------------------------------------------
  //  RANKED FLIP LOGIC
  // ----------------------------------------------------------
  function flipRankedCard(e){
    const clicked=e.currentTarget;
    if(clicked===rankedCardOne||rankedDisable) return;
    rankedFlips++; updateRankedFlipDisplay();
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

  function endRankedGame(completed){
    clearInterval(rankedInterval);
    livePlayerIntervals.forEach(i=>clearInterval(i));
    livePlayerIntervals=[];
    const timeTaken=120-rankedSeconds;
    showRankedResults(completed,timeTaken);
  }

  // ----------------------------------------------------------
  //  LIVE PLAYERS PANEL
  // ----------------------------------------------------------
  function buildLivePlayersPanel(){
    const panel=document.getElementById("live-players-panel");
    panel.innerHTML="<div class='live-panel-title'>⚔️ Live Players</div>";
    livePlayerIntervals.forEach(i=>clearInterval(i));
    livePlayerIntervals=[];

    const allPlayers=[
      ...MOCK_PLAYERS,
      {nickname:activeProfile.nickname||"You",avatar:activeProfile.avatar,isMe:true}
    ];

    allPlayers.forEach(p=>{
      const div=document.createElement("div");
      div.className=`live-player ${p.isMe?"live-player-me":""}`;
      div.id=`lp-${p.nickname.replace(/\s/g,"")}`;
      div.innerHTML=`
        <span class="lp-avatar">${AVATAR_EMOJI[p.avatar]||"🦄"}</span>
        <div class="lp-info">
          <span class="lp-name">${p.nickname}${p.isMe?" (You)":""}</span>
          <div class="lp-bar-track"><div class="lp-bar-fill" id="lpbar-${p.nickname.replace(/\s/g,"")}" style="width:0%"></div></div>
        </div>
        <span class="lp-pairs" id="lppairs-${p.nickname.replace(/\s/g,"")}">0/8</span>
      `;
      panel.appendChild(div);

      // Simulate mock player progress
      if(!p.isMe){
        let mockPairs=0;
        const interval=setInterval(()=>{
          if(mockPairs<8){
            const chance=Math.random();
            if(chance>0.4){
              mockPairs=Math.min(8,mockPairs+1);
              const pct=(mockPairs/8)*100;
              const barEl=document.getElementById(`lpbar-${p.nickname.replace(/\s/g,"")}`);
              const pairsEl=document.getElementById(`lppairs-${p.nickname.replace(/\s/g,"")}`);
              if(barEl) barEl.style.width=`${pct}%`;
              if(pairsEl) pairsEl.textContent=`${mockPairs}/8`;
            }
          } else { clearInterval(interval); }
        },Math.floor(Math.random()*3000)+2000);
        livePlayerIntervals.push(interval);
      }
    });
  }

  // Update my own progress bar during ranked
  function updateMyLiveProgress(){
    const pct=(rankedMatchedCount/8)*100;
    const barEl=document.getElementById(`lpbar-${(activeProfile.nickname||"You").replace(/\s/g,"")}`);
    const pairsEl=document.getElementById(`lppairs-${(activeProfile.nickname||"You").replace(/\s/g,"")}`);
    if(barEl) barEl.style.width=`${pct}%`;
    if(pairsEl) pairsEl.textContent=`${rankedMatchedCount}/8`;
  }

  // Hook into ranked match count
  const origCheckMatch=checkMatch;

  // ----------------------------------------------------------
  //  RANKED RESULTS
  // ----------------------------------------------------------
  function showRankedResults(completed,timeTaken){
    rankedGameScreen.classList.add("hidden-layer");
    const quest=QUESTS.find(q=>q.subject===rankedTopic);
    const myScore=calcRankedScore(rankedFlips,timeTaken);

    // Generate mock results
    const mockResults=MOCK_PLAYERS.map(p=>({
      nickname:p.nickname,
      avatar:p.avatar,
      flips:Math.floor(Math.random()*20)+8,
      time:Math.floor(Math.random()*80)+20,
      get score(){ return calcRankedScore(this.flips,this.time); }
    }));

    const myResult={
      nickname:activeProfile.nickname||"You",
      avatar:activeProfile.avatar,
      flips:rankedFlips,
      time:timeTaken,
      score:myScore,
      isMe:true
    };

    const allResults=[...mockResults,myResult].sort((a,b)=>a.score-b.score);
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

  document.getElementById("play-again-ranked-btn").addEventListener("click",()=>{
    rankedResultsScreen.classList.add("hidden-layer");
    launchRankedVote();
  });

  document.getElementById("back-to-mode-btn").addEventListener("click",()=>{
    rankedResultsScreen.classList.add("hidden-layer");
    launchGameMode();
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
          await navigator.share({ files:[file], title:"retentiOo", text });
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
    const text=`I just completed "${topic}" with ${document.getElementById("win-flips").textContent} flips in ${document.getElementById("win-time").textContent}! ${renderStarString(stars)}\nPlay at ${GAME_URL}`;
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
    const text=`I ranked ${rank} of 10 in a Ranked match on retentiOo!\nTopic: ${topic} | ${flips} flips | ${time}\nPlay at ${GAME_URL}`;
    shareCard("ranked-share-card",text);
  });

  // ----------------------------------------------------------
  //  WIN MODAL (Adventure)
  // ----------------------------------------------------------
  function showWinModal(){
    const questId=activeProfile.currentQuest;
    const level=activeProfile.currentLevel;
    const quest=QUESTS.find(q=>q.id===questId);
    const subTopic=quest.levels[level-1];
    const config=LEVEL_CONFIG[level];
    const earned=calcStars(config.pairs,flips);
    const timeStr=document.getElementById("timer").textContent;

    if(!activeProfile.stars[questId]) activeProfile.stars[questId]={};
    activeProfile.stars[questId][level]=Math.max(activeProfile.stars[questId][level]||0,earned);

    const subject=quest.subject;
    if(!activeProfile.bestStats[subject]){
      activeProfile.bestStats[subject]={flips,time:seconds};
    } else {
      if(flips<activeProfile.bestStats[subject].flips) activeProfile.bestStats[subject].flips=flips;
      if(seconds<activeProfile.bestStats[subject].time) activeProfile.bestStats[subject].time=seconds;
    }

    activeProfile.totalFlips=(activeProfile.totalFlips||0)+flips;
    activeProfile.totalSeconds=(activeProfile.totalSeconds||0)+seconds;

    const nextLevel=level+1;
    if(nextLevel<=10){
      activeProfile.unlockedLevels[questId]=Math.max(activeProfile.unlockedLevels[questId]||1,nextLevel);
    } else {
      const nextQuest=questId+1;
      if(nextQuest<=5&&!activeProfile.unlockedQuests.includes(nextQuest)){
        activeProfile.unlockedQuests.push(nextQuest);
        activeProfile.unlockedLevels[nextQuest]=1;
      }
    }

    localStorage.setItem("retentiOo_profile",JSON.stringify(activeProfile));

    document.getElementById("win-title").textContent=`Level ${level} Complete!`;
    document.getElementById("win-quest-label").textContent=`${quest.subject} ${quest.emoji} — ${subTopic}`;
    document.getElementById("win-time").textContent=timeStr;
    document.getElementById("win-flips").textContent=flips;
    const best=activeProfile.bestStats[subject];
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
    const questId=activeProfile.currentQuest;
    const nextLevel=activeProfile.currentLevel+1;
    if(nextLevel<=10){
      activeProfile.currentLevel=nextLevel;
      const quest=QUESTS.find(q=>q.id===questId);
      const subTopic=quest.levels[nextLevel-1];
      document.getElementById("current-level-label").textContent=nextLevel;
      document.getElementById("current-subject-label").textContent=`${quest.emoji} ${subTopic}`;
      buildAndShuffleCards(quest.subject,nextLevel,"game-cards",false);
    } else {
      gameScreen.classList.add("hidden-layer");
      launchQuestSelect();
    }
  });

  document.getElementById("win-claim-btn").addEventListener("click",()=>{
    winModal.classList.remove("active");
    document.getElementById("auth-modal").classList.add("active");
  });

  // ----------------------------------------------------------
  //  PROFILE SCREEN
  // ----------------------------------------------------------
  function launchProfileScreen(){
    hideAll();
    const avatar=AVATAR_EMOJI[activeProfile.avatar]||"🦄";
    const nickname=activeProfile.nickname||"Player";
    const quest=QUESTS.find(q=>q.id===activeProfile.currentQuest);
    document.getElementById("profile-avatar").textContent=avatar;
    document.getElementById("profile-name").textContent=nickname;
    document.getElementById("profile-badge").textContent=`${quest?quest.name:"Quest 1"} · Level ${activeProfile.currentLevel}`;

    const allPlayers=getPlaceholderPlayers();
    allPlayers.push(activeProfile);
    const rank=getGlobalRank(activeProfile,allPlayers);
    document.getElementById("profile-rank-badge").textContent=`🏆 Global Rank #${rank}`;

    const progressCards=document.getElementById("progress-cards");
    progressCards.innerHTML="";
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
    launchGameMode();
  });

  // ----------------------------------------------------------
  //  LEADERBOARD
  // ----------------------------------------------------------
  function launchLeaderboard(){
    hideAll();
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
    launchGameMode();
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
    launchQuestSelect();
  });

  document.getElementById("nav-ranked-link").addEventListener("click",e=>{
    e.preventDefault();
    gameScreen.classList.add("hidden-layer");
    launchRankedVote();
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
  const authForm=document.getElementById("auth-form");
  const switchMode=document.getElementById("switch-auth-mode");
  const modalTitle=document.getElementById("modal-title");
  const modalSubtitle=document.getElementById("modal-subtitle");
  const submitAuthBtn=document.getElementById("submit-auth-btn");
  const usernameWrapper=document.getElementById("username-wrapper");
  let isSignUpMode=true;

  if(authBtn) authBtn.addEventListener("click",()=>{ if(isLoggedIn){ launchProfileScreen(); } else { authModal.classList.add("active"); } });
  if(closeModalBtn) closeModalBtn.addEventListener("click",()=>authModal.classList.remove("active"));
  if(authModal) authModal.addEventListener("click",e=>{ if(e.target===authModal) authModal.classList.remove("active"); });

  if(switchMode){
    switchMode.addEventListener("click",e=>{
      e.preventDefault(); isSignUpMode=!isSignUpMode;
      const usernameInput=document.getElementById("auth-username");
      if(isSignUpMode){
        modalTitle.textContent="Create Account";
        modalSubtitle.textContent="Join retentiOo to save your high scores!";
        submitAuthBtn.textContent="Sign Up"; switchMode.textContent="Log In";
        usernameWrapper.style.display="flex";
        if(usernameInput) usernameInput.required=true;
      } else {
        modalTitle.textContent="Welcome Back";
        modalSubtitle.textContent="Log in to check your personal stats.";
        submitAuthBtn.textContent="Log In"; switchMode.textContent="Sign Up";
        usernameWrapper.style.display="none";
        if(usernameInput) usernameInput.required=false;
      }
    });
  }

  if(authForm){
    authForm.addEventListener("submit",e=>{
      e.preventDefault();
      const username=document.getElementById("auth-username").value;
      isLoggedIn=true;
      if(authBtn) authBtn.textContent=username||activeProfile.nickname||"Account";
      authModal.classList.remove("active");
      authForm.reset();
    });
  }

}); // end DOMContentLoaded

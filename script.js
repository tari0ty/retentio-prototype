// ==========================================
//  GAME CORE LOGIC & SHUFFLING ENGINE
// ==========================================

const cards = document.querySelectorAll('.card');
const timerEl = document.getElementById('timer');
const flipsEl = document.getElementById('flips');

let matchedCard = 0;
let cardOne, cardTwo;
let disableDeck = false;
let flips = 0;
let seconds = 0;
let timerInterval = null;

function startTimer() {
    if (!timerInterval) {
        timerInterval = setInterval(() => {
            seconds++;
            const mins = Math.floor(seconds / 60);
            const secs = seconds % 60;
            timerEl.textContent = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
        }, 1000);
    }
}

function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

function flipCard(e) {
    let clickedCard = e.target; // get the clicked card
    if (clickedCard !== cardOne && !disableDeck) { // if the clicked card is not same as cardOne and disableDeck value is false
        startTimer(); // Start timer on first click
        flips++; // Increment flip counter
        flipsEl.textContent = flips; // Update display
        clickedCard.classList.add("flip");
        if (!cardOne) {
            return cardOne = clickedCard;
        }
        cardTwo = clickedCard;
        disableDeck = true;
        let cardOneImg = cardOne.querySelector("img").src,
            cardTwoImg = cardTwo.querySelector("img").src;
        matchCards(cardOneImg, cardTwoImg);
    }
}

function matchCards(img1, img2) {
    if(img1 === img2) { // if two cards img matched
        matchedCard++; // increment matchedCard value by 1
        if(matchedCard == 8) {
            stopTimer(); // Stop timer when game ends
            setTimeout(() => {
                return shuffleCard();
            }, 1000); 
        } 
        
        cardOne.removeEventListener("click", flipCard);
        cardTwo.removeEventListener("click", flipCard);
        cardOne = cardTwo = "";
        return disableDeck =  false;
    }
    
    // if two cards img didn't match
    setTimeout(() => {
        //add shake class to both cards after 400ms
        cardOne.classList.add("shake");
        cardTwo.classList.add("shake");
    }, 300);

    setTimeout(() => {
        //remove shake and flip class from both cards after 1200ms
        cardOne.classList.remove("shake", "flip");
        cardTwo.classList.remove("shake", "flip");
        cardOne = cardTwo = ""; // return cardOne and cardTwo value to blank
        disableDeck = false;
    }, 1200);
}

function shuffleCard() {
    matchedCard = 0;
    cardOne = cardTwo = "";
    disableDeck = false;
    flips = 0; // Reset flips
    seconds = 0; // Reset timer
    flipsEl.textContent = flips;
    timerEl.textContent = "0:00";
    stopTimer();
    // create an array of 16 items, each item is a number from 1 to 8, and each number appears twice
    let arr = [1, 2, 3, 4, 5, 6, 7, 8, 1, 2, 3, 4, 5, 6, 7, 8];
    arr.sort(() => Math.random() > 0.5 ? 1 : -1);

    // remove flip class from all cards and shuffle cards
    cards.forEach((card, index) => { 
        card.classList.remove("flip");
        let imgTag = card.querySelector("img");
        imgTag.src = `images/img-${arr[index]}.png`;
        card.addEventListener("click", flipCard);
    });
}

shuffleCard();

cards.forEach(card => { // add event listener to each card
    card.addEventListener("click", flipCard);
});

// Mobile nav toggle
const navToggle = document.getElementById('nav-toggle');
const navLinks = document.querySelector('.nav-links');
if(navToggle && navLinks){
    navToggle.addEventListener('click', () => {
        navLinks.classList.toggle('open');
    });
    // close menu when a link is clicked
    navLinks.querySelectorAll('a').forEach(a => a.addEventListener('click', ()=> navLinks.classList.remove('open')));
}


// ==========================================
//  PLAYER AUTHENTICATION & MODAL MANAGEMENT
// ==========================================

const authBtn = document.getElementById('auth-btn'); // Your navbar sign up button
const authModal = document.getElementById('auth-modal');
const closeModalBtn = document.getElementById('close-modal-btn');
const authForm = document.getElementById('auth-form');
const switchAuthMode = document.getElementById('switch-auth-mode');

const modalTitle = document.getElementById('modal-title');
const modalSubtitle = document.getElementById('modal-subtitle');
const submitAuthBtn = document.getElementById('submit-auth-btn');
const usernameWrapper = document.getElementById('username-wrapper');

let isSignUpMode = true;

// 1. Reveal modal overlay when clicking navbar button
if (authBtn) {
    authBtn.addEventListener('click', () => {
        authModal.classList.add('active');
    });
}

// 2. Hide modal overlay when clicking the 'X' button
if (closeModalBtn) {
    closeModalBtn.addEventListener('click', () => {
        authModal.classList.remove('active');
    });
}

// 3. Hide modal window if user clicks the dark blurred area outside the form card
if (authModal) {
    authModal.addEventListener('click', (e) => {
        if (e.target === authModal) {
            authModal.classList.remove('active');
        }
    });
}

// 4. Toggle text values and fields smoothly between Sign Up and Log In styles
if (switchAuthMode) {
    switchAuthMode.addEventListener('click', (e) => {
        e.preventDefault();
        isSignUpMode = !isSignUpMode;

        const usernameInput = document.getElementById('auth-username');

        if (isSignUpMode) {
            modalTitle.textContent = "Create Account";
            modalSubtitle.textContent = "Join retentiOo to save your high scores!";
            submitAuthBtn.textContent = "Sign Up";
            switchAuthMode.textContent = "Log In";
            if (usernameWrapper) usernameWrapper.style.display = "flex";
            if (usernameInput) usernameInput.required = true;
        } else {
            modalTitle.textContent = "Welcome Back";
            modalSubtitle.textContent = "Log in to check your personal stats.";
            submitAuthBtn.textContent = "Log In";
            switchAuthMode.textContent = "Sign Up";
            if (usernameWrapper) usernameWrapper.style.display = "none";
            if (usernameInput) usernameInput.required = false; // Prevents hidden validation blocks
        }
    });
}

// 5. Handle submission event to close modal card and return player directly to the game
if (authForm) {
    authForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const email = document.getElementById('auth-email').value;
        const password = document.getElementById('auth-password').value;
        const username = document.getElementById('auth-username').value;

        // Visual tracking log in developer console
        console.log(`Auth request context: Mode=${isSignUpMode ? 'SignUp' : 'Login'}, Email=${email}`);

        // Hide overlay safely to drop user back on active deck board
        authModal.classList.remove('active');

        // Dynamically shift navbar registration label to state user profile context
        if (authBtn) {
            authBtn.textContent = isSignUpMode && username ? username : "Account";
        }

        // Clean form out for subsequent validation tasks
        authForm.reset();
    });
}

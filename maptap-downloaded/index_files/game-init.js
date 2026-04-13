// game-init.js - Game initialization and configuration
// This file contains all global variable declarations and initialization logic

// Report page version (commented out - version not defined)
// report("page_version", "access", "Page Version", version);

// URL Parameters
let PARAMS = {
    letmeplay: "0",
    overrideday: "",
    tutorial: "0",
    resetstorage: "0",
    editmode: "0",
    puzzleId: 0,
    devmode: "0",  // Auto-enabled when using test parameters
    show: "",  // Show and highlight a specific region (e.g., ?show=Siberia)
    map: "",  // Custom map path (e.g., ?map=custom/andrew loads data/custom/andrew.js)
    bestof: "",  // Best-of map name (e.g., ?bestof=ted-talks loads data/practice/ted-talks.js)
    endgame: "0"  // Skip to end game screen (e.g., ?endgame=1 for testing end game display)
};

// Tutorial city configuration
let tutorialCity = {
    name: "New York City",
    lat: 40.7128,
    lng: -74.0060
};

// Parse URL parameters
updateParamsFromURL(PARAMS);

// Support simple custom map URLs like custom.html?andrew
// If there's a query string that's just a name (no = sign), treat it as a custom map
if (window.location.search && !window.location.search.includes('=')) {
    const simpleName = window.location.search.substring(1); // Remove the leading ?
    if (simpleName) {
        PARAMS.map = 'custom/' + simpleName;
    }
}

// Auto-enable devmode when using test parameters
if (PARAMS.letmeplay === "1" || PARAMS.overrideday !== "" || PARAMS.resetstorage === "1") {
    PARAMS.devmode = "1";
    console.log("DevMode auto-enabled due to test parameters");
}

// PAGE - DOM element references
let PAGE = {
    globeContainer:   document.getElementById('globeViz'),
    scoreOutput:      document.getElementById('score'),

    shareButton:      document.getElementById('share-button'),
    shareText:        document.getElementById('share-text'),
    shareCopy:        document.getElementById('share-copy'),
    shareTextInner:   document.getElementById('scoreTextDisplay'),

    buttonContainer:  document.getElementById('bottom-bar'),
    toast:            document.getElementById('toast'),

    // Tap confirmation elements
    tapConfirmButtons : document.getElementById('tap-confirm-buttons'),
    confirmGuessButton: document.getElementById('confirm-guess-button'),
    clearGuessButton  : document.getElementById('clear-guess-button'),

    // Settings elements
    settingsModal     : document.getElementById('settingsModal'),
    settingsClose     : document.getElementById('settings-close-button'),
    soundCheckbox     : document.getElementById('sound-checkbox'),
    confirmTapCheckbox: document.getElementById('confirm-tap-checkbox'),
    showGuessesCheckbox: document.getElementById('show-guesses-checkbox'),

    // Settings auth elements
    settingsLoggedIn  : document.getElementById('settings-logged-in'),
    settingsLoggedOut : document.getElementById('settings-logged-out'),
    settingsUserEmail : document.getElementById('settings-user-email'),
    settingsLogoutButton: document.getElementById('settings-logout-button'),
    settingsLoginButton: document.getElementById('settings-login-button')
};

// UI - Extend the UI object defined in ui.js with additional properties
// UI is already declared in ui.js, we just add more properties here
UI.topBarLeft = null;
UI.topBarCenter = null;
UI.topBarRight = null;
UI.canvas = null;
UI.ctx = null;

// Extend UI.init to initialize game-init specific elements
(function() {
    const originalInit = UI.init;
    UI.init = function() {
        // Call original init from ui.js
        if (originalInit) originalInit.call(this);

        // Initialize game-init specific elements
        this.topBarLeft = document.getElementById('topbar_left');
        this.topBarCenter = document.getElementById('topbar_center');
        this.topBarRight = document.getElementById('topbar_right');
        this.canvas = document.getElementById("canvas");

        if (this.canvas) {
            this.ctx = this.canvas.getContext('2d');
        }
    };
})();

// UI.infoShowInstant method (not in ui.js)
UI.infoShowInstant = function() {
    this.info.classList.remove('fade-out', 'fade-in');
    this.info.classList.add('no-animation');
    this.roundMeta.classList.remove('fade-out', 'fade-in');
    this.roundMeta.classList.add('no-animation');
};

// Game rules configuration
let gameRules = {
    totalRounds: 5,
    guessesPerRound: 1
};

// Runtime state
let runtime = {
    activeRoundCity: null,
    selectedCities: [],
    currentlyScoring: 0,
    savePrefix: "maptap",

    // Tap confirmation state
    awaitingConfirmation: false,
    pendingTapLat: null,
    pendingTapLng: null
};

// Use different save prefix for best-of maps (allows replay without conflicting with daily games)
if (PARAMS.bestof && PARAMS.bestof !== "") {
    runtime.savePrefix = "maptap_bestof_" + PARAMS.bestof;
    console.log('[Best-Of] Using save prefix:', runtime.savePrefix);
    // Always clear game state for best-of maps to allow replay
    // (High scores are stored separately in maptap_bestof_scores)
    localStorage.removeItem(runtime.savePrefix + "_game");
    localStorage.removeItem(runtime.savePrefix + "_history");
    console.log('[Best-Of] Cleared previous game state for replay');
}

const HISTORY_KEY = runtime.savePrefix + "_history";

// Handle storage reset if requested
if (PARAMS.resetstorage == 1) {
    if (PARAMS.overrideday !== "") {
        clearGameDataForDate(PARAMS.overrideday);
    } else {
        clearGameDataByPrefix(runtime.savePrefix);
    }
}

// Game configuration variables
let theme = "";
let arcTheJourney = 0;
let mapURL = "./assets/hi-rez-v3.jpg";
let endGameSound = "";
let planetAltitude = 1.45;
let wrapWidth = 50;
let triviaFocus = 1;
let scoreTrack = "";
let firstGame = 0;
let topFive = 0;
let arcList = [];
let fiveFromMany = 0;
let prompt = "";
let pictureLocations = [];
let currentDisplayedImageURL = null; // Track currently displayed image to avoid unnecessary DOM updates
let currentDisplayedCredit = null; // Track currently displayed credit to avoid unnecessary DOM updates
let currentDisplayedLink = null; // Track currently displayed link to avoid unnecessary DOM updates
let currentDisplayedSound = null; // Track currently displayed sound to avoid unnecessary DOM updates
let checksRemaining = 0; // Counter for checks after user interaction (end game optimization)
let arcPoints = [];
let randomAddedText = [];
let randomAddedPoles = [];
let secretMessages = [];
let playedSounds = new Set(); // Track which sounds have been played
// maptap_start is now defined in jjbasics.js

// Prototype game state
let prototypeGameState = {
    roundData: [],
    round: 1,
    guesses: 0,
    totalGuesses: 0,
    totalScore: 0,
    finalScore: 0
};

// Game history (persistent stats)
let gameHistory = {
    soundEnabled: true,
    soundSetUp: false,
    confirmTapMode: false,
    showGuesses: true,
    scrollSensitivity: 0, // 0 = Normal (Globe.GL default ~0.4), 1 = Fast, 1.5 = Very Fast
    useMiles: false,
    highScore: 0,
    streak: 0,
    topTenScores: [],
    oneThousand: 0,
    overNineHundred: 0,
    overEightHundred: 0,
    overSevenHundred: 0,
    overSixHundred: 0,
    overFiveHundred: 0,
    overZero: 0,
    lastPlay: ""
};

// Migration will be run in beta.html where the migration functions are defined

let masterHistory = JSON.parse(localStorage.getItem(HISTORY_KEY) || "{}");

// Loading screen configuration
const ENABLE_LOADING_SCREEN = false;

// Loading animation function
function startLoadingAnimation() {
    if (!ENABLE_LOADING_SCREEN) return () => {};
    const loadingText = document.getElementById('loading-text');
    const message = " loading maptap! ";
    let animating = true;

    // Create spans for each character
    loadingText.innerHTML = '';
    const spans = [];
    for (let i = 0; i < message.length; i++) {
        const span = document.createElement('span');
        span.textContent = message[i];
        span.style.transition = 'color 0.2s ease';
        span.style.color = '#44f8fb';  // Start with normal color
        loadingText.appendChild(span);
        spans.push(span);
    }

    function animate() {
        if (!animating) return;

        // Start animation quickly - within 100ms
        setTimeout(() => {
            if (!animating) return;

            // Forward color wave
            let i = 0;
            let lastFrame = 0;

            function colorForward(currentTime) {
                if (!animating) return;
                if (lastFrame === 0) lastFrame = currentTime;

                if (currentTime - lastFrame >= 30) {  // 30ms per character
                    if (i < spans.length) {
                        // Brighten current character
                        spans[i].style.color = '#ffffff';
                        // Dim previous character back to normal
                        if (i > 0) {
                            spans[i - 1].style.color = '#44f8fb';
                        }
                        i++;
                        lastFrame = currentTime;
                    }
                }

                if (i < spans.length) {
                    requestAnimationFrame(colorForward);
                } else {
                    // Dim the last character
                    spans[spans.length - 1].style.color = '#44f8fb';
                    // Pause then reverse
                    setTimeout(() => {
                        if (!animating) return;
                        reverseColor();
                    }, 400);  // 400ms pause
                }
            }

            function reverseColor() {
                if (!animating) return;
                let j = spans.length - 1;
                let lastReverseFrame = 0;

                function colorBackward(currentTime) {
                    if (!animating) return;
                    if (lastReverseFrame === 0) lastReverseFrame = currentTime;

                    if (currentTime - lastReverseFrame >= 20) {  // 20ms per character (slightly faster)
                        if (j >= 0) {
                            // Brighten current character
                            spans[j].style.color = '#ffffff';
                            // Dim next character back to normal
                            if (j < spans.length - 1) {
                                spans[j + 1].style.color = '#44f8fb';
                            }
                            j--;
                            lastReverseFrame = currentTime;
                        }
                    }

                    if (j >= 0) {
                        requestAnimationFrame(colorBackward);
                    } else {
                        // Dim the first character
                        spans[0].style.color = '#44f8fb';
                        // Pause then restart
                        setTimeout(() => {
                            if (!animating) return;
                            animate();
                        }, 400);  // 400ms pause
                    }
                }

                requestAnimationFrame(colorBackward);
            }

            requestAnimationFrame(colorForward);
        }, 100);  // Start animation within 100ms
    }

    // Start the animation immediately
    animate();

    // Return function to stop animation
    return () => { animating = false; };
}

// Loading screen is disabled, so no need to track loading states
// (Removed loadingStates and checkAllLoaded - feature is disabled)

// Start loading animation (or hide immediately if disabled)
if (!ENABLE_LOADING_SCREEN) {
    // Hide loading screen immediately
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
        overlay.style.display = 'none';
    }
    window.stopLoadingAnimation = () => {};
} else {
    window.stopLoadingAnimation = startLoadingAnimation();

    // Fallback: Hide loading screen after 3 seconds no matter what
    setTimeout(() => {
        const overlay = document.getElementById('loading-overlay');
        if (overlay && overlay.style.display !== 'none') {
            console.log('Loading timeout - forcing overlay hide');
            overlay.style.opacity = '0';
            setTimeout(() => {
                overlay.style.display = 'none';
            }, 500);
            if (window.stopLoadingAnimation) {
                window.stopLoadingAnimation();
            }
        }
    }, 3000);
}
// Signal that game-init.js has finished loading
// ES modules can wait for this before accessing PAGE/PARAMS
window.gameInitReady = true;
console.log('game-init.js loaded, PAGE and PARAMS are now available');

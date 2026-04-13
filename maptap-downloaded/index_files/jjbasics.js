const today = new Date();
const day = today.getDate();
const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const month = monthNames[today.getMonth()];
const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);  // Detect if the user is on a mobile device
let playDay = `${month}${day}`; // used in cookie and storage and reporting.

// Capture the ISO date key once at page load (prevents midnight crossover bugs)
const GAME_DATE_KEY = (() => {
    const year = today.getFullYear();
    const monthNum = today.getMonth() + 1;
    const dayNum = today.getDate();
    return `${year}-${String(monthNum).padStart(2,"0")}-${String(dayNum).padStart(2,"0")}`;
})();

// UTC-aware helper function for game date key (backwards compatible)
function getGameDateKey() {
    if (typeof gameHistory !== 'undefined' && gameHistory.useUtcTime) {
        const now = new Date();
        const year = now.getUTCFullYear();
        const month = now.getUTCMonth() + 1;
        const day = now.getUTCDate();
        return `${year}-${String(month).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
    }
    return GAME_DATE_KEY; // Fallback to original constant
}

const maptap_start = new Date(2024, 5, 21); // MapTap start date (June 21, 2024)

const yesterday = new Date(today);
yesterday.setDate(today.getDate() - 1);
const yesterdayDay = yesterday.getDate();
const yesterdayMonth = monthNames[yesterday.getMonth()];
let yesterdayDate = `${yesterdayMonth}${yesterdayDay}`;

// Update PARAMS based on URL parameters
// usage let PARAMS = { letmeplay: "0", overrideday: "july10" };
// PARAMS = updateParamsFromURL(PARAMS);
// resetstorage = 1 - wipe out the cookies

function updateParamsFromURL(defaultParams) {
    const params = new URLSearchParams(window.location.search);
    Object.keys(defaultParams).forEach(key => {
        const value = params.get(key);
        if (value !== null) {
            defaultParams[key] = value;
        }
    });
    return defaultParams;
}

function timeToMidnight() {  //used to tell user when they can play again.
    const now = new Date();
    let midnight;

    // Use UTC midnight if setting is enabled
    if (typeof gameHistory !== 'undefined' && gameHistory.useUtcTime) {
        const utcNow = new Date();
        midnight = new Date(Date.UTC(utcNow.getUTCFullYear(), utcNow.getUTCMonth(), utcNow.getUTCDate() + 1));
    } else {
        midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    }

    const diff = midnight - now;

    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);

    let result = '';

    if (hours > 0) {
        result += `${hours} hour${hours > 1 ? 's' : ''}`;
    }

    if (minutes > 0) {
        if (result) {
            result += ', ';
        }
        result += `${minutes} min${minutes > 1 ? 's' : ''}`;
    }

    return result;
}


// Analytics sampling: only 1% of sessions send diagnostic events (load_sequence, performance)
// Funnel milestone events send at 2% (enough for debugging with 50k+ DAU)
// Game events (game, social, error, access) always send at 100%
const _ANALYTICS_SAMPLED = Math.random() < 0.01;
const _FUNNEL_SAMPLED = Math.random() < 0.02;
const _FUNNEL_EVENTS = new Set([
    'page_dom_ready', 'globe_script_loaded', 'globe_object_created',
    'globe_ready', 'tileglobe_ready', 'game_finished', 'all_data_loaded'
]);

// reporting
function report(evt, cat, label, value, customProps = {})
{
    let prefix = _ALLOW_REPORTING? "Prod Analytics" : "Test";
    console.log(prefix+ ' Event: '+ evt + ', category:'+ cat+', label:'+ label+', value:'+ value, customProps);

    // Track load sequence events for timeline (always, for local console display)
    if (cat === "load_sequence" && window.loadTimestamps) {
        window.loadTimestamps[evt] = value || performance.now();
    }

    if (!_ALLOW_REPORTING) return;

    // Sample diagnostic events — only 3% of sessions send load_sequence/performance to GA4
    // Funnel milestone events sampled at 5% (enough for debugging)
    if ((cat === "load_sequence" || cat === "performance")) {
        if (_FUNNEL_EVENTS.has(evt)) { if (!_FUNNEL_SAMPLED) return; }
        else { if (!_ANALYTICS_SAMPLED) return; }
    }

    // Extract page source from URL (index.html, adventures.html, beta.html, etc.)
    const pagePath = window.location.pathname;
    const pageSource = pagePath.split('/').pop().replace('.html', '') || 'index';

    // Add detailed browser and version to all events
    const eventData = {
        'event_category': cat,
        'event_label': label,
        'value': value,
        'page_source': pageSource,  // Track which page the event came from
        'detailed_browser': window.MAPTAP_DETAILED_BROWSER || 'unknown',
        'maptap_version': window.GAME_VERSION || window.MAPTAP_VERSION || 'VERSION_MISSING',
        ...customProps
    };

    // Add device capabilities to load_sequence events for globe failure analysis
    if (cat === "load_sequence") {
        // Version tracking moved to universal parameters above

        if (window.DEVICE_CAPABILITIES) {
            // Spread all capabilities
            Object.assign(eventData, window.DEVICE_CAPABILITIES);

            // ALSO explicitly set critical parameters to ensure they're sent
            // This guarantees GA4 receives them even if spreading fails
            eventData.platform = window.DEVICE_CAPABILITIES.platform || 'MISSING';
            eventData.user_agent = window.DEVICE_CAPABILITIES.user_agent || 'MISSING';
            eventData.webgl_supported = window.DEVICE_CAPABILITIES.webgl_supported || 'MISSING';
            eventData.webgl_renderer = window.DEVICE_CAPABILITIES.webgl_renderer || 'MISSING';

            // Add error summary if there are globe errors
            if (window.GLOBE_ERRORS && window.GLOBE_ERRORS.length > 0) {
                eventData.globe_error_count = window.GLOBE_ERRORS.length;
                eventData.first_globe_error = window.GLOBE_ERRORS[0]?.message || 'unknown';
            }
        } else {
            // DEVICE_CAPABILITIES object doesn't exist - this should NEVER happen with our new code
            eventData.platform = 'CAPABILITIES_OBJECT_MISSING';
            eventData.user_agent = 'CAPABILITIES_OBJECT_MISSING';
            eventData.webgl_supported = 'CAPABILITIES_OBJECT_MISSING';
            eventData.webgl_renderer = 'CAPABILITIES_OBJECT_MISSING';
        }
    }

    gtag('event', evt, eventData);
}

// sharing:
function shareHighScoreGeneric(month, day, title, score, message) {
    if (navigator.share) {
        navigator.share({
            title: title, 
            text: message,
 //           url: window.location.href // Optional: include the URL of your game or site
        })
            .then(() => report("share", "social", `Share ${month} ${day}`, score))
            .catch(err => report("fail_to_share_error", "error", `error while sharing`, score));
    } else {
        report("fail_to_share_no_support", "error", `no share support`, score);
    }
}

//text format
function wrapText(text, maxLineLength) {
    let wrappedText = '';
    let lineLength = 0;

    text.split(' ').forEach(word => {
        // Check if word contains manual line breaks
        if (word.includes('(n)')) {
            const parts = word.split('(n)');
            for (let i = 0; i < parts.length; i++) {
                const part = parts[i];
                
                if (i === 0) {
                    // First part continues current line
                    if (lineLength + part.length + 1 > maxLineLength && lineLength > 0) {
                        wrappedText += '\n';
                        lineLength = 0;
                    }
                    wrappedText += (lineLength > 0 ? ' ' : '') + part;
                    lineLength += part.length + (lineLength > 0 ? 1 : 0);
                } else {
                    // Subsequent parts start new lines
                    wrappedText += '\n' + part;
                    lineLength = part.length;
                }
            }
        } else {
            // Normal word processing
            if (lineLength + word.length + 1 > maxLineLength) {
                wrappedText += '\n';
                lineLength = 0;
            }
            wrappedText += (lineLength > 0 ? ' ' : '') + word;
            lineLength += word.length + 1;
        }
    });
    return wrappedText;
}

// Preload sounds via Web Audio API (won't pause background music like Spotify)
function preloadAllSounds() {
    if (typeof SoundManager !== 'undefined') {
        SoundManager.preloadAll();
    }
}

//const emojiScoringOld = Array.from("💩🤮🤢🌑🚯🛑😵😖🤧⛄🌒🤒🤕🙈😪💤😴🥶😶🧊🌓😱😕😞❄😨😰😟🫣😔😥🤐🙊🤫⛅🧐🤨🌤😑️😐🔦🫢🌔🌞🌝🌟🌕😁😂🤗🌞🌝😎🥈🔬🎉🎊🕺💃👑🌡🔥🏹🎖🥇🎯");
const emojiScoring = Array.from("🤮🤮😭😱🤢😝😵🤬🥺🧊😒❄😥🙈😪😴🥶😶😕😞😨😟🫣😔🤫🤨😑😐🫢🙃🙂😁😂🤗🌞👏✨🌟😁🎓🎉👑🏆🏅🔥🎯");
const emojiDigits = Array.from("0️⃣1️⃣2️⃣3️⃣4️⃣5️⃣6️⃣7️⃣8️⃣9️⃣");
function numberToEmoji(number) {
    
    const numberStr = number.toString();
    return numberStr;
    // TODO
    // Replace each digit with its corresponding emoji using the array
    let emojiString = '';
    for (let digit of numberStr) {
        emojiString += emojiDigits[parseInt(digit)];
    }
    return emojiString;
}

function clearGameDataByPrefix(prefix) {
    const keysToRemove = [];

    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(prefix)) {
            keysToRemove.push(key);
        }
    }

    for (const key of keysToRemove) {
        localStorage.removeItem(key);
    }

}

function clearGameDataForDate(overrideDay) {
    // Convert overrideDay (e.g., "September12") to YYYY-MM-DD format
    const m = overrideDay.match(/^([A-Za-z]+)(\d{1,2})$/);
    if (!m) {
        console.warn(`Invalid overrideday format "${overrideDay}" - expected format like "September12"`);
        return;
    }
    
    const [, monthName, dayStr] = m;
    const monthIndex = [
        "January","February","March","April","May","June",
        "July","August","September","October","November","December"
    ].indexOf(monthName) + 1;
    
    if (monthIndex === 0) {
        console.warn(`Invalid month name "${monthName}" in overrideday "${overrideDay}"`);
        return;
    }
    
    const currentYear = new Date().getFullYear();
    const dateKey = `${currentYear}-${String(monthIndex).padStart(2,"0")}-${String(dayStr).padStart(2,"0")}`;
    
    // Clear the specific date from maptap_history
    const historyKey = "maptap_history";
    const historyData = localStorage.getItem(historyKey);
    
    if (historyData) {
        try {
            const history = JSON.parse(historyData);
            if (history[dateKey]) {
                delete history[dateKey];
                localStorage.setItem(historyKey, JSON.stringify(history));
            } else {
            }
        } catch (error) {
            console.error(`Error parsing ${historyKey}:`, error);
        }
    } else {
    }
}

function hasGameData() {
    const prefix = runtime.savePrefix;

    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(prefix)) {
            return true;
        }
    }

    return false;
}

let activeTwoFingerTouch = false;
let activeFingerState = 1;
// touch fixes
document.addEventListener('touchmove', function(event) {
    activeTwoFingerTouch = true;
    activeFingerState++;
});

document.addEventListener('touchstart', function(event) {
    if (activeTwoFingerTouch) activeFingerState++;
});

document.addEventListener('touchend', function(event) {
    if (activeTwoFingerTouch && event.touches.length === 0) {
        let clearTime = isMobile ? 500 : 50;
        setTimeout((fingerStateAtTimeout) => {
            if (activeFingerState === fingerStateAtTimeout) {
                activeTwoFingerTouch = false;
            }
        }, clearTime, activeFingerState);
    }
});

const ART = {
    hexToRgb: function(hex) {
        return [
            parseInt(hex.slice(1, 3), 16),
            parseInt(hex.slice(3, 5), 16),
            parseInt(hex.slice(5, 7), 16)
        ];
    },

    rgbToHex: function(rgb) {
        return '#' + rgb.map(function(x) {
            return x.toString(16).padStart(2, '0');
        }).join('');
    },

    lerp: function(a, b, t) {
        return Math.round(a + (b - a) * t);
    },

    addAlpha: function(hex, alpha){
        return hex + Math.round(alpha*255).toString(16).padStart(2, '0');
    },

    lerpColorHex: function(hex1, hex2, t) {
        var rgb1 = this.hexToRgb(hex1);
        var rgb2 = this.hexToRgb(hex2);
        var lerpedRgb = [
            this.lerp(rgb1[0], rgb2[0], t),
            this.lerp(rgb1[1], rgb2[1], t),
            this.lerp(rgb1[2], rgb2[2], t)
        ];
        return this.rgbToHex(lerpedRgb);
    }
};

// DATA PERSISTENCE & GAME STATE FUNCTIONS

function computeTodayPuzzleId() {
    const msPerDay = 1000 * 60 * 60 * 24;
    let now;

    // Use UTC time if setting is enabled
    if (typeof gameHistory !== 'undefined' && gameHistory.useUtcTime) {
        // Create UTC date at midnight for consistent puzzle ID calculation
        const utcNow = new Date();
        now = new Date(Date.UTC(utcNow.getUTCFullYear(), utcNow.getUTCMonth(), utcNow.getUTCDate()));
    } else {
        now = new Date();
    }

    return Math.floor((now.getTime() - maptap_start.getTime()) / msPerDay);
}

function loadGameData(protoGameData) {
    let history;
    try {
        history = JSON.parse(localStorage.getItem(HISTORY_KEY) || "{}");
    } catch (err) {
        console.warn(`Error parsing ${HISTORY_KEY}, resetting history.`, err);
        history = {};
    }

    const todayKey = getTodayKey(); // e.g. "2025-06-15"
    if (history[todayKey]) {
        return {
            ...protoGameData,
            ...history[todayKey]
        };
    } else {
        return JSON.parse(JSON.stringify(protoGameData));
    }
}

function saveGameData(gameState) {
    const history = JSON.parse(localStorage.getItem(HISTORY_KEY) || "{}");
    const todayKey = getTodayKey(); // e.g. "2025-06-15"
    // Add gameType to track which game mode was played
    history[todayKey] = { ...gameState, gameType: 'daily' };
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));

    // Data merge moved to endGame() to avoid mid-game disruptions
}

function getTodayKey() {
    // 1) if we're overriding, try to build & log the replacement key
    if (PARAMS.overrideday) {
        const today   = new Date();
        const year    = today.getFullYear();
        const month   = today.getMonth() + 1;
        const origKey = `${year}-${String(month).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;

        const m = PARAMS.overrideday.match(/^([A-Za-z]+)(\d{1,2})$/);
        if (m) {
            const [, rawMonthName, dayStr] = m;
            // Normalize to Title Case (e.g. "february" -> "February")
            const monthName = rawMonthName.charAt(0).toUpperCase() + rawMonthName.slice(1).toLowerCase();
            const monthIndex = [
                "January","February","March","April","May","June",
                "July","August","September","October","November","December"
            ].indexOf(monthName) + 1;

            if (monthIndex > 0) {
                const overrideMm = String(monthIndex).padStart(2,"0");
                const overrideDd = String(dayStr).padStart(2,"0");

                // see how many months ahead this is, wrapping past December
                const monthsAhead = (monthIndex - month + 12) % 12;

                // if it falls before this month AND is within the next 3 months, roll to next year
                const overrideYear = (monthIndex < month && monthsAhead > 0 && monthsAhead <= 3)
                    ? year + 1
                    : year;

                const overrideKey = `${overrideYear}-${overrideMm}-${overrideDd}`;
                console.log(
                    `Overriding todayKey: would have used ${origKey}, now using ${overrideKey}`
                );
                return overrideKey;
            }
        }

        console.warn(
            `Invalid overrideday "${PARAMS.overrideday}" — falling back to captured date`
        );
    }

    // 2) Use the date key captured at page load (prevents midnight crossover bugs)
    // If UTC mode is enabled, use UTC-aware version
    if (typeof GAME_DATE_KEY !== 'undefined') {
        return getGameDateKey();
    }

    // 3) Fallback: recalculate (should never happen, but safety net)
    const fallbackToday = new Date();
    const fallbackYear = fallbackToday.getFullYear();
    const fallbackMonth = fallbackToday.getMonth() + 1;
    const fallbackDay = fallbackToday.getDate();
    return `${fallbackYear}-${String(fallbackMonth).padStart(2,"0")}-${String(fallbackDay).padStart(2,"0")}`;
}

function saveGameHistory() {
    const statsKey = runtime.savePrefix + "_stats";
    localStorage.setItem(statsKey, JSON.stringify(gameHistory));
}

function loadGameHistory() {
    const statsKey = runtime.savePrefix + "_stats";
    const defaultHistory = {
        soundEnabled: true,
        soundSetUp: false,
        confirmTapMode: false,
        showGuesses: false,
        scrollSensitivity: 0, // 0 = Normal (Globe.GL default ~0.4), 1 = Fast, 1.5 = Very Fast
        useMiles: false,
        useUtcTime: false, // Goran's worldwide sync feature
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
    const storedData = localStorage.getItem(statsKey);
    if (storedData) {
        const loadedHistory = JSON.parse(storedData);
        // Merge with defaults to ensure new properties exist (like scrollSensitivity)
        return { ...defaultHistory, ...loadedHistory };
    } else {
        return defaultHistory;
    }
}

function getMaptapDateForToday(puzzleId) {
    const msPerDay   = 24 * 60 * 60 * 1000;
    const date       = new Date(maptap_start.getTime() + puzzleId * msPerDay);
    const monthNames = [
        'January','February','March','April','May','June',
        'July','August','September','October','November','December'
    ];
    const monthName = monthNames[date.getMonth()];
    const day       = date.getDate();
    return `${monthName}${day}`;
}

function convertPlayDayToISODate(playDay) {
    // Convert "September9" format to "2025-09-09" format for Firestore storage
    const monthMap = {
        'January': '01', 'February': '02', 'March': '03', 'April': '04',
        'May': '05', 'June': '06', 'July': '07', 'August': '08',
        'September': '09', 'October': '10', 'November': '11', 'December': '12'
    };

    // Extract month name and day from playDay (e.g., "September9")
    const match = playDay.match(/^([A-Za-z]+)(\d+)$/);
    if (!match) return playDay; // fallback to original if format doesn't match

    const [, monthName, day] = match;
    const month = monthMap[monthName];
    if (!month) return playDay; // fallback if month not found

    const year = new Date().getFullYear(); // use current year
    return `${year}-${month}-${String(day).padStart(2, '0')}`;
}

// SHARING & SCORE TEXT FUNCTIONS

function simpleCopyToClipboard() {
    navigator.clipboard.writeText(getScoreText());
    report("share_by_copy", "social", `share by copy`, gameState.finalScore);
    PAGE.toast.style.display = 'block';
    // CPU OPTIMIZATION: Use setTimeout instead of setInterval (was creating infinite timer)
    setTimeout(() => { PAGE.toast.style.display = 'none'; }, 3000);
}

function MakeShareButton() {
    // Adjust Top 10 button position on wide screens
    const topScoresBtn = document.getElementById('top-scores-share-button');
    if (topScoresBtn && window.innerWidth > 500) {
        topScoresBtn.style.left = "calc(50% - 166px)";
    }

    if (!isMobile) {
        PAGE.shareButton.style.display = 'block';
        PAGE.shareButton.addEventListener('click', () => {
            simpleCopyToClipboard();
            triggerTypewriterEffect();
        });
    }
    else if (navigator.share || !_ALLOW_REPORTING)
    {
        // this code executes in ios embedded browsers, android, and desktop
        // the _ALLOW_REPORTING check makes it also execute in local servers for testing.
        PAGE.shareButton.style.display = 'block';
        PAGE.shareButton.addEventListener('click', () => {
            shareHighScore();
            triggerTypewriterEffect();
        });
    }
}

function shareHighScore() {
    shareHighScoreGeneric(month, day, 'Map Tap High Score', gameState.finalScore, getScoreText());
}

function copyHighScore() {
    report("share_by_copy", "social", `share by copy`, gameState.finalScore);
    const button = document.querySelector('button');
    const icon = button.querySelector('.icon');
    navigator.clipboard.writeText(getScoreText()).then(function() {
        button.classList.remove('error');
        button.style.backgroundColor = '#4CAF50'; // Success color
        icon.innerHTML = '&#10003;'; // Checkmark
    }, function(err) {
        console.error('Could not copy text: ', err);
        button.classList.add('error');
        icon.innerHTML = '&#x2757;'; // Exclamation mark
    });
}

function getScoreText() {
    let emoSummary = gameState.roundData
        .filter(item => item.score != null) // Only include items with a non-null score
        .map(item => item.score.toFixed(0) + getEmojiData(item));

    // Use the correct date for sharing: override day > UTC mode > local date
    let shareMonth = month;
    let shareDay = day;
    if (PARAMS.overrideday) {
        const m = PARAMS.overrideday.match(/^([A-Za-z]+)(\d{1,2})$/);
        if (m) {
            shareMonth = m[1];
            shareDay = m[2];
        }
    } else if (typeof gameHistory !== 'undefined' && gameHistory.useUtcTime) {
        const utcNow = new Date();
        shareMonth = monthNames[utcNow.getUTCMonth()];
        shareDay = utcNow.getUTCDate();
    }

    // Single share format for all devices - link first
    const antipodeLabel = gameState.isAntipode ? ' Antipode!' : '';
    return `www.maptap.gg ${shareMonth} ${shareDay}
${emoSummary[0]} ${emoSummary[1]} ${emoSummary[2]} ${emoSummary[3]} ${emoSummary[4]}
Final score: ${gameState.finalScore}${antipodeLabel}`;
}

function scoreTextWithoutLink() {
    let emoSummary = gameState.roundData
        .filter(item => item.score != null) // Only include items with a non-null score
        .map(item => item.score.toFixed(0) + getEmojiData(item));
    const message = `${emoSummary[0]} ${emoSummary[1]} ${emoSummary[2]} ${emoSummary[3]} ${emoSummary[4]}`;
    return message;
}

function getPuzzleDateText(puzzleId) {
    const offset = Number(puzzleId);
    const d = new Date(maptap_start.getTime());

    d.setDate(d.getDate() + offset);

    const monthNames = [
        "January", "February", "March",     "April",
        "May",     "June",     "July",      "August",
        "September","October", "November",  "December"
    ];

    let month = monthNames[d.getMonth()];
    const day   = d.getDate();
    const year  = d.getFullYear();

    // Abbreviate September for display to fit in header
    if (month === "September") {
        month = "Sept";
    }

    return `${month} ${day}, ${year}`;
}


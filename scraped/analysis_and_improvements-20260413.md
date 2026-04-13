# Flattap vs Maptap — Full Source Code Analysis & Improvement Suggestions
_Based on full source of maptap-downloaded/ · April 12, 2026 · Maptap game #660_

---

## Files analysed
- `index.html` (full game loop, scoring, end game, streak, persistence)
- `js/game-init.js` (state, DOM refs, URL params, storage)
- `js/jjbasics.js` (date utils, share text, score text, emoji array, storage r/w)
- `js/ui.js` (score ticker, round dots, colour palette, typewriter, `addScoreDisplay`)
- `js/geography.js` (GeographyService — polygon highlight, country/state detection)
- `js/location-detection.js` (scoring formula, haversine, distance→floatScore)
- `js/geo-utils.js` (desert belt detection)
- `js/utils.js` (UtilsService — userId, game count, `getLocationsForDate`)
- `js/effects.js` (EffectsService — fireworks canvas, drip stars)
- `js/comet-effect.js` (CometEffect + CometManager — shooting stars)
- `js/nag-system.js` (registration & subscription nag prompts)
- `js/xp-config.js` (XP tiers, level formula)
- `js/reward_text.js` (6-tier snarky distance feedback + `finalGradeFlavor`)
- `data/master_locations.js` (1,976 locations)
- `css/game-styles.css` (full UI styles)

---

## 1. Scoring — the real formulas

### Maptap (from `location-detection.js`)
```js
// Haversine great-circle distance in km
function calculateGreatCircleDistanceKm(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2)**2 +
              Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLng/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// Score: exponential decay, max meaningful distance = 16,250 km
function calculateScore(distance) {
    const maxDistance = 16250;
    if (distance >= maxDistance) return distance < 16750 ? 0.01 : 0;
    const scaledDistance = distance / maxDistance;
    return Math.exp(-scaledDistance * 3.5);  // floatScore 0–1
}
```
- Per-round display score: `Math.round(Math.max(0, Math.min(100, 100 * floatScore)))`

### Maptap round multipliers (from `ui.js → getRoundScoreMultiplier`)
```js
function getRoundScoreMultiplier() {
    switch (gameState.round) {
        case 3: return 2;
        case 4:
        case 5: return 3;
        default: return 1;   // rounds 1 & 2
    }
}
```
- **Max score is 1000, not 500**: 100×1 + 100×1 + 100×2 + 100×3 + 100×3 = 1000
- Round colours signal difficulty: green (easy×1) → lavender (×1) → yellow (×2) → orange (×3) → red (×3)

### Flattap (current, `index.html`)
```js
// Euclidean distance on the flat SVG disc (no haversine)
const dist = Math.hypot(mapX - tx, mapY - ty);
const score = Math.max(0, Math.round(
    MAX_ROUND_SCORE * Math.exp(-dist / (DISC_RADIUS * 0.36))
));
```
- Max = 500 (5 × 100, no multipliers)
- No km conversion, distance shown only in abstract "disc-units"

### Suggested improvements
1. **Convert disc-units to km for display** — on the azimuthal equidistant projection each SVG unit = `(Math.PI * 6371) / DISC_RADIUS` km. Show "Off by ~1,450 km" instead of "Off by 0.38 disc-units". -- OK
2. **Add round multipliers** (rounds 3×2, 4-5×3) to raise max to 1000 and create a satisfying score escalation — the visual colour change per round makes this feel rewarding rather than punishing. -- No. Let it as it is. 500 points max for 5 rounds
3. **Consider haversine** — the flat-earth theme actually makes Euclidean distance thematically appropriate, but labelling it in km is still useful. Keep Euclidean internally, just convert the displayed readout. -- OK

---

## 2. Emoji scoring — the real system

### Maptap (from `jjbasics.js`)
```js
const emojiScoring = Array.from("🤮🤮😭😱🤢😝😵🤬🥺🧊😒❄😥🙈😪😴🥶😶😕😞😨😟🫣😔🤫🤨😑😐🫢🙃🙂😁😂🤗🌞👏✨🌟😁🎓🎉👑🏆🏅🔥🎯");

// Used in round breakdown display
function getEmojiFromScore(score) {  // score is 0-100 integer
    let emoIndex = Math.floor((score / 100) * (emojiScoring.length - 1));
    return emojiScoring[Math.min(emojiScoring.length - 1, emoIndex)];
}

// Used in share text — uses raw floatScore (0-1), not integer
function getEmojiData(round) {
    let emoIndex = Math.floor(round.floatScore * emojiScoring.length);
    if (emoIndex === 0) emoIndex += ((round.round + day) % 3); // add variety for terrible scores
    return emojiScoring[emoIndex] ?? "🤯";
}
```
**45 emojis in a continuous gradient** from utterly terrible (🤮🤮😭😱) through mediocre (😶😕) to excellent (👑🏆🏅🔥🎯). The share text uses the continuous float, not just 5 fixed tiers.

### Flattap (current)
```js
function scoreEmoji(s) {
    if (s >= 90) return '🌟';
    if (s >= 70) return '🎯';
    if (s >= 50) return '🗺️';
    if (s >= 25) return '😅';
    return '🙃';
}
```
Only 5 discrete tiers.

### Suggested improvements
1. **Expand to a themed 30–45 emoji gradient** — keep the flat-earth comedy but give more variety. Example gradient from bad to perfect:  
   `🌍🌍😵🤢😭🤬🥺😒😥😪🥶😶😕😞😨😟😔🤫😑😐🙃🙂😁😂🌞🗺️🧭🏅🏆🎯` -- OK
2. **Use `floatScore` not integer score** as the index — scores of 89 and 91 currently get very different emojis but a continuous system makes the gradient feel fair. -- OK

---

## 3. Share text — the real format

### Maptap (from `jjbasics.js → getScoreText()`)
```js
function getScoreText() {
    let emoSummary = gameState.roundData
        .filter(item => item.score != null)
        .map(item => item.score.toFixed(0) + getEmojiData(item));

    const antipodeLabel = gameState.isAntipode ? ' Antipode!' : '';
    return `www.maptap.gg ${shareMonth} ${shareDay}
${emoSummary[0]} ${emoSummary[1]} ${emoSummary[2]} ${emoSummary[3]} ${emoSummary[4]}
Final score: ${gameState.finalScore}${antipodeLabel}`;
}
```
Example output:
```
www.maptap.gg April 12
74🌞 100🎯 96🏅 71😂 64🙃
Final score: 771
```

### Flattap (current)
```
flattap.gg · April 12
74🗺️ 100🌟 96🌟 71🎯 64😅
Final score: 405 / 500
```

### Suggested improvements
1. **Add game number** once daily mode exists: `"Flattap #12 · April 12"` -- OK
2. **Show city names** (or short names) in the final round breakdown so the viewer can see what was guessed — Maptap doesn't do this but it's more fun -- No
3. **Remove `/ 500`** from share text — it gives away the scale and makes low scores look worse; Maptap just shows the raw number -- OK
4. **Add Flattap's current URL**: `https://emibap.github.io/flattap/` -- OK
---

## 4. Snarky feedback text

### Maptap (from `reward_text.js`)
6 tiers of increasingly savage comments based on real km distance:
| Distance | Tier | Example |
|---|---|---|
| 0 (inside polygon) | Perfect | "marry me", "legend", "Can't improve on that." |
| < 300 km | Great | "So close you could join their wifi!", "Are you a descendant of Magellan?" |
| < 900 km | Good | "Just a (month-long) hike away", "Your heart was in the right place. Your finger wasn't." |
| < 2,500 km | So-so | "Right planet! Small victories.", "You and the answer are in a long-distance relationship." |
| < 6,500 km | Bad | "Your mother would be so disappointed.", "Did you fail geography class?" |
| < 13,000 km | Really bad | "Flat Earthers think you nailed it.", "The only thing your guess and the answer share is a planet." |
| ≥ 13,000 km | Worst | "You found the antipode. That's the opposite of the answer. Literally." |

Uses `pickUniqueText()` to avoid repeating the last 3 shown.

### Flattap (current)
Shows only "Off by X disc-units" — no flavour text at all.

### Suggested improvements
1. **Add flat-earth themed snarky text** — this is Flattap's biggest comedy opportunity. The tiers can use disc-unit thresholds (or converted km). Flat-earth specific examples:
   - Perfect: "The ice wall thanks you.", "NASA is furious."
   - Great: "Even the turtles holding up the disc applaud.", "Flat Earth Society wants to know your location."
   - Good: "Closer than most conspiracy theorists manage."
   - So-so: "The edge of the disc is that way. Keep walking."
   - Bad: "Are you looking at the UN logo upside down?"
   - Really bad: "You're basically pointing at the ice wall.", "Even the firmament is laughing."
   - Worst: "Congratulations, you found the antipode. Which shouldn't exist on a flat Earth. Think about it."
--OK 
2. **Add a `finalGradeFlavor(score)` equivalent** for the end-game total — Maptap shows "Geographic Master!" etc. for the final screen. -- OK

---

## 5. Daily game & persistence

### Maptap (from `jjbasics.js` + `index.html`)
```js
const maptap_start = new Date(2024, 5, 21); // June 21, 2024

function computeTodayPuzzleId() {
    const msPerDay = 1000 * 60 * 60 * 24;
    return Math.floor((new Date() - maptap_start) / msPerDay);
}

// Storage key = YYYY-MM-DD
function getTodayKey() { return GAME_DATE_KEY; } // "2026-04-12"

function saveGameData(gameState) {
    const history = JSON.parse(localStorage.getItem(HISTORY_KEY) || "{}");
    history[getTodayKey()] = { ...gameState, gameType: 'daily' };
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

function loadGameData(protoGameData) {
    const history = JSON.parse(localStorage.getItem(HISTORY_KEY) || "{}");
    const todayKey = getTodayKey();
    return history[todayKey] ? { ...protoGameData, ...history[todayKey] } : { ...protoGameData };
}
```
- If `history[todayKey].round >= 6` → game already complete → skip straight to end screen
- Supports `?overrideday=April12` for testing

### Flattap (current)
No persistence, no daily mode — every page load is a fresh random game.

### Suggested improvements
1. **Daily mode with deterministic seeding** — derive a seed from the date and use it to pick cities:
   ```js
   function getDailySeed() {
       const d = new Date();
       return d.getFullYear() * 10000 + (d.getMonth()+1) * 100 + d.getDate();
   }
   function seededRandom(seed) {
       let x = Math.sin(seed) * 10000;
       return x - Math.floor(x);
   }
   ```
   -- OK
2. **Persist game state** in localStorage with a YYYY-MM-DD key — mid-game refresh resumes where the player left off. -- OK
3. **One-play-per-day** — detect `round >= 6` in localStorage and jump to the final screen with a "Come back tomorrow" message and a `timeToMidnight()` countdown (Maptap has this function in jjbasics.js verbatim). -- OK
4. **Game number in header** — `"Flattap #N · April 12"` where N = days since launch. -- OK
5. **Keep a "Practice / Random" mode** alongside daily — a simple second button below the board. -- OK

---

## 6. Streak & personal stats

### Maptap (from `game-init.js` + `endGame()` in `index.html`)
```js
// gameHistory persisted in maptap_stats localStorage key
let gameHistory = {
    highScore: 0,
    streak: 0,
    topTenScores: [],
    oneThousand: 0,
    overNineHundred: 0,
    overEightHundred: 0,
    // ...etc
    lastPlay: ""
};

// In endGame():
if (gameHistory.lastPlay == yesterdayDate) {
    gameHistory.streak++;
} else {
    gameHistory.streak = 1;
}
gameHistory.lastPlay = playDay;
if (gameHistory.highScore < gameState.finalScore) {
    gameHistory.highScore = gameState.finalScore;
}
```

### Flattap (current)
No persistence at all.

### Suggested improvements
1. **localStorage `flattap_stats`** — same pattern as Maptap, no accounts needed:
   ```js
   let gameHistory = { highScore: 0, streak: 0, lastPlay: "" };
   ```
   -- OK
2. **Show streak in header** — "🔥 5" next to the round counter. Reset if player misses a day. -- OK
3. **Personal best banner** — on the final overlay, show "🏆 New personal best!" if `finalScore > gameHistory.highScore`. -- OK
4. **Score distribution buckets** — track `over900`, `over800` etc. to show on a simple "Your stats" modal later. -- OK

---

## 7. Round progress UI

### Maptap (from `ui.js → UI.SetRound`)
```js
UI.SetRound = function(round) {
    let roundData = ["🔘","🔘","🔘","🔘","🔘"];
    roundData[round-1] = "⚪";
    UI.roundSubway.innerHTML = roundData.join("");
}
```
Emojis as progress dots. Also colour-codes the top instruction bar per round: green → lavender → yellow → orange → red.

### Suggested improvements
1. **Round progress dots** — add 5 emoji/SVG dots to Flattap's stats bar. The current "Round X / 5" text works but dots are more glanceable on mobile. -- OK
2. **Colour the prompt bar** by round — a subtle background tint shift as difficulty escalates is great UX signalling. -- OK

---

## 8. Visual effects

### Maptap: three layered effect systems
1. **Fireworks** (`effects.js → EffectsService.launchFireworks(intensity, UI)`) — canvas overlay, particle burst from screen edges, intensity scales with score
2. **Drip stars** (`effects.js → dripStars(count, interval, type)`) — gold or silver stars fall from the score display
3. **Comet effect** (`comet-effect.js → CometManager`):
   - First game ever: always shows a comet
   - Returning user (≥3 days since last play): always shows
   - Otherwise: 25% chance per game (35% MapTap+)
   - Comet chosen between round 2–4 for surprise value

### Flattap (current)
Only the city-name fade-in animation and countdown bar.

### Suggested improvements
1. **Animated result line** — use SVG `stroke-dashoffset` animation to draw the dashed line from guess to target rather than having it pop in instantly. -- OK
2. **Score number bounce** — add a CSS `@keyframes` scale/bounce on the `+score` number when the toast appears. -- OK
3. **"Drip stars" on high scores** — when a round scores ≥ 85, drop 3–5 ⭐ characters from the score counter using the same CSS animation pattern Maptap uses. -- OK
4. **Shooting comet on first play or return** — Maptap's CometEffect is self-contained and fully portable (~300 lines). It's a delightful surprise that costs no ongoing CPU. -- OK but make it easier to toggle off
5. **Fireworks on final score ≥ 800** — the canvas-based fireworks in `effects.js` are also self-contained and paused when tab is hidden. -- OK but for scores > to 399 as the max will be 500

---

## 9. Confirm tap mode

### Maptap (from `game-init.js`)
```js
runtime = {
    awaitingConfirmation: false,
    pendingTapLat: null,
    pendingTapLng: null
};
// Tap → if confirmTapMode → show Clear/Confirm buttons, store pending coords
// Confirm → process guess
// Clear → remove pending marker
```
Called "Lotte's feature" in settings — evidently popular enough to be named after a community member.

### Suggested improvements
1. **Confirm tap mode** — show a draggable pin after tap, with a "Confirm" and "Clear" button. On mobile, fat fingers regularly misfire on a small map. This is the single highest-impact mobile UX improvement possible. -- No
2. Implement as: on click, show a pin SVG circle at click coords, enable the button pair, second click on Confirm calls `resolveRound`. -- No

---

## 10. XP & progression system (from `xp-config.js`)

### Maptap's XP formula
```js
// Score tiers: 90%=tier1, 98%=tier2, 99%=tier3, 100%=tier4
// Daily XP: 5 / 10 / 15 / 20 per round
// Level formula: n(n+1) × 50 total XP needed for level n
function getLevel(xp) {
    return Math.floor((-1 + Math.sqrt(1 + (4 * xp) / 50)) / 2);
}
```

### Suggested improvements for Flattap -- No. Don't do any of this
1. **Location type badge** — since Flattap will expand to monuments, islands, wonders: show a small emoji type icon next to the city name (`🏛️ Acropolis of Athens`). This hints at difficulty without a numerical label.
2. **Difficulty dot** — a coloured dot (🟢 easy / 🟡 medium / 🔴 hard) next to the city name, pulled from the `difficulty` field of the expanded locations data.
3. **XP/levels are complex to build** — skip for now, but saving `topTenScores` and a `streak` to localStorage is a stepping stone to this feature later.

---

## 11. Antipode mode (from `index.html → endGame()`)

```js
// If totalScore < 50 out of 1000, score by proximity to antipodes instead
if (gameState.finalScore < 50) {
    if (totalDistFromAntipode <= 110) gameState.finalScore = -1000;
    else gameState.finalScore = -Math.round(1000 * Math.pow(1 - excess/31623, 2));
}
```
If you're so wrong you're basically hitting the other side of the earth, Maptap converts to "Antipode Hunter" mode with a negative score and a special popup. It's a comedic Easter egg for terrible players.

### Flat-earth equivalent
This is a **golden feature** for Flattap. The flat-earth equivalent could be: if your total score is below some threshold, trigger a "**You found the Ice Wall!**" mode — check how close your guesses were to the outer rim of the disc and score that instead. Award a special "🧊 Ice Wall Hunter" badge. -- No

---

## 12. Location database

### Maptap (from `master_locations.js`)
1,954 active entries with schema `{ id, name, lat, lng, continent, type, difficulty }`:
- 10 types: city, capital, monument, ancient_monument, island, natural_wonder, national_park, religious_site, state_capital, region
- 3 difficulty tiers: easy (729), medium (390), hard (835)
- Names include geographic context: "Ajanta Caves, India" not just "Ajanta Caves"

### Flattap (current `cities.js`)
~150 cities, no type, no difficulty, names without country context.

### Suggested improvements
1. **Adopt the Maptap schema** exactly — `id, name, lat, lng, continent, type, difficulty`. The full `master_locations.js` is already in `maptap-inspiration/`. -- OK
2. **Expand to 300–500 locations** — include 30+ each of islands, monuments, natural wonders, national parks. These are visually distinctive on the flat-earth disc and create memorable moments. -- OK
3. **Names with country context** — "Machu Picchu, Peru" is more interesting and teaches geography. -- OK
4. **Use `difficulty` for daily seeding** — ensure each daily game has a mix of difficulties rather than 5 random picks. -- No. One of each continent is better for this game.
5. **Use `continent` for balance** — try to spread the 5 daily locations across different continents. -- OK

---

## 13. SEO & discoverability

### Maptap `index.html` head tags
```html
<meta name="description" content="Play MapTap - the daily geography game! Find 5 world locations on a 3D globe...">
<meta property="og:title" content="Play MapTap.gg - Daily Geography Game">
<meta property="og:image" content="...banner.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="apple-itunes-app" content="app-id=6755205355">
```

### Flattap (current)
```html
<title>Flatap — the flat-earther Maptap</title>
```
No Open Graph, no Twitter card, no description. When someone shares the URL it shows a blank preview.

### Suggested improvements
1. **Add OG + Twitter meta tags** — 30 minutes of work, massive impact on share virality. -- OK but I don't have a dedicated twitter account yet. Suggest one or else I can use my personal one.
2. **Fix the title typo** — "Flatap" vs "Flattap" in the `<title>` tag. -- OK
3. **Add a banner image** — a flat-earth disc with pins on it makes for a great social share preview. -- OK

---

## 14. Quick wins — ranked by effort × impact

| Priority | Improvement | Effort | Impact |
|---|---|---|---|
| 🔴 **1** | Flat-earth snarky feedback text (distance tiers) | Low | Very High |
| 🔴 **2** | Show distance in km (derive from disc-units) | Very Low | High |
| 🔴 **3** | Fix `<title>` typo ("Flatap" → "Flattap") + add OG meta tags | Very Low | High |
| 🔴 **4** | Show city names in final round breakdown (not just "S1: 85") | Very Low | High |
| 🟠 **5** | Expand `cities.js` with type + difficulty + country context | Medium | Very High |
| 🟠 **6** | Round multipliers (×1/×1/×2/×3/×3 → max 1000) | Low | High |
| 🟠 **7** | Animated SVG result line (stroke-dashoffset) | Low | Medium |
| 🟠 **8** | Round progress dots + colour-tinted prompt bar | Low | Medium |
| 🟡 **9** | Daily game mode (deterministic seeding by date) | Medium | Very High |
| 🟡 **10** | localStorage streak + personal best | Medium | High |
| 🟡 **11** | Confirm tap mode (pin + confirm/clear buttons) | Medium | High |
| 🟡 **12** | Expanded emoji gradient (30–45 emojis, continuous) | Low | Medium |
| 🟢 **13** | "Ice Wall Hunter" antipode-style Easter egg | Medium | High (viral) |
| 🟢 **14** | Comet effect on first play / returning player | Medium | Medium |
| 🟢 **15** | Fireworks canvas on high final score | Medium | Medium |

---

## 15. What Flattap has that Maptap doesn't

- The **flat-earth projection** is the entire identity — never lose this
- **Flat-earth comedy** is under-exploited — lean into it hard at every text touchpoint
- **Simpler codebase** is an asset — the single-file architecture means faster iteration
- The azimuthal equidistant map looks **stunning** and is genuinely educational

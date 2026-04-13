/**
 * Continent Progress - RPG-style XP and Level System
 *
 * Tracks player progress across 7 continents:
 * - Africa, Asia, Europe, Middle_East, North_America, Oceania, South_America
 *
 * XP values are now data-driven via xp-config.js (window.XP_CONFIG)
 * See experience_points.md and practice_xp_overhaul.md for documentation.
 *
 * Level curve: totalXpForLevel(n) = n * (n + 1) * 50
 */

const ContinentProgress = (function() {
    'use strict';

    // ========================================
    // CONSTANTS
    // ========================================

    const CONTINENTS = ['Africa', 'Asia', 'Europe', 'Middle_East', 'North_America', 'Oceania', 'South_America'];

    const CONTINENT_ICONS = {
        Africa: '🌍',
        Asia: '🌏',
        Europe: '🇪🇺',
        Middle_East: '🕌',
        North_America: '🌎',
        Oceania: '🏝️',
        South_America: '🌎'
    };

    // Coordinate bounds for continent determination
    const CONTINENT_BOUNDS = {
        Middle_East: { latMin: 12, latMax: 42, lngMin: 25, lngMax: 63 },
        Europe: { latMin: 35, latMax: 71, lngMin: -25, lngMax: 40 },
        Africa: { latMin: -35, latMax: 37, lngMin: -20, lngMax: 55 },
        Asia: { latMin: -10, latMax: 77, lngMin: 60, lngMax: 180 },
        Oceania: { latMin: -50, latMax: 0, lngMin: 110, lngMax: 180 },
        North_America: { latMin: 7, latMax: 84, lngMin: -170, lngMax: -50 },
        South_America: { latMin: -56, latMax: 13, lngMin: -82, lngMax: -34 }
    };

    // ========================================
    // XP CONFIG (loaded from xp-config.js)
    // Fallback values if xp-config.js not loaded
    // ========================================

    function getConfig() {
        if (window.XP_CONFIG) {
            return window.XP_CONFIG;
        }
        // Fallback defaults (should match xp-config.js)
        console.warn('[ContinentProgress] XP_CONFIG not found, using fallback values');
        return {
            thresholds: { tier1: 89.5, tier2: 97.5, tier3: 98.5, tier4: 99.5 },
            practice: { tier1: 1, tier2: 2, tier3: 3, tier4: 4 },
            personalized: { tier1: 2, tier2: 4, tier3: 6, tier4: 8 },
            daily: { tier1: 5, tier2: 10, tier3: 15, tier4: 20 },
            levelMultiplier: 50
        };
    }

    // ========================================
    // XP / LEVEL CALCULATIONS
    // ========================================

    /**
     * Get level from total XP
     * Formula: n(n+1) × multiplier = xp
     * Solving for n: n = (-1 + sqrt(1 + 4×xp/multiplier)) / 2
     */
    function getLevel(xp) {
        if (xp <= 0) return 0;
        const m = getConfig().levelMultiplier;
        return Math.floor((-1 + Math.sqrt(1 + (4 * xp) / m)) / 2);
    }

    /**
     * Get total XP needed to reach a level
     * Formula: level × (level + 1) × multiplier
     */
    function getXpForLevel(level) {
        const m = getConfig().levelMultiplier;
        return level * (level + 1) * m;
    }

    /**
     * Get detailed progress info for a given XP amount
     */
    function getLevelProgress(xp) {
        const level = getLevel(xp);
        const currentLevelXp = getXpForLevel(level);
        const nextLevelXp = getXpForLevel(level + 1);
        const xpIntoLevel = xp - currentLevelXp;
        const xpNeededForNext = nextLevelXp - currentLevelXp;

        return {
            level,
            currentXp: xp,
            xpIntoLevel,
            xpNeededForNext,
            xpToNextLevel: nextLevelXp - xp,
            progressPercent: xpNeededForNext > 0 ? (xpIntoLevel / xpNeededForNext) * 100 : 100
        };
    }

    /**
     * Calculate XP earned for a score (tiered system)
     * Uses data-driven config from xp-config.js
     * @param {number} score - The accuracy score (0-100)
     * @param {boolean} isDaily - True for daily game, false for practice
     * @returns {number} XP earned
     */
    function calculateXp(score, mode) {
        const config = getConfig();
        const thresholds = config.thresholds;

        // Support legacy boolean parameter and new mode strings
        let modeConfig;
        if (mode === true || mode === 'daily') {
            modeConfig = config.daily;
        } else if (mode === 'personalized') {
            modeConfig = config.personalized;
        } else {
            modeConfig = config.practice;
        }

        // Below minimum threshold = no XP
        if (score < thresholds.tier1) return 0;

        // Tiered XP based on score
        if (score >= thresholds.tier4) return modeConfig.tier4;  // 100%
        if (score >= thresholds.tier3) return modeConfig.tier3;  // 99%+
        if (score >= thresholds.tier2) return modeConfig.tier2;  // 98%+
        return modeConfig.tier1;  // 90%+
    }

    /**
     * Check if a location type qualifies for hard location bonus
     * @deprecated Hard location bonus has been removed
     */
    function isHardLocationType(locationType) {
        return false; // Hard location bonus removed
    }

    // ========================================
    // CONTINENT DETERMINATION
    // ========================================

    // Middle East countries/cities for name-based detection
    const MIDDLE_EAST_NAMES = [
        'israel', 'jerusalem', 'tel aviv', 'turkey', 'ankara', 'istanbul',
        'iran', 'tehran', 'iraq', 'baghdad', 'saudi', 'riyadh', 'egypt', 'cairo',
        'jordan', 'amman', 'lebanon', 'beirut', 'syria', 'damascus',
        'yemen', 'sanaa', 'oman', 'muscat', 'qatar', 'doha',
        'bahrain', 'manama', 'kuwait', 'emirates', 'dubai', 'abu dhabi'
    ];

    /**
     * Get continent from lat/lng coordinates
     * @param {number} lat - Latitude
     * @param {number} lng - Longitude
     * @param {string} name - Optional location name for better detection
     * @returns {string|null} Continent name or null if unknown
     */
    function getContinentFromCoords(lat, lng, name = '') {
        // Name-based detection for Middle East (more accurate than coords alone)
        if (name) {
            const nameLower = name.toLowerCase();
            for (const keyword of MIDDLE_EAST_NAMES) {
                if (nameLower.includes(keyword)) {
                    return 'Middle_East';
                }
            }
        }

        // Check Middle East first (overlaps with Asia/Africa)
        if (lat >= 12 && lat <= 42 && lng >= 25 && lng <= 63) {
            return 'Middle_East';
        }

        // Check other continents
        for (const [continent, bounds] of Object.entries(CONTINENT_BOUNDS)) {
            if (continent === 'Middle_East') continue;
            if (lat >= bounds.latMin && lat <= bounds.latMax &&
                lng >= bounds.lngMin && lng <= bounds.lngMax) {
                return continent;
            }
        }

        // Special cases
        // Caribbean (North America)
        if (lat >= 10 && lat <= 30 && lng >= -90 && lng <= -60) {
            return 'North_America';
        }

        // Pacific islands (Oceania)
        if (lat >= -20 && lat <= 20 && (lng > 150 || lng < -150)) {
            return 'Oceania';
        }

        // Western Russia (Europe)
        if (lat > 50 && lng >= 40 && lng <= 60) {
            return 'Europe';
        }

        // Arctic Europe (Svalbard, North Cape, etc.)
        if (lat > 71 && lat <= 85 && lng >= -25 && lng <= 40) {
            return 'Europe';
        }

        // South American Pacific islands (Galápagos, Easter Island, Cocos Island)
        if (lat >= -56 && lat < 7 && lng >= -120 && lng < -82) {
            return 'South_America';
        }

        // Extended Oceania (Tonga and southern Pacific with negative longitudes)
        if (lat >= -50 && lat < -20 && (lng > 150 || lng < -150)) {
            return 'Oceania';
        }

        // Mid-Atlantic South American islands (Fernando de Noronha)
        if (lat >= -35 && lat <= 13 && lng > -34 && lng < -20) {
            return 'South_America';
        }

        // Catch-all for Asia (remaining Eastern regions)
        if (lng >= 40 && lng <= 180) return 'Asia';
        if (lng >= -180 && lng <= -120 && lat >= 0) return 'Asia';

        return null;
    }

    /**
     * Get continent for a location object
     * Tries: location.continent, then coordinates+name, then master_locations lookup
     */
    function getContinentForLocation(location) {
        // If continent is already set and valid
        if (location.continent && CONTINENTS.includes(location.continent)) {
            return location.continent;
        }

        // Try coordinates with name for better detection
        if (typeof location.lat === 'number' && typeof location.lng === 'number') {
            const continent = getContinentFromCoords(location.lat, location.lng, location.name || '');
            if (continent) return continent;
        }

        // Try master_locations lookup by name
        if (location.name && window.masterLocations) {
            const normalized = location.name.toLowerCase().trim();
            const found = window.masterLocations.find(loc =>
                loc.name.toLowerCase().trim() === normalized
            );
            if (found && found.continent) {
                return found.continent;
            }
        }

        return null;
    }

    // ========================================
    // PENDING XP QUEUE (for batching writes)
    // ========================================

    let pendingXP = {
        Africa: 0, Asia: 0, Europe: 0, Middle_East: 0,
        North_America: 0, Oceania: 0, South_America: 0
    };

    /**
     * Queue XP for a location (called after each round)
     */
    function queueXP(location, score, isDaily) {
        const config = getConfig();
        if (score < config.thresholds.tier1) return;

        const continent = getContinentForLocation(location);
        if (!continent) {
            console.log('[ContinentProgress] Could not determine continent for:', location.name);
            return;
        }

        const xp = calculateXp(score, isDaily);

        pendingXP[continent] += xp;
        console.log(`[ContinentProgress] Queued ${xp} XP for ${continent} (score: ${score})`);
    }

    /**
     * Queue Egg Hunt XP for a location (bypasses score threshold)
     * Used to award bonus XP for achieving negative scores in daily game
     * @param {object} location - Location object with lat/lng
     * @param {number} xpAmount - Direct XP amount to add
     */
    function queueEggHuntXP(location, xpAmount) {
        if (xpAmount <= 0) return;

        const continent = getContinentForLocation(location);
        if (!continent) {
            console.log('[ContinentProgress] Egg Hunt XP: Could not determine continent for:', location.name);
            return;
        }

        pendingXP[continent] += xpAmount;
        console.log(`[ContinentProgress] Queued ${xpAmount} Egg Hunt XP for ${continent}`);
    }

    /**
     * Get current pending XP (for display)
     */
    function getPendingXP() {
        return { ...pendingXP };
    }

    /**
     * Reset pending XP
     */
    function resetPendingXP() {
        pendingXP = {
            Africa: 0, Asia: 0, Europe: 0, Middle_East: 0,
            North_America: 0, Oceania: 0, South_America: 0
        };
    }

    /**
     * Flush pending XP to Firestore
     * Uses window.firestore pattern (modular SDK) for compatibility with beta.html
     */
    async function flushXP() {
        const hasXP = Object.values(pendingXP).some(v => v > 0);
        if (!hasXP) {
            console.log('[ContinentProgress] No pending XP to flush');
            return;
        }

        const user = window.currentAuthUser;
        if (!user) {
            console.log('[ContinentProgress] No user logged in, cannot flush XP');
            return;
        }

        // Check for window.firestore (modular SDK pattern)
        if (!window.firestore || !window.firestore.db) {
            console.error('[ContinentProgress] Firestore not initialized (window.firestore missing)');
            return;
        }

        try {
            const { db, doc, getDoc, setDoc } = window.firestore;
            const docRef = doc(db, 'users', user.uid, 'continentProgress', 'summary');

            // Get existing data
            const docSnap = await getDoc(docRef);
            const existingData = docSnap.exists() ? docSnap.data() : null;

            if (!existingData) {
                // Create initial document
                await setDoc(docRef, {
                    continents: { ...pendingXP },
                    updatedAt: new Date().toISOString(),
                    createdAt: new Date().toISOString()
                });
            } else {
                // Merge with existing data
                const updatedContinents = { ...existingData.continents };
                for (const [continent, xp] of Object.entries(pendingXP)) {
                    if (xp > 0) {
                        updatedContinents[continent] = (updatedContinents[continent] || 0) + xp;
                    }
                }
                await setDoc(docRef, {
                    ...existingData,
                    continents: updatedContinents,
                    updatedAt: new Date().toISOString()
                }, { merge: true });
            }

            console.log('[ContinentProgress] Flushed XP:', pendingXP);
            resetPendingXP();

        } catch (error) {
            console.error('[ContinentProgress] Error flushing XP:', error);
        }
    }

    // ========================================
    // LOADING PROGRESS
    // ========================================

    /**
     * Load user's continent progress from Firestore
     * Uses window.firestore pattern (modular SDK) for compatibility with beta.html
     */
    async function loadProgress() {
        const user = window.currentAuthUser;
        if (!user) return null;

        // Check for window.firestore (modular SDK pattern)
        if (!window.firestore || !window.firestore.db) {
            console.error('[ContinentProgress] Firestore not initialized');
            return null;
        }

        try {
            const { db, doc, getDoc } = window.firestore;
            const docRef = doc(db, 'users', user.uid, 'continentProgress', 'summary');
            const docSnap = await getDoc(docRef);

            if (!docSnap.exists()) {
                // Check if we need to migrate
                return await checkAndMigrate(user.uid);
            }

            const data = docSnap.data();
            const continents = data.continents || {};

            // Ensure all continents exist
            for (const c of CONTINENTS) {
                if (typeof continents[c] !== 'number') {
                    continents[c] = 0;
                }
            }

            // Calculate levels
            const result = {
                continents: {},
                totalXP: 0,
                totalLevel: 0
            };

            for (const [continent, xp] of Object.entries(continents)) {
                const progress = getLevelProgress(xp);
                result.continents[continent] = {
                    xp,
                    level: progress.level,
                    progress: progress
                };
                result.totalXP += xp;
                result.totalLevel += progress.level;
            }

            return result;

        } catch (error) {
            console.error('[ContinentProgress] Error loading progress:', error);
            return null;
        }
    }

    // ========================================
    // MIGRATION
    // ========================================

    /**
     * Check if user needs migration and run it if so
     * Uses window.firestore pattern (modular SDK) for compatibility with beta.html
     *
     * Call this early in beta.html load for logged-in users to ensure
     * historical XP is migrated before new XP is earned.
     */
    async function checkAndMigrate(userId) {
        console.log('[ContinentProgress] Checking if migration needed for', userId);

        if (!window.firestore || !window.firestore.db) {
            console.error('[ContinentProgress] Firestore not initialized');
            return null;
        }

        const { db, doc, getDoc } = window.firestore;

        // First check if migration already happened
        const progressRef = doc(db, 'users', userId, 'continentProgress', 'summary');
        const progressSnap = await getDoc(progressRef);

        if (progressSnap.exists()) {
            const existingData = progressSnap.data();
            if (existingData.migratedAt) {
                console.log('[ContinentProgress] Already migrated at', existingData.migratedAt);
                return existingData; // Already migrated, return existing data
            }
            console.log('[ContinentProgress] Document exists but not migrated yet, will merge');
        }

        // Check if user has any game history to migrate
        const userDocRef = doc(db, 'users', userId);
        const userDocSnap = await getDoc(userDocRef);
        const userData = userDocSnap.exists() ? userDocSnap.data() : {};

        // Look for gameHistory nested object (not flat keys)
        const gameHistory = userData.gameHistory || {};
        const historyKeys = Object.keys(gameHistory);

        if (historyKeys.length === 0) {
            console.log('[ContinentProgress] New user, no history to migrate');
            // Initialize empty progress (only if no document exists)
            if (!progressSnap.exists()) {
                return initializeEmptyProgress(userId);
            }
            return progressSnap.data();
        }

        console.log(`[ContinentProgress] Found ${historyKeys.length} game history entries, migrating...`);

        // Pass existing data so migration can MERGE with it
        const existingContinents = progressSnap.exists() ? progressSnap.data().continents : null;
        return await migrateFromHistory(userId, userData, historyKeys, existingContinents);
    }

    /**
     * Initialize empty progress for new user
     * Uses window.firestore pattern (modular SDK) for compatibility with beta.html
     */
    async function initializeEmptyProgress(userId) {
        if (!window.firestore || !window.firestore.db) {
            console.error('[ContinentProgress] Firestore not initialized');
            return null;
        }

        const { db, doc, setDoc } = window.firestore;

        const emptyProgress = {
            continents: {
                Africa: 0, Asia: 0, Europe: 0, Middle_East: 0,
                North_America: 0, Oceania: 0, South_America: 0
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        const docRef = doc(db, 'users', userId, 'continentProgress', 'summary');
        await setDoc(docRef, emptyProgress);

        return {
            continents: Object.fromEntries(
                CONTINENTS.map(c => [c, { xp: 0, level: 0, progress: getLevelProgress(0) }])
            ),
            totalXP: 0,
            totalLevel: 0
        };
    }

    /**
     * Migrate from game history to continent XP
     * Uses window.firestore pattern (modular SDK) for compatibility with beta.html
     *
     * @param {string} userId - User ID
     * @param {object} userData - User document data
     * @param {array} historyKeys - Keys of game history entries
     * @param {object|null} existingContinents - Existing XP to merge with (if any)
     */
    async function migrateFromHistory(userId, userData, historyKeys, existingContinents = null) {
        if (!window.firestore || !window.firestore.db) {
            console.error('[ContinentProgress] Firestore not initialized');
            return null;
        }

        const { db, doc, setDoc } = window.firestore;

        // Start with existing XP if any (to merge, not replace)
        const continentXP = existingContinents ? { ...existingContinents } : {
            Africa: 0, Asia: 0, Europe: 0, Middle_East: 0,
            North_America: 0, Oceania: 0, South_America: 0
        };

        // Ensure all continents exist
        for (const c of CONTINENTS) {
            if (typeof continentXP[c] !== 'number') {
                continentXP[c] = 0;
            }
        }

        let roundsProcessed = 0;
        let roundsSkipped = 0;

        // Load historical locations lookup
        const historicalLookup = window.historicalLocations || {};

        // Get gameHistory from nested object (not flat keys)
        const gameHistory = userData.gameHistory || {};

        // Helper to convert ISO date to MonthDay format
        function isoToMonthDay(isoDate) {
            const months = ['January','February','March','April','May','June',
                           'July','August','September','October','November','December'];
            if (isoDate.includes('-')) {
                const parts = isoDate.split('-');
                const monthNum = parseInt(parts[1]) - 1;
                const day = parseInt(parts[2]);
                return months[monthNum] + day;
            }
            return isoDate; // Already in MonthDay format
        }

        for (const gameDate of historyKeys) {
            const gameData = gameHistory[gameDate];

            if (!gameData) continue;

            // Data is stored as roundData, not rounds
            const rounds = gameData.roundData || gameData.rounds || [];
            if (!rounds || rounds.length === 0) continue;

            // Convert date format for historical lookup
            const lookupDate = isoToMonthDay(gameDate);
            const dayLocations = historicalLookup[lookupDate] || [];

            for (const round of rounds) {
                // Handle score as string or number
                const score = parseFloat(round.score) || 0;
                if (score < 90) continue;

                let continent = null;

                // Primary method: Use cityLat/cityLng for coordinate-based lookup
                if (round.cityLat && round.cityLng) {
                    continent = getContinentFromCoords(round.cityLat, round.cityLng);
                }

                // Fallback 1: Historical lookup
                if (!continent && dayLocations.length > 0) {
                    const roundNum = parseInt(round.round) || 0;
                    const locData = dayLocations.find(l => l.round === roundNum);
                    if (locData && locData.continent) {
                        continent = locData.continent;
                    }
                }

                // Fallback 2: try city name lookup in master_locations
                if (!continent && round.cityName && window.masterLocations) {
                    const normalized = round.cityName.toLowerCase().trim();
                    const found = window.masterLocations.find(loc =>
                        loc.name.toLowerCase().trim() === normalized
                    );
                    if (found) {
                        continent = found.continent;
                    }
                }

                if (!continent) {
                    roundsSkipped++;
                    continue;
                }

                // Award XP (daily game rate)
                let xp = score >= 99 ? 15 : 10;
                continentXP[continent] += xp;
                roundsProcessed++;
            }
        }

        console.log(`[ContinentProgress] Migration complete: ${roundsProcessed} rounds, ${roundsSkipped} skipped`);

        // Save to Firestore
        const progressData = {
            continents: continentXP,
            migratedAt: new Date().toISOString(),
            migratedFromGames: historyKeys.length,
            migratedRounds: roundsProcessed,
            skippedRounds: roundsSkipped,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        const docRef = doc(db, 'users', userId, 'continentProgress', 'summary');
        await setDoc(docRef, progressData);

        // Return formatted result
        const result = {
            continents: {},
            totalXP: 0,
            totalLevel: 0,
            migrated: true,
            migratedRounds: roundsProcessed
        };

        for (const [continent, xp] of Object.entries(continentXP)) {
            const progress = getLevelProgress(xp);
            result.continents[continent] = {
                xp,
                level: progress.level,
                progress: progress
            };
            result.totalXP += xp;
            result.totalLevel += progress.level;
        }

        return result;
    }

    // ========================================
    // PUBLIC API
    // ========================================

    return {
        // Constants
        CONTINENTS,
        CONTINENT_ICONS,

        // Config (data-driven from xp-config.js)
        getConfig,
        isHardLocationType,

        // XP/Level calculations
        getLevel,
        getXpForLevel,
        getLevelProgress,
        calculateXp,

        // Continent determination
        getContinentFromCoords,
        getContinentForLocation,

        // XP queue
        queueXP,
        queueEggHuntXP,
        getPendingXP,
        resetPendingXP,
        flushXP,

        // Loading/Migration
        loadProgress,
        checkAndMigrate
    };

})();

// Export for use
if (typeof window !== 'undefined') {
    window.ContinentProgress = ContinentProgress;
}

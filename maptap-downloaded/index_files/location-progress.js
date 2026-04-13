/**
 * Location Progress Tracking Module
 *
 * Tracks per-location performance for MapTap+ subscribers to enable
 * personalized practice recommendations.
 *
 * Used by: beta.html (daily game), adventures.html (practice modes)
 */

(function() {
    'use strict';

    // ============================================================
    // CONFIGURATION
    // ============================================================

    const CONFIG = {
        MAX_SCORES_PER_LOCATION: 10,  // Keep last N scores per location
        DEBOUNCE_MS: 2000,            // Wait before flushing to Firestore
        FIRESTORE_PATH: 'practiceProgress/summary'  // Subcollection path under users/{uid}
    };

    // ============================================================
    // INITIALIZATION STATE
    // ============================================================

    let initPromise = null;      // Cached promise for init()
    let isInitialized = false;   // True after init completes
    let initResult = null;       // Cached result: { user, isPremium }

    /**
     * Initialize LocationProgress - waits for auth and subscription to be ready
     * Safe to call multiple times - returns cached promise after first call
     *
     * @returns {Promise<{user: object|null, isPremium: boolean}>}
     */
    async function init() {
        // Return cached promise if already initializing or initialized
        if (initPromise) {
            return initPromise;
        }

        initPromise = _doInit();
        return initPromise;
    }

    /**
     * Internal init implementation
     */
    async function _doInit() {
        console.log('[LocationProgress] Initializing...');
        const startTime = Date.now();

        try {
            // Step 1: Wait for Firebase auth to be available
            await _waitForFirebase();

            // Step 2: Wait for auth state to resolve
            const user = await _waitForAuthState();

            // Step 3: If logged in, initialize subscription
            let isPremium = false;
            if (user) {
                isPremium = await _initializeSubscription();
            }

            // Cache result
            isInitialized = true;
            initResult = { user, isPremium };

            const elapsed = Date.now() - startTime;
            console.log(`[LocationProgress] Initialized in ${elapsed}ms - user: ${user?.email || 'none'}, premium: ${isPremium}`);

            return initResult;

        } catch (error) {
            console.error('[LocationProgress] Init error:', error);
            isInitialized = true;
            initResult = { user: null, isPremium: false };
            return initResult;
        }
    }

    /**
     * Wait for Firebase to be loaded
     */
    function _waitForFirebase() {
        return new Promise((resolve) => {
            const check = () => {
                if (window.firebaseAuth || window.firebaseService?.auth) {
                    resolve();
                } else {
                    setTimeout(check, 50);
                }
            };
            check();
        });
    }

    /**
     * Wait for Firebase auth state to resolve using onAuthStateChanged
     * @returns {Promise<object|null>} - The user object or null
     */
    function _waitForAuthState() {
        return new Promise((resolve) => {
            const auth = window.firebaseAuth || window.firebaseService?.auth;
            const onAuthStateChanged = window.authFunctions?.onAuthStateChanged;

            if (!auth || !onAuthStateChanged) {
                console.warn('[LocationProgress] Firebase auth not available, falling back to polling');
                // Fallback: poll for currentAuthUser
                let attempts = 0;
                const poll = () => {
                    attempts++;
                    if (window.currentAuthUser !== undefined || attempts > 50) {
                        resolve(window.currentAuthUser || null);
                    } else {
                        setTimeout(poll, 100);
                    }
                };
                poll();
                return;
            }

            // Use proper Firebase callback
            console.log('[LocationProgress] Waiting for onAuthStateChanged...');
            const unsubscribe = onAuthStateChanged(auth, (user) => {
                console.log('[LocationProgress] Auth state resolved:', user?.email || 'no user');
                unsubscribe(); // Only need first callback
                resolve(user);
            });

            // Timeout after 5 seconds
            setTimeout(() => {
                console.warn('[LocationProgress] Auth timeout, using current state');
                unsubscribe();
                resolve(window.currentAuthUser || null);
            }, 5000);
        });
    }

    /**
     * Initialize subscription service for logged-in user
     * @returns {Promise<boolean>} - Whether user is premium
     */
    async function _initializeSubscription() {
        if (!window.MapTapSubscription?.initialize) {
            console.log('[LocationProgress] No subscription service, checking cachedUserDocument...');
            // Wait for cachedUserDocument
            let attempts = 0;
            while (!window.cachedUserDocument && attempts < 30) {
                await new Promise(r => setTimeout(r, 100));
                attempts++;
            }
            return isPremiumUser();
        }

        try {
            console.log('[LocationProgress] Initializing subscription service...');
            await window.MapTapSubscription.initialize();
            const premium = window.MapTapSubscription.isSubscribed();
            console.log('[LocationProgress] Subscription initialized, premium:', premium);
            return premium;
        } catch (error) {
            console.warn('[LocationProgress] Subscription init failed:', error.message);
            return false;
        }
    }

    /**
     * Check if init has completed
     * @returns {boolean}
     */
    function isReady() {
        return isInitialized;
    }

    /**
     * Get cached init result (only valid after init completes)
     * @returns {{user: object|null, isPremium: boolean}|null}
     */
    function getInitResult() {
        return initResult;
    }

    /**
     * Get httpsCallable function for Firebase Functions
     * Uses dynamic import to support both beta.html and adventures.html
     * @returns {Promise<Function>} - httpsCallable function
     */
    async function getHttpsCallable() {
        if (!window.firebaseFunctions) {
            throw new Error('Firebase Functions not initialized');
        }
        const { httpsCallable } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js');
        return (fnName) => httpsCallable(window.firebaseFunctions, fnName);
    }

    // ============================================================
    // LOCATION ID NORMALIZATION
    // ============================================================

    /**
     * Normalize a location name to a consistent ID format
     * Must match the Python compile_master_locations.py logic exactly
     *
     * @param {string} name - Location name (e.g., "Paris, France")
     * @returns {string} - Normalized ID (e.g., "paris_france")
     */
    function normalizeLocationId(name) {
        if (!name) return '';

        // Normalize unicode to decomposed form, then remove combining marks (accents)
        let normalized = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

        // Lowercase
        normalized = normalized.toLowerCase();

        // Remove punctuation (keep only alphanumeric and spaces)
        normalized = normalized.replace(/[^\w\s]/g, '');

        // Replace spaces with underscores
        normalized = normalized.replace(/\s+/g, '_').trim();

        return normalized;
    }

    // ============================================================
    // CONTINENT LOOKUP
    // ============================================================

    /**
     * Look up continent for a location from master locations database
     *
     * @param {string} locationId - Normalized location ID
     * @returns {string|null} - Continent name or null if not found
     */
    function getContinentForLocation(locationId) {
        if (!window.masterLocations) {
            console.warn('[LocationProgress] masterLocations not loaded');
            return null;
        }

        const location = window.masterLocations.find(loc => loc.id === locationId);
        return location ? location.continent : null;
    }

    /**
     * Look up continent by location name (normalizes first)
     *
     * @param {string} locationName - Location name
     * @returns {string|null} - Continent name or null if not found
     */
    function getContinentForLocationName(locationName) {
        const locationId = normalizeLocationId(locationName);
        return getContinentForLocation(locationId);
    }

    // ============================================================
    // SCORE QUEUE MANAGEMENT
    // ============================================================

    // Pending scores to be flushed to Firestore
    let pendingScores = [];
    let flushTimeoutId = null;

    /**
     * Queue a location score for later batch write to Firestore
     * Only records for premium subscribers
     *
     * @param {string} locationName - Location name (will be normalized)
     * @param {number} score - Score (0-100)
     * @param {string} gameType - 'daily', 'daily_practice', 'adventure', 'personalized'
     */
    function queueLocationScore(locationName, score, gameType) {
        // Only track for premium subscribers
        if (!isPremiumUser()) {
            return;
        }

        const locationId = normalizeLocationId(locationName);
        if (!locationId || locationId.length < 2) {
            console.warn('[LocationProgress] Invalid location name:', locationName);
            return;
        }

        const continent = getContinentForLocationName(locationName);

        pendingScores.push({
            locationId,
            locationName,
            score: Math.round(Math.max(0, Math.min(100, score))),
            continent: continent || 'Unknown',
            gameType,
            timestamp: Date.now()
        });

        console.log(`[LocationProgress] Queued: ${locationId} = ${score}% (${continent || 'Unknown'})`);

        // Reset debounce timer
        if (flushTimeoutId) {
            clearTimeout(flushTimeoutId);
        }
        flushTimeoutId = setTimeout(() => {
            flushLocationScores();
        }, CONFIG.DEBOUNCE_MS);
    }

    /**
     * Check if current user is a premium subscriber
     * @returns {boolean}
     */
    function isPremiumUser() {
        // Check MapTapSubscription if available
        if (window.MapTapSubscription && typeof window.MapTapSubscription.isSubscribed === 'function') {
            return window.MapTapSubscription.isSubscribed();
        }
        // Fallback: check for premium flag in user data
        if (window.currentAuthUser && window.cachedUserDocument) {
            const userData = window.cachedUserDocument.data ? window.cachedUserDocument.data() : window.cachedUserDocument;
            return userData?.isPremium === true || userData?.subscription?.status === 'active';
        }
        return false;
    }

    /**
     * Flush all pending scores to Firestore
     * Called automatically after debounce, or manually at game end
     *
     * @param {boolean} immediate - If true, use synchronous approach for page unload
     * @returns {Promise<void>}
     */
    async function flushLocationScores(immediate = false) {
        if (pendingScores.length === 0) {
            return;
        }

        const user = window.currentAuthUser;
        if (!user) {
            console.warn('[LocationProgress] No user logged in, clearing pending scores');
            pendingScores = [];
            return;
        }

        // Capture and clear pending scores
        const scoresToFlush = [...pendingScores];
        pendingScores = [];

        if (flushTimeoutId) {
            clearTimeout(flushTimeoutId);
            flushTimeoutId = null;
        }

        console.log(`[LocationProgress] Flushing ${scoresToFlush.length} scores for user ${user.uid.substring(0, 8)}...`);

        try {
            await updatePracticeProgress(user.uid, scoresToFlush);
            console.log('[LocationProgress] Flush complete');
        } catch (error) {
            console.error('[LocationProgress] Flush failed:', error);
            // Re-queue failed scores for retry
            pendingScores = [...scoresToFlush, ...pendingScores];
        }
    }

    // ============================================================
    // FIRESTORE OPERATIONS
    // ============================================================

    /**
     * Update practice progress document with new scores
     *
     * @param {string} userId - Firebase user ID
     * @param {Array} scores - Array of score objects
     */
    async function updatePracticeProgress(userId, scores) {
        if (!window.firestore || !window.firestore.db) {
            console.error('[LocationProgress] Firestore not initialized');
            return;
        }

        const { db, doc, getDoc, setDoc } = window.firestore;

        // Get reference to practice progress document
        const progressRef = doc(db, 'users', userId, CONFIG.FIRESTORE_PATH.split('/')[0], CONFIG.FIRESTORE_PATH.split('/')[1]);

        // Get existing data
        let existingData = { locations: {}, continents: {}, totalAttempts: 0, uniqueLocationsSeen: 0 };
        try {
            const docSnap = await getDoc(progressRef);
            if (docSnap.exists()) {
                existingData = docSnap.data();
            }
        } catch (error) {
            console.warn('[LocationProgress] Could not fetch existing data:', error);
        }

        // Ensure structures exist
        if (!existingData.locations) existingData.locations = {};
        if (!existingData.continents) existingData.continents = {};

        // Process each score
        for (const scoreEntry of scores) {
            const { locationId, score, continent } = scoreEntry;

            // Update location entry
            if (!existingData.locations[locationId]) {
                existingData.locations[locationId] = {
                    scores: [],
                    avgScore: 0,
                    attempts: 0,
                    lastSeen: null
                };
                existingData.uniqueLocationsSeen = (existingData.uniqueLocationsSeen || 0) + 1;
            }

            const locData = existingData.locations[locationId];

            // Add score (keep last N)
            locData.scores.push(score);
            if (locData.scores.length > CONFIG.MAX_SCORES_PER_LOCATION) {
                locData.scores = locData.scores.slice(-CONFIG.MAX_SCORES_PER_LOCATION);
            }

            // Update stats
            locData.attempts = (locData.attempts || 0) + 1;
            locData.avgScore = Math.round(locData.scores.reduce((a, b) => a + b, 0) / locData.scores.length);
            locData.lastSeen = new Date().toISOString();

            // Update continent aggregate
            if (continent && continent !== 'Unknown') {
                if (!existingData.continents[continent]) {
                    existingData.continents[continent] = {
                        avgScore: 0,
                        attempts: 0,
                        locationCount: 0,
                        totalScore: 0
                    };
                }

                const contData = existingData.continents[continent];
                contData.attempts = (contData.attempts || 0) + 1;
                contData.totalScore = (contData.totalScore || 0) + score;
                contData.avgScore = Math.round(contData.totalScore / contData.attempts);

                // Count unique locations per continent (approximate)
                const locationsInContinent = Object.entries(existingData.locations)
                    .filter(([id, data]) => {
                        const loc = window.masterLocations?.find(l => l.id === id);
                        return loc?.continent === continent;
                    }).length;
                contData.locationCount = locationsInContinent;
            }

            existingData.totalAttempts = (existingData.totalAttempts || 0) + 1;
        }

        // Update metadata
        existingData.lastUpdated = new Date().toISOString();

        // Write to Firestore
        await setDoc(progressRef, existingData, { merge: true });
    }

    /**
     * Get practice progress for current user
     *
     * @returns {Promise<Object|null>} - Practice progress data or null
     */
    async function getPracticeProgress() {
        const user = window.currentAuthUser;
        if (!user) return null;

        if (!window.firestore || !window.firestore.db) {
            console.error('[LocationProgress] Firestore not initialized');
            return null;
        }

        const { db, doc, getDoc } = window.firestore;

        try {
            const progressRef = doc(db, 'users', user.uid, CONFIG.FIRESTORE_PATH.split('/')[0], CONFIG.FIRESTORE_PATH.split('/')[1]);
            const docSnap = await getDoc(progressRef);
            return docSnap.exists() ? docSnap.data() : null;
        } catch (error) {
            console.error('[LocationProgress] Error fetching progress:', error);
            return null;
        }
    }

    // ============================================================
    // HISTORY MIGRATION (Firebase Functions)
    // ============================================================

    /**
     * Migrate user's game history into practiceProgress structure
     * Calls the Firebase Function migrateLocationHistory
     *
     * @returns {Promise<Object>} - Migration result
     */
    async function migrateHistory() {
        if (!isPremiumUser()) {
            throw new Error('Premium subscription required');
        }

        const user = window.currentAuthUser;
        if (!user) {
            throw new Error('User not logged in');
        }

        console.log('[LocationProgress] Starting history migration...');

        try {
            const callFunction = await getHttpsCallable();
            const migrateLocationHistory = callFunction('migrateLocationHistory');
            const result = await migrateLocationHistory();

            console.log('[LocationProgress] Migration complete:', result.data);
            return result.data;
        } catch (error) {
            console.error('[LocationProgress] Migration failed:', error);
            throw error;
        }
    }

    /**
     * Get migration status for current user
     *
     * @returns {Promise<Object>} - Migration status
     */
    async function getMigrationStatus() {
        const user = window.currentAuthUser;
        if (!user) {
            return { migrated: false, message: 'User not logged in' };
        }

        // First try: check Firestore directly (faster, no function call needed)
        try {
            const progress = await getPracticeProgress();
            if (progress && progress.lastMigrated) {
                return {
                    migrated: true,
                    lastMigrated: progress.lastMigrated,
                    uniqueLocations: progress.uniqueLocationsSeen,
                    totalAttempts: progress.totalAttempts
                };
            }
            return { migrated: false, message: 'No migration data found' };
        } catch (error) {
            console.warn('[LocationProgress] Firestore check failed, trying function:', error.message);
        }

        // Fallback: use Firebase Function
        try {
            const callFunction = await getHttpsCallable();
            const getLocationMigrationStatus = callFunction('getLocationMigrationStatus');
            const result = await getLocationMigrationStatus();
            return result.data;
        } catch (error) {
            console.error('[LocationProgress] Error getting migration status:', error);
            return { migrated: false, message: error.message };
        }
    }

    // ============================================================
    // PERSONALIZED PRACTICE (Firebase Functions)
    // ============================================================

    /**
     * Get personalized practice locations for current user
     * Calls Firebase Function getPersonalizedPracticeLocations
     *
     * @returns {Promise<Object>} - { locations: [...], cached: bool, date: string }
     */
    async function getPersonalizedLocations() {
        if (!isPremiumUser()) {
            throw new Error('Premium subscription required');
        }

        const user = window.currentAuthUser;
        if (!user) {
            throw new Error('User not logged in');
        }

        console.log('[LocationProgress] Fetching personalized practice locations...');

        try {
            const callFunction = await getHttpsCallable();
            const getLocations = callFunction('getPersonalizedPracticeLocations');
            const result = await getLocations();

            console.log('[LocationProgress] Got locations:', result.data);
            return result.data;
        } catch (error) {
            console.error('[LocationProgress] Failed to get personalized locations:', error);
            throw error;
        }
    }

    /**
     * Get continent progress summary for current user
     *
     * @returns {Promise<Object>} - { continents: {...}, totalAttempts, uniqueLocations }
     */
    async function getContinentProgress() {
        const user = window.currentAuthUser;
        if (!user) {
            throw new Error('User not logged in');
        }

        // Try Firebase Function first
        try {
            const callFunction = await getHttpsCallable();
            const getProgress = callFunction('getContinentProgress');
            const result = await getProgress();
            return result.data;
        } catch (error) {
            console.warn('[LocationProgress] Function call failed, using fallback:', error.message);
        }

        // Fallback: read from Firestore directly
        const progress = await getPracticeProgress();
        if (!progress) {
            return { continents: {}, totalAttempts: 0, uniqueLocations: 0 };
        }

        return {
            continents: progress.continents || {},
            totalAttempts: progress.totalAttempts || 0,
            uniqueLocations: progress.uniqueLocationsSeen || 0,
            lastPractice: progress.lastPersonalizedPractice
        };
    }

    /**
     * Record results from completed personalized practice session
     *
     * @param {Object} results - { locationScores: [...], totalScore, averageScore }
     */
    async function recordPracticeResults(results) {
        const user = window.currentAuthUser;
        if (!user) {
            throw new Error('User not logged in');
        }

        try {
            const callFunction = await getHttpsCallable();
            const recordResults = callFunction('recordPersonalizedPracticeResults');
            await recordResults({ results });
            console.log('[LocationProgress] Practice results recorded');
        } catch (error) {
            console.error('[LocationProgress] Failed to record practice results:', error);
        }
    }

    // ============================================================
    // PAGE UNLOAD HANDLER
    // ============================================================

    // Flush pending scores when leaving page
    if (typeof window !== 'undefined') {
        window.addEventListener('beforeunload', () => {
            if (pendingScores.length > 0) {
                flushLocationScores(true);
            }
        });

        // Also flush on visibility change (mobile browsers)
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden' && pendingScores.length > 0) {
                flushLocationScores(true);
            }
        });
    }

    // ============================================================
    // EXPORT API
    // ============================================================

    window.LocationProgress = {
        // Initialization (call before using other functions)
        init,
        isReady,
        getInitResult,

        // Core functions
        normalizeLocationId,
        queueLocationScore,
        flushLocationScores,

        // Lookup functions
        getContinentForLocation,
        getContinentForLocationName,

        // Data access
        getPracticeProgress,
        isPremiumUser,

        // Migration functions
        migrateHistory,
        getMigrationStatus,

        // Personalized practice functions
        getPersonalizedLocations,
        getContinentProgress,
        recordPracticeResults,

        // For debugging
        getPendingScores: () => [...pendingScores],
        getConfig: () => ({ ...CONFIG })
    };

    console.log('[LocationProgress] Module loaded');

})();

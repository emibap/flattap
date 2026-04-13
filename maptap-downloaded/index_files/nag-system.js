/**
 * MapTap Nag System
 *
 * Encourages anonymous users to register (5+ games) and
 * registered users to subscribe (10+ games).
 *
 * Rules:
 * - Minimum 10 days between any nags
 * - Registration nag: once ever
 * - Subscription nag: once (expandable to 2 later)
 */

(function() {
    'use strict';

    // =============================================================================
    // CONFIGURATION
    // =============================================================================

    const CONFIG = {
        REGISTRATION_NAG_THRESHOLD: 5,   // Games before showing registration nag
        SUBSCRIPTION_NAG_THRESHOLD: 10,  // Games before showing subscription nag
        MAX_SUBSCRIPTION_NAGS: 1,        // Can increase to 2 later
        MIN_DAYS_BETWEEN_NAGS: 10,       // Minimum days between any nags
        NAG_STATE_KEY: 'maptap_nag_state',
        DEBUG: false  // Set via ?nagDebug=1
    };

    // =============================================================================
    // URL PARAMETER HANDLING (for testing)
    // =============================================================================

    const PARAMS = new URLSearchParams(window.location.search);
    const TEST_FORCE_NAG = PARAMS.get('forceNag');           // 'registration' or 'subscription'
    const TEST_MOCK_GAMES = PARAMS.get('mockGamesCompleted'); // number
    const TEST_RESET_STATE = PARAMS.get('resetNagState');     // '1' to reset
    const TEST_DEBUG = PARAMS.get('nagDebug');                // '1' for verbose logging

    if (TEST_DEBUG === '1') {
        CONFIG.DEBUG = true;
    }

    function debug(...args) {
        if (CONFIG.DEBUG) {
            console.log('[NagSystem]', ...args);
        }
    }

    // =============================================================================
    // DATE UTILITIES
    // =============================================================================

    function getTodayDateString() {
        // Use the same format as the rest of MapTap (e.g., "January5")
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                           'July', 'August', 'September', 'October', 'November', 'December'];
        const now = new Date();
        return `${monthNames[now.getMonth()]}${now.getDate()}`;
    }

    function getYesterdayDateString() {
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                           'July', 'August', 'September', 'October', 'November', 'December'];
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        return `${monthNames[yesterday.getMonth()]}${yesterday.getDate()}`;
    }

    // =============================================================================
    // STATE MANAGEMENT
    // =============================================================================

    /**
     * Get nag state from localStorage
     * @param {string} userId - Optional user ID for user-specific key
     */
    function getLocalNagState(userId) {
        try {
            const key = userId ? `${CONFIG.NAG_STATE_KEY}_${userId}` : CONFIG.NAG_STATE_KEY;
            const stored = localStorage.getItem(key);
            if (stored) {
                return JSON.parse(stored);
            }
        } catch (e) {
            console.warn('[NagSystem] Error reading nag state:', e);
        }
        return {
            regNagShown: false,
            subNagCount: 0,
            lastNagDate: null
        };
    }

    /**
     * Save nag state to localStorage
     * @param {Object} state - State to save
     * @param {string} userId - Optional user ID for user-specific key
     */
    function saveLocalNagState(state, userId) {
        try {
            const key = userId ? `${CONFIG.NAG_STATE_KEY}_${userId}` : CONFIG.NAG_STATE_KEY;
            localStorage.setItem(key, JSON.stringify(state));
        } catch (e) {
            console.warn('[NagSystem] Error saving nag state:', e);
        }
    }

    /**
     * Get nag state from Firestore for logged-in users
     * Uses cached user document if available, otherwise falls back to localStorage
     */
    async function getFirestoreNagState(userId) {
        try {
            // Try to get from cached user document first (populated by firebaseService)
            if (window.cachedUserDocument && window.cachedUserDocument.nagState) {
                return window.cachedUserDocument.nagState;
            }

            // Try to get from firebaseService
            if (window.firebaseService && window.firebaseService.getUserData) {
                const userData = await window.firebaseService.getUserData(userId);
                if (userData && userData.nagState) {
                    return userData.nagState;
                }
            }
        } catch (e) {
            debug('Error reading Firestore nag state, using localStorage:', e);
        }

        // Fallback to localStorage with user-specific key
        return getLocalNagState(userId);
    }

    async function saveFirestoreNagState(userId, state) {
        try {
            // Use firebaseService.queueWrite for batched writes
            if (window.firebaseService && window.firebaseService.queueWrite) {
                window.firebaseService.queueWrite(userId, { nagState: state }, true);
                debug('Saved nag state via firebaseService');
            }
        } catch (e) {
            debug('Error saving Firestore nag state:', e);
        }

        // Also save to localStorage as backup (with user-specific key)
        saveLocalNagState(state, userId);
    }

    // =============================================================================
    // GAMES COMPLETED COUNT
    // =============================================================================

    /**
     * Get games completed count for anonymous users from localStorage
     */
    function getLocalGamesCompleted() {
        // Check for test override
        if (TEST_MOCK_GAMES) {
            return parseInt(TEST_MOCK_GAMES, 10);
        }

        try {
            // Use maptap_history which stores completed games keyed by date
            const historyKey = (window.runtime?.savePrefix || 'maptap') + '_history';
            const stored = localStorage.getItem(historyKey);
            if (stored) {
                const history = JSON.parse(stored);
                // Count number of completed games (each key is a date like "2025-01-05")
                return Object.keys(history).length;
            }
        } catch (e) {
            console.warn('[NagSystem] Error reading games completed:', e);
        }
        return 0;
    }

    /**
     * Get games completed count for logged-in users from Firestore
     */
    async function getFirestoreGamesCompleted(userId) {
        // Check for test override
        if (TEST_MOCK_GAMES) {
            return parseInt(TEST_MOCK_GAMES, 10);
        }

        try {
            // Try cached user document first
            if (window.cachedUserDocument && window.cachedUserDocument.gameHistory) {
                return Object.keys(window.cachedUserDocument.gameHistory).length;
            }

            // Try firebaseService
            if (window.firebaseService && window.firebaseService.getUserData) {
                const userData = await window.firebaseService.getUserData(userId);
                if (userData && userData.gameHistory) {
                    return Object.keys(userData.gameHistory).length;
                }
            }
        } catch (e) {
            debug('Error reading Firestore games completed:', e);
        }
        return 0;
    }

    // =============================================================================
    // SUBSCRIPTION STATUS
    // =============================================================================

    async function checkIsSubscribed() {
        // Use the existing subscription system if available
        if (window.MapTapSubscription && typeof window.MapTapSubscription.isSubscribed === 'function') {
            return await window.MapTapSubscription.isSubscribed();
        }

        // Fallback: check cached user document
        const user = window.currentAuthUser;
        if (!user) return false;

        try {
            // Check cached user document
            if (window.cachedUserDocument && window.cachedUserDocument.subscription) {
                const status = window.cachedUserDocument.subscription.status;
                return status === 'active' || status === 'trialing';
            }

            // Try firebaseService
            if (window.firebaseService && window.firebaseService.getUserData) {
                const userData = await window.firebaseService.getUserData(user.uid);
                if (userData && userData.subscription) {
                    const status = userData.subscription.status;
                    return status === 'active' || status === 'trialing';
                }
            }
        } catch (e) {
            debug('Error checking subscription:', e);
        }
        return false;
    }

    // =============================================================================
    // NAG DECISION LOGIC
    // =============================================================================

    /**
     * Determine which nag (if any) should be shown
     * @returns {Promise<{show: boolean, type?: 'registration'|'subscription', reason?: string}>}
     */
    async function shouldShowNag() {
        const today = getTodayDateString();
        const yesterday = getYesterdayDateString();
        const user = window.currentAuthUser;
        const isLoggedIn = !!user;

        debug('Checking nag eligibility...', { today, isLoggedIn, userId: user?.uid });

        // Handle test reset
        if (TEST_RESET_STATE === '1') {
            debug('Resetting nag state (test param)');
            saveLocalNagState({ regNagShown: false, subNagCount: 0, lastNagDate: null });
            if (isLoggedIn) {
                await saveFirestoreNagState(user.uid, { regNagShown: false, subNagCount: 0, lastNagDate: null });
            }
        }

        // Handle forced nag (for testing)
        if (TEST_FORCE_NAG === 'registration' || TEST_FORCE_NAG === 'subscription') {
            debug('Forcing nag (test param):', TEST_FORCE_NAG);
            return { show: true, type: TEST_FORCE_NAG, reason: 'forced_test' };
        }

        // Get nag state
        let nagState;
        if (isLoggedIn) {
            nagState = await getFirestoreNagState(user.uid);
        } else {
            nagState = getLocalNagState();
        }

        debug('Current nag state:', nagState);

        // Rule: Minimum days between nags
        if (nagState.lastNagDate) {
            const lastNag = new Date(nagState.lastNagDate);
            const now = new Date(today);
            const daysSinceLastNag = Math.floor((now - lastNag) / (1000 * 60 * 60 * 24));

            if (daysSinceLastNag < CONFIG.MIN_DAYS_BETWEEN_NAGS) {
                debug(`Only ${daysSinceLastNag} days since last nag, need ${CONFIG.MIN_DAYS_BETWEEN_NAGS}, skipping`);
                return { show: false, reason: 'too_soon', daysSinceLastNag };
            }
        }

        // Get games completed
        let gamesCompleted;
        if (isLoggedIn) {
            gamesCompleted = await getFirestoreGamesCompleted(user.uid);
        } else {
            gamesCompleted = getLocalGamesCompleted();
        }

        debug('Games completed:', gamesCompleted);

        // Registration nag: anonymous users, 5+ games, never shown
        if (!isLoggedIn && gamesCompleted >= CONFIG.REGISTRATION_NAG_THRESHOLD) {
            if (!nagState.regNagShown) {
                debug('Eligible for registration nag');
                return { show: true, type: 'registration', reason: 'eligible' };
            } else {
                debug('Registration nag already shown');
            }
        }

        // Subscription nag: logged in, not subscribed, 10+ games
        if (isLoggedIn && gamesCompleted >= CONFIG.SUBSCRIPTION_NAG_THRESHOLD) {
            const isSubscribed = await checkIsSubscribed();

            if (!isSubscribed && nagState.subNagCount < CONFIG.MAX_SUBSCRIPTION_NAGS) {
                debug('Eligible for subscription nag');
                return { show: true, type: 'subscription', reason: 'eligible' };
            } else if (isSubscribed) {
                debug('User is subscribed, skipping subscription nag');
            } else {
                debug('Max subscription nags reached:', nagState.subNagCount);
            }
        }

        debug('No nag to show');
        return { show: false, reason: 'not_eligible' };
    }

    // =============================================================================
    // NAG RECORDING
    // =============================================================================

    /**
     * Record that a nag was shown
     * @param {'registration'|'subscription'} nagType
     */
    async function recordNagShown(nagType) {
        const today = getTodayDateString();
        const user = window.currentAuthUser;
        const isLoggedIn = !!user;

        debug('Recording nag shown:', nagType);

        // Get current state
        let nagState;
        if (isLoggedIn) {
            nagState = await getFirestoreNagState(user.uid);
        } else {
            nagState = getLocalNagState();
        }

        // Update state
        nagState.lastNagDate = today;
        if (nagType === 'registration') {
            nagState.regNagShown = true;
        } else if (nagType === 'subscription') {
            nagState.subNagCount = (nagState.subNagCount || 0) + 1;
        }

        // Save state
        if (isLoggedIn) {
            await saveFirestoreNagState(user.uid, nagState);
        } else {
            saveLocalNagState(nagState);
        }

        // Also increment analytics
        await incrementNagAnalytics(nagType, 'shown');
    }

    /**
     * Record nag interaction (dismissed, clicked action)
     */
    async function recordNagAction(nagType, action) {
        debug('Recording nag action:', nagType, action);
        await incrementNagAnalytics(nagType, action);
    }

    // =============================================================================
    // ANALYTICS
    // =============================================================================

    async function incrementNagAnalytics(nagType, action) {
        debug('Analytics event:', nagType, action);

        try {
            if (window.firebaseFunctions) {
                const { httpsCallable } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js');
                const incrementNagAnalyticsFn = httpsCallable(window.firebaseFunctions, 'incrementNagAnalytics');
                await incrementNagAnalyticsFn({ nagType, action });
                debug('Analytics incremented via Cloud Function:', nagType, action);
            }
        } catch (e) {
            debug('Analytics error (non-fatal):', e.message);
        }
    }

    // =============================================================================
    // PUBLIC API
    // =============================================================================

    /**
     * Check if a nag should be shown and show it if so
     * Call this at end of game
     */
    async function checkAndShowNag() {
        return null;  // TEMP: Disable all nags

        const result = await shouldShowNag();

        if (result.show) {
            debug('Showing nag:', result.type);
            await showNagModal(result.type);
            await recordNagShown(result.type);
            return result.type;
        }

        return null;
    }

    /**
     * Show a specific nag modal
     * @param {'registration'|'subscription'} nagType
     */
    async function showNagModal(nagType) {
        // Wait for modals to be loaded (they're fetched dynamically)
        if (window.modalsLoaded) {
            try {
                await window.modalsLoaded;
            } catch (e) {
                console.warn('[NagSystem] Modals failed to load:', e);
                return;
            }
        }

        if (nagType === 'registration') {
            showRegistrationNag();
        } else if (nagType === 'subscription') {
            showSubscriptionNag();
        }
    }

    function showRegistrationNag() {
        const gamesPlayed = getLocalGamesCompleted();
        const modal = document.getElementById('registration-nag-modal');
        if (modal) {
            // Update games count in modal
            const countEl = modal.querySelector('.nag-games-count');
            if (countEl) {
                countEl.textContent = gamesPlayed;
            }
            modal.style.display = 'flex';
        } else {
            console.warn('[NagSystem] Registration nag modal not found');
        }
    }

    function showSubscriptionNag() {
        const modal = document.getElementById('subscription-nag-modal');
        if (modal) {
            modal.style.display = 'flex';
        } else {
            console.warn('[NagSystem] Subscription nag modal not found');
        }
    }

    /**
     * Handle registration nag dismiss
     */
    async function dismissRegistrationNag() {
        const modal = document.getElementById('registration-nag-modal');
        if (modal) {
            modal.style.display = 'none';
        }
        await recordNagAction('registration', 'dismissed');
    }

    /**
     * Handle registration nag action (create account clicked)
     */
    async function handleRegistrationAction() {
        await recordNagAction('registration', 'clickedRegister');
        // The actual registration flow is handled elsewhere
        // Just close the modal
        const modal = document.getElementById('registration-nag-modal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    /**
     * Handle subscription nag dismiss
     */
    async function dismissSubscriptionNag() {
        const modal = document.getElementById('subscription-nag-modal');
        if (modal) {
            modal.style.display = 'none';
        }
        await recordNagAction('subscription', 'dismissed');
    }

    /**
     * Handle subscription nag action (start trial clicked)
     */
    async function handleSubscriptionAction() {
        await recordNagAction('subscription', 'clickedTrial');

        // Start checkout with trial
        if (window.MapTapSubscription && typeof window.MapTapSubscription.startCheckout === 'function') {
            // Close modal first
            const modal = document.getElementById('subscription-nag-modal');
            if (modal) {
                modal.style.display = 'none';
            }
            // Start checkout with trial flag
            await window.MapTapSubscription.startCheckout('monthly', true); // true = withTrial
        } else {
            console.warn('[NagSystem] Subscription system not available');
        }
    }

    /**
     * Reset nag state (for testing)
     */
    async function reset() {
        saveLocalNagState({ regNagShown: false, subNagCount: 0, lastNagDate: null });
        const user = window.currentAuthUser;
        if (user) {
            await saveFirestoreNagState(user.uid, { regNagShown: false, subNagCount: 0, lastNagDate: null });
        }
        debug('Nag state reset');
    }

    /**
     * Get current nag state (for debugging)
     */
    async function getState() {
        const user = window.currentAuthUser;
        if (user) {
            return await getFirestoreNagState(user.uid);
        }
        return getLocalNagState();
    }

    /**
     * Force show a nag (for testing)
     */
    async function forceShow(nagType) {
        await showNagModal(nagType);
    }

    // =============================================================================
    // EXPOSE PUBLIC API
    // =============================================================================

    window.MapTapNag = {
        checkAndShowNag,
        forceShow,
        reset,
        getState,
        dismissRegistrationNag,
        handleRegistrationAction,
        dismissSubscriptionNag,
        handleSubscriptionAction,
        // For debugging
        _shouldShowNag: shouldShowNag,
        _getLocalGamesCompleted: getLocalGamesCompleted,
        _config: CONFIG
    };

    debug('Nag system initialized');

})();

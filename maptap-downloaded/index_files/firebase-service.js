/**
 * Firebase Service Module
 * Handles Firebase configuration, authentication, and data synchronization
 */

class FirebaseService {
    constructor() {
        this.app = null;
        this.db = null;
        this.auth = null;
        this.googleProvider = null;
        this.currentUser = null;
        this.authStateResolved = false;

        // Write batching system - reduces Firestore write costs
        this.pendingWrites = new Map(); // userId -> {updates: {}, timeoutId: number}
        this.DEBOUNCE_MS = 2000; // Wait 2 seconds to batch writes
        this.setupUnloadHandler();
    }

    /**
     * Setup handler to flush pending writes on page unload
     */
    setupUnloadHandler() {
        if (typeof window !== 'undefined') {
            window.addEventListener('beforeunload', () => {
                this.flushAllPendingWrites(true); // Synchronous flush
            });

            // Also flush on visibility change (mobile browsers)
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'hidden') {
                    this.flushAllPendingWrites(true);
                }
            });
        }
    }

    /**
     * Queue a write operation for batching
     * @param {string} userId
     * @param {Object} updates - Field updates to merge
     * @param {boolean} immediate - If true, skip debouncing
     */
    queueWrite(userId, updates, immediate = false) {
        if (!userId) {
            console.error('Cannot queue write without userId');
            return;
        }

        // Get or create pending write entry
        if (!this.pendingWrites.has(userId)) {
            this.pendingWrites.set(userId, {
                updates: {},
                timeoutId: null
            });
        }

        const pending = this.pendingWrites.get(userId);

        // Merge updates (nested field paths are preserved)
        pending.updates = { ...pending.updates, ...updates };

        // Clear existing timeout
        if (pending.timeoutId) {
            clearTimeout(pending.timeoutId);
        }

        if (immediate) {
            // Execute immediately
            this.flushPendingWrites(userId);
        } else {
            // Debounce: wait for more updates
            pending.timeoutId = setTimeout(() => {
                this.flushPendingWrites(userId);
            }, this.DEBOUNCE_MS);

        }
    }

    // Flush pending writes for a specific user
    async flushPendingWrites(userId) {
        const pending = this.pendingWrites.get(userId);
        if (!pending || Object.keys(pending.updates).length === 0) {
            return;
        }

        try {
            const { doc, setDoc, serverTimestamp } = this._firebaseFunctions;
            const userDocRef = doc(this.db, 'users', userId);


            await setDoc(userDocRef, pending.updates, { merge: true });


            // Clear pending writes
            this.pendingWrites.delete(userId);

            // Update cache if available
            if (window.updateUserDocumentCache) {
                window.updateUserDocumentCache(userId, pending.updates);
            }

        } catch (error) {
            console.error('❌ Error flushing batched writes:', error);
            // Don't delete on error - will retry on next write or unload
        }
    }

    // Flush all pending writes (used on page unload)
    flushAllPendingWrites(synchronous = false) {
        const userIds = Array.from(this.pendingWrites.keys());

        if (userIds.length === 0) return;


        if (synchronous) {
            // Use sendBeacon or synchronous fetch for unload
            userIds.forEach(userId => {
                const pending = this.pendingWrites.get(userId);
                if (pending && Object.keys(pending.updates).length > 0) {
                    // For now, just trigger async (browser will try to complete)
                    this.flushPendingWrites(userId);
                }
            });
        } else {
            // Async flush all
            Promise.all(userIds.map(userId => this.flushPendingWrites(userId)))
                .catch(error => console.error('Error flushing pending writes:', error));
        }
    }

    // Initialize Firebase with configuration
    initialize(firebaseModules) {
        const {
            initializeApp,
            getFirestore,
            getAuth,
            GoogleAuthProvider,
            collection,
            addDoc,
            serverTimestamp,
            doc,
            getDoc,
            updateDoc,
            setDoc,
            signInWithRedirect,
            signOut,
            onAuthStateChanged,
            getRedirectResult,
            signInWithEmailAndPassword,
            createUserWithEmailAndPassword,
            OAuthProvider,
            signInWithPopup
        } = firebaseModules;

        // Firebase configuration
        const firebaseConfig = {
            apiKey: "AIzaSyDvZ5de91CR1yn8OF0doGCg2wIBVpip3Jo",
            authDomain: "jjexperiment-12af6.firebaseapp.com",
            databaseURL: "https://jjexperiment-12af6-default-rtdb.firebaseio.com",
            projectId: "jjexperiment-12af6",
            storageBucket: "jjexperiment-12af6.appspot.com",
            messagingSenderId: "598736859878",
            appId: "1:598736859878:web:4c4e81e3e30b8d9ed48ad4",
            measurementId: "G-M0H6SPLEBJ"
        };

        // Initialize Firebase
        this.app = initializeApp(firebaseConfig);
        this.db = getFirestore(this.app);
        this.auth = getAuth(this.app);
        this.googleProvider = new GoogleAuthProvider();

        // Store Firebase functions for internal use
        this._firebaseFunctions = {
            collection,
            addDoc,
            serverTimestamp,
            doc,
            getDoc,
            updateDoc,
            setDoc,
            signInWithRedirect,
            signOut,
            onAuthStateChanged,
            getRedirectResult,
            signInWithEmailAndPassword,
            createUserWithEmailAndPassword,
            OAuthProvider,
            signInWithPopup
        };

        window.firestore = {
            db: this.db,
            collection,
            addDoc,
            serverTimestamp,
            doc,
            getDoc,
            updateDoc,
            setDoc
        };
        window.firebaseAuth = this.auth;
        window.googleProvider = this.googleProvider;
        window.authFunctions = {
            signInWithRedirect,
            signOut,
            onAuthStateChanged,
            getRedirectResult,
            signInWithEmailAndPassword,
            createUserWithEmailAndPassword,
            OAuthProvider,
            signInWithPopup
        };
    }

    // Merge game histories (higher score wins)
    mergeGameHistories(localHistory, serverHistory) {
        const merged = { ...localHistory };

        const allDates = new Set([
            ...Object.keys(localHistory),
            ...Object.keys(serverHistory)
        ]);

        let serverWins = 0, localWins = 0, serverAdded = 0, localKept = 0;

        for (const date of allDates) {
            const localData = localHistory[date];
            const serverData = serverHistory[date];

            // Check for valid score (including negative scores for egg hunt feature)
            const hasValidLocal = localData && !isNaN(parseInt(localData.finalScore));
            const hasValidServer = serverData && !isNaN(parseInt(serverData.finalScore));

            if (hasValidLocal && hasValidServer) {
                // Convert to numbers for comparison (handles both string and number types)
                const serverScore = parseInt(serverData.finalScore) || 0;
                const localScore = parseInt(localData.finalScore) || 0;

                // Check if this was admin-edited (has modifiedBy field)
                const wasAdminEdited = serverData.modifiedBy ? true : false;

                if (serverScore > localScore) {
                    merged[date] = { ...serverData };
                    serverWins++;
                } else if (localScore > serverScore) {
                    localWins++;
                } else {
                    localWins++;
                }
            } else if (hasValidServer && !hasValidLocal) {
                merged[date] = { ...serverData };
                serverAdded++;
            } else if (hasValidLocal && !hasValidServer) {
                localKept++;
            } else {
                if (merged[date]) {
                    delete merged[date];
                }
            }
        }

        console.log(`Data merge: ${Object.keys(merged).length} final dates (server wins: ${serverWins}, local wins: ${localWins}, server added: ${serverAdded}, local kept: ${localKept})`);

        return merged;
    }

    /**
     * Update server with merged history
     * @param {Object} user
     * @param {Object} mergedHistory - Merged game history
     */
    async updateServerHistory(user, mergedHistory) {
        try {
            const { doc, setDoc, getDoc, serverTimestamp } = this._firebaseFunctions;
            const userDocRef = doc(this.db, 'users', user.uid);

            // Check if user already has joinDate to avoid overwriting it
            const userDoc = await getDoc(userDocRef);
            const updateData = { gameHistory: mergedHistory };

            // Only set joinDate if it doesn't exist
            if (!userDoc.exists() || !userDoc.data()?.joinDate) {
                updateData.joinDate = serverTimestamp();
                console.log('Setting missing joinDate for user');
            }

            await setDoc(userDocRef, updateData, { merge: true });
        } catch (error) {
            console.error('Error updating server history:', error);
        }
    }

    // Comprehensive data sync that merges local and server data
    async syncDataWithHierarchy(user) {
        try {
            console.log('[SCORE SYNC] Starting data sync for user:', user.uid.substring(0, 8) + '...');

            const localHistoryData = localStorage.getItem('maptap_history');
            const localHistory = localHistoryData ? JSON.parse(localHistoryData) : {};
            console.log('[SCORE SYNC] Local history has', Object.keys(localHistory).length, 'dates');

            const { doc, getDoc } = this._firebaseFunctions;
            const userDocRef = doc(this.db, 'users', user.uid);
            const userDoc = await getDoc(userDocRef);

            let serverHistory = {};
            if (userDoc.exists()) {
                const userData = userDoc.data();
                serverHistory = userData.gameHistory || {};
            }
            console.log('[SCORE SYNC] Server history has', Object.keys(serverHistory).length, 'dates');

            const mergedHistory = this.mergeGameHistories(localHistory, serverHistory);

            console.log('[SCORE SYNC] Merged history has', Object.keys(mergedHistory).length, 'dates');
            console.log('[SCORE SYNC] Updating localStorage with merged data...');
            localStorage.setItem('maptap_history', JSON.stringify(mergedHistory));

            console.log('[SCORE SYNC] Pushing merged data back to server...');
            await this.updateServerHistory(user, mergedHistory);
            console.log('[SCORE SYNC] ✅ Sync complete!');


        } catch (error) {
            console.error('Error in comprehensive data sync:', error);
        }
    }

    // Trigger a full data merge
    async triggerDataMerge(user) {
        if (!user) {
            return;
        }

        try {
            await this.syncDataWithHierarchy(user);
        } catch (error) {
            console.error('Error triggering data merge:', error);
        }
    }

    // Get user data from Firestore
    async getUserData(uid) {
        try {
            const { doc, getDoc } = this._firebaseFunctions;
            const userDocRef = doc(this.db, 'users', uid);
            const userDoc = await getDoc(userDocRef);
            return userDoc.exists() ? userDoc.data() : null;
        } catch (error) {
            console.error('Error fetching user data:', error);
            return null;
        }
    }

    /**
     * Create user with email and password
     * @param {string} email - User email
     * @param {string} password - User password
     * @returns {Promise} UserCredential
     */
    async createUserWithEmailAndPassword(email, password) {
        const { createUserWithEmailAndPassword } = this._firebaseFunctions;
        return await createUserWithEmailAndPassword(this.auth, email, password);
    }

    /**
     * Sign in with email and password
     * @param {string} email - User email
     * @param {string} password - User password
     * @returns {Promise} UserCredential
     */
    async signInWithEmailAndPassword(email, password) {
        const { signInWithEmailAndPassword } = this._firebaseFunctions;
        return await signInWithEmailAndPassword(this.auth, email, password);
    }

    /**
     * Sign out current user
     * @returns {Promise}
     */
    async signOut() {
        const { signOut } = this._firebaseFunctions;
        return await signOut(this.auth);
    }

    /**
     * Sign in with Google redirect
     * @returns {Promise}
     */
    async signInWithGoogleRedirect() {
        const { signInWithRedirect } = this._firebaseFunctions;
        return await signInWithRedirect(this.auth, this.googleProvider);
    }

    /**
     * Save game data to user's Firestore document (with write batching)
     * @param {Object} user
     * @param {string} todayKey (e.g., "2025-10-29")
     * @param {Object} gameState - Game state object
     * @param {boolean} immediate - If true, skip batching and write immediately
     */
    async saveGameToUserAccount(user, todayKey, gameState, immediate = false) {
        try {

            const { serverTimestamp } = this._firebaseFunctions;

            // Prepare updates for batching
            const updates = {
                [`gameHistory.${todayKey}`]: gameState,
                lastSyncDate: serverTimestamp(),
                lastPlayedDate: serverTimestamp()
            };

            // Queue the write (will be batched with badge updates, etc.)
            this.queueWrite(user.uid, updates, immediate);

            // Update cache immediately (optimistic update)
            if (window.updateUserDocumentCache) {
                // Build updated gameHistory by merging with cached data
                let updatedGameHistory = { [todayKey]: gameState };

                // If cache exists, merge with it
                if (window.cachedUserDocument && window.cachedUserDocumentId === user.uid) {
                    const cachedData = window.cachedUserDocument.data();
                    updatedGameHistory = {
                        ...(cachedData.gameHistory || {}),
                        [todayKey]: gameState
                    };
                }

                window.updateUserDocumentCache(user.uid, {
                    gameHistory: updatedGameHistory,
                    lastPlayedDate: new Date()
                });
            }

        } catch (error) {
            console.error('❌ Error saving game to user account:', error);
        }
    }

    // Update login status indicator with typewriter effect
    updateLoginStatus(user) {
        const loginStatus = document.getElementById('login_status');
        if (user) {
            loginStatus.style.display = 'block';

            const text = 'Logged in';
            let playCount = 0;
            const maxPlays = 1;

            function playTypewriterEffect() {
                playCount++;

                loginStatus.innerHTML = text.split('').map(char =>
                    char === ' ' ? ' ' : `<span>${char}</span>`
                ).join('');

                loginStatus.classList.add('animate');
                const spans = loginStatus.querySelectorAll('span');
                spans.forEach((span, index) => {
                    span.style.animationDelay = `${index * 0.2}s`;
                });

                setTimeout(() => {
                    loginStatus.classList.remove('animate');

                    if (playCount < maxPlays) {
                        setTimeout(playTypewriterEffect, 300);
                    }
                }, (spans.length * 200) + 500);
            }

            setTimeout(playTypewriterEffect, 5000);

        } else {
            loginStatus.style.display = 'none';
        }
    }

    /**
     * Setup auth state listener
     * @param {Function} onUserChange - Callback for when auth state changes
     * @param {Object} params - Game parameters (for devmode check)
     */
    setupAuthListener(onUserChange, params) {
        const { onAuthStateChanged, getRedirectResult } = this._firebaseFunctions;

        // Check for redirect result from Google Sign-In
        getRedirectResult(this.auth).then((result) => {
            if (result && result.user) {
            }
        }).catch((error) => {
            console.error('Error handling redirect result:', error);
        });

        // Listen for auth state changes
        onAuthStateChanged(this.auth, (user) => {
            this.currentUser = user;
            this.authStateResolved = true;
            window.currentAuthUser = user;
            window.authStateResolved = true;

            // Update GA4 user_id: use Firebase UID when authenticated, fall back to localStorage ID
            if (typeof gtag === 'function') {
                const userId = user ? user.uid : localStorage.getItem('maptap_user_id');
                if (userId) {
                    gtag('set', { 'user_id': userId });
                }
            }

            this.updateLoginStatus(user);

            if (onUserChange) {
                onUserChange(user, params);
            }
        });
    }
}

// Export for use in beta.html
window.FirebaseService = FirebaseService;

// Export write batching function globally for other modules (badge-system.js, etc.)
window.queueFirestoreWrite = function(userId, updates, immediate = false) {
    if (window.firebaseService) {
        window.firebaseService.queueWrite(userId, updates, immediate);
    } else {
        console.error('FirebaseService not initialized - cannot queue write');
    }
};